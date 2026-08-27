import { motion } from 'framer-motion';
import { CameraOff, Loader2, ScanFace } from 'lucide-react';
import type { FaceBox } from '@smart-cam/shared-types';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  ready: boolean;
  live: boolean;
  faceBoxes: FaceBox[];
  processingMs?: number;
  error?: string | null;
}

export function CameraPanel({ videoRef, ready, live, faceBoxes, processingMs, error }: Props) {
  return (
    <div className="relative glass-strong overflow-hidden shadow-card">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="glass px-3 py-1.5 text-xs font-mono tracking-wider flex items-center gap-2">
          <ScanFace className="w-3.5 h-3.5 text-neon-cyan" />
          <span>CAM · MAIN</span>
        </div>
        {processingMs !== undefined && (
          <div className="glass px-3 py-1.5 text-xs font-mono text-slate-300">
            latency <span className="text-neon-lime">{processingMs}ms</span>
          </div>
        )}
      </div>

      <div className="absolute top-3 right-3 z-10">
        {live && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> LIVE
          </div>
        )}
      </div>

      <div className="aspect-video bg-black relative">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>กำลังเปิดกล้อง…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center text-rose-300">
            <div className="flex flex-col items-center gap-2 text-center px-8">
              <CameraOff className="w-8 h-8" />
              <span className="font-semibold">ไม่สามารถเข้าถึงกล้อง</span>
              <span className="text-xs text-slate-400">{error}</span>
            </div>
          </div>
        )}

        {/* SVG overlay for face boxes — scale to video display */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 640 480"
          preserveAspectRatio="none"
        >
          {faceBoxes.map((b, i) => (
            <motion.g
              key={`${b.x}-${b.y}-${i}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <rect
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                fill="none"
                stroke="url(#gradBox)"
                strokeWidth={3}
                rx={12}
              />
              {[
                { x: b.x, y: b.y },
                { x: b.x + b.width, y: b.y },
                { x: b.x, y: b.y + b.height },
                { x: b.x + b.width, y: b.y + b.height },
              ].map((c, k) => (
                <circle key={k} cx={c.x} cy={c.y} r={5} fill="#22d3ee" />
              ))}
            </motion.g>
          ))}
          <defs>
            <linearGradient id="gradBox" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
