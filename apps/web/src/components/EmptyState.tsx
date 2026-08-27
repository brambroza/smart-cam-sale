import { motion } from 'framer-motion';
import { ScanFace, WifiOff } from 'lucide-react';
import type { Status } from '../hooks/useRecognition';

export function EmptyState({ live, status }: { live: boolean; status: Status }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="surface-raised p-8 grid place-items-center text-center min-h-[280px]"
    >
      <div className="max-w-xs">
        <div className="mx-auto w-14 h-14 rounded-md bg-paper-200 grid place-items-center text-ink-700">
          {status === 'error' ? <WifiOff className="w-6 h-6 text-alert" /> : <ScanFace className="w-6 h-6" />}
        </div>
        <h3 className="mt-4 font-display font-bold text-lg text-ink-900">
          {live ? 'รอลูกค้าเข้ากรอบ' : 'ระบบพร้อมใช้งาน'}
        </h3>
        <p className="mt-1 text-sm text-ink-500 leading-relaxed">
          {live
            ? 'ให้ลูกค้าหันหน้าเข้าหากล้อง ระบบจะประเมินอายุ · เพศ และตรวจสอบสถานะสมาชิกให้อัตโนมัติ'
            : 'กดปุ่ม "เริ่มถ่ายทอด" ที่มุมขวาบนเพื่อเริ่มการวิเคราะห์'}
        </p>
      </div>
    </motion.div>
  );
}
