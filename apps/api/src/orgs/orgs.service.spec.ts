import { BadRequestException } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { PrismaService } from '../prisma.service';

function prismaMock() {
  return {
    organization: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'org_new', ...data }),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    staffUser: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'u_new' }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    member: { groupBy: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
}

describe('OrgsService.create', () => {
  it('creates org + first admin and returns the bridge token exactly once', async () => {
    const prisma = prismaMock();
    const svc = new OrgsService(prisma);
    const res = await svc.create({
      name: 'ร้านทดสอบ',
      slug: 'Test-Shop',
      adminUsername: 'ShopAdmin',
      adminPassword: 'long-enough',
    });
    expect(res.slug).toBe('test-shop');
    expect(res.adminUsername).toBe('shopadmin');
    expect(res.bridgeToken).toMatch(/^brg_[0-9a-f]{48}$/);
    expect(prisma.staffUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'admin', orgId: 'org_new' }),
      }),
    );
  });

  it('validates slug, username, and password', async () => {
    const svc = new OrgsService(prismaMock());
    const base = { name: 'x', slug: 'ok-slug', adminUsername: 'okname', adminPassword: 'long-enough' };
    await expect(svc.create({ ...base, slug: 'BAD SLUG!' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.create({ ...base, adminUsername: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.create({ ...base, adminPassword: 'short' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('OrgsService.setPlan', () => {
  it('accepts only known plans and protects the default org from suspension', async () => {
    const svc = new OrgsService(prismaMock());
    await expect(svc.setPlan('org_x', 'gold')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.setPlan('org_default', 'suspended')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.setPlan('org_x', 'suspended')).resolves.toMatchObject({
      ok: true,
      plan: 'suspended',
    });
  });
});

describe('OrgsService.resolveBridgeToken — tenant isolation', () => {
  it('rejects missing/unknown tokens and suspended orgs, resolves active orgs', async () => {
    const prisma = prismaMock();
    (prisma.organization.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.bridgeToken === 'brg_active') return Promise.resolve({ id: 'org_a', plan: 'pilot' });
      if (where.bridgeToken === 'brg_frozen')
        return Promise.resolve({ id: 'org_b', plan: 'suspended' });
      return Promise.resolve(null);
    });
    const svc = new OrgsService(prisma);
    expect(await svc.resolveBridgeToken(undefined)).toBeNull();
    expect(await svc.resolveBridgeToken('brg_nope')).toBeNull();
    expect(await svc.resolveBridgeToken('brg_frozen')).toBeNull();
    expect(await svc.resolveBridgeToken('brg_active')).toEqual({ orgId: 'org_a' });
  });
});
