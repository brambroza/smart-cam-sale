/**
 * Camera Bridge — pulls frames from an RTSP/HTTP camera (Hikvision, Xiaomi,
 * Dahua, TP-Link Tapo, generic ONVIF) with ffmpeg and relays them to the
 * Smart Cam Sale API over the same WebSocket channel the web console uses.
 *
 * Run this on any machine that can reach both the camera (LAN) and the API
 * (internet) — a mini PC, Raspberry Pi, or the store's POS computer.
 *
 * Usage:
 *   RTSP_URL='rtsp://user:pass@192.168.1.64:554/Streaming/Channels/101' \
 *   API_URL='https://smart-cam-api.xxx.azurecontainerapps.io' \
 *   CHANNEL='store-bkk01-door' \
 *   node src/bridge.js
 *
 * Env:
 *   RTSP_URL   (required)  camera stream URL — see docs/CAMERA-SOURCES.md
 *   API_URL    (required)  Smart Cam API base URL
 *   CHANNEL    (required)  channel name viewers subscribe to
 *   FPS        (default 1) frames per second sent for analysis
 *   WIDTH      (default 640)
 *   HEIGHT     (default 480)
 *   JPEG_Q     (default 7) ffmpeg mjpeg quality 2(best)-31(worst)
 *   BROADCAST  (default 1) also push frames to viewer consoles (set 0 to save bandwidth)
 */
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const {
  RTSP_URL,
  API_URL,
  CHANNEL,
  FPS = '1',
  WIDTH = '640',
  HEIGHT = '480',
  JPEG_Q = '7',
  BROADCAST = '1',
} = process.env;

if (!RTSP_URL || !API_URL || !CHANNEL) {
  console.error('ต้องตั้ง RTSP_URL, API_URL, CHANNEL — ดูตัวอย่างในไฟล์นี้');
  process.exit(1);
}

const SOI = Buffer.from([0xff, 0xd8]); // JPEG start
const EOI = Buffer.from([0xff, 0xd9]); // JPEG end

console.log(`▶ bridge: ${RTSP_URL.replace(/\/\/.*@/, '//***@')} → ${API_URL} [${CHANNEL}] @${FPS}fps`);

const socket = io(API_URL, { path: '/ws', transports: ['websocket'] });
let connected = false;
let busy = false;

socket.on('connect', () => {
  connected = true;
  console.log(`✔ connected to API as ${socket.id}`);
});
socket.on('disconnect', () => {
  connected = false;
  console.log('✖ API disconnected — reconnecting…');
});
socket.on('recognition', (msg) => {
  busy = false;
  const faces = msg.results?.length ?? 0;
  if (faces > 0) {
    const r = msg.results[0];
    console.log(
      `👤 ${faces} face(s) · ${r.isMember ? `member:${r.member?.displayName}` : 'guest'} · age~${r.estimatedAge} · ${msg.processingMs}ms`,
    );
  }
});
socket.on('recognition_error', (e) => {
  busy = false;
  console.error('recognition error:', e.message);
});

function startFfmpeg() {
  const args = [
    '-rtsp_transport', 'tcp',
    '-i', RTSP_URL,
    '-vf', `fps=${FPS},scale=${WIDTH}:${HEIGHT}`,
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-q:v', JPEG_Q,
    '-',
  ];
  const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let buf = Buffer.alloc(0);

  ff.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    // Extract complete JPEGs from the pipe
    let start = buf.indexOf(SOI);
    let end = buf.indexOf(EOI, start + 2);
    while (start !== -1 && end !== -1) {
      const jpeg = buf.subarray(start, end + 2);
      buf = buf.subarray(end + 2);
      sendFrame(jpeg);
      start = buf.indexOf(SOI);
      end = buf.indexOf(EOI, start + 2);
    }
    // Guard against unbounded growth on corrupt streams
    if (buf.length > 10 * 1024 * 1024) buf = Buffer.alloc(0);
  });

  ff.stderr.on('data', (d) => {
    const line = d.toString();
    if (line.includes('error') || line.includes('Error')) console.error('[ffmpeg]', line.trim());
  });

  ff.on('exit', (code) => {
    console.error(`ffmpeg exited (${code}) — restarting in 5s…`);
    setTimeout(startFfmpeg, 5000);
  });
}

function sendFrame(jpeg) {
  if (!connected || busy) return; // drop frame if API still processing
  busy = true;
  socket.emit('frame', {
    imageBase64: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
    ts: Date.now(),
    frameId: `bridge_${Date.now()}`,
    channel: CHANNEL,
    broadcastFrame: BROADCAST === '1',
  });
}

startFfmpeg();
