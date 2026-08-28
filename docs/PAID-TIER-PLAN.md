# แผนย้ายจาก Free Tier → Paid Tier

> P0 จาก gap analysis: ก่อนเก็บเงินลูกค้าจริง ต้องออกจากข้อจำกัดของ free tier
> (cold start, ไม่มี backup/PITR, ไม่มี SLA) — เอกสารนี้บอกว่าจ่ายอะไร เมื่อไหร่ เท่าไหร่
> คำสั่งทั้งหมดรันจาก Cloud Shell ผ่าน `./infra/paid-tier.sh`

## สรุปลำดับการจ่าย (จ่ายเมื่อถึงจุดที่ต้องใช้ ไม่ต้องจ่ายพร้อมกัน)

| ลำดับ | รายการ | จ่ายเมื่อ | ราคา/เดือน (ประมาณ) |
|---|---|---|---|
| 1 | **Budget alert** (Azure) | วันนี้ — ฟรี | ฿0 |
| 2 | **Neon Launch** (database) | ก่อนมีลูกค้า pilot รายแรก | ~$19 (฿700) |
| 3 | **Always-on AI service** (`warm`) | ก่อน demo ขาย / pilot | ~$30–40 (฿1,100–1,500) |
| 4 | **Always-on API** (รวมในข้อ 3) | พร้อมข้อ 3 | ~$25–35 (฿900–1,300) |
| 5 | **SWA Standard** | เมื่อลูกค้าต้องการ SLA/custom domain | $9 (฿330) |

รวมช่วง pilot จริง: **~$85–100/เดือน (฿3,100–3,700)** ต่อ 1 สภาพแวดล้อม —
คุ้มเมื่อเทียบราคาขายที่ทีม sales เสนอ (฿1,500–3,000/สาขา/เดือน ตั้งแต่ ~2 สาขาขึ้นไป)

## 1. Budget alert — ทำวันนี้ ฟรี กันบิลช็อก

Azure Portal → **Cost Management + Billing → Budgets → + Add**
- Scope: subscription ปัจจุบัน
- Amount: `30` USD/เดือน (ปรับตามจริง)
- Alert conditions: Actual 50%, 90%, 100% → ใส่อีเมลของคุณ

(สร้างผ่าน Portal ง่ายกว่า CLI — CLI รุ่นปัจจุบันตั้ง notification ไม่ได้)

## 2. Neon Free → Launch ($19/เดือน) — สำคัญสุด

ข้อจำกัด Free ที่รับไม่ได้ตอนมีลูกค้าจริง: ไม่มี point-in-time recovery จริงจัง,
compute autosuspend (query แรกหลังเงียบช้า), storage 0.5GB

**Launch ได้:** PITR ย้อนหลัง 7 วัน, storage 10GB, compute ใหญ่ขึ้น, support

ขั้นตอน (ไม่ต้องแก้โค้ด/ไม่ต้อง migrate — โปรเจกต์เดิม อัปเกรดในที่):
1. [console.neon.tech](https://console.neon.tech) → เลือกโปรเจกต์ → **Billing → Upgrade to Launch**
2. connection string เดิมใช้ได้ต่อ — ไม่ต้องแตะ secrets ใน Azure
3. ระหว่างยังไม่อัปเกรด: workflow `Nightly DB backup` (pg_dump ทุกคืน เก็บ 30 วันใน
   GitHub Actions artifacts) เป็น backup ชั่วคราว — ตั้ง secret `DIRECT_DATABASE_URL`
   ใน repo (Settings → Secrets → Actions) แล้ว workflow จะทำงานเองหลัง merge เข้า main

## 3–4. Always-on (หมด cold start)

ตอนนี้ทั้ง API และ AI service scale-to-zero — เงียบ ~5 นาทีแล้ว container ดับ
request ถัดไปรอ 30–60 วิ (AI ต้องโหลดโมเดล InsightFace ใหม่) **demo ต่อหน้าลูกค้าพังเพราะอันนี้ได้**

```bash
./infra/paid-tier.sh warm    # เปิด always-on ทั้งคู่
./infra/paid-tier.sh status  # ดูสถานะ
./infra/paid-tier.sh cold    # กลับไปฟรี (เช่นหลัง demo)
```

ค่าใช้จ่ายคิดตามวินาทีที่ replica เปิด — เปิด `warm` เฉพาะช่วงมีลูกค้าใช้จริง/ช่วง demo
แล้ว `cold` กลับได้ตลอด ไม่มีค่าผูกมัด

## 5. Static Web App Free → Standard ($9/เดือน)

Free ใช้ custom domain ได้อยู่แล้ว — จ่ายเมื่อลูกค้าเรียกร้อง SLA (Standard มี 99.95%)
หรือต้องใช้ private endpoint: `./infra/paid-tier.sh swa-standard`

## Monitoring ที่มากับ repo (ฟรี)

- `GET /health/deep` — เช็ค DB + AI service จริง คืน 503 เมื่อ component ใดล่ม
- Workflow **Uptime monitor** — ยิง `/health/deep` ทุก 15 นาที, fail แล้ว GitHub
  ส่งอีเมลหาเจ้าของ repo อัตโนมัติ (เริ่มทำงานเมื่อ merge เข้า default branch;
  ระหว่างนี้กด Run workflow ทดสอบได้)
- Workflow **Nightly DB backup** — pg_dump รายคืน เก็บ 30 วัน
- ดู log สด: `az containerapp logs show -n smart-cam-api -g smart-cam-rg --follow`

## สิ่งที่ *ยังไม่ต้อง* จ่าย

- Application Insights / Log Analytics แบบเสียเงิน — uptime workflow + logs พอสำหรับ pilot
- Dedicated plan ของ Container Apps — consumption plan รับได้ถึงหลายสิบสาขา
- Azure Database for PostgreSQL — Neon Launch ถูกกว่าและย้ายง่ายกว่าที่ scale นี้
