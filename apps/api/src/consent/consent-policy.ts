import { sha256Hex } from '../common/crypto.util';

/**
 * Consent text shown to the customer at enrollment. Bump CONSENT_VERSION on
 * every wording change — enrollments sent with a stale version are rejected so
 * the stored evidence always matches the text the customer actually saw.
 */
export const CONSENT_PURPOSE = 'face_recognition';

export const CONSENT_VERSION = '1.0-20260828';

export const CONSENT_TEXT = `ข้าพเจ้ายินยอมโดยชัดแจ้งให้ร้านค้าเก็บรวบรวมและใช้ข้อมูลชีวภาพของข้าพเจ้า ได้แก่ ข้อมูลจำลองใบหน้า (face embedding) เพื่อวัตถุประสงค์ในการยืนยันตัวตนสมาชิกและแนะนำสินค้าเฉพาะบุคคลเท่านั้น

ระบบจะเก็บเฉพาะรหัสตัวเลขที่แปลงจากใบหน้า ไม่เก็บภาพถ่ายหรือวิดีโอของข้าพเจ้า และจะไม่เปิดเผยข้อมูลนี้แก่บุคคลภายนอก

ข้าพเจ้าทราบว่าสามารถถอนความยินยอมและขอให้ลบข้อมูลใบหน้าได้ทุกเมื่อที่หน้าร้าน โดยไม่มีค่าใช้จ่ายและไม่กระทบสิทธิสมาชิกด้านอื่น ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562`;

export const CONSENT_TEXT_HASH = sha256Hex(CONSENT_TEXT);
