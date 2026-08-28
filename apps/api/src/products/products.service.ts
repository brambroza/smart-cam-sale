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

  async list(q?: string, category?: string, includeInactive = false) {
    return this.prisma.product.findMany({
      where: {
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

  async create(input: ProductInput) {
    if (!input.name?.trim() || !input.category?.trim())
      throw new BadRequestException('ต้องมีชื่อสินค้าและหมวดหมู่');
    if (!(input.price > 0)) throw new BadRequestException('ราคาต้องมากกว่า 0');
    return this.prisma.product.create({
      data: {
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

  async update(id: string, input: Partial<ProductInput>) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
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

  async categories() {
    const rows = await this.prisma.product.groupBy({
      by: ['category'],
      where: { active: true },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => ({ name: r.category, count: r._count._all }));
  }
}
