import { BadRequestException } from '@nestjs/common';
import { MembersService } from './members.service';
import { PrismaService } from '../prisma.service';
import { CONSENT_VERSION } from '../consent/consent-policy';

const EMBEDDING = Array.from({ length: 512 }, () => 0.1);

function prismaMock() {
  return {
    member: {
      create: jest.fn().mockResolvedValue({ id: 'm-new' }),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.orgId === 'org1' ? { id: where.id, orgId: 'org1' } : null),
      ),
    },
    consentRecord: {
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    faceEmbedding: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  } as unknown as PrismaService;
}

const BASE = {
  fullName: 'สมชาย ใจดี',
  displayName: 'ชาย',
  embedding: EMBEDDING,
};

describe('MembersService.enroll — PDPA consent enforcement', () => {
  it('rejects enrollment without consent', async () => {
    const svc = new MembersService(prismaMock());
    await expect(svc.enroll({ ...BASE, orgId: 'org1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      svc.enroll({ ...BASE, orgId: 'org1', consentAccepted: false, consentVersion: CONSENT_VERSION }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a stale consent version', async () => {
    const svc = new MembersService(prismaMock());
    await expect(
      svc.enroll({ ...BASE, orgId: 'org1', consentAccepted: true, consentVersion: '0.9-old' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a granted ConsentRecord with the staff witness on success', async () => {
    const prisma = prismaMock();
    const svc = new MembersService(prisma);
    const res = await svc.enroll({
      ...BASE,
      orgId: 'org1',
      consentAccepted: true,
      consentVersion: CONSENT_VERSION,
      staff: { id: 'u1', username: 'admin' },
    });
    expect(res).toMatchObject({ ok: true, memberId: 'm-new' });
    expect(prisma.consentRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'granted',
          policyVersion: CONSENT_VERSION,
          staffUsername: 'admin',
          orgId: 'org1',
        }),
      }),
    );
  });
});

describe('MembersService.removeFace', () => {
  it('deletes embeddings, clears opt-in, and records a withdrawal', async () => {
    const prisma = prismaMock();
    const svc = new MembersService(prisma);
    await svc.removeFace('m1', 'org1', { id: 'u1', username: 'admin' });
    expect(prisma.faceEmbedding.deleteMany).toHaveBeenCalledWith({ where: { memberId: 'm1' } });
    expect(prisma.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { faceOptIn: false } }),
    );
    expect(prisma.consentRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'withdrawn' }) }),
    );
  });

  it('TENANT ISOLATION: cannot remove the face of a member in another org', async () => {
    const svc = new MembersService(prismaMock());
    await expect(
      svc.removeFace('m1', 'org-OTHER', { id: 'u1', username: 'admin' }),
    ).rejects.toBeTruthy();
  });
});
