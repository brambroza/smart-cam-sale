import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ProductsService, ProductInput } from './products.service';
import { AdminOnly } from '../auth/admin.decorator';
import type { JwtPayload } from '../auth/auth.service';

type AuthedRequest = { user: JwtPayload };

@Controller('products')
export class ProductsController {
  constructor(private readonly svc: ProductsService) {}

  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('all') all?: string,
  ) {
    return this.svc.list(req.user.orgId, q, category, all === '1');
  }

  @Get('categories')
  categories(@Req() req: AuthedRequest) {
    return this.svc.categories(req.user.orgId);
  }

  @AdminOnly()
  @Post()
  create(@Body() body: ProductInput, @Req() req: AuthedRequest) {
    return this.svc.create(body, req.user.orgId);
  }

  @AdminOnly()
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<ProductInput>, @Req() req: AuthedRequest) {
    return this.svc.update(id, body, req.user.orgId);
  }
}
