import { DemoService } from './demo.service';
import { PrismaService } from '../prisma.service';

function prismaMock(opts: { org?: unknown; user?: unknown; productCount?: number } = {}) {
  let productSeq = 0;
  return {
    organization: {
      findUnique: jest.fn().mockResolvedValue(opts.org ?? null),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'org_demo', ...data }),
      ),
    },
    staffUser: {
      findUnique: jest.fn().mockResolvedValue(opts.user ?? null),
      create: jest.fn().mockResolvedValue({ id: 'u_demo' }),
      update: jest.fn().mockResolvedValue({}),
    },
    product: {
      count: jest.fn().mockResolvedValue(opts.productCount ?? 0),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `p${productSeq++}`, ...data }),
      ),
    },
    member: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `m_${data.displayName}`, ...data }),
      ),
    },
    purchase: { create: jest.fn().mockResolvedValue({ id: 'pur' }) },
  } as unknown as PrismaService;
}

describe('DemoService.ensureDemo', () => {
  it('creates the demo org + demo admin and seeds sample data on first run', async () => {
    const prisma = prismaMock();
    await new DemoService(prisma).ensureDemo();
    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'demo', cameraEnabled: true }) }),
    );
    expect(prisma.staffUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: 'demo', role: 'admin', orgId: 'org_demo' }),
      }),
    );
    expect(prisma.product.create).toHaveBeenCalled();
    expect(prisma.member.create).toHaveBeenCalledTimes(3);
    expect(prisma.purchase.create).toHaveBeenCalledTimes(4);
  });

  it('SAFETY: a demo user created inside a real org is moved into the demo org', async () => {
    const prisma = prismaMock({
      org: { id: 'org_demo', slug: 'demo' },
      user: { id: 'u1', username: 'demo', orgId: 'org_REAL' },
      productCount: 6,
    });
    await new DemoService(prisma).ensureDemo();
    expect(prisma.staffUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ orgId: 'org_demo', role: 'admin' }),
      }),
    );
  });

  it('is idempotent: an already-seeded demo org is not seeded again', async () => {
    const prisma = prismaMock({
      org: { id: 'org_demo', slug: 'demo' },
      user: { id: 'u1', username: 'demo', orgId: 'org_demo' },
      productCount: 6,
    });
    await new DemoService(prisma).ensureDemo();
    expect(prisma.product.create).not.toHaveBeenCalled();
    expect(prisma.purchase.create).not.toHaveBeenCalled();
  });
});
