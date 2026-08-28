/**
 * Camera Bridge — relays IP-camera streams (Hikvision, Xiaomi, Dahua, Tapo,
 * Reolink, EZVIZ, Uniview, generic RTSP) into the Smart Cam Sale API.
 *
 * Two modes:
 *
 * 1) AGENT MODE (recommended) — cameras are managed from the web console.
 *    The bridge polls the API for its camera list and spawns one ffmpeg per
 *    enabled camera. Add/edit/remove cameras in the UI; the bridge follows
 *    within ~30s without a restart.
 *
 *      API_URL='https://smart-cam-api.xxx.azurecontainerapps.io' \
 *      BRIDGE_ID='default' \
 *      BRIDGE_TOKEN='optional-shared-secret' \
 *      node src/bridge.js
 *
 * 2) SINGLE-CAMERA MODE (legacy) — everything from env, no API config.
 *
 *      RTSP_URL='rtsp://user:pass@192.168.1.64:554/Streaming/Channels/102' \
 *      API_URL='https://...' CHANNEL='store-main' node src/bridge.js
 *
 * Common env: FPS (1), WIDTH (640), HEIGHT (480), JPEG_Q (7), BROADCAST (1)
 */
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const {
  API_URL,
  RTSP_URL,
  CHANNEL,
  BRIDGE_ID = 'default',
  BRIDGE_TOKEN,
  FPS = '1',
  WIDTH = '640',
  HEIGHT = '480',
  JPEG_Q = '7',
  BROADCAST = '1',
  POLL_MS = '30000',
} = process.env;

if (!API_URL) {
  console.error('ต้องตั้ง API_URL');
  process.exit(1);
}

const agentMode = !RTSP_URL;
if (!agentMode && !CHANNEL) {
  console.error('single-camera mode ต้องตั้ง CHANNEL ด้วย');
  process.exit(1);
}

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

/** channel -> { ffmpeg process, rtspUrl, busy } */
const workers = new Map();

const socket = io(API_URL, {
  path: '/ws',
  transports: ['websocket'],
  auth: { bridgeToken: BRIDGE_TOKEN },
});
let connected = false;

socket.on('connect', () => {
  connected = true;
  console.log(`✔ connected to API as ${socket.id}`);
});
socket.on('disconnect', () => {
  connected = false;
  console.log('✖ API disconnected — reconnecting…');
});
socket.on('connect_error', (e) => {
  console.error(`connect error: ${e.message}${BRIDGE_TOKEN ? '' : ' (ยังไม่ได้ตั้ง BRIDGE_TOKEN — API ที่เปิด auth จะปฏิเสธการเชื่อมต่อ)'}`);
});
socket.on('recognition', (msg) => {
  // frameId carries the channel — mark that worker free
  const ch = msg.frameId?.split('|')[0];
  const w = ch && workers.get(ch);
  if (w) w.busy = false;
  const faces = msg.results?.length ?? 0;
  if (faces > 0) {
    const r = msg.results[0];
    console.log(
      `👤 [${ch}] ${faces} face(s) · ${r.isMember ? `member:${r.member?.displayName}` : 'guest'} · age~${r.estimatedAge} · ${msg.processingMs}ms`,
    );
  }
});
socket.on('recognition_error', (e) => {
  for (const w of workers.values()) w.busy = false;
  console.error('recognition error:', e.message);
});

function startWorker(channel, rtspUrl) {
  const worker = { proc: null, rtspUrl, busy: false, stopped: false };
  workers.set(channel, worker);
  spawnFfmpeg(channel, worker);
  console.log(`▶ [${channel}] ${rtspUrl.replace(/\/\/.*@/, '//***@')}`);
}

function stopWorker(channel) {
  const w = workers.get(channel);
  if (!w) return;
  w.stopped = true;
  w.proc?.kill('SIGKILL');
  workers.delete(channel);
  console.log(`■ [${channel}] stopped`);
}

function spawnFfmpeg(channel, worker) {
  if (worker.stopped) return;
  const args = [
    '-rtsp_transport', 'tcp',
    '-i', worker.rtspUrl,
    '-vf', `fps=${FPS},scale=${WIDTH}:${HEIGHT}`,
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-q:v', JPEG_Q,
    '-',
  ];
  const ff = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  worker.proc = ff;

  let buf = Buffer.alloc(0);
  ff.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let start = buf.indexOf(SOI);
    let end = buf.indexOf(EOI, start + 2);
    while (start !== -1 && end !== -1) {
      const jpeg = buf.subarray(start, end + 2);
      buf = buf.subarray(end + 2);
      sendFrame(channel, worker, jpeg);
      start = buf.indexOf(SOI);
      end = buf.indexOf(EOI, start + 2);
    }
    if (buf.length > 10 * 1024 * 1024) buf = Buffer.alloc(0);
  });

  ff.stderr.on('data', (d) => {
    const line = d.toString();
    if (/error/i.test(line)) console.error(`[ffmpeg:${channel}]`, line.trim());
  });

  ff.on('exit', (code) => {
    if (worker.stopped) return;
    console.error(`[${channel}] ffmpeg exited (${code}) — restart in 5s`);
    setTimeout(() => spawnFfmpeg(channel, worker), 5000);
  });
}

function sendFrame(channel, worker, jpeg) {
  if (!connected || worker.busy) return;
  worker.busy = true;
  socket.emit('frame', {
    imageBase64: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
    ts: Date.now(),
    frameId: `${channel}|${Date.now()}`,
    channel,
    broadcastFrame: BROADCAST === '1',
  });
  // safety: never stay busy forever if a reply is lost
  setTimeout(() => {
    worker.busy = false;
  }, 10000);
}

async function syncCameras() {
  try {
    const res = await fetch(`${API_URL}/cameras/bridge/${encodeURIComponent(BRIDGE_ID)}`, {
      headers: BRIDGE_TOKEN ? { 'x-bridge-token': BRIDGE_TOKEN } : {},
    });
    if (!res.ok) {
      console.error(`config fetch failed: HTTP ${res.status}`);
      return;
    }
    const cams = await res.json();
    const wanted = new Map(cams.map((c) => [c.channel, c.rtspUrl]));

    // stop removed/changed
    for (const [channel, w] of workers) {
      const url = wanted.get(channel);
      if (!url) stopWorker(channel);
      else if (url !== w.rtspUrl) {
        stopWorker(channel);
        startWorker(channel, url);
      }
    }
    // start new
    for (const [channel, url] of wanted) {
      if (!workers.has(channel)) startWorker(channel, url);
    }
    if (workers.size === 0) console.log('(ยังไม่มีกล้อง enabled สำหรับ bridge นี้ — เพิ่มจากหน้าเว็บได้เลย)');
  } catch (e) {
    console.error('config sync error:', e.message);
  }
}

if (agentMode) {
  console.log(`▶ agent mode · bridge_id=${BRIDGE_ID} · poll ${POLL_MS}ms`);
  syncCameras();
  setInterval(syncCameras, Number(POLL_MS));
} else {
  console.log('▶ single-camera mode (legacy env config)');
  startWorker(CHANNEL, RTSP_URL);
}
