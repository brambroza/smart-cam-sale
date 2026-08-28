#!/usr/bin/env bash
#
# ติดตั้ง Smart Cam Bridge บน mini PC (Ubuntu/Debian) ในคำสั่งเดียว —
# สำหรับ "ผู้ติดตั้ง" ใช้ตอนเตรียมกล่องให้ร้านลูกค้า ไม่ใช่ให้ลูกค้ารันเอง
#
#   curl -fsSL https://raw.githubusercontent.com/brambroza/smart-cam-sale/main/infra/install-bridge.sh | sudo bash
#
# สิ่งที่สคริปต์ทำ: ลง Node.js + ffmpeg, วาง bridge ไว้ที่ /opt/smart-cam-bridge,
# ถาม bridge token (พิมพ์แบบลับ), ตั้ง systemd service ที่รันเองตอนเปิดเครื่อง
# และรีสตาร์ตเองเมื่อล่ม — เสร็จแล้วกล่องนี้คือ appliance เสียบปลั๊กใช้ได้เลย
set -euo pipefail

APP_DIR=/opt/smart-cam-bridge
ENV_FILE=/etc/smart-cam-bridge.env
SERVICE=/etc/systemd/system/smart-cam-bridge.service
RAW=https://raw.githubusercontent.com/brambroza/smart-cam-sale/main/apps/camera-bridge/src/bridge.js
DEFAULT_API=https://smart-cam-api.icygrass-3d32430d.southeastasia.azurecontainerapps.io

[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย sudo"; exit 1; }

echo "▶ [1/5] ติดตั้ง Node.js + ffmpeg"
apt-get update -qq
apt-get install -y -qq ffmpeg curl ca-certificates >/dev/null
if ! command -v node >/dev/null || [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "   node $(node -v) · $(ffmpeg -version | head -1 | cut -d' ' -f1-3)"

echo "▶ [2/5] ดาวน์โหลด bridge → $APP_DIR"
mkdir -p "$APP_DIR"
curl -fsSL "$RAW" -o "$APP_DIR/bridge.js"
cat > "$APP_DIR/package.json" <<'PKG'
{ "name": "smart-cam-bridge", "private": true, "type": "module" }
PKG
(cd "$APP_DIR" && npm install --silent socket.io-client@^4.7.5 >/dev/null)

echo "▶ [3/5] ตั้งค่าการเชื่อมต่อ"
# ถามเฉพาะตอนยังไม่มีไฟล์ env (รันซ้ำเพื่ออัปเดตโค้ดได้โดยไม่ถาม token ใหม่)
if [ ! -f "$ENV_FILE" ]; then
  read -rp "API URL [$DEFAULT_API]: " API_URL </dev/tty
  API_URL=${API_URL:-$DEFAULT_API}
  read -rsp "Bridge token ขององค์กร (brg_...): " TOKEN </dev/tty; echo
  case "$TOKEN" in
    brg_*) ;;
    *) echo "token ต้องขึ้นต้นด้วย brg_ — ยกเลิก"; exit 1 ;;
  esac
  read -rp "Bridge ID [default]: " BRIDGE_ID </dev/tty
  cat > "$ENV_FILE" <<ENV
API_URL=$API_URL
BRIDGE_TOKEN=$TOKEN
BRIDGE_ID=${BRIDGE_ID:-default}
ENV
  chmod 600 "$ENV_FILE"
else
  echo "   ใช้ค่าเดิมจาก $ENV_FILE (ลบไฟล์นี้ถ้าต้องการตั้งใหม่)"
fi

echo "▶ [4/5] ตั้ง system service (รันเองตอนเปิดเครื่อง + ล่มแล้วฟื้นเอง)"
cat > "$SERVICE" <<UNIT
[Unit]
Description=Smart Cam Bridge (camera relay)
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) $APP_DIR/bridge.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now smart-cam-bridge >/dev/null

echo "▶ [5/5] ตรวจสถานะ"
sleep 3
systemctl --no-pager -l status smart-cam-bridge | head -12 || true
echo
echo "✅ เสร็จแล้ว — คำสั่งดูแล:"
echo "   ดู log สด:   journalctl -u smart-cam-bridge -f"
echo "   รีสตาร์ต:    sudo systemctl restart smart-cam-bridge"
echo "   เปลี่ยน token: sudo nano $ENV_FILE แล้วรีสตาร์ต"
echo
echo "ขั้นต่อไป: เพิ่มกล้องของร้านจากหน้าเว็บ (จัดการกล้อง) — bridge จะรับ config เองใน ~30 วิ"
