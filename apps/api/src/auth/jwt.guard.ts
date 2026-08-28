import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, JwtPayload } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ADMIN_ONLY_KEY } from './admin.decorator';

/** Global HTTP guard — every REST route requires a Bearer JWT unless @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WS messages are authenticated at connection time by the gateway.
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
    const header = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('ต้องเข้าสู่ระบบก่อน');
    let payload: JwtPayload;
    try {
      payload = await this.auth.verifyToken(token);
    } catch {
      throw new UnauthorizedException('token ไม่ถูกต้องหรือหมดอายุ');
    }
    req.user = payload;

    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (adminOnly && payload.role !== 'admin') {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบ (admin) เท่านั้น');
    }
    return true;
  }
}
