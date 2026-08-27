import { motion } from 'framer-motion';
import { Cpu, Radio, Power } from 'lucide-react';
import type { Status } from '../hooks/useRecognition';
import { cn } from '../lib/utils';

export function TopBar({
  status,
  live,
  onToggleLive,
}: {
  status: Status;
  live: boolean;
  onToggleLive: () => void;
}) {
  const dotColor =
    status === 'connected' ? 'bg-emerald-400' : status === 'connecting' ? 'bg-amber-400' : status === 'error' ? 'bg-rose-500' : 'bg-slate-500';
  return (
    <header className="glass-strong m-4 px-5 py-3 flex items-center justify-between shadow-card">
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-400 to-cyan-400 grid place-items-center shadow-glow"
        >
          <Cpu className="w-5 h-5 text-ink-950" />
        </motion.div>
        <div>
          <div className="font-display font-bold text-lg tracking-tight">Smart Cam Sale</div>
          <div className="text-xs text-slate-400 -mt-0.5">คอนโซลพนักงานหน้าร้าน</div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className={cn('relative flex h-2.5 w-2.5')}>
            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-ring', dotColor)} />
            <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', dotColor)} />
          </span>
          <span className="text-slate-300">
            {status === 'connected' ? 'AI online' : status === 'connecting' ? 'กำลังเชื่อมต่อ' : status === 'error' ? 'ตัดการเชื่อมต่อ' : 'พร้อมทำงาน'}
          </span>
        </div>

        <button
          onClick={onToggleLive}
          className={cn(
            'group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition',
            live
              ? 'border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20'
              : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20',
          )}
        >
          {live ? <Radio className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          {live ? 'LIVE — คลิกเพื่อหยุด' : 'เริ่มถ่ายทอด'}
        </button>
      </div>
    </header>
  );
}
