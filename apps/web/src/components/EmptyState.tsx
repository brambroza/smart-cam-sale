import { motion } from 'framer-motion';
import { ScanFace, WifiOff } from 'lucide-react';
import type { Status } from '../hooks/useRecognition';

export function EmptyState({ live, status }: { live: boolean; status: Status }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="glass-strong p-8 grid place-items-center text-center min-h-[300px]"
    >
      <div className="max-w-xs">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-400/20 grid place-items-center relative">
          {status === 'error' ? (
            <WifiOff className="w-8 h-8 text-rose-300" />
          ) : (
            <>
              <ScanFace className="w-8 h-8 text-neon-cyan" />
              <span className="absolute inset-0 rounded-2xl border-2 border-neon-cyan/40 animate-pulse-ring" />
            </>
          )}
        </div>
        <h3 className="mt-4 font-display font-bold text-lg text-slate-100">
          {live ? 'รอลูกค้าเข้ากรอบ…' : 'ระบบพร้อมใช้งาน'}
        </h3>
        <p className="mt-1 text-sm text-slate-400 leading-relaxed">
          {live
            ? 'ให้ลูกค้าหันหน้าเข้าหากล้อง ระบบจะประเมินอายุ · เพศ และตรวจสอบสถานะสมาชิกอัตโนมัติ'
            : 'กดปุ่ม "เริ่มถ่ายทอด" เพื่อเปิดกล้องและเริ่มการวิเคราะห์เรียลไทม์'}
        </p>
      </div>
    </motion.div>
  );
}
