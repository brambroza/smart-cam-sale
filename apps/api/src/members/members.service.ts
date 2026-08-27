import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(take: number) {
    return this.prisma.member.findMany({
      take,
      orderBy: { memberSince: 'desc' },
      select: { id: true, displayName: true, tier: true, points: true, gender: true },
    });
  }

  async detail(id: string) {
    const m = await this.prisma.member.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { boughtAt: 'desc' },
          take: 10,
          include: { items: { include: { product: true } } },
        },
      },
    });
    if (!m) throw new NotFoundException('member not found');
    return m;
  }

  async stats() {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [total, todayMembers, todayGuests] = await Promise.all([
      this.prisma.member.count(),
      this.prisma.visitLog.count({ where: { visitedAt: { gte: since }, matchedFace: true } }),
      this.prisma.visitLog.count({ where: { visitedAt: { gte: since }, matchedFace: false } }),
    ]);
    return { totalMembers: total, memberVisits24h: todayMembers, guestVisits24h: todayGuests };
  }

  async registerFace(memberId: string, embedding: number[]) {
    if (embedding.length !== 512) throw new NotFoundException('embedding must be 512-d');
    const vec = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "FaceEmbedding" ("id", "memberId", "embedding") VALUES ($1, $2, $3::vector)`,
      `face_${Math.random().toString(36).slice(2, 10)}`,
      memberId,
      vec,
    );
    await this.prisma.member.update({ where: { id: memberId }, data: { faceOptIn: true } });
    return { ok: true };
  }

  async enroll(input: {
    fullName: string;
    displayName: string;
    gender?: 'male' | 'female' | 'unknown';
    birthYear?: number;
    phone?: string;
    email?: string;
    embedding: number[];
  }) {
    if (!input.embedding || input.embedding.length !== 512) {
      throw new NotFoundException('embedding must be 512-d');
    }
    const member = await this.prisma.member.create({
      data: {
        fullName: input.fullName,
        displayName: input.displayName,
        gender: (input.gender ?? 'unknown') as any,
        birthYear: input.birthYear,
        phone: input.phone,
        email: input.email,
        tier: 'bronze',
        points: 100, // ของขวัญสมัครใหม่
        faceOptIn: true,
      },
    });
    const vec = `[${input.embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "FaceEmbedding" ("id", "memberId", "embedding") VALUES ($1, $2, $3::vector)`,
      `face_${Math.random().toString(36).slice(2, 10)}`,
      member.id,
      vec,
    );
    return { ok: true, memberId: member.id, welcomePoints: 100 };
  }

  async removeFace(memberId: string) {
    await this.prisma.faceEmbedding.deleteMany({ where: { memberId } });
    await this.prisma.member.update({ where: { id: memberId }, data: { faceOptIn: false } });
    return { ok: true };
  }
}
