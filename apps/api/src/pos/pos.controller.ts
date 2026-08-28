import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import { PosService, PosSaleInput } from './pos.service';
import { Public } from '../auth/public.decorator';
import { AdminOnly } from '../auth/admin.decorator';
import type { JwtPayload } from '../auth/auth.service';

type AuthedRequest = { user: JwtPayload };

@Controller('pos')
export class PosController {
  constructor(private readonly svc: PosService) {}

  // ── endpoints called by the store's POS (x-api-key, no JWT) ──

  /** Connectivity check for POS setup. */
  @Public()
  @Get('ping')
  async ping(@Headers('x-api-key') apiKey?: string) {
    const key = await this.svc.verifyKey(apiKey);
    return { ok: true, name: key.name, storeCode: key.storeCode };
  }

  /** Push one completed sale from the POS. See docs/POS-INTEGRATION.md. */
  @Public()
  @Post('sales')
  async sale(@Body() body: PosSaleInput, @Headers('x-api-key') apiKey?: string) {
    const key = await this.svc.verifyKey(apiKey);
    return this.svc.recordSale(body, key.storeCode, key.orgId);
  }

  // ── key management from the back office (admin JWT) ──

  @AdminOnly()
  @Get('keys')
  keys(@Req() req: AuthedRequest) {
    return this.svc.listKeys(req.user.orgId);
  }

  @AdminOnly()
  @Post('keys')
  createKey(@Body() body: { name: string; storeCode?: string }, @Req() req: AuthedRequest) {
    return this.svc.createKey(body.name, req.user.orgId, body.storeCode);
  }

  @AdminOnly()
  @Patch('keys/:id')
  setEnabled(
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
    @Req() req: AuthedRequest,
  ) {
    return this.svc.setKeyEnabled(id, !!body.enabled, req.user.orgId);
  }

  @AdminOnly()
  @Delete('keys/:id')
  deleteKey(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.deleteKey(id, req.user.orgId);
  }
}
