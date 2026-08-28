import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BRAND_PROFILES, buildRtspUrl } from './camera-profiles';
import { decryptSecret, encryptSecret, isEncryptedSecret } from '../common/crypto.util';

export interface CameraInput {
  name: string;
  brand: string;
  model?: string;
  host: string;
  port?: number;
  username?: string;
  password: string;
  streamPath?: string;
  quality?: 'main' | 'sub';
  bridgeId?: string;
  enabled?: boolean;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'cam'
  );
}

@Injectable()
export class CamerasService implements OnModuleInit {
  private readonly logger = new Logger(CamerasService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** One-time upgrade: encrypt any camera passwords still stored as plaintext. */
  async onModuleInit() {
    const cams = await this.prisma.camera.findMany({
      select: { id: true, password: true },
    });
    const legacy = cams.filter((c) => c.password.length > 0 && !isEncryptedSecret(c.password));
    for (const c of legacy) {
      await this.prisma.camera.update({
        where: { id: c.id },
        data: { password: encryptSecret(c.password) },
      });
    }
    if (legacy.length > 0) {
      this.logger.log(`เข้ารหัสรหัสผ่านกล้องเดิม ${legacy.length} ตัวเรียบร้อย`);
    }
  }

  profiles() {
    return Object.entries(BRAND_PROFILES).map(([key, p]) => ({
      brand: key,
      label: p.label,
      defaultPort: p.defaultPort,
      models: p.models,
      note: p.note ?? null,
      needsCustomPath: key === 'generic',
    }));
  }

  /** List for the UI — passwords redacted. */
  async list(orgId: string) {
    const cams = await this.prisma.camera.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    });
    return cams.map(({ password, ...rest }) => ({ ...rest, hasPassword: password.length > 0 }));
  }

  async create(input: CameraInput, orgId: string) {
    if (!BRAND_PROFILES[input.brand]) throw new BadRequestException(`unknown brand: ${input.brand}`);
    if (input.brand === 'generic' && !input.streamPath)
      throw new BadRequestException('generic camera requires streamPath');

    const base = slugify(input.name);
    let channel = base;
    for (
      let i = 2;
      await this.prisma.camera.findFirst({ where: { orgId, channel } });
      i++
    ) {
      channel = `${base}-${i}`;
    }

    const profile = BRAND_PROFILES[input.brand]!;
    const cam = await this.prisma.camera.create({
      data: {
        orgId,
        name: input.name,
        brand: input.brand,
        model: input.model,
        host: input.host,
        port: input.port ?? profile.defaultPort,
        username: input.username ?? 'admin',
        password: input.password ? encryptSecret(input.password) : '',
        streamPath: input.streamPath,
        quality: input.quality ?? 'sub',
        channel,
        bridgeId: input.bridgeId ?? 'default',
        enabled: input.enabled ?? true,
      },
    });
    const { password, ...rest } = cam;
    return rest;
  }

  async update(id: string, input: Partial<CameraInput>, orgId: string) {
    const existing = await this.prisma.camera.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('camera not found');
    const cam = await this.prisma.camera.update({
      where: { id },
      data: {
        name: input.name,
        brand: input.brand,
        model: input.model,
        host: input.host,
        port: input.port,
        username: input.username,
        // keep old password when the field is omitted/blank
        password: input.password ? encryptSecret(input.password) : undefined,
        streamPath: input.streamPath,
        quality: input.quality,
        bridgeId: input.bridgeId,
        enabled: input.enabled,
      },
    });
    const { password, ...rest } = cam;
    return rest;
  }

  async remove(id: string, orgId: string) {
    const existing = await this.prisma.camera.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('camera not found');
    await this.prisma.camera.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Bridge agent endpoint — returns full RTSP URLs (credentials included).
   * Guarded by BRIDGE_TOKEN when set.
   */
  async bridgeConfig(bridgeId: string, orgId: string) {
    const cams = await this.prisma.camera.findMany({
      where: { orgId, bridgeId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return cams.flatMap((c) => {
      try {
        return [
          {
            id: c.id,
            name: c.name,
            channel: c.channel,
            rtspUrl: buildRtspUrl({ ...c, password: decryptSecret(c.password) }),
          },
        ];
      } catch {
        // key changed since this row was written — surface it instead of feeding
        // the bridge a broken URL
        this.logger.error(
          `ถอดรหัสรหัสผ่านกล้อง "${c.name}" ไม่ได้ (DATA_ENCRYPTION_KEY เปลี่ยน?) — ข้ามกล้องนี้ กรอกรหัสใหม่ในหน้าจัดการกล้อง`,
        );
        return [];
      }
    });
  }
}
