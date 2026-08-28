import { decryptSecret, encryptSecret, isEncryptedSecret, sha256Hex } from './crypto.util';

describe('crypto.util', () => {
  it('round-trips a secret including Thai and special characters', () => {
    const plain = 'p@ss:with/special?chars&ไทย รหัสผ่าน';
    const enc = encryptSecret(plain);
    expect(isEncryptedSecret(enc)).toBe(true);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('randomizes IV — same input gives different ciphertext', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('passes legacy plaintext values through unchanged', () => {
    expect(isEncryptedSecret('plain-old-password')).toBe(false);
    expect(decryptSecret('plain-old-password')).toBe('plain-old-password');
  });

  it('throws on tampered ciphertext (GCM auth)', () => {
    const enc = encryptSecret('secret');
    const raw = Buffer.from(enc.slice('enc:v1:'.length), 'base64');
    raw[raw.length - 1] ^= 0xff; // flip a ciphertext bit
    const tampered = 'enc:v1:' + raw.toString('base64');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('sha256Hex is stable', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
