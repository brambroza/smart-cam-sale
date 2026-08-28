import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../lib/api';
import type { RecognitionMessage } from '@smart-cam/shared-types';

const WS_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/';

export type Status = 'idle' | 'connecting' | 'connected' | 'error';

export function useRecognition(
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean,
  fps = 2,
  /** 'webcam' captures local frames; 'bridge' keeps the socket open but sends nothing. */
  mode: 'webcam' | 'bridge' = 'webcam',
) {
  const socketRef = useRef<Socket | null>(null);
  const busyRef = useRef(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [last, setLast] = useState<RecognitionMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setStatus('connecting');
    const s = io(WS_URL, {
      path: '/ws',
      transports: ['websocket'],
      auth: { token: getToken() },
    });
    socketRef.current = s;
    setSocket(s);
    s.on('connect', () => setStatus('connected'));
    s.on('disconnect', () => setStatus('idle'));
    s.on('connect_error', (e) => {
      setStatus('error');
      setError(e.message);
    });
    s.on('recognition', (msg: RecognitionMessage) => {
      setLast(msg);
      busyRef.current = false;
    });
    s.on('recognition_error', (e: { message: string }) => {
      setError(e.message);
      busyRef.current = false;
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || mode !== 'webcam') return;
    const interval = setInterval(() => {
      const s = socketRef.current;
      const v = videoRef.current;
      if (!s || !v || v.readyState < 2 || busyRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.7);
      busyRef.current = true;
      s.emit('frame', {
        imageBase64: b64,
        ts: Date.now(),
        frameId: `f_${Date.now()}`,
      });
    }, Math.floor(1000 / fps));
    return () => clearInterval(interval);
  }, [enabled, fps, videoRef, mode]);

  return { status, last, error, socket };
}
