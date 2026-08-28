import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.store.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(orgId: string, input: { code: string; name: string }) {
    const code = input.code?.trim();
    if (!code || !/^[a-zA-Z0-9_-]{1,24}$/.test(code)) {
      throw new BadRequestException('รหัสสาขาต้องเป็น a-z 0-9 _ - ยาว 1-24 ตัว');
    }
    if (!input.name?.trim()) throw new BadRequestException('ต้องมีชื่อสาขา');
    const dup = await this.prisma.store.findFirst({ where: { orgId, code } });
    if (dup) throw new BadRequestException('รหัสสาขานี้มีอยู่แล้ว');
    return this.prisma.store.create({
      data: { orgId, code, name: input.name.trim() },
    });
  }

  async update(id: string, orgId: string, input: { name?: string }) {
    const existing = await this.prisma.store.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('ไม่พบสาขา');
    return this.prisma.store.update({
      where: { id },
      data: { name: input.name?.trim() || undefined },
    });
  }

  async remove(id: string, orgId: string) {
    const existing = await this.prisma.store.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('ไม่พบสาขา');
    // purchases keep their storeCode — deleting a store never deletes history
    await this.prisma.store.delete({ where: { id } });
    return { ok: true };
  }
}
