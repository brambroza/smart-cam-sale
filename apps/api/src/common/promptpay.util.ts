import { BadRequestException } from '@nestjs/common';

/**
 * PromptPay QR payload (EMVCo merchant-presented, Thai PromptPay AID).
 * Display-only payment request — no gateway involved: the customer scans with
 * any Thai banking app and the money goes straight to the shop's account.
 */

const PROMPTPAY_AID = 'A000000677010111';

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — the EMVCo checksum. */
export function crc16ccitt(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

/**
 * Accepts what a shop owner would type — "081-234-5678", a 13-digit citizen
 * id, or a 15-digit e-wallet id — and returns the canonical digits, or throws
 * a Thai-message error for anything else.
 */
export function normalizePromptPayId(raw: string): string {
  const digits = (raw ?? '').replace(/[^0-9]/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return digits; // mobile
  if (digits.length === 13 || digits.length === 15) return digits; // citizen / e-wallet
  throw new BadRequestException(
    'PromptPay ต้องเป็นเบอร์มือถือ 10 หลัก, เลขบัตรประชาชน 13 หลัก หรือ e-Wallet 15 หลัก',
  );
}

/** Build the scannable payload. Omit amount for a reusable (static) QR. */
export function buildPromptPayPayload(target: string, amount?: number): string {
  const id = normalizePromptPayId(target);
  let account: string;
  if (id.length === 10) {
    account = tlv('01', '0066' + id.slice(1)); // phone: country code, drop leading 0
  } else if (id.length === 13) {
    account = tlv('02', id);
  } else {
    account = tlv('03', id);
  }

  // field order matches the de-facto PromptPay payload every Thai bank app reads
  const withAmount = amount !== undefined && amount > 0;
  let payload =
    tlv('00', '01') + // payload format
    tlv('01', withAmount ? '12' : '11') + // dynamic vs static
    tlv('29', tlv('00', PROMPTPAY_AID) + account) +
    tlv('58', 'TH') +
    tlv('53', '764'); // THB
  if (withAmount) payload += tlv('54', amount.toFixed(2));
  payload += '6304'; // CRC id+len, checksum covers everything incl. these 4 chars
  return payload + crc16ccitt(payload).toString(16).toUpperCase().padStart(4, '0');
}
