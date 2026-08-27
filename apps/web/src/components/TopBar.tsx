import { Circle, Radio, Power } from 'lucide-react';
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
  const statusLabel =
    status === 'connected' ? 'AI พร้อมใช้งาน'
      : status === 'connecting' ? 'กำลังเชื่อมต่อ'
      : status === 'error' ? 'ขาดการเชื่อมต่อ'
      : 'พร้อมทำงาน';

  const statusColor =
    status === 'connected' ? 'text-moss'
      : status === 'connecting' ? 'text-brass'
      : status === 'error' ? 'text-alert'
      : 'text-ink-500';

  return (
    <header className="surface-raised mx-4 mt-4 px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-terracotta grid place-items-center text-paper-50 font-display font-bold text-lg">
          SC
        </div>
        <div>
          <div className="font-display font-bold text-lg leading-none tracking-tight">
            Smart Cam Sale
          </div>
          <div className="text-xs text-ink-500 mt-1">
            คอนโซลพนักงานหน้าร้าน · สาขา BKK-01
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-sm">
          <Circle className={cn('w-2 h-2 fill-current', statusColor)} />
          <span className="text-ink-700">{statusLabel}</span>
        </div>

        <button
          onClick={onToggleLive}
          className={cn(
            'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md border font-medium text-sm transition',
            live
              ? 'border-alert/40 bg-alert-tint text-alert hover:bg-alert/10 hover:border-alert'
              : 'border-moss/40 bg-moss-tint text-moss-deep hover:bg-moss/10 hover:border-moss',
          )}
        >
          {live ? <Radio className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          {live ? 'LIVE · กดเพื่อหยุด' : 'เริ่มถ่ายทอด'}
        </button>
      </div>
    </header>
  );
}
