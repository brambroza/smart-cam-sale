import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { RecommendedProduct } from '@smart-cam/shared-types';

type Tod = 'morning' | 'afternoon' | 'evening' | 'night';

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async forMember(memberId: string, tod: Tod, orgId: string): Promise<RecommendedProduct[]> {
    const since = new Date(Date.now() - 90 * 86400000);
    const history = await this.prisma.purchase.findMany({
      where: { memberId, boughtAt: { gte: since } },
      include: { items: { include: { product: true } } },
    });

    const scored = new Map<
      string,
      { name: string; price: number; category: string; imageUrl?: string; score: number; reason: string }
    >();

    for (const p of history) {
      const pTod = timeBucket(p.boughtAt);
      const timeBoost = pTod === tod ? 1.5 : 1;
      for (const it of p.items) {
        const cur = scored.get(it.productId);
        const inc = timeBoost;
        if (cur) {
          cur.score += inc;
        } else {
          scored.set(it.productId, {
            name: it.product.name,
            price: it.product.price,
            category: it.product.category,
            imageUrl: it.product.imageUrl ?? undefined,
            score: inc,
            reason: pTod === tod ? `ลูกค้ามักซื้อในช่วง${todLabel(tod)}` : 'ซื้อประจำ',
          });
        }
      }
    }

    // basket affinity: products bought together
    const productIds = Array.from(scored.keys());
    if (productIds.length) {
      // co-purchase stats stay inside the org — no cross-tenant signal leak
      const co = await this.prisma.$queryRawUnsafe<{ productId: string; count: bigint }[]>(
        `SELECT pi2."productId", COUNT(*)::bigint AS count
         FROM "PurchaseItem" pi1
         JOIN "PurchaseItem" pi2 ON pi1."purchaseId" = pi2."purchaseId" AND pi1."productId" <> pi2."productId"
         JOIN "Purchase" pu ON pu."id" = pi1."purchaseId"
         WHERE pi1."productId" = ANY($1::text[]) AND pu."orgId" = $2
         GROUP BY pi2."productId"
         ORDER BY count DESC
         LIMIT 5`,
        productIds,
        orgId,
      );
      for (const r of co) {
        if (scored.has(r.productId)) continue;
        const prod = await this.prisma.product.findFirst({ where: { id: r.productId, orgId } });
        if (!prod) continue;
        scored.set(r.productId, {
          name: prod.name,
          price: prod.price,
          category: prod.category,
          imageUrl: prod.imageUrl ?? undefined,
          score: Number(r.count) * 0.4,
          reason: 'คนที่ซื้อของแบบเดียวกันมักซื้อคู่กัน',
        });
      }
    }

    return Array.from(scored.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 3)
      .map(([productId, v]) => ({
        productId,
        name: v.name,
        price: v.price,
        imageUrl: v.imageUrl,
        reason: v.reason,
        score: Math.min(1, v.score / 5),
        category: v.category,
      }));
  }

  async forGuest(age: number, gender: string, tod: Tod, orgId: string): Promise<RecommendedProduct[]> {
    const products = await this.prisma.product.findMany({
      where: {
        orgId,
        active: true,
        AND: [
          { OR: [{ targetGender: gender as any }, { targetGender: 'unknown' }] },
          { OR: [{ minAge: null }, { minAge: { lte: age } }] },
          { OR: [{ maxAge: null }, { maxAge: { gte: age } }] },
        ],
      },
    });

    const scored = products.map((p) => {
      let s = 0.5;
      if (p.timeOfDay === tod) s += 0.4;
      if (p.timeOfDay === 'any') s += 0.15;
      if (p.targetGender === gender) s += 0.25;
      return {
        productId: p.id,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl ?? undefined,
        category: p.category,
        score: s + Math.random() * 0.1,
        reason:
          p.timeOfDay === tod
            ? `ยอดนิยมในช่วง${todLabel(tod)}`
            : p.targetGender === gender
              ? `เหมาะกับลูกค้ากลุ่มนี้`
              : 'ขายดีตลอด',
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 3);
  }
}

function timeBucket(d: Date): Tod {
  const h = d.getHours();
  if (h < 11) return 'morning';
  if (h < 16) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}
function todLabel(t: Tod) {
  return { morning: 'เช้า', afternoon: 'บ่าย', evening: 'เย็น', night: 'ค่ำ' }[t];
}
