import { Body, Controller, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
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
}
