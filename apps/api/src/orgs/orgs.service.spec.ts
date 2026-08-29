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
  it('rejects missing/unknown tokens, suspended orgs, and Lite orgs; resolves active camera orgs', async () => {
    const prisma = prismaMock();
    (prisma.organization.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.bridgeToken === 'brg_active')
        return Promise.resolve({ id: 'org_a', plan: 'pilot', cameraEnabled: true });
      if (where.bridgeToken === 'brg_frozen')
        return Promise.resolve({ id: 'org_b', plan: 'suspended', cameraEnabled: true });
      if (where.bridgeToken === 'brg_lite')
        return Promise.resolve({ id: 'org_c', plan: 'pilot', cameraEnabled: false });
      return Promise.resolve(null);
    });
    const svc = new OrgsService(prisma);
    expect(await svc.resolveBridgeToken(undefined)).toBeNull();
    expect(await svc.resolveBridgeToken('brg_nope')).toBeNull();
    expect(await svc.resolveBridgeToken('brg_frozen')).toBeNull();
    // แพ็กเกจ Lite: bridge ต่อไม่ได้แม้ token จะถูกต้อง
    expect(await svc.resolveBridgeToken('brg_lite')).toBeNull();
    expect(await svc.resolveBridgeToken('brg_active')).toEqual({ orgId: 'org_a' });
  });
});

describe('OrgsService.setCameraEnabled / isCameraEnabled', () => {
  it('flips the flag and defaults to camera-on for unknown orgs', async () => {
    const prisma = prismaMock();
    const svc = new OrgsService(prisma);
    await expect(svc.setCameraEnabled('org_x', false)).resolves.toEqual({
      ok: true,
      orgId: 'org_x',
      cameraEnabled: false,
    });
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org_x' }, data: { cameraEnabled: false } }),
    );
    // org row missing → treat as camera tier (fail open for legacy orgs)
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await svc.isCameraEnabled('org_ghost')).toBe(true);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ cameraEnabled: false });
    expect(await svc.isCameraEnabled('org_lite')).toBe(false);
  });

  it('create() honors cameraEnabled=false for Lite orgs', async () => {
    const svc = new OrgsService(prismaMock());
    const res = await svc.create({
      name: 'คลินิก Lite',
      slug: 'lite-clinic',
      adminUsername: 'liteadmin',
      adminPassword: 'long-enough',
      cameraEnabled: false,
    });
    expect(res.cameraEnabled).toBe(false);
  });
});

describe('OrgsService PromptPay settings', () => {
  it('normalizes and stores a phone-format id, and clears on empty input', async () => {
    const prisma = prismaMock();
    const svc = new OrgsService(prisma);
    await expect(svc.setPromptPayId('org1', '081-234-5678')).resolves.toEqual({
      ok: true,
      promptpayId: '0812345678',
    });
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org1' }, data: { promptpayId: '0812345678' } }),
    );
    await expect(svc.setPromptPayId('org1', '  ')).resolves.toEqual({
      ok: true,
      promptpayId: null,
    });
  });

  it('rejects malformed PromptPay ids', async () => {
    const svc = new OrgsService(prismaMock());
    await expect(svc.setPromptPayId('org1', '12345')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getSettings returns only the admin-safe fields', async () => {
    const prisma = prismaMock();
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      name: 'ร้าน A',
      cameraEnabled: false,
      promptpayId: '0812345678',
    });
    const svc = new OrgsService(prisma);
    await expect(svc.getSettings('org1')).resolves.toEqual({
      name: 'ร้าน A',
      cameraEnabled: false,
      promptpayId: '0812345678',
    });
  });
});

describe('OrgsService.selfServeSignup — email-based Lite signup', () => {
  const VALID = { shopName: 'ร้านกาแฟบ้านสวน', email: 'Owner@Example.com', password: 'long-enough' };

  function signupPrisma() {
    const prisma = prismaMock();
    (prisma.organization as any).count = jest.fn().mockResolvedValue(0);
    return prisma;
  }

  it('creates a Lite org (camera off, ฿590) + an email-login admin, and alerts the owner', async () => {
    const prisma = signupPrisma();
    const email = { sendSignupAlert: jest.fn().mockResolvedValue(undefined) };
    const svc = new OrgsService(prisma, email as never);
    await expect(svc.selfServeSignup(VALID)).resolves.toMatchObject({ ok: true, orgId: 'org_new' });
    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'ร้านกาแฟบ้านสวน',
          cameraEnabled: false,
          pricePerStore: 590,
        }),
      }),
    );
    expect(prisma.staffUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: 'owner@example.com', // email, lowercased — doubles as the login name
          role: 'admin',
          orgId: 'org_new',
        }),
      }),
    );
    expect(email.sendSignupAlert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'owner@example.com' }),
    );
  });

  it('rejects a taken email, bad email formats, and short passwords', async () => {
    const prisma = signupPrisma();
    (prisma.staffUser.findUnique as jest.Mock).mockResolvedValue({ id: 'u-existing' });
    await expect(new OrgsService(prisma).selfServeSignup(VALID)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const svc = new OrgsService(signupPrisma());
    await expect(svc.selfServeSignup({ ...VALID, email: 'not-an-email' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.selfServeSignup({ ...VALID, password: 'short' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.selfServeSignup({ ...VALID, shopName: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('ABUSE GUARD: refuses when too many orgs were created in the last 24h', async () => {
    const prisma = signupPrisma();
    ((prisma.organization as any).count as jest.Mock).mockResolvedValue(50);
    await expect(new OrgsService(prisma).selfServeSignup(VALID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });
});
