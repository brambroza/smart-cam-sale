# Getting started

## Prerequisites

- Node.js ≥ 20 + pnpm 9
- Python ≥ 3.11 (for AI service local run)
- Docker (สำหรับ PostgreSQL + pgvector)
- กล้อง (webcam / USB / IP camera ที่ map เป็น v4l2)

## Quick start (แนะนำ — โหมด mock AI ก่อน)

```bash
# 1) เปิด Postgres+pgvector
docker compose up -d db

# 2) ติดตั้ง deps + migrate + seed
pnpm install
cd apps/api
cp .env.example .env
pnpm prisma migrate deploy
pnpm prisma generate
pnpm ts-node prisma/seed.ts
cd ../..

# 3) รัน AI service แบบ mock (ไม่ต้องโหลด InsightFace model)
cd apps/ai-service
python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn opencv-python-headless numpy pydantic
USE_MOCK=true uvicorn app.main:app --port 8000 --reload
# เปิดอีก terminal นึง

# 4) รัน API + Web
pnpm dev
```

จากนั้นเปิด http://localhost:5173

## รันโหมด production (มี InsightFace จริง)

```bash
docker compose up -d
```

ครั้งแรกจะช้า เพราะ container จะดาวน์โหลด buffalo_l model (~300MB)

## Query ตัวอย่าง — pgvector

```sql
-- หาสมาชิกที่ใกล้เคียงกับ face embedding ใหม่
SELECT m.*, 1 - (fe.embedding <=> '[0.1,0.2,...]'::vector) AS similarity
FROM "FaceEmbedding" fe
JOIN "Member" m ON m.id = fe."memberId"
ORDER BY fe.embedding <=> '[0.1,0.2,...]'::vector
LIMIT 1;
```

## ต่อยอด

- แทน mock AI ด้วย InsightFace จริง: ตั้ง `USE_MOCK=false` ใน ai-service
- ถ้าจะใช้ GPU: เปลี่ยน onnxruntime → onnxruntime-gpu ใน requirements.txt
- ปรับ FPS ที่ frontend (ค่า default 2 fps) — ดู `apps/web/src/App.tsx` line: `useRecognition(videoRef, live, 2)`
- Dashboard สถิติ: ต่อ endpoint `/members/stats` เพิ่ม chart ด้วย Recharts
