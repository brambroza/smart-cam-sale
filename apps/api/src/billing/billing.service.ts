import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service';

function parsePeriod(period: string): { start: Date; end: Date } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new BadRequestException('period ต้องเป็นรูปแบบ YYYY-MM');
  }
  const [y, m] = period.split('-').map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m!, 1)); // exclusive
  return { start, end };
}

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Metering behind every invoice: what the org actually consumed that month. */
  async usage(orgId: string, period: string) {
    const { start, end } = parsePeriod(period);
    const [org, storeCount, memberTotal, newMembers, visits, purchaseAgg] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, pricePerStore: true, plan: true },
      }),
      this.prisma.store.count({ where: { orgId } }),
      this.prisma.member.count({ where: { orgId } }),
      this.prisma.member.count({ where: { orgId, memberSince: { gte: start, lt: end } } }),
      this.prisma.visitLog.count({ where: { orgId, visitedAt: { gte: start, lt: end } } }),
      this.prisma.purchase.aggregate({
        where: { orgId, boughtAt: { gte: start, lt: end } },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);
    if (!org) throw new NotFoundException('ไม่พบองค์กร');
    const billableStores = Math.max(storeCount, 1);
    return {
      orgId,
      orgName: org.name,
      period,
      plan: org.plan,
      stores: storeCount,
      billableStores,
      pricePerStore: org.pricePerStore,
      estimatedAmount: billableStores * org.pricePerStore,
      members: memberTotal,
      newMembers,
      visits,
      purchases: purchaseAgg._count._all,
      salesTotal: purchaseAgg._sum.total ?? 0,
    };
  }

  /** Create the month's invoice: billable stores × the org's negotiated rate. */
  async generateInvoice(orgId: string, period: string, overrideAmount?: number, note?: string) {
    const u = await this.usage(orgId, period);
    const existing = await this.prisma.invoice.findFirst({
      where: { orgId, period, status: { not: 'void' } },
    });
    if (existing) {
      throw new BadRequestException(
        `มีใบแจ้งหนี้ ${existing.number} ของงวดนี้อยู่แล้ว (${existing.status}) — void ก่อนจึงออกใหม่ได้`,
      );
    }
    if (overrideAmount !== undefined && !(overrideAmount >= 0)) {
      throw new BadRequestException('ยอดที่กำหนดเองต้องเป็นตัวเลข >= 0');
    }
    const number = `INV-${period.replace('-', '')}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const { end } = parsePeriod(period);
    return this.prisma.invoice.create({
      data: {
        orgId,
        number,
        period,
        amount: overrideAmount ?? u.estimatedAmount,
        note,
        dueDate: new Date(end.getTime() + 15 * 86400000), // ครบกำหนด 15 วันหลังสิ้นงวด
      },
    });
  }

  /** Org admin's own invoices. */
  listForOrg(orgId: string) {
    return this.prisma.invoice.findMany({
      where: { orgId },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    });
  }

  /** Superadmin: all invoices with org names attached. */
  async listAll(period?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: period ? { period } : {},
      orderBy: { issuedAt: 'desc' },
      take: 200,
    });
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: [...new Set(invoices.map((i) => i.orgId))] } },
      select: { id: true, name: true, slug: true },
    });
    const nameOf = new Map(orgs.map((o) => [o.id, o]));
    return invoices.map((i) => ({ ...i, org: nameOf.get(i.orgId) ?? null }));
  }

  async setStatus(id: string, status: string) {
    if (!['sent', 'paid', 'void'].includes(status)) {
      throw new BadRequestException('status ต้องเป็น sent | paid | void');
    }
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('ไม่พบใบแจ้งหนี้');
    if (invoice.status === 'paid' && status !== 'void') {
      throw new BadRequestException('ใบแจ้งหนี้ที่จ่ายแล้วเปลี่ยนได้เฉพาะเป็น void');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status, paidAt: status === 'paid' ? new Date() : invoice.paidAt },
    });
  }
}
