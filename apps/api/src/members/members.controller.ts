import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { MembersService, StaffRef } from './members.service';
import type { JwtPayload } from '../auth/auth.service';

interface EnrollBody {
  fullName: string;
  displayName: string;
  gender?: 'male' | 'female' | 'unknown';
  birthYear?: number;
  phone?: string;
  email?: string;
  embedding: number[];
  consentAccepted?: boolean;
  consentVersion?: string;
}

type AuthedRequest = { user?: JwtPayload };

function staffOf(req: AuthedRequest): StaffRef | undefined {
  return req.user ? { id: req.user.sub, username: req.user.username } : undefined;
}

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

  @Get(':id/consents')
  consents(@Param('id') id: string) {
    return this.svc.consents(id);
  }

  @Post('enroll')
  enroll(@Body() body: EnrollBody, @Req() req: AuthedRequest) {
    return this.svc.enroll({ ...body, staff: staffOf(req) });
  }

  @Post(':id/face')
  registerFace(
    @Param('id') id: string,
    @Body() body: { embedding: number[]; consentAccepted?: boolean; consentVersion?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.svc.registerFace(id, body.embedding, {
      consentAccepted: body.consentAccepted,
      consentVersion: body.consentVersion,
      staff: staffOf(req),
    });
  }

  @Delete(':id/face')
  removeFace(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.removeFace(id, staffOf(req));
  }
}
