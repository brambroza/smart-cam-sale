import { useState, useMemo } from 'react';
import { CameraPanel } from './components/CameraPanel';
import { CustomerCard } from './components/CustomerCard';
import { TopBar } from './components/TopBar';
import { StatsStrip } from './components/StatsStrip';
import { useCamera } from './hooks/useCamera';
import { useRecognition } from './hooks/useRecognition';
import { AnimatePresence } from 'framer-motion';
import { EmptyState } from './components/EmptyState';

export default function App() {
  const [live, setLive] = useState(true);
  const { videoRef, ready, error: camError } = useCamera(live);
  const { status, last, error: recError } = useRecognition(videoRef, live, 2);
  const primaryResult = last?.results[0];

  // Stable identity across frames so AnimatePresence doesn't re-mount on every
  // recognition tick (which was making the right panel flicker).
  const identityKey = useMemo(() => {
    if (!primaryResult) return null;
    if (primaryResult.isMember && primaryResult.member) return `m:${primaryResult.member.memberId}`;
    return `guest:${primaryResult.ageBucket}:${primaryResult.gender}`;
  }, [primaryResult]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar status={status} live={live} onToggleLive={() => setLive((v) => !v)} />
      <main className="flex-1 grid gap-4 p-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-4">
          <CameraPanel
            videoRef={videoRef}
            ready={ready}
            live={live}
            faceBoxes={last?.results.map((r) => r.bbox) ?? []}
            processingMs={last?.processingMs}
            error={camError ?? recError}
          />
          <StatsStrip />
        </section>
        <aside className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {primaryResult && identityKey ? (
              <CustomerCard key={identityKey} result={primaryResult} />
            ) : (
              <EmptyState key="empty" live={live} status={status} />
            )}
          </AnimatePresence>
        </aside>
      </main>
    </div>
  );
}
