import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PosService } from './pos.service';
import { PrismaService } from '../prisma.service';
import { sha256Hex } from '../common/crypto.util';

const MEMBER = { id: 'm1', displayName: 'เมย์', phone: '0812345678', points: 50 };
const KNOWN = { id: 'p1', name: 'น้ำดื่ม', price: 10, sku: '885000111' };

function prismaMock() {
  return {
    posApiKey: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    member: {
      findFirst: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.orgId === 'org1' && (where.id === 'm1' || where.phone === '0812345678')
            ? MEMBER
            : null,
        ),
      ),
      update: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ ...MEMBER, points: MEMBER.points + data.points.increment }),
      ),
    },
    product: {
      findFirst: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.orgId === 'org1' && (where.sku === KNOWN.sku || where.id === KNOWN.id)
            ? KNOWN
            : null,
        ),
      ),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'auto1', ...data }),
      ),
    },
    purchase: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'pur1', ...data }),
      ),
    },
    visitLog: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
}

describe('PosService.verifyKey', () => {
  it('rejects a missing or unknown key', async () => {
    const svc = new PosService(prismaMock());
    await expect(svc.verifyKey(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.verifyKey('pos_wrong')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a disabled key, accepts an enabled one by hash', async () => {
    const prisma = prismaMock();
    const raw = 'pos_abc';
    const row = { id: 'k1', name: 'สาขา 1', storeCode: 'main', enabled: false };
    (prisma.posApiKey.findUnique as jest.Mock).mockImplementation(({ where }: any) =>
      Promise.resolve(where.keyHash === sha256Hex(raw) ? row : null),
    );
    const svc = new PosService(prisma);
    await expect(svc.verifyKey(raw)).rejects.toBeInstanceOf(UnauthorizedException);

    row.enabled = true;
    await expect(svc.verifyKey(raw)).resolves.toMatchObject({ id: 'k1' });
  });
});

describe('PosService.recordSale', () => {
  it('acknowledges but does not record a sale with no matching member', async () => {
    const svc = new PosService(prismaMock());
    const res = await svc.recordSale(
      { memberPhone: '0899999999', items: [{ barcode: KNOWN.sku, qty: 1 }] },
      'main',
      'org1',
    );
    expect(res).toMatchObject({ recorded: false, reason: 'member_not_found' });
  });

  it('matches member by phone, item by barcode, uses POS price and awards points', async () => {
    const svc = new PosService(prismaMock());
    const res = await svc.recordSale(
      {
        memberPhone: '0812345678',
        externalId: 'RCPT-1',
        items: [{ barcode: KNOWN.sku, qty: 3, price: 12 }], // POS promo price wins
      },
      'branch-2',
      'org1',
    );
    expect(res.recorded).toBe(true);
    expect(res.total).toBe(36);
    expect(res.pointsEarned).toBe(3);
    expect(res.newPointsBalance).toBe(53);
    expect(res.externalId).toBe('RCPT-1');
  });

  it('auto-creates an unknown product when name+price provided', async () => {
    const prisma = prismaMock();
    const svc = new PosService(prisma);
    const res = await svc.recordSale(
      {
        memberId: 'm1',
        items: [{ barcode: 'new-sku', name: 'ของใหม่', price: 25, qty: 2 }],
      },
      'main',
      'org1',
    );
    expect(res.recorded).toBe(true);
    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sku: 'new-sku', category: 'pos_import' }),
      }),
    );
    expect(res.total).toBe(50);
  });

  it('rejects an unknown barcode without name+price to create from', async () => {
    const svc = new PosService(prismaMock());
    await expect(
      svc.recordSale({ memberId: 'm1', items: [{ barcode: 'mystery', qty: 1 }] }, 'main', 'org1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects bad qty and empty items', async () => {
    const svc = new PosService(prismaMock());
    await expect(
      svc.recordSale({ memberId: 'm1', items: [] }, 'main', 'org1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.recordSale({ memberId: 'm1', items: [{ barcode: KNOWN.sku, qty: 0 }] }, 'main', 'org1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ROI attribution: POS bill is marked assisted after a recent recognition', async () => {
    const prisma = prismaMock();
    (prisma.visitLog.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
    const svc = new PosService(prisma);
    await svc.recordSale(
      { memberId: 'm1', items: [{ barcode: KNOWN.sku, qty: 1 }] },
      'main',
      'org1',
    );
    expect(prisma.purchase.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assisted: true }) }),
    );
  });

  it('TENANT ISOLATION: a valid member phone from another org is not matched', async () => {
    const svc = new PosService(prismaMock());
    const res = await svc.recordSale(
      { memberPhone: '0812345678', items: [{ barcode: KNOWN.sku, qty: 1 }] },
      'main',
      'org-OTHER',
    );
    expect(res).toMatchObject({ recorded: false, reason: 'member_not_found' });
  });
});
