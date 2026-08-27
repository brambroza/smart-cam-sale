import { useEffect, useRef, useState } from 'react';

export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      setReady(false);
    };
  }, [active]);

  return { videoRef, ready, error };
}
