import { useState } from 'react';
import { CameraPanel } from './components/CameraPanel';
import { CustomerCard } from './components/CustomerCard';
import { TopBar } from './components/TopBar';
import { StatsStrip } from './components/StatsStrip';
import { useCamera } from './hooks/useCamera';
import { useRecognition } from './hooks/useRecognition';
import { useStableFaces } from './hooks/useStableFaces';
import { AnimatePresence, motion } from 'framer-motion';
import { EmptyState } from './components/EmptyState';
import { EnrollModal } from './components/EnrollModal';
import { ProductBrowser } from './components/ProductBrowser';
import { PackageOpen, UserPlus } from 'lucide-react';

export default function App() {
  const [live, setLive] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const { videoRef, ready, error: camError } = useCamera(live);
  const { status, last, error: recError, socket } = useRecognition(videoRef, live, 1);
  const faces = useStableFaces(last);
  const primary = faces[0];
  const guestPrimary = primary && !primary.result.isMember ? primary : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar status={status} live={live} onToggleLive={() => setLive((v) => !v)} />
      <main className="flex-1 grid gap-4 p-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-4">
          <CameraPanel
            videoRef={videoRef}
            ready={ready}
            live={live}
            faceBoxes={faces.map((f) => f.result.bbox)}
            processingMs={last?.processingMs}
            error={camError ?? recError}
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

      {/* Floating Product Browser button */}
      <motion.button
        onClick={() => setBrowserOpen(true)}
        whileTap={{ scale: 0.97 }}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-md bg-paper-50 border border-paper-400 shadow-raised font-medium text-sm text-ink-900 hover:bg-paper-100"
      >
        <PackageOpen className="w-4 h-4 text-terracotta" />
        <span>สินค้าทั้งหมด</span>
      </motion.button>

      {/* Floating Enroll button */}
      {guestPrimary && (
        <motion.button
          onClick={() => setEnrollOpen(true)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="fixed bottom-6 left-6 z-30 flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-md bg-terracotta text-paper-50 font-semibold text-sm shadow-raised hover:bg-terracotta-deep"
        >
          <UserPlus className="w-4 h-4" />
          <span>สมัครสมาชิกลูกค้าคนนี้</span>
        </motion.button>
      )}

      <EnrollModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        socket={socket}
        guessGender={guestPrimary?.result.gender as any}
        guessAge={guestPrimary?.result.estimatedAge}
      />
      <ProductBrowser open={browserOpen} onClose={() => setBrowserOpen(false)} />
    </div>
  );
}
