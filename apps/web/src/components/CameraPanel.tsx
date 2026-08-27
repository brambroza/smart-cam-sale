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
  /** Bridge mode: JPEG data URI pushed from an IP-camera bridge; replaces local video. */
  remoteFrameSrc?: string | null;
  sourceLabel?: string;
}

const VB_W = 640;
const VB_H = 480;

export function CameraPanel({
  videoRef,
  ready,
  live,
  faceBoxes,
  processingMs,
  error,
  remoteFrameSrc,
  sourceLabel,
}: Props) {
  const primary = faceBoxes[0];
  const isBridge = remoteFrameSrc !== undefined && remoteFrameSrc !== null;

  return (
    <div className="relative glass-strong overflow-hidden shadow-card">
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="glass px-3 py-1.5 text-xs font-mono tracking-wider flex items-center gap-2">
          <ScanFace className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="text-neon-cyan">{sourceLabel ?? 'CAM · MAIN'}</span>
        </div>
        {processingMs !== undefined && (
          <div className="glass px-3 py-1.5 text-xs font-mono text-slate-300">
            latency <span className="text-neon-lime">{processingMs}ms</span>
          </div>
        )}
        <div className="glass px-3 py-1.5 text-xs font-mono text-slate-300">
          faces <span className="text-neon-cyan">{faceBoxes.length}</span>
        </div>
      </div>

      <div className="absolute top-3 right-3 z-10">
        {live && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-xs font-semibold text-rose-100">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> LIVE
          </div>
        )}
      </div>

      <div className="aspect-video bg-black relative">
        {isBridge ? (
          <img src={remoteFrameSrc!} className="w-full h-full object-cover" alt="camera stream" />
        ) : (
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        )}

        {!isBridge && !ready && !error && (
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

        {/* Face reticle overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="scanLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="bracketGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <mask id="spotlightMask">
              <rect x="0" y="0" width={VB_W} height={VB_H} fill="white" />
              {faceBoxes.map((b, i) => {
                const pad = 24;
                return (
                  <rect
                    key={i}
                    x={b.x - pad}
                    y={b.y - pad}
                    width={b.width + pad * 2}
                    height={b.height + pad * 2}
                    rx={20}
                    fill="black"
                  />
                );
              })}
            </mask>
          </defs>

          {faceBoxes.length > 0 && (
            <rect
              x="0" y="0" width={VB_W} height={VB_H}
              fill="rgba(5,5,16,0.5)"
              mask="url(#spotlightMask)"
            />
          )}

          {faceBoxes.map((b, i) => (
            <FaceReticle key={`${b.x.toFixed(0)}-${b.y.toFixed(0)}-${i}`} box={b} primary={i === 0} />
          ))}
        </svg>

        {primary && <FaceLabel box={primary} />}
      </div>
    </div>
  );
}

function FaceReticle({ box, primary }: { box: FaceBox; primary: boolean }) {
  const bracketLen = Math.max(16, Math.min(box.width, box.height) * 0.22);
  const stroke = primary ? 'url(#bracketGrad)' : '#a78bfa88';
  const strokeWidth = primary ? 3 : 2;

  const corners = [
    { x: box.x, y: box.y, dx: 1, dy: 1 },
    { x: box.x + box.width, y: box.y, dx: -1, dy: 1 },
    { x: box.x, y: box.y + box.height, dx: 1, dy: -1 },
    { x: box.x + box.width, y: box.y + box.height, dx: -1, dy: -1 },
  ];

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {corners.map((c, i) => (
        <g key={i}>
          <line x1={c.x} y1={c.y} x2={c.x + c.dx * bracketLen} y2={c.y}
            stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1={c.x} y1={c.y} x2={c.x} y2={c.y + c.dy * bracketLen}
            stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        </g>
      ))}

      {primary && (
        <motion.rect
          x={box.x + 4} y={box.y} width={box.width - 8} height={2}
          fill="url(#scanLine)"
          animate={{ y: [box.y + 6, box.y + box.height - 8, box.y + 6] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {primary && (
        <>
          <circle cx={box.x + box.width / 2} cy={box.y + box.height / 2} r={3} fill="#22d3ee" />
          <circle cx={box.x + box.width / 2} cy={box.y + box.height / 2} r={10}
            fill="none" stroke="#22d3ee" strokeWidth={1} strokeDasharray="3 4" opacity="0.6">
            <animateTransform attributeName="transform" type="rotate"
              from={`0 ${box.x + box.width / 2} ${box.y + box.height / 2}`}
              to={`360 ${box.x + box.width / 2} ${box.y + box.height / 2}`}
              dur="6s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </motion.g>
  );
}

function FaceLabel({ box }: { box: FaceBox }) {
  const leftPct = ((box.x + box.width) / VB_W) * 100;
  const topPct = (box.y / VB_H) * 100;
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute"
      style={{ left: `calc(${leftPct}% + 8px)`, top: `${topPct}%`, maxWidth: '35%' }}
    >
      <div className="glass-strong px-2.5 py-1.5 text-[10px] font-mono tracking-wide leading-tight border border-cyan-400/30">
        <div className="text-neon-cyan uppercase font-bold">TARGET LOCKED</div>
        <div className="text-slate-300">
          <span className="text-neon-lime">●</span> tracking · {box.width.toFixed(0)}×{box.height.toFixed(0)}
        </div>
      </div>
    </motion.div>
  );
}
