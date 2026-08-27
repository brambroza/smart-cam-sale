import { useEffect, useState } from 'react';
import { CameraPanel } from './components/CameraPanel';
import { CustomerCard } from './components/CustomerCard';
import { TopBar } from './components/TopBar';
import { StatsStrip } from './components/StatsStrip';
import { useCamera } from './hooks/useCamera';
import { useRecognition } from './hooks/useRecognition';
import { useBridgeViewer } from './hooks/useBridgeViewer';
import { useStableFaces } from './hooks/useStableFaces';
import { AnimatePresence, motion } from 'framer-motion';
import { EmptyState } from './components/EmptyState';
import { EnrollModal } from './components/EnrollModal';
import { ProductBrowser } from './components/ProductBrowser';
import { PackageOpen, UserPlus, Webcam, Video } from 'lucide-react';
import { cn } from './lib/utils';

type CamSource = 'webcam' | 'bridge';

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [live, setLive] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [source, setSource] = useState<CamSource>(() => loadPref('cam_source', 'webcam'));
  const [channel, setChannel] = useState<string>(() => loadPref('cam_channel', 'store-main'));

  useEffect(() => {
    try {
      localStorage.setItem('cam_source', JSON.stringify(source));
      localStorage.setItem('cam_channel', JSON.stringify(channel));
    } catch {}
  }, [source, channel]);

  const isBridge = source === 'bridge';
  const { videoRef, ready, error: camError } = useCamera(live && !isBridge);
  const { status, last: webcamLast, error: recError, socket } = useRecognition(
    videoRef,
    live,
    1,
    isBridge ? 'bridge' : 'webcam',
  );
  const { last: bridgeLast, frameSrc, joined } = useBridgeViewer(
    socket,
    live && isBridge ? channel : null,
  );

  const last = isBridge ? bridgeLast : webcamLast;
  const faces = useStableFaces(last);
  const primary = faces[0];
  const guestPrimary = primary && !primary.result.isMember ? primary : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar status={status} live={live} onToggleLive={() => setLive((v) => !v)} />

      {/* Camera source selector */}
      <div className="mx-4 -mt-1 mb-0 flex items-center gap-2">
        <SourceTab
          active={!isBridge}
          onClick={() => setSource('webcam')}
          icon={<Webcam className="w-3.5 h-3.5" />}
        >
          กล้องเครื่องนี้
        </SourceTab>
        <SourceTab
          active={isBridge}
          onClick={() => setSource('bridge')}
          icon={<Video className="w-3.5 h-3.5" />}
        >
          IP Camera (Hikvision / Xiaomi)
        </SourceTab>
        {isBridge && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-slate-500">channel:</span>
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value.trim())}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-100 w-44 focus:border-neon-cyan/50 focus:outline-none"
              placeholder="store-main"
            />
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border',
                joined
                  ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
                  : 'text-amber-300 border-amber-400/40 bg-amber-500/10',
              )}
            >
              {joined ? (frameSrc ? 'รับสัญญาณแล้ว' : 'รอ bridge ส่งภาพ…') : 'กำลังเชื่อม…'}
            </span>
          </div>
        )}
      </div>

      <main className="flex-1 grid gap-4 p-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-4">
          <CameraPanel
            videoRef={videoRef}
            ready={ready}
            live={live}
            faceBoxes={faces.map((f) => f.result.bbox)}
            processingMs={last?.processingMs}
            error={isBridge ? recError : (camError ?? recError)}
            remoteFrameSrc={isBridge ? frameSrc : undefined}
            sourceLabel={isBridge ? `CAM · ${channel.toUpperCase()}` : 'CAM · WEBCAM'}
          />
          <StatsStrip />
        </section>
        <aside className="flex flex-col gap-4 min-h-0">
          <AnimatePresence mode="popLayout">
            {faces.length === 0 ? (
              <EmptyState key="empty" live={live} status={status} />
            ) : (
              faces.map((f, idx) => (
                <CustomerCard
                  key={f.identityKey}
                  result={f.result}
                  held={f.held}
                  compact={idx > 0}
                  onEnroll={idx === 0 && !f.result.isMember ? () => setEnrollOpen(true) : undefined}
                />
              ))
            )}
          </AnimatePresence>
        </aside>
      </main>

      <motion.button
        onClick={() => setBrowserOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full glass-strong border border-white/15 shadow-glow font-semibold text-slate-100"
      >
        <PackageOpen className="w-5 h-5 text-neon-cyan" />
        <span>สินค้าทั้งหมด</span>
      </motion.button>

      {guestPrimary && (
        <motion.button
          onClick={() => setEnrollOpen(true)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="fixed bottom-6 left-6 z-30 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-ink-950 font-bold shadow-glow"
        >
          <UserPlus className="w-5 h-5" />
          <span>สมัครสมาชิก</span>
        </motion.button>
      )}

      <EnrollModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        socket={socket}
        channel={isBridge ? channel : undefined}
        guessGender={guestPrimary?.result.gender as any}
        guessAge={guestPrimary?.result.estimatedAge}
      />
      <ProductBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
    </div>
  );
}

function SourceTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition',
        active
          ? 'bg-cyan-400/15 text-neon-cyan border-cyan-400/40'
          : 'bg-white/[0.03] text-slate-400 border-white/10 hover:border-white/20',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
