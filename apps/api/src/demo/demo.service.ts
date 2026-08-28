import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';

/** Public demo credentials — shown on the login page on purpose. */
export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'demo@1234';
const DEMO_SLUG = 'demo';

/**
 * Sales demo: a sandbox organization prospects can explore from the login
 * page without signing up. Runs at every startup and is idempotent:
 *
 * - ensures the demo org exists (camera tier, so the webcam console works)
 * - ensures the `demo` account lives INSIDE the demo org — if someone created
 *   it under a real org, it is moved, so public credentials can never open
 *   real customer data — and resets its password/role to the known state,
 *   which also self-heals anything a visitor managed to break
 * - seeds sample products/members/purchases once, so the console, phone
 *   lookup, back office, and ROI views all have something to show
 */
@Injectable()
export class DemoService implements OnModuleInit {
  private readonly logger = new Logger(DemoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureDemo();
    } catch (e) {
      // a broken demo must never block the real app from starting
      this.logger.error(`demo bootstrap failed: ${(e as Error).message}`);
    }
  }

  async ensureDemo() {
    let org = await this.prisma.organization.findUnique({ where: { slug: DEMO_SLUG } });
    if (!org) {
      org = await this.prisma.organization.create({
        data: {
          name: 'ร้านกาแฟเดโม่',
          slug: DEMO_SLUG,
          cameraEnabled: true,
          bridgeToken: `brg_${randomBytes(24).toString('hex')}`,
        },
      });
      this.logger.log('สร้างองค์กรเดโมแล้ว');
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const existing = await this.prisma.staffUser.findUnique({
      where: { username: DEMO_USERNAME },
    });
    if (existing) {
      if (existing.orgId !== org.id) {
        this.logger.warn('บัญชี demo อยู่ผิดองค์กร — ย้ายเข้าองค์กรเดโมเพื่อกันข้อมูลจริงรั่ว');
      }
      await this.prisma.staffUser.update({
        where: { id: existing.id },
        data: { orgId: org.id, role: 'admin', passwordHash, displayName: 'ผู้เยี่ยมชมเดโม' },
      });
    } else {
      await this.prisma.staffUser.create({
        data: {
          username: DEMO_USERNAME,
          passwordHash,
          displayName: 'ผู้เยี่ยมชมเดโม',
          role: 'admin',
          orgId: org.id,
        },
      });
    }

    await this.seed(org.id);
  }

  /** One-time sample data; skipped once the demo org has any products. */
  private async seed(orgId: string) {
    const count = await this.prisma.product.count({ where: { orgId } });
    if (count > 0) return;

    const products = await Promise.all(
      [
        { name: 'ลาเต้เย็น', category: 'เครื่องดื่ม', price: 65, timeOfDay: 'morning' },
        { name: 'อเมริกาโน่ร้อน', category: 'เครื่องดื่ม', price: 55, timeOfDay: 'morning' },
        { name: 'ชาเขียวมัทฉะ', category: 'เครื่องดื่ม', price: 75, timeOfDay: 'afternoon' },
        { name: 'ครัวซองต์เนยสด', category: 'เบเกอรี่', price: 49 },
        { name: 'เค้กส้มหน้านิ่ม', category: 'เบเกอรี่', price: 89 },
        { name: 'คุกกี้ช็อกชิพ', category: 'เบเกอรี่', price: 35 },
      ].map((p) => this.prisma.product.create({ data: { orgId, ...p } })),
    );

    const members = await Promise.all(
      [
        { fullName: 'สมหญิง ใจดี', displayName: 'คุณเมย์', phone: '0811111111', gender: 'female', tier: 'gold', points: 420 },
        { fullName: 'สมชาย ขยันดี', displayName: 'พี่ชาย', phone: '0822222222', gender: 'male', tier: 'silver', points: 180 },
        { fullName: 'อรทัย มาประจำ', displayName: 'คุณอร', phone: '0833333333', gender: 'female', tier: 'bronze', points: 95 },
      ].map((m) =>
        this.prisma.member.create({ data: { orgId, ...m, gender: m.gender as never, tier: m.tier as never } }),
      ),
    );

    // a little purchase history so recommendations/ROI/receipts have substance
    const buy = (memberIdx: number, items: [number, number][], daysAgo: number, assisted = false) =>
      this.prisma.purchase.create({
        data: {
          orgId,
          memberId: members[memberIdx]!.id,
          assisted,
          total: items.reduce((s, [p, q]) => s + products[p]!.price * q, 0),
          boughtAt: new Date(Date.now() - daysAgo * 86400000),
          items: {
            create: items.map(([p, q]) => ({
              productId: products[p]!.id,
              qty: q,
              price: products[p]!.price,
            })),
          },
        },
      });
    await buy(0, [[0, 1], [3, 1]], 1, true);
    await buy(0, [[0, 1]], 3, true);
    await buy(1, [[1, 2]], 2);
    await buy(2, [[2, 1], [5, 2]], 5);

    this.logger.log('seed ข้อมูลตัวอย่างในองค์กรเดโมแล้ว');
  }
}
