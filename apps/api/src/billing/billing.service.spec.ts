import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { SignupService } from './signup.service';
import { PrismaService } from '../prisma.service';

function prismaMock() {
  return {
    organization: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'ร้านทดสอบ',
        pricePerStore: 2500,
        plan: 'pilot',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    store: { count: jest.fn().mockResolvedValue(3) },
    member: { count: jest.fn().mockResolvedValue(42) },
    visitLog: { count: jest.fn().mockResolvedValue(1200) },
    purchase: {
      aggregate: jest.fn().mockResolvedValue({ _count: { _all: 210 }, _sum: { total: 15500 } }),
    },
    invoice: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'inv1', status: 'draft', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'inv1', ...data })),
    },
    signupRequest: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'lead1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'lead1', status: 'new' }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'lead1', ...data })),
    },
  } as unknown as PrismaService;
}

describe('BillingService.usage + generateInvoice', () => {
  it('meters the month and prices billable stores × org rate', async () => {
    const svc = new BillingService(prismaMock());
    const u = await svc.usage('org1', '2026-08');
    expect(u).toMatchObject({
      stores: 3,
      billableStores: 3,
      pricePerStore: 2500,
      estimatedAmount: 7500,
      visits: 1200,
      purchases: 210,
      salesTotal: 15500,
    });
  });

  it('bills at least 1 store even before any Store rows exist', async () => {
    const prisma = prismaMock();
    (prisma.store.count as jest.Mock).mockResolvedValue(0);
    const svc = new BillingService(prisma);
    const u = await svc.usage('org1', '2026-08');
    expect(u.billableStores).toBe(1);
    expect(u.estimatedAmount).toBe(2500);
  });

  it('rejects a malformed period', async () => {
    const svc = new BillingService(prismaMock());
    await expect(svc.usage('org1', '2026-13')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.usage('org1', 'สิงหา')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates INV-numbered invoice with due date; blocks a duplicate non-void period', async () => {
    const prisma = prismaMock();
    const svc = new BillingService(prisma);
    const inv = await svc.generateInvoice('org1', '2026-08');
    expect(inv.number).toMatch(/^INV-202608-[0-9A-F]{4}$/);
    expect(inv.amount).toBe(7500);
    expect(inv.dueDate).toBeInstanceOf(Date);

    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      number: 'INV-202608-AAAA',
      status: 'sent',
    });
    await expect(svc.generateInvoice('org1', '2026-08')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts a manual amount override', async () => {
    const svc = new BillingService(prismaMock());
    const inv = await svc.generateInvoice('org1', '2026-08', 999, 'ส่วนลดเปิดตัว');
    expect(inv.amount).toBe(999);
    expect(inv.note).toBe('ส่วนลดเปิดตัว');
  });
});

describe('BillingService.setStatus', () => {
  it('marks paid with paidAt; a paid invoice can only become void', async () => {
    const prisma = prismaMock();
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'inv1', status: 'sent', paidAt: null });
    const svc = new BillingService(prisma);
    const paid = await svc.setStatus('inv1', 'paid');
    expect(paid.paidAt).toBeInstanceOf(Date);

    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'inv1', status: 'paid', paidAt: new Date() });
    await expect(svc.setStatus('inv1', 'sent')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.setStatus('inv1', 'void')).resolves.toBeTruthy();
  });

  it('rejects unknown statuses', async () => {
    const svc = new BillingService(prismaMock());
    await expect(svc.setStatus('inv1', 'gone')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SignupService.create — public form hardening', () => {
  const VALID = { name: 'คุณเอ', storeName: 'ร้านกาแฟ', phone: '0812345678' };

  it('accepts a valid lead and normalizes the phone', async () => {
    const prisma = prismaMock();
    const svc = new SignupService(prisma);
    await expect(svc.create({ ...VALID, phone: '081-234-5678' })).resolves.toEqual({ ok: true });
    expect(prisma.signupRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: '0812345678' }) }),
    );
  });

  it('rejects missing fields and bad phones', async () => {
    const svc = new SignupService(prismaMock());
    await expect(svc.create({ ...VALID, name: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create({ ...VALID, storeName: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.create({ ...VALID, phone: '12' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('silently swallows honeypot hits and per-phone floods without creating rows', async () => {
    const prisma = prismaMock();
    const svc = new SignupService(prisma);
    await expect(svc.create({ ...VALID, website: 'spam.example' })).resolves.toEqual({ ok: true });
    (prisma.signupRequest.count as jest.Mock).mockResolvedValue(3);
    await expect(svc.create(VALID)).resolves.toEqual({ ok: true });
    expect(prisma.signupRequest.create).not.toHaveBeenCalled();
  });
});
