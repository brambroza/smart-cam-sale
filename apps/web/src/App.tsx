import { useState } from 'react';
import { CameraPanel } from './components/CameraPanel';
import { CustomerCard } from './components/CustomerCard';
import { TopBar } from './components/TopBar';
import { StatsStrip } from './components/StatsStrip';
import { useCamera } from './hooks/useCamera';
import { useRecognition } from './hooks/useRecognition';
import { useStableFaces } from './hooks/useStableFaces';
import { AnimatePresence } from 'framer-motion';
import { EmptyState } from './components/EmptyState';

export default function App() {
  const [live, setLive] = useState(true);
  const { videoRef, ready, error: camError } = useCamera(live);
  const { status, last, error: recError } = useRecognition(videoRef, live, 1);
  const faces = useStableFaces(last);

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
                />
              ))
            )}
          </AnimatePresence>
        </aside>
      </main>
    </div>
  );
}
