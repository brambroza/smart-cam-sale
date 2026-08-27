# Smart Cam Sale

ระบบกล้องอัจฉริยะสำหรับร้านสะดวกซื้อ ร้านกาแฟ ร้านอาหารตามสั่ง — ตรวจจับใบหน้าลูกค้าเรียลไทม์ ระบุว่าเป็นสมาชิกหรือไม่ ประเมินอายุ/เพศ และแนะนำสินค้าให้พนักงานหน้าร้านช่วยปิดการขาย

## กลุ่มลูกค้าเป้าหมาย

- ร้านสะดวกซื้อ (7-Eleven, CJ, Lotus's Go Fresh)
- ร้านกาแฟ (independent, chain เล็ก)
- ร้านอาหารตามสั่ง / street food ที่มีระบบสมาชิก

## Features

- 🎥 Live camera stream ผ่าน WebRTC
- 👤 Face recognition (InsightFace) — ประเมิน อายุ / เพศ / embedding
- 🔍 ค้นหาสมาชิกจากใบหน้า ด้วย pgvector cosine similarity
- 🛒 แนะนำสินค้าตามประวัติซื้อ + ช่วงเวลา + demographic
- ✨ UI ที่การ์ดลูกค้าเด้งขึ้นแบบ smooth พร้อม micro-interactions
- 📊 Dashboard สรุปทราฟฟิกลูกค้า (member vs guest, peak hour)

## Architecture

```
┌─────────────────┐        ┌──────────────────┐        ┌────────────────┐
│  React (Vite)   │◄──ws──►│   NestJS API     │◄──────►│  AI Service    │
│  Tailwind + FM  │        │   Socket.IO      │        │  FastAPI       │
│  Webcam stream  │        │   Prisma         │        │  InsightFace   │
└─────────────────┘        └────────┬─────────┘        └────────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │ PostgreSQL         │
                          │ + pgvector         │
                          └────────────────────┘
```

## Local dev

```bash
docker compose up -d db          # start postgres+pgvector
pnpm install
pnpm --filter api prisma migrate dev
pnpm --filter api seed
pnpm dev                          # starts web + api concurrently
# AI service:
cd apps/ai-service && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Repo layout

```
apps/
  web/          React + Vite frontend (camera + WOW UI)
  api/          NestJS API + WebSocket gateway + Prisma
  ai-service/   Python FastAPI wrapping InsightFace
packages/
  shared-types/ TypeScript types shared FE/BE
infra/          docker-compose, k8s manifests
docs/           architecture, ADRs
```

See `docs/ARCHITECTURE.md` for detail.
