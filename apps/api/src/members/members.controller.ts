import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { MembersService, StaffRef } from './members.service';
import { RecognitionService } from '../recognition/recognition.service';
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

type AuthedRequest = { user: JwtPayload };

function staffOf(req: AuthedRequest): StaffRef | undefined {
  return req.user ? { id: req.user.sub, username: req.user.username } : undefined;
}

@Controller('members')
export class MembersController {
  constructor(
    private readonly svc: MembersService,
    private readonly recognition: RecognitionService,
  ) {}

  @Get('stats')
  stats(@Req() req: AuthedRequest) {
    return this.svc.stats(req.user.orgId);
  }

  /** Lite mode: identify a customer by phone at the counter. */
  @Get('lookup')
  lookup(@Query('phone') phone: string, @Req() req: AuthedRequest) {
    return this.recognition.lookupByPhone(phone ?? '', req.user.orgId);
  }

  @Get()
  list(@Query('take') take: string | undefined, @Req() req: AuthedRequest) {
    return this.svc.list(Number(take) || 20, req.user.orgId);
  }

  @Get(':id')
  detail(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.detail(id, req.user.orgId);
  }

  @Get(':id/consents')
  consents(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.consents(id, req.user.orgId);
  }

  @Post('enroll')
  enroll(@Body() body: EnrollBody, @Req() req: AuthedRequest) {
    return this.svc.enroll({ ...body, staff: staffOf(req), orgId: req.user.orgId });
  }

  /** Lite mode: enroll by phone, no biometrics. */
  @Post('enroll-lite')
  enrollLite(
    @Body()
    body: {
      fullName: string;
      displayName: string;
      phone: string;
      gender?: 'male' | 'female' | 'unknown';
      birthYear?: number;
    },
    @Req() req: AuthedRequest,
  ) {
    return this.svc.enrollLite({ ...body, orgId: req.user.orgId });
  }

  @Post(':id/face')
  registerFace(
    @Param('id') id: string,
    @Body() body: { embedding: number[]; consentAccepted?: boolean; consentVersion?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.svc.registerFace(id, body.embedding, req.user.orgId, {
      consentAccepted: body.consentAccepted,
      consentVersion: body.consentVersion,
      staff: staffOf(req),
    });
  }

  @Delete(':id/face')
  removeFace(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.removeFace(id, req.user.orgId, staffOf(req));
  }
}
