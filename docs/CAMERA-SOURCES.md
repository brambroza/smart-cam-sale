# การใช้กล้อง IP (Hikvision, Xiaomi, Dahua ฯลฯ)

Browser เล่น RTSP โดยตรงไม่ได้ — ต้องรัน **camera-bridge** (ffmpeg relay) บนเครื่องที่:
- มองเห็นกล้องใน LAN
- ต่ออินเทอร์เน็ตถึง API ได้

เหมาะกับ: mini PC หลังเคาน์เตอร์, Raspberry Pi, เครื่อง POS, NAS ที่รัน Docker ได้

```
กล้อง (RTSP/LAN) → camera-bridge (ffmpeg) → Smart Cam API → console ทุกเครื่อง
```

## รัน bridge

### แบบ Node (เครื่องมี ffmpeg)

```bash
cd apps/camera-bridge
npm install

RTSP_URL='rtsp://admin:password@192.168.1.64:554/Streaming/Channels/101' \
API_URL='https://smart-cam-api.icygrass-3d32430d.southeastasia.azurecontainerapps.io' \
CHANNEL='store-main' \
npm start
```

### แบบ Docker (แนะนำ — มี ffmpeg ในตัว)

```bash
cd apps/camera-bridge
docker build -t smart-cam-bridge .

docker run -d --restart unless-stopped \
  -e RTSP_URL='rtsp://admin:password@192.168.1.64:554/Streaming/Channels/101' \
  -e API_URL='https://smart-cam-api.icygrass-3d32430d.southeastasia.azurecontainerapps.io' \
  -e CHANNEL='store-main' \
  --name cam-bridge smart-cam-bridge
```

### เปิดดูใน console

เว็บ console → แท็บ **"IP Camera (Hikvision / Xiaomi)"** → กรอก channel ให้ตรงกับ bridge (`store-main`) → รอสถานะ "รับสัญญาณแล้ว"

---

## RTSP URL ของแต่ละยี่ห้อ

### Hikvision

```
rtsp://<user>:<pass>@<ip>:554/Streaming/Channels/101   # main stream (คมชัด)
rtsp://<user>:<pass>@<ip>:554/Streaming/Channels/102   # sub stream (เบากว่า — แนะนำ)
```
- เปิด RTSP: เข้าเว็บกล้อง → Configuration → Network → Advanced → Integration Protocol → เปิด **ONVIF/RTSP**
- แนะนำใช้ sub stream (102) ตั้งไว้ 640×480 — พอสำหรับ face detection และเบา CPU

### Dahua / Imou

```
rtsp://<user>:<pass>@<ip>:554/cam/realmonitor?channel=1&subtype=1
```
(subtype=0 คือ main, 1 คือ sub)

### Xiaomi (Mi Home / Xiaomi Smart Camera)

⚠️ Firmware ปกติของ Xiaomi **ไม่เปิด RTSP** — มี 2 ทาง:

**ทาง A — เปิด RTSP ผ่าน firmware ทางเลือก** (นิยมสุด)
1. ลง [Xiaomi-camera-hacks](https://github.com/EliasKotlyar/Xiaomi-Dafang-Hacks) หรือ
   [yi-hack](https://github.com/roleoroleo/yi-hack-MStar) ตามรุ่นกล้อง (ทำผ่าน SD card)
2. หลังลงจะได้ RTSP:
   ```
   rtsp://<ip>:8554/unicast
   ```

**ทาง B — ใช้ Xiaomi ผ่าน Home Assistant + go2rtc**
ถ้ามี Home Assistant อยู่แล้ว ให้ add กล้องผ่าน Xiaomi integration แล้วใช้ go2rtc
restream ออกมาเป็น RTSP ให้ bridge ต่อ

### TP-Link Tapo

```
rtsp://<user>:<pass>@<ip>:554/stream2
```
(ต้องสร้าง camera account แยกใน Tapo app: Settings → Advanced → Camera Account)

### กล้อง ONVIF ทั่วไป

ใช้โปรแกรม [ONVIF Device Manager](https://sourceforge.net/projects/onvifdm/) หา RTSP URL อัตโนมัติ

---

## ตัวแปร env ของ bridge

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `RTSP_URL` | (บังคับ) | URL กล้อง |
| `API_URL` | (บังคับ) | Smart Cam API |
| `CHANNEL` | (บังคับ) | ชื่อ channel ให้ console subscribe |
| `FPS` | 1 | เฟรมต่อวินาทีที่ส่งวิเคราะห์ |
| `WIDTH`×`HEIGHT` | 640×480 | ขนาด frame |
| `JPEG_Q` | 7 | คุณภาพ JPEG (2 ดีสุด – 31 แย่สุด) |
| `BROADCAST` | 1 | ส่งภาพไป console ด้วย (0 = ส่งเฉพาะผลวิเคราะห์ ประหยัด bandwidth) |

## หลายกล้อง / หลายสาขา

รัน bridge หลายตัว คนละ `CHANNEL`:
```
CHANNEL=store-bkk01-door    # ประตูเข้า
CHANNEL=store-bkk01-counter # หน้าเคาน์เตอร์
CHANNEL=store-bkk02-door    # สาขา 2
```
Console แต่ละเครื่องเลือก channel ที่ต้องการดู

## Bandwidth โดยประมาณ

640×480 JPEG q7 @1fps ≈ **30-50 KB/s ต่อกล้อง** (upstream จากร้าน)
ปิด `BROADCAST=0` เหลือแค่ metadata ~1 KB/s

## ความปลอดภัย

- อย่า expose RTSP ของกล้องออกอินเทอร์เน็ต — ให้ bridge อยู่ LAN เดียวกับกล้อง
- เปลี่ยน password default ของกล้องเสมอ (Hikvision/Dahua โดนสแกนจากบอทตลอด)
- ถ้าต้องการ auth ระหว่าง bridge ↔ API แจ้งได้ — เพิ่ม token ให้
