import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CamerasService, CameraInput } from './cameras.service';

@Controller('cameras')
export class CamerasController {
  constructor(private readonly svc: CamerasService) {}

  @Get('profiles')
  profiles() {
    return this.svc.profiles();
  }

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() body: CameraInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<CameraInput>) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  /** Bridge agents pull their camera list (with credentials) here. */
  @Get('bridge/:bridgeId')
  bridgeConfig(
    @Param('bridgeId') bridgeId: string,
    @Headers('x-bridge-token') token?: string,
  ) {
    const required = process.env.BRIDGE_TOKEN;
    if (required && token !== required) {
      throw new UnauthorizedException('invalid bridge token');
    }
    return this.svc.bridgeConfig(bridgeId);
  }
}
