/**
 * RTSP path templates per camera brand. `model` in the DB is informational;
 * the stream path is decided by brand + quality (or overridden by streamPath
 * for brand "generic").
 */
export interface BrandProfile {
  label: string;
  defaultPort: number;
  paths: { main: string; sub: string };
  /** Models shown as suggestions in the UI dropdown. */
  models: string[];
  note?: string;
}

export const BRAND_PROFILES: Record<string, BrandProfile> = {
  hikvision: {
    label: 'Hikvision',
    defaultPort: 554,
    paths: { main: '/Streaming/Channels/101', sub: '/Streaming/Channels/102' },
    models: ['DS-2CD ซีรีส์ (กล้องโดม/กระบอก)', 'DS-2DE ซีรีส์ (PTZ)', 'HiWatch ซีรีส์', 'อื่น ๆ'],
    note: 'เปิด RTSP: Configuration → Network → Advanced → Integration Protocol',
  },
  dahua: {
    label: 'Dahua',
    defaultPort: 554,
    paths: {
      main: '/cam/realmonitor?channel=1&subtype=0',
      sub: '/cam/realmonitor?channel=1&subtype=1',
    },
    models: ['IPC-HDW ซีรีส์', 'IPC-HFW ซีรีส์', 'SD ซีรีส์ (PTZ)', 'อื่น ๆ'],
  },
  imou: {
    label: 'Imou',
    defaultPort: 554,
    paths: {
      main: '/cam/realmonitor?channel=1&subtype=0',
      sub: '/cam/realmonitor?channel=1&subtype=1',
    },
    models: ['Ranger 2', 'Bullet 2', 'Cruiser', 'A1', 'อื่น ๆ'],
    note: 'เปิด local RTSP ในแอป Imou Life: Device Settings → Advanced',
  },
  tapo: {
    label: 'TP-Link Tapo',
    defaultPort: 554,
    paths: { main: '/stream1', sub: '/stream2' },
    models: ['C200', 'C210', 'C310', 'C320WS', 'C500', 'อื่น ๆ'],
    note: 'สร้าง Camera Account ในแอป Tapo ก่อน: Settings → Advanced → Camera Account',
  },
  xiaomi_hack: {
    label: 'Xiaomi (firmware ทางเลือก)',
    defaultPort: 8554,
    paths: { main: '/unicast', sub: '/unicast' },
    models: ['Mi 360° 2K', 'Mi 360° 1080p', 'Yi Home', 'Yi Dome', 'อื่น ๆ'],
    note: 'ต้องลง firmware ทางเลือก (yi-hack / Dafang-Hacks) ก่อน — ดู docs/CAMERA-SOURCES.md',
  },
  reolink: {
    label: 'Reolink',
    defaultPort: 554,
    paths: { main: '/h264Preview_01_main', sub: '/h264Preview_01_sub' },
    models: ['E1 Pro', 'E1 Zoom', 'RLC-510A', 'RLC-810A', 'อื่น ๆ'],
  },
  ezviz: {
    label: 'EZVIZ',
    defaultPort: 554,
    paths: { main: '/h264/ch1/main/av_stream', sub: '/h264/ch1/sub/av_stream' },
    models: ['C6N', 'C3N', 'TY1', 'H6c', 'อื่น ๆ'],
    note: 'username = admin, password = verification code ข้างกล้อง',
  },
  uniview: {
    label: 'Uniview (UNV)',
    defaultPort: 554,
    paths: { main: '/media/video1', sub: '/media/video2' },
    models: ['IPC ซีรีส์', 'อื่น ๆ'],
  },
  generic: {
    label: 'RTSP อื่น ๆ / ONVIF',
    defaultPort: 554,
    paths: { main: '', sub: '' },
    models: ['กำหนดเอง'],
    note: 'กรอก stream path เอง เช่น /live/ch0',
  },
};

export function buildRtspUrl(cam: {
  brand: string;
  host: string;
  port: number;
  username: string;
  password: string;
  quality: string;
  streamPath?: string | null;
}): string {
  const profile = BRAND_PROFILES[cam.brand] ?? BRAND_PROFILES.generic!;
  const path =
    cam.brand === 'generic'
      ? (cam.streamPath ?? '')
      : (cam.streamPath || profile.paths[cam.quality === 'main' ? 'main' : 'sub']);
  const auth = `${encodeURIComponent(cam.username)}:${encodeURIComponent(cam.password)}`;
  return `rtsp://${auth}@${cam.host}:${cam.port}${path}`;
}
