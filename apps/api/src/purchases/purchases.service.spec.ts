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

  it('TENANT ISOLATION: a member of another org is invisible', async () => {
    const svc = new PurchasesService(prismaMock());
    await expect(
      svc.record({ memberId: 'm1', items: [{ productId: 'p1', qty: 1 }] }, 'org-OTHER'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
