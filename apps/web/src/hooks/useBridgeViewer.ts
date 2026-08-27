import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { RecognitionMessage } from '@smart-cam/shared-types';

/**
 * Bridge viewer mode: instead of capturing from the local webcam, subscribe to
 * a channel that a camera-bridge (RTSP relay) publishes into. The server fans
 * out both recognition results and (optionally) JPEG frames.
 */
export function useBridgeViewer(socket: Socket | null, channel: string | null) {
  const [last, setLast] = useState<RecognitionMessage | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!socket || !channel) {
      setJoined(false);
      setLast(null);
      setFrameSrc(null);
      return;
    }

    const onJoined = (msg: { channel: string }) => {
      if (msg.channel === channel) setJoined(true);
    };
    const onRecognition = (msg: RecognitionMessage) => setLast(msg);
    const onFrame = (msg: { channel: string; imageBase64: string }) => {
      if (msg.channel === channel) setFrameSrc(msg.imageBase64);
    };

    socket.on('joined_channel', onJoined);
    socket.on('recognition', onRecognition);
    socket.on('camera_frame', onFrame);
    socket.emit('join_channel', { channel });

    return () => {
      socket.emit('leave_channel', { channel });
      socket.off('joined_channel', onJoined);
      socket.off('recognition', onRecognition);
      socket.off('camera_frame', onFrame);
      setJoined(false);
    };
  }, [socket, channel]);

  return { last, frameSrc, joined };
}
