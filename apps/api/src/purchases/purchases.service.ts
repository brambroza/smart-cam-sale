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

  /** Back-office overview: totals per day + best sellers over the window. */
  async summary(days = 7) {
    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 24 * 3600 * 1000);
    const purchases = await this.prisma.purchase.findMany({
      where: { boughtAt: { gte: since } },
      select: { total: true, boughtAt: true },
    });
    const byDay = new Map<string, { total: number; count: number }>();
    for (const p of purchases) {
      const day = p.boughtAt.toISOString().slice(0, 10);
      const row = byDay.get(day) ?? { total: 0, count: 0 };
      row.total += p.total;
      row.count += 1;
      byDay.set(day, row);
    }
    const topItems = await this.prisma.purchaseItem.groupBy({
      by: ['productId'],
      where: { purchase: { boughtAt: { gte: since } } },
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
      totalSales: purchases.reduce((s, p) => s + p.total, 0),
      purchaseCount: purchases.length,
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
