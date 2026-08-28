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

@Injectable()
export class OrgsService implements OnModuleInit {
  private readonly logger = new Logger(OrgsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  list() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true, plan: true, createdAt: true },
    });
  }

  /** Create an org + its first admin in one shot. Credentials are returned once. */
  async create(input: {
    name: string;
    slug: string;
    adminUsername: string;
    adminPassword: string;
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
      data: { name: input.name.trim(), slug, bridgeToken },
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
      // shown once — the bridge on-site needs this value
      bridgeToken,
      adminUsername: username,
    };
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
      select: { id: true, plan: true },
    });
    if (!org || org.plan === 'suspended') return null;
    return { orgId: org.id };
  }
}
