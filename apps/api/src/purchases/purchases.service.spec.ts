import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { PrismaService } from '../prisma.service';

const MEMBER = { id: 'm1', displayName: 'เมย์', points: 100 };
const PRODUCTS = [
  { id: 'p1', name: 'ลาเต้เย็น', price: 45 },
  { id: 'p2', name: 'ครัวซองต์', price: 39 },
];

function prismaMock() {
  return {
    member: {
      findFirst: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === MEMBER.id && where.orgId === 'org1' ? MEMBER : null),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...MEMBER, points: MEMBER.points + data.points.increment }),
      ),
    },
    product: { findMany: jest.fn().mockResolvedValue(PRODUCTS) },
    visitLog: { findFirst: jest.fn().mockResolvedValue(null) },
    purchase: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'pur1',
          ...data,
          items: data.items.create.map((i: any, n: number) => ({
            ...i,
            id: `it${n}`,
            product: PRODUCTS.find((p) => p.id === i.productId),
          })),
        }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
}

describe('PurchasesService.record', () => {
  it('computes total from DB prices and floors points (1 per 10 THB)', async () => {
    const svc = new PurchasesService(prismaMock());
    const res = await svc.record(
      {
        memberId: 'm1',
        items: [
          { productId: 'p1', qty: 2 }, // 90
          { productId: 'p2', qty: 1 }, // 39
        ],
      },
      'org1',
    );
    expect(res.total).toBe(129);
    expect(res.pointsEarned).toBe(12); // floor(129/10)
    expect(res.newPointsBalance).toBe(112); // from the transaction's update result
  });

  it('rejects an empty cart', async () => {
    const svc = new PurchasesService(prismaMock());
    await expect(svc.record({ memberId: 'm1', items: [] }, 'org1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects qty outside 1-99 and non-integers', async () => {
    const svc = new PurchasesService(prismaMock());
    for (const qty of [0, 100, 1.5, -1]) {
      await expect(
        svc.record({ memberId: 'm1', items: [{ productId: 'p1', qty }] }, 'org1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('rejects an unknown product', async () => {
    const svc = new PurchasesService(prismaMock());
    await expect(
      svc.record({ memberId: 'm1', items: [{ productId: 'nope', qty: 1 }] }, 'org1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown member', async () => {
    const svc = new PurchasesService(prismaMock());
    await expect(
      svc.record({ memberId: 'ghost', items: [{ productId: 'p1', qty: 1 }] }, 'org1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ROI attribution: marks the bill assisted when the member was recognized recently', async () => {
    const prisma = prismaMock();
    (prisma.visitLog.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
    const svc = new PurchasesService(prisma);
    const res = await svc.record({ memberId: 'm1', items: [{ productId: 'p1', qty: 1 }] }, 'org1');
    expect(res.assisted).toBe(true);
    expect(prisma.purchase.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assisted: true }) }),
    );
    // the attribution query itself must stay org+member scoped with a time window
    const q = (prisma.visitLog.findFirst as jest.Mock).mock.calls[0][0];
    expect(q.where).toMatchObject({ orgId: 'org1', memberId: 'm1', matchedFace: true });
    expect(q.where.visitedAt.gte).toBeInstanceOf(Date);
  });

  it('ROI attribution: bill stays unassisted without a recent recognition', async () => {
    const svc = new PurchasesService(prismaMock());
    const res = await svc.record({ memberId: 'm1', items: [{ productId: 'p1', qty: 1 }] }, 'org1');
    expect(res.assisted).toBe(false);
  });

  it('TENANT ISOLATION: a member of another org is invisible', async () => {
    const svc = new PurchasesService(prismaMock());
    await expect(
      svc.record({ memberId: 'm1', items: [{ productId: 'p1', qty: 1 }] }, 'org-OTHER'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PurchasesService.receipt', () => {
  const PURCHASE = {
    id: 'clx123abcdEFGH99',
    total: 187.5,
    boughtAt: new Date('2026-08-28T10:30:00+07:00'),
    storeCode: 'main',
    member: { displayName: 'เมย์', points: 112 },
    items: [
      { qty: 2, price: 45, product: { name: 'ลาเต้เย็น' } },
      { qty: 1, price: 97.5, product: { name: 'เค้กส้ม' } },
    ],
  };

  function receiptPrisma(opts: { promptpayId?: string | null; purchase?: unknown } = {}) {
    return {
      purchase: {
        findFirst: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.orgId === 'org1' ? (opts.purchase !== undefined ? opts.purchase : PURCHASE) : null,
          ),
        ),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'ร้านกาแฟบ้านสวน',
          promptpayId: opts.promptpayId ?? null,
        }),
      },
    } as unknown as PrismaService;
  }

  it('builds the abbreviated receipt with line totals and points', async () => {
    const svc = new PurchasesService(receiptPrisma());
    const r = await svc.receipt('clx123abcdEFGH99', 'org1');
    expect(r.shopName).toBe('ร้านกาแฟบ้านสวน');
    expect(r.receiptNo).toBe('CDEFGH99'); // last 8 chars of the purchase id, uppercased
    expect(r.items).toEqual([
      { name: 'ลาเต้เย็น', qty: 2, price: 45, lineTotal: 90 },
      { name: 'เค้กส้ม', qty: 1, price: 97.5, lineTotal: 97.5 },
    ]);
    expect(r.total).toBe(187.5);
    expect(r.pointsEarned).toBe(18);
    expect(r.promptpayPayload).toBeNull(); // no PromptPay configured
  });

  it('includes a dynamic PromptPay payload with the bill amount when configured', async () => {
    const svc = new PurchasesService(receiptPrisma({ promptpayId: '0812345678' }));
    const r = await svc.receipt('clx123abcdEFGH99', 'org1');
    expect(r.promptpayPayload).toContain('010212'); // dynamic QR
    expect(r.promptpayPayload).toContain('5406187.50'); // the bill total
    expect(r.promptpayPayload).toMatch(/6304[0-9A-F]{4}$/);
  });

  it('a corrupt stored PromptPay id degrades to null instead of breaking the receipt', async () => {
    const svc = new PurchasesService(receiptPrisma({ promptpayId: 'not-a-number' }));
    const r = await svc.receipt('clx123abcdEFGH99', 'org1');
    expect(r.total).toBe(187.5);
    expect(r.promptpayPayload).toBeNull();
  });

  it('TENANT ISOLATION: cannot read a receipt from another org', async () => {
    const svc = new PurchasesService(receiptPrisma());
    await expect(svc.receipt('clx123abcdEFGH99', 'org-OTHER')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PurchasesService.dayClose', () => {
  function dayPrisma(purchases: unknown[]) {
    return {
      purchase: { findMany: jest.fn().mockResolvedValue(purchases) },
      purchaseItem: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ productId: 'p1', _sum: { qty: 5 } }]),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', name: 'ลาเต้เย็น' }]),
      },
    } as unknown as PrismaService;
  }

  it('sums the day: bills, total, avg ticket, points, assisted split, top products', async () => {
    const prisma = dayPrisma([
      { total: 100, assisted: true, storeCode: 'main' },
      { total: 59, assisted: false, storeCode: 'main' },
      { total: 41, assisted: false, storeCode: 'bkk-02' },
    ]);
    const svc = new PurchasesService(prisma);
    const r = await svc.dayClose('org1', '2026-08-28');
    expect(r.date).toBe('2026-08-28');
    expect(r.billCount).toBe(3);
    expect(r.total).toBe(200);
    expect(r.avgTicket).toBeCloseTo(200 / 3);
    expect(r.pointsIssued).toBe(10 + 5 + 4); // floored per bill, matching earn logic
    expect(r.assistedBillCount).toBe(1);
    expect(r.assistedTotal).toBe(100);
    expect(r.byStore[0]).toEqual({ storeCode: 'main', total: 159, count: 2 });
    expect(r.topProducts[0]).toEqual({ productId: 'p1', name: 'ลาเต้เย็น', qty: 5 });
  });

  it('queries exactly one Bangkok calendar day scoped to the org', async () => {
    const prisma = dayPrisma([]);
    const svc = new PurchasesService(prisma);
    await svc.dayClose('org1', '2026-08-28', 'main');
    const { where } = (prisma.purchase.findMany as jest.Mock).mock.calls[0][0];
    expect(where.orgId).toBe('org1');
    expect(where.storeCode).toBe('main');
    expect(where.boughtAt.gte.toISOString()).toBe('2026-08-27T17:00:00.000Z'); // 00:00 BKK
    expect(where.boughtAt.lt.toISOString()).toBe('2026-08-28T17:00:00.000Z'); // +24h
  });

  it('an empty day reports zeros, not NaN', async () => {
    const svc = new PurchasesService(dayPrisma([]));
    const r = await svc.dayClose('org1', '2026-08-28');
    expect(r.billCount).toBe(0);
    expect(r.avgTicket).toBe(0);
    expect(r.total).toBe(0);
  });
});
