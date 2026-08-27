import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string, category?: string) {
    return this.prisma.product.findMany({
      where: {
        active: true,
        AND: [
          q ? { name: { contains: q, mode: 'insensitive' } } : {},
          category ? { category } : {},
        ],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 200,
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
