import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Bootstrap: ensure an admin account exists so a fresh deploy is loginable. */
  async onModuleInit() {
    const count = await this.prisma.staffUser.count();
    if (count > 0) return;
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD ?? 'admin1234';
    await this.prisma.staffUser.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash(initialPassword, 10),
        displayName: 'Administrator',
        role: 'admin',
      },
    });
    this.logger.warn(
      `สร้างบัญชี admin เริ่มต้นแล้ว (username: admin) — ` +
        (process.env.ADMIN_INITIAL_PASSWORD
          ? 'ใช้รหัสจาก ADMIN_INITIAL_PASSWORD'
          : '⚠️ รหัสเริ่มต้น "admin1234" — เปลี่ยนทันทีผ่าน POST /auth/change-password'),
    );
  }

  async login(username: string, password: string) {
    const user = await this.prisma.staffUser.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.staffUser.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('รหัสผ่านเดิมไม่ถูกต้อง');
    }
    if (newPassword.length < 8) {
      throw new UnauthorizedException('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
    }
    await this.prisma.staffUser.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { ok: true };
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token);
  }
}
