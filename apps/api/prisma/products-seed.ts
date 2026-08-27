import { Gender } from '@prisma/client';

// ~110 products styled after a Thai convenience store
export const PRODUCTS: Array<{
  name: string;
  category: string;
  price: number;
  targetGender?: Gender;
  minAge?: number;
  maxAge?: number;
  timeOfDay?: string;
}> = [
  // ── กาแฟ / เครื่องดื่มร้อน (12) ─────────────────────
  { name: 'อเมริกาโน่เย็น', category: 'coffee', price: 40, timeOfDay: 'morning' },
  { name: 'อเมริกาโน่ร้อน', category: 'coffee', price: 35, timeOfDay: 'morning' },
  { name: 'ลาเต้เย็น', category: 'coffee', price: 45, timeOfDay: 'morning' },
  { name: 'ลาเต้ร้อน', category: 'coffee', price: 40, timeOfDay: 'morning' },
  { name: 'เอสเปรสโซ่เย็น', category: 'coffee', price: 40, timeOfDay: 'morning' },
  { name: 'คาปูชิโน่ร้อน', category: 'coffee', price: 40, timeOfDay: 'morning' },
  { name: 'มอคค่าเย็น', category: 'coffee', price: 45, timeOfDay: 'morning' },
  { name: 'กาแฟโบราณเย็น', category: 'coffee', price: 25, timeOfDay: 'morning', minAge: 30 },
  { name: 'ชาเย็น', category: 'coffee', price: 30, timeOfDay: 'afternoon' },
  { name: 'ชาเขียวนมเย็น', category: 'coffee', price: 35, timeOfDay: 'afternoon' },
  { name: 'ชามะนาวเย็น', category: 'coffee', price: 30, timeOfDay: 'afternoon' },
  { name: 'โกโก้เย็น', category: 'coffee', price: 35, timeOfDay: 'afternoon', maxAge: 25 },

  // ── เครื่องดื่มเย็น (16) ─────────────────────────────
  { name: 'น้ำเปล่า 600 มล.', category: 'drink', price: 10, timeOfDay: 'any' },
  { name: 'น้ำเปล่า 1.5 ลิตร', category: 'drink', price: 19, timeOfDay: 'any' },
  { name: 'น้ำแร่ 500 มล.', category: 'drink', price: 15, timeOfDay: 'any' },
  { name: 'โค้ก 325 มล.', category: 'drink', price: 17, timeOfDay: 'any' },
  { name: 'โค้กซีโร่ 325 มล.', category: 'drink', price: 17, timeOfDay: 'any' },
  { name: 'เป๊ปซี่ 345 มล.', category: 'drink', price: 16, timeOfDay: 'any' },
  { name: 'สไปรท์ 325 มล.', category: 'drink', price: 17, timeOfDay: 'any' },
  { name: 'น้ำส้ม 100% กล่อง', category: 'drink', price: 25, timeOfDay: 'morning' },
  { name: 'นมเปรี้ยวพร้อมดื่ม', category: 'drink', price: 15, timeOfDay: 'morning', maxAge: 30 },
  { name: 'ชาเขียวโออิชิ', category: 'drink', price: 20, timeOfDay: 'afternoon' },
  { name: 'อิชิตันน้ำผึ้งมะนาว', category: 'drink', price: 20, timeOfDay: 'afternoon' },
  { name: 'เครื่องดื่มเกลือแร่', category: 'drink', price: 22, timeOfDay: 'afternoon', maxAge: 40 },
  { name: 'กระทิงแดง', category: 'drink', price: 12, timeOfDay: 'morning', minAge: 18, targetGender: Gender.male },
  { name: 'M-150', category: 'drink', price: 12, timeOfDay: 'morning', minAge: 18, targetGender: Gender.male },
  { name: 'น้ำมะพร้าวพร้อมดื่ม', category: 'drink', price: 30, timeOfDay: 'afternoon' },
  { name: 'สมูทตี้ผลไม้รวม', category: 'drink', price: 45, timeOfDay: 'afternoon', targetGender: Gender.female },

  // ── นม / โยเกิร์ต (8) ────────────────────────────────
  { name: 'นมจืด UHT 225 มล.', category: 'dairy', price: 13, timeOfDay: 'morning' },
  { name: 'นมช็อกโกแลต UHT', category: 'dairy', price: 14, timeOfDay: 'morning', maxAge: 25 },
  { name: 'นมถั่วเหลือง', category: 'dairy', price: 15, timeOfDay: 'morning' },
  { name: 'โยเกิร์ตรสธรรมชาติ', category: 'dairy', price: 16, timeOfDay: 'morning', targetGender: Gender.female },
  { name: 'โยเกิร์ตพร้อมดื่ม', category: 'dairy', price: 18, timeOfDay: 'morning' },
  { name: 'นมอัดเม็ด', category: 'dairy', price: 10, maxAge: 20 },
  { name: 'นมสดพาสเจอร์ไรส์', category: 'dairy', price: 28, timeOfDay: 'morning' },
  { name: 'กรีกโยเกิร์ต', category: 'dairy', price: 35, targetGender: Gender.female, minAge: 20, maxAge: 40 },

  // ── อาหารพร้อมทาน (18) ───────────────────────────────
  { name: 'ข้าวกล่องกะเพราไก่ไข่ดาว', category: 'meal', price: 45, timeOfDay: 'afternoon' },
  { name: 'ข้าวกล่องกะเพราหมู', category: 'meal', price: 45, timeOfDay: 'afternoon' },
  { name: 'ข้าวผัดกุ้ง', category: 'meal', price: 49, timeOfDay: 'afternoon' },
  { name: 'ข้าวไข่เจียวหมูสับ', category: 'meal', price: 39, timeOfDay: 'afternoon' },
  { name: 'ข้าวมันไก่', category: 'meal', price: 45, timeOfDay: 'afternoon' },
  { name: 'ข้าวหมูทอดกระเทียม', category: 'meal', price: 45, timeOfDay: 'afternoon' },
  { name: 'สปาเก็ตตี้คาโบนาร่า', category: 'meal', price: 55, timeOfDay: 'evening' },
  { name: 'ผัดไทยกุ้งสด', category: 'meal', price: 49, timeOfDay: 'evening' },
  { name: 'ข้าวต้มหมู', category: 'meal', price: 35, timeOfDay: 'night' },
  { name: 'โจ๊กหมูใส่ไข่', category: 'meal', price: 35, timeOfDay: 'morning' },
  { name: 'แซนวิชแฮมชีส', category: 'meal', price: 35, timeOfDay: 'morning' },
  { name: 'แซนวิชทูน่า', category: 'meal', price: 35, timeOfDay: 'morning' },
  { name: 'เบอร์เกอร์หมู', category: 'meal', price: 39, timeOfDay: 'afternoon', maxAge: 30 },
  { name: 'ฮอทดอกชีส', category: 'meal', price: 29, timeOfDay: 'afternoon', maxAge: 25 },
  { name: 'สลัดอกไก่', category: 'meal', price: 59, timeOfDay: 'afternoon', targetGender: Gender.female, minAge: 20 },
  { name: 'สลัดผลไม้', category: 'meal', price: 49, targetGender: Gender.female },
  { name: 'ไก่ย่างเทอริยากิ', category: 'meal', price: 55, timeOfDay: 'evening' },
  { name: 'ข้าวเหนียวหมูปิ้ง 2 ไม้', category: 'meal', price: 32, timeOfDay: 'morning' },

  // ── อาหารแช่แข็ง (8) ─────────────────────────────────
  { name: 'เกี๊ยวซ่าแช่แข็ง', category: 'frozen', price: 42, timeOfDay: 'evening' },
  { name: 'ติ่มซำรวมแช่แข็ง', category: 'frozen', price: 45, timeOfDay: 'morning' },
  { name: 'ข้าวผัดแช่แข็ง', category: 'frozen', price: 39, timeOfDay: 'night' },
  { name: 'พิซซ่าแช่แข็ง', category: 'frozen', price: 69, timeOfDay: 'evening', maxAge: 35 },
  { name: 'นักเก็ตไก่แช่แข็ง', category: 'frozen', price: 45, maxAge: 30 },
  { name: 'เฟรนช์ฟรายส์แช่แข็ง', category: 'frozen', price: 39, maxAge: 30 },
  { name: 'บะหมี่เกี๊ยวกุ้งแช่แข็ง', category: 'frozen', price: 49, timeOfDay: 'night' },
  { name: 'ขนมจีบกุ้งแช่แข็ง', category: 'frozen', price: 42, timeOfDay: 'morning' },

  // ── เบเกอรี่ (10) ────────────────────────────────────
  { name: 'ครัวซองต์เนยสด', category: 'bakery', price: 32, timeOfDay: 'morning' },
  { name: 'ครัวซองต์ช็อกโกแลต', category: 'bakery', price: 35, timeOfDay: 'morning' },
  { name: 'ขนมปังไส้หมูหยอง', category: 'bakery', price: 25, timeOfDay: 'morning' },
  { name: 'ขนมปังไส้ครีม', category: 'bakery', price: 22, timeOfDay: 'morning' },
  { name: 'เค้กกล้วยหอม', category: 'bakery', price: 28, timeOfDay: 'afternoon' },
  { name: 'บราวนี่', category: 'bakery', price: 35, timeOfDay: 'afternoon', targetGender: Gender.female },
  { name: 'โดนัทช็อกโกแลต', category: 'bakery', price: 25, maxAge: 30 },
  { name: 'พายไก่', category: 'bakery', price: 32, timeOfDay: 'afternoon' },
  { name: 'ขนมปังปิ้งเนยนม', category: 'bakery', price: 25, timeOfDay: 'evening' },
  { name: 'ทาร์ตไข่', category: 'bakery', price: 25, timeOfDay: 'afternoon' },

  // ── ขนม / ของกินเล่น (14) ────────────────────────────
  { name: 'เลย์รสออริจินัล', category: 'snack', price: 30, timeOfDay: 'evening' },
  { name: 'เลย์โนริสาหร่าย', category: 'snack', price: 30, timeOfDay: 'evening', maxAge: 30 },
  { name: 'เถ้าแก่น้อยสาหร่ายทอด', category: 'snack', price: 20, maxAge: 30 },
  { name: 'ปลาเส้นปรุงรส', category: 'snack', price: 15 },
  { name: 'ถั่วลิสงอบเกลือ', category: 'snack', price: 20, minAge: 25 },
  { name: 'ป๊อปคอร์นคาราเมล', category: 'snack', price: 25, maxAge: 30 },
  { name: 'ช็อกโกแลตแท่ง', category: 'snack', price: 35, targetGender: Gender.female },
  { name: 'คุกกี้เนยช็อกชิพ', category: 'snack', price: 30 },
  { name: 'เยลลี่ผลไม้', category: 'snack', price: 15, maxAge: 25 },
  { name: 'หมากฝรั่งรสมินต์', category: 'snack', price: 10 },
  { name: 'ลูกอมรสผลไม้', category: 'snack', price: 5 },
  { name: 'ไอศกรีมโคนช็อกโกแลต', category: 'snack', price: 20, timeOfDay: 'afternoon' },
  { name: 'ไอศกรีมแท่งกะทิ', category: 'snack', price: 15, timeOfDay: 'afternoon' },
  { name: 'บะหมี่กึ่งสำเร็จรูปต้มยำกุ้ง', category: 'snack', price: 8, timeOfDay: 'night' },

  // ── เบียร์ / แอลกอฮอล์ (6) ───────────────────────────
  { name: 'เบียร์ลีโอกระป๋อง', category: 'alcohol', price: 42, timeOfDay: 'evening', minAge: 20, targetGender: Gender.male },
  { name: 'เบียร์ช้างกระป๋อง', category: 'alcohol', price: 40, timeOfDay: 'evening', minAge: 20, targetGender: Gender.male },
  { name: 'เบียร์สิงห์กระป๋อง', category: 'alcohol', price: 45, timeOfDay: 'evening', minAge: 20 },
  { name: 'ไฮเนเก้นกระป๋อง', category: 'alcohol', price: 52, timeOfDay: 'evening', minAge: 20 },
  { name: 'โซจูรสองุ่น', category: 'alcohol', price: 89, timeOfDay: 'night', minAge: 20, maxAge: 35 },
  { name: 'สแปลชไซเดอร์', category: 'alcohol', price: 65, timeOfDay: 'evening', minAge: 20, targetGender: Gender.female },

  // ── ของใช้ส่วนตัว (12) ───────────────────────────────
  { name: 'ยาสีฟันขนาดพกพา', category: 'personal_care', price: 25 },
  { name: 'แปรงสีฟันพกพา', category: 'personal_care', price: 29 },
  { name: 'สบู่ก้อน', category: 'personal_care', price: 22 },
  { name: 'แชมพูซอง', category: 'personal_care', price: 5 },
  { name: 'ครีมอาบน้ำขวดเล็ก', category: 'personal_care', price: 39 },
  { name: 'โรลออนระงับกลิ่นกาย', category: 'personal_care', price: 49 },
  { name: 'ทิชชู่เปียก', category: 'personal_care', price: 25 },
  { name: 'ทิชชู่พกพา', category: 'personal_care', price: 10 },
  { name: 'ผ้าอนามัยแบบกลางคืน', category: 'personal_care', price: 45, targetGender: Gender.female },
  { name: 'ถุงยางอนามัย', category: 'personal_care', price: 55, minAge: 18 },
  { name: 'มีดโกนหนวดพกพา', category: 'personal_care', price: 35, targetGender: Gender.male, minAge: 18 },
  { name: 'หน้ากากอนามัย 10 ชิ้น', category: 'personal_care', price: 29 },

  // ── สุขภาพ (8) ───────────────────────────────────────
  { name: 'ยาพาราเซตามอล', category: 'health', price: 15 },
  { name: 'ยาดมสมุนไพร', category: 'health', price: 25, minAge: 30 },
  { name: 'ยาหม่องตราถ้วยทอง', category: 'health', price: 35, minAge: 35 },
  { name: 'พลาสเตอร์ยา', category: 'health', price: 15 },
  { name: 'วิตามินซีเม็ด', category: 'health', price: 45, targetGender: Gender.female },
  { name: 'เครื่องดื่มคอลลาเจน', category: 'health', price: 55, targetGender: Gender.female, minAge: 25 },
  { name: 'ซุปไก่สกัด', category: 'health', price: 55, minAge: 30 },
  { name: 'เจลแอลกอฮอล์ล้างมือ', category: 'health', price: 29 },

  // ── ความงาม (6) ──────────────────────────────────────
  { name: 'มาส์กหน้าแผ่น', category: 'beauty', price: 39, targetGender: Gender.female, minAge: 18 },
  { name: 'ลิปมันกันแดด', category: 'beauty', price: 49, targetGender: Gender.female },
  { name: 'ครีมกันแดด SPF50', category: 'beauty', price: 89, minAge: 18 },
  { name: 'โฟมล้างหน้า', category: 'beauty', price: 69 },
  { name: 'เจลใส่ผม', category: 'beauty', price: 59, targetGender: Gender.male, minAge: 18, maxAge: 40 },
  { name: 'น้ำหอมขนาดพกพา', category: 'beauty', price: 99, minAge: 18, maxAge: 35 },
];
