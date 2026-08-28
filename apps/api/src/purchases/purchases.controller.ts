import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PurchasesService, PurchaseItemInput } from './purchases.service';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly svc: PurchasesService) {}

  @Post()
  record(@Body() body: { memberId: string; items: PurchaseItemInput[]; storeCode?: string }) {
    return this.svc.record(body);
  }

  @Get('recent')
  recent(@Query('take') take?: string) {
    return this.svc.recent(Number(take) || 20);
  }
}
