import { RecognitionService } from './recognition.service';
import { PrismaService } from '../prisma.service';

/**
 * Lite mode: lookupByPhone is the camera-less identification path. These tests
 * pin (1) tenant scoping of the phone search, (2) the matchedFace VisitLog that
 * keeps ROI attribution identical to camera recognitions, and (3) the fallback
 * to the template script when Claude is unavailable.
 */
describe('RecognitionService.lookupByPhone — Lite tier', () => {
  const MEMBER = {
    id: 'm1',
    fullName: 'สมหญิง ใจดี',
    displayName: 'หญิง',
    tier: 'gold',
    points: 450,
    memberSince: new Date('2025-01-15'),
    avatarUrl: null,
    birthYear: 1990,
    gender: 'female',
    purchases: [{ total: 120 }, { total: 80 }],
  };

  function build(opts: { member?: unknown; claudeScript?: string | null } = {}) {
    const prisma = {
      member: {
        findFirst: jest.fn().mockResolvedValue(opts.member ?? null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(MEMBER),
      },
      purchase: { findMany: jest.fn().mockResolvedValue([]) },
      visitLog: { create: jest.fn().mockResolvedValue({ id: 'v1' }) },
    } as unknown as PrismaService;
    const recos = {
      forMember: jest.fn().mockResolvedValue([
        { productId: 'p1', name: 'ลาเต้เย็น', price: 65, reason: 'ขายดี', score: 1, category: 'drink' },
      ]),
    };
    const claude = { generate: jest.fn().mockResolvedValue(opts.claudeScript ?? null) };
    const svc = new RecognitionService(prisma, {} as never, recos as never, claude as never);
    return { svc, prisma, recos, claude };
  }

  it('returns found:false for a too-short phone without touching the database', async () => {
    const { svc, prisma } = build();
    expect(await svc.lookupByPhone('0812', 'org1')).toEqual({ found: false });
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });

  it('returns found:false when no member has that phone in this org', async () => {
    const { svc } = build({ member: null });
    expect(await svc.lookupByPhone('0812345678', 'org1')).toEqual({ found: false });
  });

  it('TENANT ISOLATION: searches the phone only inside the caller org, normalized', async () => {
    const { svc, prisma } = build();
    await svc.lookupByPhone('081-234-5678', 'org-A');
    expect(prisma.member.findFirst).toHaveBeenCalledWith({
      where: { phone: '0812345678', orgId: 'org-A' },
    });
  });

  it('returns the full profile and logs a matchedFace VisitLog so ROI attribution counts it', async () => {
    const { svc, prisma, recos } = build({ member: MEMBER });
    const res = await svc.lookupByPhone('0812345678', 'org1');
    expect(res.found).toBe(true);
    if (!res.found) return;
    expect(res.member).toMatchObject({ memberId: 'm1', displayName: 'หญิง', points: 450 });
    expect(res.recommendations[0].name).toBe('ลาเต้เย็น');
    expect(res.suggestedScript).toContain('หญิง');
    expect(recos.forMember).toHaveBeenCalledWith('m1', expect.any(String), 'org1');
    expect(prisma.visitLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: 'org1', memberId: 'm1', matchedFace: true }),
      }),
    );
  });

  it('prefers the Claude script when available', async () => {
    const { svc } = build({ member: MEMBER, claudeScript: 'สวัสดีค่ะคุณหญิง วันนี้รับลาเต้เย็นแก้วโปรดไหมคะ' });
    const res = await svc.lookupByPhone('0812345678', 'org1');
    if (!res.found) throw new Error('expected found');
    expect(res.suggestedScript).toContain('แก้วโปรด');
  });
});
