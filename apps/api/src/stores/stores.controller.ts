import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { StoresService } from './stores.service';
import { AdminOnly } from '../auth/admin.decorator';
import type { JwtPayload } from '../auth/auth.service';

type AuthedRequest = { user: JwtPayload };

@Controller('stores')
export class StoresController {
  constructor(private readonly svc: StoresService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.svc.list(req.user.orgId);
  }

  @AdminOnly()
  @Post()
  create(@Body() body: { code: string; name: string }, @Req() req: AuthedRequest) {
    return this.svc.create(req.user.orgId, body);
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string }, @Req() req: AuthedRequest) {
    return this.svc.update(id, req.user.orgId, body);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.remove(id, req.user.orgId);
  }
}
