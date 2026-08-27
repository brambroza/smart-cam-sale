import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly svc: MembersService) {}

  @Get('stats')
  stats() {
    return this.svc.stats();
  }

  @Get()
  list(@Query('take') take?: string) {
    return this.svc.list(Number(take) || 20);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(id);
  }

  @Post(':id/face')
  registerFace(
    @Param('id') id: string,
    @Body() body: { embedding: number[] },
  ) {
    return this.svc.registerFace(id, body.embedding);
  }

  @Delete(':id/face')
  removeFace(@Param('id') id: string) {
    return this.svc.removeFace(id);
  }
}
