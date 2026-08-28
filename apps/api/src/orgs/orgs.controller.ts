import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { SuperadminOnly } from '../auth/admin.decorator';

/** Platform-level org management — superadmin only. */
@SuperadminOnly()
@Controller('admin/orgs')
export class OrgsController {
  constructor(private readonly svc: OrgsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(
    @Body()
    body: { name: string; slug: string; adminUsername: string; adminPassword: string },
  ) {
    return this.svc.create(body);
  }

  @Post(':id/rotate-bridge-token')
  rotate(@Param('id') id: string) {
    return this.svc.rotateBridgeToken(id);
  }

  @Post(':id/plan')
  setPlan(@Param('id') id: string, @Body() body: { plan: string }) {
    return this.svc.setPlan(id, body.plan);
  }
}
