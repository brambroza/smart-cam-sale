import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CONSENT_PURPOSE, CONSENT_TEXT_HASH, CONSENT_VERSION } from '../consent/consent-policy';

export interface StaffRef {
  id?: string;
  username?: string;
}

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(take: number) {
    return this.prisma.member.findMany({
      take,
      orderBy: { memberSince: 'desc' },
      select: {
        id: true,
        fullName: true,
        displayName: true,
        phone: true,
        tier: true,
        points: true,
        gender: true,
        memberSince: true,
        faceOptIn: true,
      },
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

  async registerFace(
    memberId: string,
    embedding: number[],
    opts?: { consentAccepted?: boolean; consentVersion?: string; staff?: StaffRef },
  ) {
    if (embedding.length !== 512) throw new NotFoundException('embedding must be 512-d');
    if (!opts?.consentAccepted || opts.consentVersion !== CONSENT_VERSION) {
      throw new BadRequestException('ต้องได้รับความยินยอม (เวอร์ชันปัจจุบัน) ก่อนบันทึกใบหน้า');
    }
    const vec = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "FaceEmbedding" ("id", "memberId", "embedding") VALUES ($1, $2, $3::vector)`,
      `face_${Math.random().toString(36).slice(2, 10)}`,
      memberId,
      vec,
    );
    await this.prisma.member.update({ where: { id: memberId }, data: { faceOptIn: true } });
    await this.recordConsent(memberId, 'granted', opts.staff);
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
    consentAccepted?: boolean;
    consentVersion?: string;
    staff?: StaffRef;
  }) {
    if (!input.embedding || input.embedding.length !== 512) {
      throw new NotFoundException('embedding must be 512-d');
    }
    if (!input.consentAccepted) {
      throw new BadRequestException('ต้องได้รับความยินยอมจากลูกค้าก่อนสมัครสมาชิกด้วยใบหน้า');
    }
    if (input.consentVersion !== CONSENT_VERSION) {
      throw new BadRequestException(
        'เวอร์ชันข้อความยินยอมไม่ตรงกับปัจจุบัน — รีเฟรชหน้าเว็บแล้วลองใหม่',
      );
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
    await this.recordConsent(member.id, 'granted', input.staff);
    return { ok: true, memberId: member.id, welcomePoints: 100 };
  }

  async removeFace(memberId: string, staff?: StaffRef) {
    await this.prisma.faceEmbedding.deleteMany({ where: { memberId } });
    await this.prisma.member.update({ where: { id: memberId }, data: { faceOptIn: false } });
    await this.recordConsent(memberId, 'withdrawn', staff);
    return { ok: true };
  }

  /** PDPA evidence: who consented/withdrew, when, under which policy text. */
  consents(memberId: string) {
    return this.prisma.consentRecord.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private recordConsent(memberId: string, action: 'granted' | 'withdrawn', staff?: StaffRef) {
    return this.prisma.consentRecord.create({
      data: {
        memberId,
        action,
        purpose: CONSENT_PURPOSE,
        policyVersion: CONSENT_VERSION,
        policyHash: CONSENT_TEXT_HASH,
        method: 'enroll_console',
        staffUserId: staff?.id,
        staffUsername: staff?.username,
      },
    });
  }
}
