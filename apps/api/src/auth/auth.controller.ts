import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { AdminOnly } from './admin.decorator';
import type { JwtPayload } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly svc: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.svc.login(body.username, body.password);
  }

  @Post('change-password')
  changePassword(
    @Req() req: { user: JwtPayload },
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.svc.changePassword(req.user.sub, body.currentPassword, body.newPassword);
  }

  // ── staff management (back office) ──

  @AdminOnly()
  @Get('users')
  users(@Req() req: { user: JwtPayload }) {
    return this.svc.listUsers(req.user.orgId);
  }

  @AdminOnly()
  @Post('users')
  createUser(
    @Body() body: { username: string; password: string; displayName: string; role?: string },
    @Req() req: { user: JwtPayload },
  ) {
    return this.svc.createUser({ ...body, orgId: req.user.orgId });
  }

  @AdminOnly()
  @Post('users/:id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
    @Req() req: { user: JwtPayload },
  ) {
    return this.svc.resetPassword(id, body.newPassword, req.user.orgId);
  }

  @AdminOnly()
  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @Req() req: { user: JwtPayload }) {
    return this.svc.deleteUser(id, req.user.sub, req.user.orgId);
  }
}
