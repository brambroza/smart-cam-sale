import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { DEFAULT_ORG_ID } from '../auth/auth.service';
import { normalizePromptPayId } from '../common/promptpay.util';
import { EmailService } from '../notify/email.service';

@Injectable()
export class OrgsService implements OnModuleInit {
  private readonly logger = new Logger(OrgsService.name);

  constructor(
    private readonly prisma: PrismaService,
    // optional so unit tests can construct without it
    private readonly email?: EmailService,
  ) {}

  /**
   * Startup adoption: existing deployments authenticated bridges with the
   * BRIDGE_TOKEN env var. Move that value onto the default org so those
   * bridges keep connecting without a config change.
   */
  async onModuleInit() {
    const legacy = process.env.BRIDGE_TOKEN;
    if (!legacy) return;
    const org = await this.prisma.organization.findUnique({ where: { id: DEFAULT_ORG_ID } });
    if (org && org.bridgeToken !== legacy) {
      const taken = await this.prisma.organization.findUnique({
        where: { bridgeToken: legacy },
      });
      if (!taken) {
        await this.prisma.organization.update({
          where: { id: DEFAULT_ORG_ID },
          data: { bridgeToken: legacy },
        });
        this.logger.log('ย้ายค่า BRIDGE_TOKEN (env เดิม) เข้าเป็น bridgeToken ขององค์กร default แล้ว');
      }
    }
  }

