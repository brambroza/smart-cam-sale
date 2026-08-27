import { motion } from 'framer-motion';
import { CameraOff, Loader2 } from 'lucide-react';
import type { FaceBox } from '@smart-cam/shared-types';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  ready: boolean;
  live: boolean;
  faceBoxes: FaceBox[];
  processingMs?: number;
  error?: string | null;
}

const VB_W = 640;
const VB_H = 480;

export function CameraPanel({ videoRef, ready, live, faceBoxes, processingMs, error }: Props) {
  return (
    <div className="surface-raised overflow-hidden relative">
      {/* Top bar chip strip */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-paper-400 bg-paper-50">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="font-mono font-semibold text-ink-900 tracking-wider">CAM · MAIN</span>
          <span className="w-px h-3 bg-paper-400" />
          {processingMs !== undefined ? (
            <span className="font-mono text-ink-500">
              latency <span className="text-moss-deep">{processingMs}ms</span>
            </span>
          ) : (
            <span className="text-ink-500">idle</span>
          )}
          <span className="w-px h-3 bg-paper-400" />
          <span className="font-mono text-ink-500">
            faces <span className="text-terracotta-deep">{faceBoxes.length}</span>
          </span>
        </div>
        {live && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-alert-tint text-alert text-[10px] font-mono font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-alert animate-pulse" />
            LIVE
          </div>
        )}
      </div>

      <div className="aspect-video bg-ink-950 relative">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-paper-300">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">กำลังเปิดกล้อง…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center text-alert-tint">
            <div className="flex flex-col items-center gap-2 text-center px-8">
              <CameraOff className="w-8 h-8" />
              <span className="font-semibold">ไม่สามารถเข้าถึงกล้อง</span>
              <span className="text-xs text-paper-300">{error}</span>
            </div>
          </div>
        )}

        {/* Face marker overlay — simple corner ticks + label */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
        >
          {faceBoxes.map((b, i) => (
            <FaceMarker key={`${b.x.toFixed(0)}-${b.y.toFixed(0)}-${i}`} box={b} primary={i === 0} />
          ))}
        </svg>
      </div>
    </div>
  );
}

function FaceMarker({ box, primary }: { box: FaceBox; primary: boolean }) {
  const t = Math.max(14, Math.min(box.width, box.height) * 0.18);
  const color = primary ? '#E27B4E' : '#B8944F';
  const strokeWidth = primary ? 2.5 : 1.5;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Corner ticks — thin, industrial */}
      {[
        { x: box.x, y: box.y, dx: 1, dy: 1 },
        { x: box.x + box.width, y: box.y, dx: -1, dy: 1 },
        { x: box.x, y: box.y + box.height, dx: 1, dy: -1 },
        { x: box.x + box.width, y: box.y + box.height, dx: -1, dy: -1 },
      ].map((c, i) => (
        <g key={i}>
          <line
            x1={c.x}
            y1={c.y}
            x2={c.x + c.dx * t}
            y2={c.y}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="square"
          />
          <line
            x1={c.x}
            y1={c.y}
            x2={c.x}
            y2={c.y + c.dy * t}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="square"
          />
        </g>
      ))}

      {/* Center tick */}
      {primary && (
        <>
          <line
            x1={box.x + box.width / 2 - 5}
            y1={box.y + box.height / 2}
            x2={box.x + box.width / 2 + 5}
            y2={box.y + box.height / 2}
            stroke={color}
            strokeWidth={1.5}
          />
          <line
            x1={box.x + box.width / 2}
            y1={box.y + box.height / 2 - 5}
            x2={box.x + box.width / 2}
            y2={box.y + box.height / 2 + 5}
            stroke={color}
            strokeWidth={1.5}
          />
        </>
      )}
    </motion.g>
  );
}
