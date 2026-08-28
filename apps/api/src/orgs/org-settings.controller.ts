import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { AdminOnly } from '../auth/admin.decorator';
import type { JwtPayload } from '../auth/auth.service';

type AuthedRequest = { user: JwtPayload };

/** Own-org settings, editable by the org's admin (unlike /admin/orgs which is platform-level). */
@AdminOnly()
@Controller('org')
export class OrgSettingsController {
  constructor(private readonly svc: OrgsService) {}

  @Get('settings')
  settings(@Req() req: AuthedRequest) {
    return this.svc.getSettings(req.user.orgId);
  }

  @Post('settings')
  update(@Body() body: { promptpayId?: string }, @Req() req: AuthedRequest) {
    return this.svc.setPromptPayId(req.user.orgId, body.promptpayId ?? '');
  }
}