  async list() {
    const [orgs, memberCounts, staffCounts] = await Promise.all([
      this.prisma.organization.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, slug: true, plan: true, cameraEnabled: true, createdAt: true },
      }),
      this.prisma.member.groupBy({ by: ['orgId'], _count: { _all: true } }),
      this.prisma.staffUser.groupBy({ by: ['orgId'], _count: { _all: true } }),
    ]);
    const members = new Map(memberCounts.map((r) => [r.orgId, r._count._all]));
    const staff = new Map(staffCounts.map((r) => [r.orgId, r._count._all]));
    return orgs.map((o) => ({
      ...o,
      memberCount: members.get(o.id) ?? 0,
      staffCount: staff.get(o.id) ?? 0,
    }));
  }

  /** Suspend cuts off logins, bridges, and POS ingestion for the whole org. */
  async setPlan(orgId: string, plan: string) {
    if (!['pilot', 'standard', 'suspended'].includes(plan)) {
      throw new BadRequestException('plan ต้องเป็น pilot | standard | suspended');
    }
    if (orgId === DEFAULT_ORG_ID && plan === 'suspended') {
      throw new BadRequestException('ระงับองค์กร default ไม่ได้ (บัญชี superadmin อยู่ในนี้)');
    }
    await this.prisma.organization
      .update({ where: { id: orgId }, data: { plan } })
      .catch(() => {
        throw new NotFoundException('ไม่พบองค์กรนี้');
      });
    return { ok: true, orgId, plan };
  }

  /** Create an org + its first admin in one shot. Credentials are returned once. */
  async create(input: {
    name: string;
    slug: string;
    adminUsername: string;
    adminPassword: string;
    cameraEnabled?: boolean;
  }) {
    const slug = input.slug?.trim().toLowerCase();
    if (!input.name?.trim()) throw new BadRequestException('ต้องมีชื่อองค์กร');
    if (!slug || !/^[a-z0-9-]{2,32}$/.test(slug)) {
      throw new BadRequestException('slug ต้องเป็น a-z 0-9 - ยาว 2-32 ตัว');
    }
    const username = input.adminUsername?.trim().toLowerCase();
    if (!username || !/^[a-z0-9_.-]{3,32}$/.test(username)) {
      throw new BadRequestException('username admin ต้องเป็น a-z 0-9 _ . - ยาว 3-32 ตัว');
    }
    if (!input.adminPassword || input.adminPassword.length < 8) {
      throw new BadRequestException('รหัสผ่าน admin ต้องยาวอย่างน้อย 8 ตัวอักษร');
    }
    if (await this.prisma.organization.findUnique({ where: { slug } })) {
      throw new BadRequestException('slug นี้ถูกใช้แล้ว');
    }
    if (await this.prisma.staffUser.findUnique({ where: { username } })) {
      throw new BadRequestException('username นี้ถูกใช้แล้ว');
    }

    const bridgeToken = `brg_${randomBytes(24).toString('hex')}`;
    const org = await this.prisma.organization.create({
      data: {
        name: input.name.trim(),
        slug,
        bridgeToken,
        cameraEnabled: input.cameraEnabled ?? true,
      },
    });
    await this.prisma.staffUser.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(input.adminPassword, 10),
        displayName: `Admin ${org.name}`,
        role: 'admin',
        orgId: org.id,
      },
    });
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      cameraEnabled: org.cameraEnabled,
      // shown once — the bridge on-site needs this value (Lite orgs won't use it)
      bridgeToken,
      adminUsername: username,
    };
  }

  /**
   * Self-serve signup from the login page: a small shop registers with email
   * + password and gets its own Lite org instantly (no camera, no install —
   * upgrading to the camera tier goes through us). The email doubles as the
   * login username, so the regular login endpoint just works.
   */
  async selfServeSignup(input: { shopName: string; email: string; password: string }) {
    const shopName = input.shopName?.trim() ?? '';
    const email = input.email?.trim().toLowerCase() ?? '';
    if (shopName.length < 2 || shopName.length > 100) {
      throw new BadRequestException('กรุณากรอกชื่อร้าน (2-100 ตัวอักษร)');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 150) {
      throw new BadRequestException('อีเมลไม่ถูกต้อง');
    }
    if (!input.password || input.password.length < 8) {
      throw new BadRequestException('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
    }
    if (await this.prisma.staffUser.findUnique({ where: { username: email } })) {
      throw new BadRequestException('อีเมลนี้มีบัญชีอยู่แล้ว — เข้าสู่ระบบได้เลย');
    }
    // abuse guard: an unauthenticated endpoint that creates orgs needs a ceiling
    const since = new Date(Date.now() - 86400000);
    const createdToday = await this.prisma.organization.count({
      where: { createdAt: { gte: since } },
    });
    if (createdToday >= 50) {
      throw new BadRequestException(
        'มีผู้สมัครจำนวนมากผิดปกติ — ลองใหม่ภายหลัง หรือติดต่อ 085-608-3298',
      );
    }

    const base =
      shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) ||
      'shop';
    let slug = `${base}-${randomBytes(2).toString('hex')}`;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${base}-${randomBytes(2).toString('hex')}`;
    }

    const org = await this.prisma.organization.create({
      data: {
        name: shopName,
        slug,
        cameraEnabled: false, // Lite tier
        pricePerStore: 590,
        bridgeToken: `brg_${randomBytes(24).toString('hex')}`,
      },
    });
    await this.prisma.staffUser.create({
      data: {
        username: email,
        passwordHash: await bcrypt.hash(input.password, 10),
        displayName: `แอดมิน ${shopName}`,
        role: 'admin',
        orgId: org.id,
      },
    });
    this.email?.sendSignupAlert({ shopName, email }).catch(() => {});
    return { ok: true, orgId: org.id };
  }

  /** Tier switch: Lite (false) refuses camera frames and bridge connections. */
  async setCameraEnabled(orgId: string, enabled: boolean) {
    await this.prisma.organization
      .update({ where: { id: orgId }, data: { cameraEnabled: enabled } })
      .catch(() => {
        throw new NotFoundException('ไม่พบองค์กรนี้');
      });
    return { ok: true, orgId, cameraEnabled: enabled };
  }

  async isCameraEnabled(orgId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { cameraEnabled: true },
    });
    return org?.cameraEnabled ?? true;
  }

  /** Own-org settings an org admin may read (no bridge token, no plan levers). */
  async getSettings(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, cameraEnabled: true, promptpayId: true },
    });
    if (!org) throw new NotFoundException('ไม่พบองค์กรนี้');
    return org;
  }

  /** Set/clear the shop's PromptPay target for payment QRs (empty string clears). */
  async setPromptPayId(orgId: string, raw: string) {
    const value = raw?.trim() ? normalizePromptPayId(raw) : null;
    await this.prisma.organization
      .update({ where: { id: orgId }, data: { promptpayId: value } })
      .catch(() => {
        throw new NotFoundException('ไม่พบองค์กรนี้');
      });
    return { ok: true, promptpayId: value };
  }

  async rotateBridgeToken(orgId: string) {
    const bridgeToken = `brg_${randomBytes(24).toString('hex')}`;
    await this.prisma.organization
      .update({ where: { id: orgId }, data: { bridgeToken } })
      .catch(() => {
        throw new NotFoundException('ไม่พบองค์กรนี้');
      });
    return { orgId, bridgeToken };
  }

  /** Resolve a bridge's token to its org. Used by the WS gateway and the bridge config endpoint. */
  async resolveBridgeToken(token?: string): Promise<{ orgId: string } | null> {
    if (!token) return null;
    const org = await this.prisma.organization.findUnique({
      where: { bridgeToken: token },
      select: { id: true, plan: true, cameraEnabled: true },
    });
    if (!org || org.plan === 'suspended' || !org.cameraEnabled) return null;
    return { orgId: org.id };
  }
}
