import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { CamerasService, CameraInput } from './cameras.service';
import { OrgsService } from '../orgs/orgs.service';
import { Public } from '../auth/public.decorator';
import type { JwtPayload } from '../auth/auth.service';

type AuthedRequest = { user: JwtPayload };

@Controller('cameras')
export class CamerasController {
  constructor(
    private readonly svc: CamerasService,
    private readonly orgs: OrgsService,
  ) {}

  @Get('profiles')
  profiles() {
    return this.svc.profiles();
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.svc.list(req.user.orgId);
  }

  @Post()
  create(@Body() body: CameraInput, @Req() req: AuthedRequest) {
    return this.svc.create(body, req.user.orgId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<CameraInput>, @Req() req: AuthedRequest) {
    return this.svc.update(id, body, req.user.orgId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.remove(id, req.user.orgId);
  }

  /** Bridge agents pull their camera list (with credentials) here — authenticated
   *  by the org's bridgeToken (x-bridge-token), not a staff JWT. */
  @Public()
  @Get('bridge/:bridgeId')
  async bridgeConfig(
    @Param('bridgeId') bridgeId: string,
    @Headers('x-bridge-token') token?: string,
  ) {
    const org = await this.orgs.resolveBridgeToken(token);
    if (!org) throw new UnauthorizedException('invalid bridge token');
    return this.svc.bridgeConfig(bridgeId, org.orgId);
  }
}
