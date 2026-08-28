import { BadRequestException } from '@nestjs/common';
import { buildPromptPayPayload, crc16ccitt, normalizePromptPayId } from './promptpay.util';

describe('crc16ccitt', () => {
  it('matches the CRC-16/CCITT-FALSE standard check value', () => {
    // canonical check input for this CRC variant
    expect(crc16ccitt('123456789')).toBe(0x29b1);
  });
});

describe('normalizePromptPayId', () => {
  it('strips formatting from phone numbers', () => {
    expect(normalizePromptPayId('081-234-5678')).toBe('0812345678');
    expect(normalizePromptPayId('08 1234 5678')).toBe('0812345678');
  });

  it('accepts 13-digit citizen ids and 15-digit e-wallet ids', () => {
    expect(normalizePromptPayId('1-2345-67890-12-3')).toBe('1234567890123');
    expect(normalizePromptPayId('123456789012345')).toBe('123456789012345');
  });

  it('rejects anything else', () => {
    expect(() => normalizePromptPayId('12345')).toThrow(BadRequestException);
    expect(() => normalizePromptPayId('')).toThrow(BadRequestException);
    expect(() => normalizePromptPayId('9812345678')).toThrow(BadRequestException); // not 0-leading
  });
});

describe('buildPromptPayPayload', () => {
  it('produces the reference payload structure for phone 000-000-0000', () => {
    // body layout matches the de-facto promptpay-qr reference byte-for-byte;
    // CRC suffix cross-checked with two independent CRC-16/CCITT-FALSE impls
    expect(buildPromptPayPayload('000-000-0000')).toBe(
      '00020101021129370016A000000677010111011300660000000005802TH530376463048956',
    );
  });

  it('emits a dynamic payload with the amount when one is given', () => {
    const p = buildPromptPayPayload('0812345678', 187.5);
    expect(p).toContain('010212'); // dynamic
    expect(p).toContain('0113006681234567'+ '8'); // 0066 + phone without leading 0
    expect(p).toContain('5406187.50'); // tag 54, len 06, two decimals
    expect(p).toMatch(/6304[0-9A-F]{4}$/);
  });

  it('static payload omits the amount tag entirely', () => {
    const p = buildPromptPayPayload('0812345678');
    expect(p).toContain('010211');
    // currency tag runs straight into the CRC — no 54 (amount) tag between them
    expect(p).toMatch(/53037646304[0-9A-F]{4}$/);
  });
});
