import { Body, Controller, Delete, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { PosService, PosSaleInput } from './pos.service';
import { Public } from '../auth/public.decorator';
import { AdminOnly } from '../auth/admin.decorator';

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
    return this.svc.recordSale(body, key.storeCode);
  }

  // ── key management from the back office (admin JWT) ──

  @AdminOnly()
  @Get('keys')
  keys() {
    return this.svc.listKeys();
  }

  @AdminOnly()
  @Post('keys')
  createKey(@Body() body: { name: string; storeCode?: string }) {
    return this.svc.createKey(body.name, body.storeCode);
  }

  @AdminOnly()
  @Patch('keys/:id')
  setEnabled(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.svc.setKeyEnabled(id, !!body.enabled);
  }

  @AdminOnly()
  @Delete('keys/:id')
  deleteKey(@Param('id') id: string) {
    return this.svc.deleteKey(id);
  }
}
