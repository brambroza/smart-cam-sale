import { Controller, Get } from '@nestjs/common';
import { CONSENT_PURPOSE, CONSENT_TEXT, CONSENT_TEXT_HASH, CONSENT_VERSION } from './consent-policy';

@Controller('consent')
export class ConsentController {
  /** Current consent policy — the enroll form must show this exact text. */
  @Get('policy')
  policy() {
    return {
      purpose: CONSENT_PURPOSE,
      version: CONSENT_VERSION,
      text: CONSENT_TEXT,
      textHash: CONSENT_TEXT_HASH,
    };
  }
}
