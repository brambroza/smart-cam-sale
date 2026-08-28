import { Controller, Get, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma.service';

interface ComponentHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

const startedAt = Date.now();

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness — cheap, no dependencies. Used by the container probe. */
  @Public()
  @Get()
  health() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  /**
   * Readiness for external monitors — actually touches the DB and the AI
   * service. Returns 503 when any component is down so a plain HTTP check
   * (uptime workflow, Azure availability test) alerts without parsing JSON.
   */
  @Public()
  @Get('deep')
  async deep() {
    const [db, ai] = await Promise.all([this.checkDb(), this.checkAi()]);
    const ok = db.ok && ai.ok;
    const body = {
      status: ok ? 'ok' : 'degraded',
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      ts: new Date().toISOString(),
      components: { db, ai },
    };
    if (!ok) throw new ServiceUnavailableException(body);
    return body;
  }

  private async checkDb(): Promise<ComponentHealth> {
    const t0 = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 5s')), 5000)),
      ]);
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - t0, error: (e as Error).message };
    }
  }

  private async checkAi(): Promise<ComponentHealth> {
    const t0 = Date.now();
    const base = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new HttpException(`HTTP ${res.status}`, res.status);
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (e) {
      return { ok: false, latencyMs: Date.now() - t0, error: (e as Error).message };
    }
  }
}
