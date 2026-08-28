import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface ProductInput {
  name: string;
  category: string;
  price: number;
  sku?: string;
  targetGender?: 'male' | 'female' | 'unknown';
  minAge?: number;
  maxAge?: number;
  timeOfDay?: string;
  active?: boolean;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string, q?: string, category?: string, includeInactive = false) {
    return this.prisma.product.findMany({
      where: {
        orgId,
        ...(includeInactive ? {} : { active: true }),
        AND: [
          q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { sku: { contains: q } },
                ],
              }
            : {},
          category ? { category } : {},
        ],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 200,
    });
  }

  async create(input: ProductInput, orgId: string) {
    if (!input.name?.trim() || !input.category?.trim())
      throw new BadRequestException('ต้องมีชื่อสินค้าและหมวดหมู่');
    if (!(input.price > 0)) throw new BadRequestException('ราคาต้องมากกว่า 0');
    return this.prisma.product.create({
      data: {
        orgId,
        name: input.name.trim(),
        category: input.category.trim(),
        price: input.price,
        sku: input.sku?.trim() || null,
        targetGender: input.targetGender ?? 'unknown',
        minAge: input.minAge,
        maxAge: input.maxAge,
        timeOfDay: input.timeOfDay,
        active: input.active ?? true,
      },
    });
  }

  async update(id: string, input: Partial<ProductInput>, orgId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('ไม่พบสินค้า');
    if (input.price !== undefined && !(input.price > 0))
      throw new BadRequestException('ราคาต้องมากกว่า 0');
    return this.prisma.product.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        category: input.category?.trim(),
        price: input.price,
        sku: input.sku !== undefined ? input.sku.trim() || null : undefined,
        targetGender: input.targetGender,
        minAge: input.minAge,
        maxAge: input.maxAge,
        timeOfDay: input.timeOfDay,
        active: input.active,
      },
    });
  }

  async categories(orgId: string) {
    const rows = await this.prisma.product.groupBy({
      by: ['category'],
      where: { orgId, active: true },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => ({ name: r.category, count: r._count._all }));
  }
}
