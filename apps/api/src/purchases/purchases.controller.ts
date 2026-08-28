import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { PurchasesService, PurchaseItemInput } from './purchases.service';
import type { JwtPayload } from '../auth/auth.service';

type AuthedRequest = { user: JwtPayload };

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly svc: PurchasesService) {}

  @Post()
  record(
    @Body() body: { memberId: string; items: PurchaseItemInput[]; storeCode?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.svc.record(body, req.user.orgId);
  }

  @Get('recent')
  recent(@Req() req: AuthedRequest, @Query('take') take?: string) {
    return this.svc.recent(req.user.orgId, Number(take) || 20);
  }

  @Get('summary')
  summary(
    @Req() req: AuthedRequest,
    @Query('days') days?: string,
    @Query('store') store?: string,
  ) {
    return this.svc.summary(req.user.orgId, Number(days) || 7, store || undefined);
  }
}
