import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notify/email.service';

@Injectable()
export class SignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** Public lead form on the landing page. Keep validation strict — it's unauthenticated. */
  async create(input: { name?: string; storeName?: string; phone?: string; email?: string; message?: string; website?: string }) {
    // honeypot: real users never fill the hidden "website" field
    if (input.website) return { ok: true };
    const name = input.name?.trim() ?? '';
    const storeName = input.storeName?.trim() ?? '';
    const phone = (input.phone ?? '').replace(/[^0-9+]/g, '');
    if (name.length < 2 || name.length > 100) throw new BadRequestException('กรุณากรอกชื่อ');
    if (storeName.length < 2 || storeName.length > 150) throw new BadRequestException('กรุณากรอกชื่อร้าน');
    if (phone.length < 9 || phone.length > 15) throw new BadRequestException('เบอร์โทรไม่ถูกต้อง');
    // crude flood guard: same phone can't file more than 3 requests a day
    const since = new Date(Date.now() - 86400000);
    const recent = await this.prisma.signupRequest.count({
      where: { phone, createdAt: { gte: since } },
    });
    if (recent >= 3) return { ok: true }; // silently accept — no oracle for spammers
    const lead = {
      name,
      storeName,
      phone,
      email: input.email?.trim().slice(0, 150) || null,
      message: input.message?.trim().slice(0, 1000) || null,
    };
    await this.prisma.signupRequest.create({ data: lead });
    // lead is already saved — the alert mail is best-effort and must not block
    this.email.sendLeadAlert(lead).catch(() => {});
    return { ok: true };
  }

  list(status?: string) {
    return this.prisma.signupRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async setStatus(id: string, status: string) {
    if (!['new', 'contacted', 'converted', 'rejected'].includes(status)) {
      throw new BadRequestException('status ไม่ถูกต้อง');
    }
    const lead = await this.prisma.signupRequest.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('ไม่พบรายการ');
    return this.prisma.signupRequest.update({ where: { id }, data: { status } });
  }
}
