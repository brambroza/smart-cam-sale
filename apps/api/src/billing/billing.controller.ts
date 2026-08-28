import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { BillingService, currentPeriod } from './billing.service';
import { SignupService } from './signup.service';
import { AdminOnly, SuperadminOnly } from '../auth/admin.decorator';
import { Public } from '../auth/public.decorator';
import type { JwtPayload } from '../auth/auth.service';

type AuthedRequest = { user: JwtPayload };

@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly signup: SignupService,
  ) {}

  // ── public lead form (landing page) ──

  @Public()
  @Post('signup')
  lead(
    @Body()
    body: { name?: string; storeName?: string; phone?: string; email?: string; message?: string; website?: string },
  ) {
    return this.signup.create(body);
  }

  // ── org admin: own usage + invoices ──

  @AdminOnly()
  @Get('billing/usage')
  myUsage(@Req() req: AuthedRequest, @Query('period') period?: string) {
    return this.billing.usage(req.user.orgId, period || currentPeriod());
  }

  @AdminOnly()
  @Get('billing/invoices')
  myInvoices(@Req() req: AuthedRequest) {
    return this.billing.listForOrg(req.user.orgId);
  }

  // ── superadmin: platform billing ──

  @SuperadminOnly()
  @Get('admin/billing/usage/:orgId')
  orgUsage(@Param('orgId') orgId: string, @Query('period') period?: string) {
    return this.billing.usage(orgId, period || currentPeriod());
  }

  @SuperadminOnly()
  @Get('admin/billing/invoices')
  allInvoices(@Query('period') period?: string) {
    return this.billing.listAll(period || undefined);
  }

  @SuperadminOnly()
  @Post('admin/billing/invoices')
  generate(
    @Body() body: { orgId: string; period?: string; amount?: number; note?: string },
  ) {
    return this.billing.generateInvoice(
      body.orgId,
      body.period || currentPeriod(),
      body.amount,
      body.note,
    );
  }

  @SuperadminOnly()
  @Post('admin/billing/invoices/:id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.billing.setStatus(id, body.status);
  }

  // ── superadmin: lead queue ──

  @SuperadminOnly()
  @Get('admin/signups')
  leads(@Query('status') status?: string) {
    return this.signup.list(status || undefined);
  }

  @SuperadminOnly()
  @Post('admin/signups/:id/status')
  leadStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.signup.setStatus(id, body.status);
  }
}
