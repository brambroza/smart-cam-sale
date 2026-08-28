import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM secretbox for values that must be recoverable (camera RTSP
 * passwords). Format: `enc:v1:` + base64(iv[12] ‖ authTag[16] ‖ ciphertext).
 * Values without the prefix are legacy plaintext rows and are returned as-is
 * by decryptSecret so old data keeps working until re-encrypted.
 */
const PREFIX = 'enc:v1:';

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (!cachedKey) {
    const source =
      process.env.DATA_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
    if (!process.env.DATA_ENCRYPTION_KEY) {
      console.warn(
        '⚠️  DATA_ENCRYPTION_KEY ไม่ได้ตั้ง — derive คีย์เข้ารหัสจาก JWT_SECRET แทน ' +
          '(ใช้งานได้ แต่ production ควรตั้งแยก และห้ามเปลี่ยนคีย์หลังมีข้อมูลแล้ว ไม่งั้นถอดรหัสของเดิมไม่ได้)',
      );
    }
    cachedKey = createHash('sha256').update(source).digest();
  }
  return cachedKey;
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

/** Throws if the value is encrypted but the key is wrong/changed. */
export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) return value; // legacy plaintext row
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
