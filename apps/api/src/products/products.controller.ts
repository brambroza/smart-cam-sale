import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductsService, ProductInput } from './products.service';
import { AdminOnly } from '../auth/admin.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly svc: ProductsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('all') all?: string,
  ) {
    return this.svc.list(q, category, all === '1');
  }

  @Get('categories')
  categories() {
    return this.svc.categories();
  }

  @AdminOnly()
  @Post()
  create(@Body() body: ProductInput) {
    return this.svc.create(body);
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<ProductInput>) {
    return this.svc.update(id, body);
  }
}
