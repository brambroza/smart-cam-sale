import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { wasAssisted } from '../common/attribution';
import { buildPromptPayPayload } from '../common/promptpay.util';

// Shop days close on Bangkok time regardless of where the server runs.
const BANGKOK_OFFSET = '+07:00';

export interface PurchaseItemInput {
  productId: string;
  qty: number;
}

// 1 point per 10 THB spent, floored — the welcome bonus elsewhere is separate.
const THB_PER_POINT = 10;

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    input: { memberId: string; items: PurchaseItemInput[]; storeCode?: string },
    orgId: string,
  ) {
    if (!input.items?.length) throw new BadRequestException('ต้องมีสินค้าอย่างน้อย 1 รายการ');

    const member = await this.prisma.member.findFirst({
      where: { id: input.memberId, orgId },
    });
    if (!member) throw new NotFoundException('ไม่พบสมาชิก');

    const ids = input.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, orgId },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const item of input.items) {
      if (!byId.has(item.productId)) {
        throw new BadRequestException(`ไม่พบสินค้า: ${item.productId}`);
      }
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
        throw new BadRequestException('จำนวนต้องเป็น 1-99');
      }
    }

    const total = input.items.reduce(
      (sum, item) => sum + byId.get(item.productId)!.price * item.qty,
      0,
    );
    const pointsEarned = Math.floor(total / THB_PER_POINT);
    const assisted = await wasAssisted(this.prisma, orgId, input.memberId);

    const [purchase, updatedMember] = await this.prisma.$transaction([
      this.prisma.purchase.create({
        data: {
          orgId,
          memberId: input.memberId,
          assisted,
          total,
          storeCode: input.storeCode ?? 'main',
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              price: byId.get(item.productId)!.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      }),
      this.prisma.member.update({
        where: { id: input.memberId },
        data: { points: { increment: pointsEarned } },
      }),
    ]);

    return {
      purchaseId: purchase.id,
      assisted,
      total,
      pointsEarned,
      newPointsBalance: updatedMember.points,
      items: purchase.items.map((i) => ({
        productId: i.productId,
        name: i.product.name,
        qty: i.qty,
        price: i.price,
      })),
    };
  }

  /** Back-office overview: totals per day + best sellers, optional per-store filter. */
  async summary(orgId: string, days = 7, store?: string) {
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 24 * 3600 * 1000);
    const purchases = await this.prisma.purchase.findMany({
      where: { orgId, boughtAt: { gte: since }, ...(store ? { storeCode: store } : {}) },
      select: { total: true, boughtAt: true, storeCode: true },
    });
    const byDay = new Map<string, { total: number; count: number }>();
    for (const p of purchases) {
      const day = p.boughtAt.toISOString().slice(0, 10);
      const row = byDay.get(day) ?? { total: 0, count: 0 };
      row.total += p.total;
      row.count += 1;
      byDay.set(day, row);
    }
    const byStore = new Map<string, { total: number; count: number }>();
    for (const p of purchases) {
      const row = byStore.get(p.storeCode) ?? { total: 0, count: 0 };
      row.total += p.total;
      row.count += 1;
      byStore.set(p.storeCode, row);
    }

    const topItems = await this.prisma.purchaseItem.groupBy({
      by: ['productId'],
      where: {
        purchase: { orgId, boughtAt: { gte: since }, ...(store ? { storeCode: store } : {}) },
      },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 5,
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: topItems.map((t) => t.productId) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(products.map((p) => [p.id, p.name]));
    return {
      days,
      store: store ?? null,
      totalSales: purchases.reduce((s, p) => s + p.total, 0),
      purchaseCount: purchases.length,
      byStore: Array.from(byStore.entries())
        .map(([code, v]) => ({ storeCode: code, ...v }))
        .sort((a, b) => b.total - a.total),
      daily: Array.from(byDay.entries())
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      topProducts: topItems.map((t) => ({
        productId: t.productId,
        name: nameOf.get(t.productId) ?? t.productId,
        qty: t._sum.qty ?? 0,
      })),
    };
  }

  /**
   * Abbreviated receipt (ใบเสร็จรับเงินอย่างย่อ — NOT a tax invoice) plus a
   * ready-to-render PromptPay payload when the org has configured one.
   */
  async receipt(purchaseId: string, orgId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id: purchaseId, orgId },
      include: {
        items: { include: { product: { select: { name: true } } } },
        member: { select: { displayName: true, points: true } },
      },
    });
    if (!purchase) throw new NotFoundException('ไม่พบบิลนี้');
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, promptpayId: true },
    });

    let promptpayPayload: string | null = null;
    if (org?.promptpayId) {
      try {
        promptpayPayload = buildPromptPayPayload(org.promptpayId, purchase.total);
      } catch {
        promptpayPayload = null; // bad stored id must never break the receipt
      }
    }

    return {
      shopName: org?.name ?? '',
      receiptNo: purchase.id.slice(-8).toUpperCase(),
      boughtAt: purchase.boughtAt.toISOString(),
      storeCode: purchase.storeCode,
      memberName: purchase.member?.displayName ?? null,
      items: purchase.items.map((i) => ({
        name: i.product.name,
        qty: i.qty,
        price: i.price,
        lineTotal: i.price * i.qty,
      })),
      total: purchase.total,
      pointsEarned: Math.floor(purchase.total / THB_PER_POINT),
      promptpayPayload,
    };
  }

  /** สรุปปิดยอดรายวัน — one Bangkok calendar day, optional per-store. */
  async dayClose(orgId: string, dateStr?: string, store?: string) {
    const date =
      dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
        ? dateStr
        : new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const start = new Date(`${date}T00:00:00${BANGKOK_OFFSET}`);
    const end = new Date(start.getTime() + 24 * 3600 * 1000);

    const where = {
      orgId,
      boughtAt: { gte: start, lt: end },
      ...(store ? { storeCode: store } : {}),
    };
    const purchases = await this.prisma.purchase.findMany({
      where,
      select: { total: true, assisted: true, storeCode: true },
    });

    const total = purchases.reduce((s, p) => s + p.total, 0);
    const assistedBills = purchases.filter((p) => p.assisted);
    const byStore = new Map<string, { total: number; count: number }>();
    for (const p of purchases) {
      const row = byStore.get(p.storeCode) ?? { total: 0, count: 0 };
      row.total += p.total;
      row.count += 1;
      byStore.set(p.storeCode, row);
    }

    const topItems = await this.prisma.purchaseItem.groupBy({
      by: ['productId'],
      where: { purchase: where },
      _sum: { qty: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 5,
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: topItems.map((t) => t.productId) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(products.map((p) => [p.id, p.name]));

    return {
      date,
      store: store ?? null,
      billCount: purchases.length,
      total,
      avgTicket: purchases.length ? total / purchases.length : 0,
      pointsIssued: purchases.reduce((s, p) => s + Math.floor(p.total / THB_PER_POINT), 0),
      assistedBillCount: assistedBills.length,
      assistedTotal: assistedBills.reduce((s, p) => s + p.total, 0),
      byStore: Array.from(byStore.entries())
        .map(([code, v]) => ({ storeCode: code, ...v }))
        .sort((a, b) => b.total - a.total),
      topProducts: topItems.map((t) => ({
        productId: t.productId,
        name: nameOf.get(t.productId) ?? t.productId,
        qty: t._sum.qty ?? 0,
      })),
    };
  }

  recent(orgId: string, take = 20) {
    return this.prisma.purchase.findMany({
      where: { orgId },
      orderBy: { boughtAt: 'desc' },
      take: Math.min(take, 100),
      include: {
        member: { select: { id: true, displayName: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });
  }
}
