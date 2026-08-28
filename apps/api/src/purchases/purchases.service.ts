import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface PurchaseItemInput {
  productId: string;
  qty: number;
}

// 1 point per 10 THB spent, floored — the welcome bonus elsewhere is separate.
const THB_PER_POINT = 10;

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: { memberId: string; items: PurchaseItemInput[]; storeCode?: string }) {
    if (!input.items?.length) throw new BadRequestException('ต้องมีสินค้าอย่างน้อย 1 รายการ');

    const member = await this.prisma.member.findUnique({ where: { id: input.memberId } });
    if (!member) throw new NotFoundException('ไม่พบสมาชิก');

    const ids = input.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: ids } } });
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

    const [purchase, updatedMember] = await this.prisma.$transaction([
      this.prisma.purchase.create({
        data: {
          memberId: input.memberId,
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

  recent(take = 20) {
    return this.prisma.purchase.findMany({
      orderBy: { boughtAt: 'desc' },
      take: Math.min(take, 100),
      include: {
        member: { select: { id: true, displayName: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });
  }
}
