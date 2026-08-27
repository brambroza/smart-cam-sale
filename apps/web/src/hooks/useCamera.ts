import { useCallback, useEffect, useRef, useState } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

/**
 * Local camera hook with device selection — a notebook's built-in camera and
 * any USB webcams appear as separate devices the user can switch between.
 */
export function useCamera(active: boolean, deviceId?: string | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [devices, setDevices] = useState<CameraDevice[]>([]);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          // labels are empty until permission is granted — fall back to index
          label: d.label || `กล้อง ${i + 1}`,
        }));
      setDevices(cams);
    } catch {
      /* enumeration unsupported — keep empty list */
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
        // labels become available after permission — refresh the list
        refreshDevices();
      } catch (e) {
        const err = e as Error;
        if (err.name === 'OverconstrainedError') {
          setError('ไม่พบกล้องที่เลือก — อาจถูกถอดออก ลองเลือกกล้องอื่น');
        } else {
          setError(err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      setReady(false);
    };
  }, [active, deviceId, refreshDevices]);

  // keep device list in sync when cameras are plugged/unplugged
  useEffect(() => {
    refreshDevices();
    const onChange = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
  }, [refreshDevices]);

  return { videoRef, ready, error, devices };
}
