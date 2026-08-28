import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';

const HASH = bcrypt.hashSync('correct-password', 4);
const ADMIN = {
  id: 'u1',
  username: 'admin',
  passwordHash: HASH,
  displayName: 'Administrator',
  role: 'admin',
};

function prismaMock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    staffUser: {
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn().mockResolvedValue(ADMIN),
      create: jest.fn().mockImplementation(({ data, select }: any) => Promise.resolve({ id: 'u2', ...data })),
      update: jest.fn().mockResolvedValue(ADMIN),
      delete: jest.fn().mockResolvedValue(ADMIN),
      ...overrides,
    },
  } as unknown as PrismaService;
}

const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });

describe('AuthService.login', () => {
  it('returns a verifiable token and safe user object on correct credentials', async () => {
    const svc = new AuthService(prismaMock(), jwt);
    const res = await svc.login('admin', 'correct-password');
    expect(res.user).toEqual({
      id: 'u1',
      username: 'admin',
      displayName: 'Administrator',
      role: 'admin',
    });
    const payload = await svc.verifyToken(res.accessToken);
    expect(payload).toMatchObject({ sub: 'u1', username: 'admin', role: 'admin' });
  });

  it('rejects a wrong password and an unknown user with the same error', async () => {
    const svc = new AuthService(prismaMock(), jwt);
    await expect(svc.login('admin', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);

    const prisma = prismaMock();
    (prisma.staffUser.findUnique as jest.Mock).mockResolvedValue(null);
    const svc2 = new AuthService(prisma, jwt);
    await expect(svc2.login('ghost', 'x')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a forged token', async () => {
    const svc = new AuthService(prismaMock(), jwt);
    const forged = new JwtService({ secret: 'other-secret' }).sign({ sub: 'u1' });
    await expect(svc.verifyToken(forged)).rejects.toBeTruthy();
  });
});

describe('AuthService.changePassword', () => {
  it('requires the correct current password and >=8 chars for the new one', async () => {
    const svc = new AuthService(prismaMock(), jwt);
    await expect(svc.changePassword('u1', 'wrong', 'long-enough')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(svc.changePassword('u1', 'correct-password', 'short')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(svc.changePassword('u1', 'correct-password', 'long-enough')).resolves.toEqual({
      ok: true,
    });
  });
});

describe('AuthService staff management', () => {
  it('validates username format and password length on create', async () => {
    const prisma = prismaMock();
    (prisma.staffUser.findUnique as jest.Mock).mockResolvedValue(null); // no duplicate
    const svc = new AuthService(prisma, jwt);
    await expect(
      svc.createUser({ username: 'ab', password: 'long-enough', displayName: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      svc.createUser({ username: 'valid.name', password: 'short', displayName: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const ok = await svc.createUser({
      username: 'Valid.Name',
      password: 'long-enough',
      displayName: 'พนักงานใหม่',
      role: 'superuser', // unknown role must demote to staff
    });
    expect(ok).toMatchObject({ username: 'valid.name', role: 'staff' });
  });

  it('blocks self-delete and deleting the last admin', async () => {
    const svc = new AuthService(prismaMock(), jwt);
    await expect(svc.deleteUser('u1', 'u1')).rejects.toBeInstanceOf(UnauthorizedException);
    // one admin in DB, target is that admin
    await expect(svc.deleteUser('u1', 'someone-else')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
