import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BRAND_PROFILES, buildRtspUrl } from './camera-profiles';

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
export class CamerasService {
  constructor(private readonly prisma: PrismaService) {}

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
  async list() {
    const cams = await this.prisma.camera.findMany({ orderBy: { createdAt: 'asc' } });
    return cams.map(({ password, ...rest }) => ({ ...rest, hasPassword: password.length > 0 }));
  }

  async create(input: CameraInput) {
    if (!BRAND_PROFILES[input.brand]) throw new BadRequestException(`unknown brand: ${input.brand}`);
    if (input.brand === 'generic' && !input.streamPath)
      throw new BadRequestException('generic camera requires streamPath');

    const base = slugify(input.name);
    let channel = base;
    for (let i = 2; await this.prisma.camera.findUnique({ where: { channel } }); i++) {
      channel = `${base}-${i}`;
    }

    const profile = BRAND_PROFILES[input.brand]!;
    const cam = await this.prisma.camera.create({
      data: {
        name: input.name,
        brand: input.brand,
        model: input.model,
        host: input.host,
        port: input.port ?? profile.defaultPort,
        username: input.username ?? 'admin',
        password: input.password,
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

  async update(id: string, input: Partial<CameraInput>) {
    const existing = await this.prisma.camera.findUnique({ where: { id } });
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
        password: input.password ? input.password : undefined,
        streamPath: input.streamPath,
        quality: input.quality,
        bridgeId: input.bridgeId,
        enabled: input.enabled,
      },
    });
    const { password, ...rest } = cam;
    return rest;
  }

  async remove(id: string) {
    await this.prisma.camera.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('camera not found');
    });
    return { ok: true };
  }

  /**
   * Bridge agent endpoint — returns full RTSP URLs (credentials included).
   * Guarded by BRIDGE_TOKEN when set.
   */
  async bridgeConfig(bridgeId: string) {
    const cams = await this.prisma.camera.findMany({
      where: { bridgeId, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return cams.map((c) => ({
      id: c.id,
      name: c.name,
      channel: c.channel,
      rtspUrl: buildRtspUrl(c),
    }));
  }
}
