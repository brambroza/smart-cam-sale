import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { sha256Hex } from '../common/crypto.util';

export interface PosSaleItem {
  barcode?: string; // matched against Product.sku
  productId?: string; // direct id, if the POS keeps our ids
  name?: string; // used to auto-create an unknown product
  price?: number; // unit price from the POS (required for auto-create)
  qty: number;
}

export interface PosSaleInput {
  memberPhone?: string;
  memberId?: string;
  items: PosSaleItem[];
  externalId?: string; // POS-side receipt id, for the store's own reconciliation
}

const THB_PER_POINT = 10;

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── key management (admin, from the back office) ──

  async createKey(name: string, orgId: string, storeCode?: string) {
    if (!name?.trim()) throw new BadRequestException('ต้องตั้งชื่อ key (เช่น ชื่อสาขา)');
    const rawKey = `pos_${randomBytes(24).toString('hex')}`;
    const row = await this.prisma.posApiKey.create({
      data: {
        orgId,
        name: name.trim(),
        keyHash: sha256Hex(rawKey),
        storeCode: storeCode?.trim() || 'main',
      },
    });
    // rawKey is returned exactly once — only the hash is stored
    return { id: row.id, name: row.name, storeCode: row.storeCode, apiKey: rawKey };
  }

  listKeys(orgId: string) {
    return this.prisma.posApiKey.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        storeCode: true,
        enabled: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
  }

  async setKeyEnabled(id: string, enabled: boolean, orgId: string) {
    const key = await this.prisma.posApiKey.findFirst({ where: { id, orgId } });
    if (!key) throw new NotFoundException('ไม่พบ key นี้');
    await this.prisma.posApiKey.update({ where: { id }, data: { enabled } });
    return { ok: true };
  }

  async deleteKey(id: string, orgId: string) {
    const key = await this.prisma.posApiKey.findFirst({ where: { id, orgId } });
    if (!key) throw new NotFoundException('ไม่พบ key นี้');
    await this.prisma.posApiKey.delete({ where: { id } });
    return { ok: true };
  }

  /** Resolve an x-api-key header to its PosApiKey row (throws 401 otherwise). */
  async verifyKey(rawKey?: string) {
    if (!rawKey) throw new UnauthorizedException('ต้องส่ง header x-api-key');
    const key = await this.prisma.posApiKey.findUnique({ where: { keyHash: sha256Hex(rawKey) } });
    if (!key || !key.enabled) throw new UnauthorizedException('api key ไม่ถูกต้องหรือถูกปิดใช้งาน');
    await this.prisma.posApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    return key;
  }

  // ── sale ingestion ──

  /**
   * Record a sale pushed from a store's POS. Items are matched by barcode
   * (Product.sku) or productId; unknown barcodes auto-create a product (so
   * history stays complete) when the POS sends name+price. Sales without a
   * matching member are acknowledged but not recorded — the value of this
   * system is per-member history.
   */
  async recordSale(input: PosSaleInput, storeCode: string, orgId: string) {
    if (!input.items?.length) throw new BadRequestException('ต้องมีสินค้าอย่างน้อย 1 รายการ');
    for (const item of input.items) {
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
        throw new BadRequestException('จำนวนต่อรายการต้องเป็น 1-99');
      }
      if (!item.barcode && !item.productId) {
        throw new BadRequestException('ทุกรายการต้องมี barcode หรือ productId');
      }
    }

    // resolve member (scoped to the key's org)
    const member = input.memberId
      ? await this.prisma.member.findFirst({ where: { id: input.memberId, orgId } })
      : input.memberPhone
        ? await this.prisma.member.findFirst({
            where: { phone: input.memberPhone.trim(), orgId },
          })
        : null;
    if (!member) {
      return {
        recorded: false,
        reason: 'member_not_found',
        hint: 'ส่ง memberPhone (เบอร์ที่ลงทะเบียนสมาชิก) หรือ memberId มาด้วยจึงจะบันทึกประวัติได้',
      };
    }

    // resolve items → products
    const resolved: { productId: string; price: number; qty: number }[] = [];
    for (const item of input.items) {
      let product = item.productId
        ? await this.prisma.product.findFirst({ where: { id: item.productId, orgId } })
        : await this.prisma.product.findFirst({ where: { sku: item.barcode!, orgId } });
      if (!product) {
        if (!item.name || !(item.price! > 0)) {
          throw new BadRequestException(
            `ไม่รู้จักสินค้า barcode=${item.barcode ?? item.productId} — ส่ง name และ price มาด้วยเพื่อให้ระบบสร้างสินค้าให้อัตโนมัติ`,
          );
        }
        product = await this.prisma.product.create({
          data: {
            orgId,
            name: item.name.trim(),
            category: 'pos_import',
            price: item.price!,
            sku: item.barcode ?? null,
          },
        });
      }
      // trust the POS price when given (promotions/discounts), else our catalog price
      resolved.push({
        productId: product.id,
        price: item.price !== undefined && item.price >= 0 ? item.price : product.price,
        qty: item.qty,
      });
    }

    const total = resolved.reduce((s, r) => s + r.price * r.qty, 0);
    const pointsEarned = Math.floor(total / THB_PER_POINT);

    const [purchase, updatedMember] = await this.prisma.$transaction([
      this.prisma.purchase.create({
        data: {
          orgId,
          memberId: member.id,
          total,
          storeCode,
          items: { create: resolved },
        },
      }),
      this.prisma.member.update({
        where: { id: member.id },
        data: { points: { increment: pointsEarned } },
      }),
    ]);

    return {
      recorded: true,
      purchaseId: purchase.id,
      externalId: input.externalId ?? null,
      member: { id: member.id, displayName: member.displayName },
      total,
      pointsEarned,
      newPointsBalance: updatedMember.points,
    };
  }
}
