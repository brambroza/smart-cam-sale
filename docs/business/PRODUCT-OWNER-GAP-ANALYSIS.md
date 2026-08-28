# Smart Cam Sale — Gap Analysis: จาก MVP สู่ผลิตภัณฑ์ที่ขายได้จริง

**จัดทำโดย:** Product Owner
**วันที่:** 28 สิงหาคม 2026
**ฐานข้อมูล:** ตรวจสอบจากโค้ดจริงใน repo (`apps/api`, `apps/web`, `apps/ai-service`, `apps/camera-bridge`, `infra/`, `.github/workflows/`) และสถานะ deployment ปัจจุบันบน Azure free tier

> **บรรทัดเดียวที่ต้องรู้:** ระบบ demo ได้สวยงาม แต่ **ยังเก็บเงินลูกค้าไม่ได้** — ไม่มี auth, ไม่มีทางบันทึกการซื้อจริง (recommendation จะไร้ข้อมูลภายในเดือนแรก), และเก็บ face embedding ซึ่งเป็นข้อมูลชีวภาพโดยไม่มี consent flow ที่ใช้งานได้จริง ต้องปิด P0 ประมาณ 10 คน-สัปดาห์ก่อนเซ็นสัญญารายแรก

---

## 1. สรุปสถานะ: อะไรเสร็จแล้ว

| Feature | สถานะ | หมายเหตุ |
|---|---|---|
| Live camera: webcam + IP camera ผ่าน bridge | ✅ | bridge agent mode poll API ทุก ~30s, ffmpeg ต่อกล้อง, จัดการกล้องจากหน้าเว็บได้ (CRUD ครบ) |
| รองรับกล้องหลายยี่ห้อ | ✅ | Hikvision, Dahua, Imou, Tapo, Reolink, EZVIZ, Uniview, generic RTSP — **Xiaomi C-series ใช้ไม่ได้** |
| Face recognition จริง (ไม่ mock) | ✅ | InsightFace buffalo_s บน CPU 1 core/2GB, `USE_MOCK=false` ใช้งานจริงแล้ว |
| จับคู่สมาชิกจากใบหน้า | ✅ | pgvector cosine similarity, threshold 0.55 (hard-coded) |
| Enroll สมาชิก + จัดการ face embedding | ✅ | ผ่าน UI (EnrollModal) + API |
| Recommendation ตามประวัติซื้อ/เวลา/demographic | ✅ | ทำงานได้ แต่ข้อมูลซื้อมาจาก seed เท่านั้น |
| สคริปต์พูดขายจาก Claude Haiku 4.5 | ✅ | ภาษาไทย เปิดใช้จริงผ่าน `ANTHROPIC_API_KEY` |
| Dashboard สถิติ (member vs guest, traffic) | ✅ | StatsStrip + VisitLog |
| Deploy บน Azure ฟรี ($0/เดือน) | ✅ | Container Apps consumption + Static Web Apps free + Neon free — แลกกับ cold start และ SLA ที่สัญญาไม่ได้ |
| CI build image | ✅ | GitHub Actions → GHCR สำเร็จ (แต่ deploy เข้า Azure ต้องรันมือ) |

สรุป: **core loop "เห็นหน้า → รู้จัก → แนะนำสินค้า" ทำงานจริง end-to-end แล้ว** นี่คือสิ่งที่ขายได้ในเชิง demo แต่ทุกอย่างรอบ ๆ core loop ยังเป็นระดับ prototype

---

## 2. Gap Analysis

### 2.1 Technical

| # | Gap | สภาพจริงในโค้ด | ความเสี่ยงถ้าไม่แก้ |
|---|---|---|---|
| T1 | **ไม่มีทางบันทึกการซื้อจริง** | ไม่มี endpoint `POST /purchases` — ตาราง `Purchase` ถูกเติมจาก `seed.ts` เท่านั้น | **ร้ายแรงสุด** — value proposition ของระบบคือ recommendation จากประวัติซื้อ ถ้าติดตั้งให้ลูกค้าโดยไม่มีทางเก็บ purchase ใหม่ ภายใน 1 เดือนคำแนะนำทั้งหมดจะอิงข้อมูลปลอม → ลูกค้าเลิกใช้ |
| T2 | **ไม่มี auth ใด ๆ** | `main.ts`/`app.module.ts` ไม่มี Guard เลย — ทุก REST endpoint + Socket.IO gateway + console เปิด public | ใครก็ตามที่รู้ URL ดึงรายชื่อสมาชิก เบอร์โทร ประวัติซื้อ และ **ลบ/แก้กล้อง** ได้ ผิด PDPA ตั้งแต่วันแรก |
| T3 | **Password กล้อง plaintext** | `schema.prisma` ระบุ comment ตรง ๆ: `password String // NOTE: stored plaintext for MVP` | DB หลุด = กล้องทุกตัวของทุกร้านหลุด |
| T4 | **Single tenant** | ไม่มี model Organization/Store — มีแค่ `storeCode String @default("main")` | ขยายเกิน 1 ร้านต้อง deploy ใหม่ทั้งชุดต่อร้าน = ต้นทุน ops โตเชิงเส้น |
| T5 | **ไม่มี test แม้แต่ไฟล์เดียว** | ยืนยันแล้วทั้ง repo | ทุก release คือการพนัน โดยเฉพาะ recognition pipeline ที่แตะหลาย service |
| T6 | **ไม่มี monitoring/alerting** | ไม่มีเลย — มีแค่ `/health` endpoint | ระบบล่มจะรู้ก็ต่อเมื่อลูกค้าโทรมาด่า |
| T7 | **Backup = Neon default เท่านั้น** | ไม่มี backup strategy, ไม่มี restore runbook | ข้อมูลสมาชิก + embedding หายคือหายจริง |
| T8 | **Deploy มือ** | GH Actions build → GHCR ได้ แต่ต้องรัน `./infra/deploy.sh` จาก Cloud Shell (ไม่มี service principal เพราะ tenant ติด MFA) | Hotfix กลางคืนต้องมีคนเปิด Cloud Shell — แก้ได้ด้วย OIDC federated credentials (ไม่ต้องใช้ secret) |
| T9 | **Free tier ทั้งหมด** | scale-to-zero cold start หลายสิบวินาที, Neon free 3GB | face recognition ที่ต้องรอ cold start = ลูกค้าเดินผ่านกล้องไปแล้ว — ต้องย้าย paid ก่อนเก็บเงิน (ประมาณการต้นทุนในข้อ 5) |
| T10 | **Threshold hard-coded** | `MATCH_THRESHOLD = 0.55` ใน `recognition.service.ts` | ปรับตามสภาพแสง/กล้องแต่ละร้านไม่ได้โดยไม่ deploy ใหม่ |
| T11 | **CPU inference** | `CPUExecutionProvider` เท่านั้น, buffalo_s บน 1 core/2GB | พอไหวสำหรับ 1-3 ร้าน ถ้า >5 สาขาควรพิจารณา GPU กลางหรือ batch — ยังไม่ใช่ปัญหาวันนี้ |

### 2.2 Product

| # | Gap | สภาพจริง |
|---|---|---|
| P-1 | **หน้าจัดการสินค้า** | Products API มีแค่ `GET` — เพิ่มสินค้า/แก้ราคาไม่ได้จาก UI, สินค้า ~110 รายการมาจาก seed ล้วน ๆ ร้านจริงราคาเปลี่ยนทุกสัปดาห์ |
| P-2 | **หน้าบันทึกการขาย / POS integration** | คู่กับ T1 — อย่างน้อยต้องมีหน้า "บันทึกขาย" ให้พนักงานกดเลือกสินค้าผูกกับสมาชิกที่ระบบเพิ่งจำได้ (POS integration เต็มรูปเป็น phase ถัดไป) |
| P-3 | **รายงานรายเดือนให้เจ้าของร้าน** | มีแค่ dashboard เรียลไทม์ — เจ้าของร้านที่จ่ายเงินต้องการเห็นยอด visit, member vs guest, conversion รายเดือน เพื่อ justify ค่าบริการ |
| P-4 | **Onboarding wizard** | การติดตั้งวันนี้ = อ่าน docs dev-facing + ตั้ง env มือ — ต้องมี wizard: ตั้งกล้อง → ทดสอบ stream → enroll สมาชิกชุดแรก |
| P-5 | **Consent flow ตาม PDPA** | schema มี `faceOptIn Boolean` แล้ว แต่ไม่มี UI/กระบวนการขอ consent จริง — face embedding เป็นข้อมูลชีวภาพ (ข้อมูลอ่อนไหว ม.26) ต้องได้ explicit consent ก่อน enroll |
| P-6 | **Mobile/tablet layout** | console ออกแบบสำหรับ desktop — หน้าร้านจริงใช้ tablet เป็นหลัก |
| P-7 | **ตั้งค่า threshold + settings** | ไม่มีหน้า settings ใด ๆ |
| P-8 | **ภาษา** | UI เป็นไทย hard-coded ไม่มี i18n — พอสำหรับตลาดไทย, เป็น P2 |

### 2.3 Operational

| # | Gap | สภาพจริง |
|---|---|---|
| O-1 | **การติดตั้งหน้างาน** | ไม่มีใครรับผิดชอบติดกล้อง เดินสาย ตั้ง mini PC รัน bridge ใน LAN ของร้าน — ต้องตัดสินใจ: ทีมเอง หรือ partner ช่างติดกล้อง + checklist ติดตั้งมาตรฐาน |
| O-2 | **SLA + ช่องทาง support** | สัญญา SLA ยังไม่ได้เพราะ free tier scale-to-zero — หลังย้าย paid ควรเริ่มที่ 99% เวลาทำการ + LINE OA เป็นช่องทาง support ตอบใน 4 ชม. ยังไม่มี on-call |
| O-3 | **คู่มือ + เทรนพนักงานร้าน** | docs ทั้ง 4 ไฟล์เป็น dev-facing ทั้งหมด (GETTING-STARTED, DEPLOY, ARCHITECTURE, CAMERA-SOURCES) — ไม่มีคู่มือพนักงานแม้แต่หน้าเดียว พนักงานร้านสะดวกซื้อ turnover สูง ต้องเทรนได้ใน 30 นาที |
| O-4 | **Billing/invoice** | ไม่มีระบบ ไม่มีสัญญามาตรฐาน — เริ่มด้วย invoice มือ + โอนได้ แต่ต้องมีสัญญา, ใบกำกับภาษี, เงื่อนไขยกเลิก |
| O-5 | **กระบวนการ PDPA** | ไม่มี privacy policy, ไม่มีกระบวนการลบข้อมูลตามคำขอ (ลบ embedding มีใน API แล้ว แต่ไม่มี workflow ฝั่งลูกค้า), ไม่มี data retention policy สำหรับ VisitLog |

---

## 3. จัดลำดับความสำคัญ + Effort

Effort เป็น "คน-สัปดาห์" ประมาณการโดย PO — ใช้วางแผน ไม่ใช่คำมั่น

### P0 — ต้องมีก่อนเก็บเงินลูกค้ารายแรก (~10 คน-สัปดาห์)

| รายการ | Gap ref | Effort |
|---|---|---|
| Auth + RBAC (owner/staff) ครอบ REST + WebSocket + console login | T2 | 2.0 |
| `POST /purchases` + หน้าบันทึกการขายอย่างง่าย (ผูกกับสมาชิกที่เพิ่งถูกจดจำ) | T1, P-2 | 2.0 |
| หน้าจัดการสินค้า (CRUD + ราคา + active) | P-1 | 1.5 |
| เข้ารหัส camera password (AES-GCM, key ใน env) + migration | T3 | 0.5 |
| PDPA consent flow ตอน enroll + privacy notice + ลบข้อมูลตามคำขอ | P-5, O-5 | 1.0 |
| Monitoring พื้นฐาน: uptime ping + error alert (เช่น Azure Monitor/Better Stack) | T6 | 1.0 |
| ย้าย Neon → paid + ตั้ง backup + เขียน restore runbook + ทดสอบ restore 1 ครั้ง | T7, T9 | 0.5 |
| Smoke/integration test เส้นทางหลัก (enroll → recognize → recommend) + CI gate | T5 | 1.0 |
| Deploy อัตโนมัติด้วย GitHub OIDC federated credentials (เลี่ยงปัญหา MFA/secret) | T8 | 0.5 |

### P1 — ภายใน 3 เดือน (~11.5 คน-สัปดาห์)

| รายการ | Gap ref | Effort |
|---|---|---|
| Multi-store ภายใน tenant เดียว (เพิ่ม Store model ต่อยอด `storeCode` ที่มีอยู่) | T4 (บางส่วน) | 2.0 |
| รายงานรายเดือนเจ้าของร้าน (visit, member vs guest, conversion) | P-3 | 1.5 |
| Onboarding wizard | P-4 | 1.5 |
| Tablet layout หน้าพนักงาน | P-6 | 1.0 |
| หน้า settings + threshold ต่อร้าน/ต่อกล้อง | T10, P-7 | 0.5 |
| POS integration ระยะแรก: CSV import + webhook รับข้อมูลขาย | P-2 | 2.0 |
| ขยาย test coverage + e2e | T5 | 2.0 |
| Billing กึ่งอัตโนมัติ (invoice + ทะเบียนลูกค้า) + สัญญามาตรฐาน | O-4 | 1.0 |

### P2 — Roadmap (เมื่อมีลูกค้าจ่ายเงิน >3 ราย)

| รายการ | Gap ref | Effort |
|---|---|---|
| Multi-tenancy เต็มรูป (org model, data isolation, self-serve provisioning) | T4 | 4-6 |
| GPU/centralized inference หรือ model ใหญ่ขึ้น เมื่อ >5 สาขา | T11 | 2-3 |
| i18n (EN เป็นภาษาที่สอง) | P-8 | 1.0 |
| ทางเลือกแทน Xiaomi C-series (แนะนำรุ่นกล้อง partner ที่ test แล้ว) | — | 1.0 |
| Mobile app เจ้าของร้าน | — | 4+ |

---

## 4. แผน 30-60-90 วัน → pilot ที่เก็บเงินได้

**วัน 1-30 — ปิดรูรั่ว (P0 ทั้งหมด)**
- Auth/RBAC, encrypt camera password, PDPA consent — ปิดความเสี่ยงกฎหมาย/ความปลอดภัยก่อน
- `POST /purchases` + หน้าบันทึกขาย + หน้าจัดการสินค้า — ทำให้ข้อมูลจริงไหลเข้าระบบได้
- ย้าย Neon paid + monitoring + OIDC deploy + smoke tests
- เกณฑ์ผ่าน: ระบบใหม่ทั้งชุด deploy อัตโนมัติได้, มี alert เมื่อล่ม, บันทึกการขายจริงได้ครบ loop

**วัน 31-60 — Pilot ฟรี 1 ร้าน (design partner)**
- เลือกร้านกาแฟ/สะดวกซื้อ 1 ร้าน ติดตั้งจริง (ทีมไปเอง — ใช้เป็นต้นแบบ checklist ติดตั้ง O-1)
- วัด recognition accuracy หน้างานจริง ปรับ threshold ต่อร้าน (ต้องมี settings UI จาก P1)
- Onboarding wizard + tablet layout + รายงานรายเดือนฉบับแรก
- เขียนคู่มือพนักงาน 1 หน้า + เทรนจริง เก็บ feedback
- เกณฑ์ผ่าน: ร้าน pilot ใช้ระบบเองได้ 2 สัปดาห์ติดโดยไม่ต้องมีทีมไปเฝ้า, มี purchase จริง >100 รายการในระบบ

**วัน 61-90 — แปลงเป็นเงิน**
- เสนอ pilot เป็นลูกค้าจ่ายเงินรายแรก + เซ็นสัญญา (billing มือ + ใบกำกับ)
- กำหนด SLA (99% เวลาทำการ) + เปิด LINE OA support
- CSV import/webhook สำหรับร้านที่มี POS อยู่แล้ว
- ตั้งราคาอ้างอิง: ~2,000-3,500 บาท/เดือน/สาขา + ค่าติดตั้งครั้งแรก ~8,000-15,000 บาท (รวมกล้อง + mini PC) — ปรับตาม feedback pilot
- เกณฑ์ผ่าน: ลูกค้าจ่ายเงินรายแรก + pipeline อีก 2-3 ราย

---

## 5. ทีมและต้นทุน

### ทีมขั้นต่ำสำหรับ 90 วันแรก

| บทบาท | จำนวน | หมายเหตุ |
|---|---|---|
| Full-stack dev (TS/NestJS/React) | 2 | คนหนึ่งถนัด backend/infra อีกคนถนัด frontend/UX |
| DevOps | 0.5 | part-time พอ — OIDC, monitoring, backup ตั้งครั้งเดียว |
| PO + support + ไปหน้างาน pilot | 1 | คนเดียวกันช่วงแรก |
| ช่างติดตั้งกล้อง | จ้างเป็นงาน | หรือ partner ร้านกล้องวงจรปิดท้องถิ่น |

รวม ~3.5 FTE — P0 10 คน-สัปดาห์ ÷ 2 dev ≈ 5-6 สัปดาห์ปฏิทิน สอดคล้องกับแผน 30 วัน (มี buffer เกินเล็กน้อย — ยอมรับได้)

### ต้นทุน infra เมื่อย้าย free → paid (ประมาณการ/เดือน)

| รายการ | ต้นทุน | หมายเหตุ |
|---|---|---|
| ACA: API always-on (min replica 1, ~0.5 vCPU/1GB) | ~$15-25 | ตัด cold start |
| ACA: AI service always-on (1 vCPU/2GB, CPU inference) | ~$30-50 | ตัวแพงสุด — buffalo_s CPU พอสำหรับ 1-5 ร้าน |
| Neon Launch (backup + ไม่มี auto-suspend) | $19 | |
| Static Web Apps Standard | $9 | ได้ SLA |
| Claude Haiku 4.5 (สคริปต์ ~600 token/visit, ~300 visit/วัน/ร้าน) | ~$3-8/ร้าน | จิ๋วมาก ไม่ใช่ cost driver |
| Monitoring (Better Stack ฯลฯ) | $0-25 | |
| **รวม core (แชร์ทุกสาขา)** | **~$80-130/เดือน (~2,900-4,700 บาท)** | |
| **Marginal ต่อสาขาเพิ่ม** | **~$10-20/เดือน (~350-700 บาท)** | AI/API/DB แชร์กัน — ต้นทุนเพิ่มคือ traffic + Claude + storage |
| อุปกรณ์ต่อสาขา (one-time) | กล้อง ~1,500-3,000 บาท/ตัว + mini PC bridge ~5,000-8,000 บาท | ผลักเป็นค่าติดตั้งได้ |

ที่ราคา ~2,500 บาท/เดือน/สาขา: สาขาแรกแทบไม่มี margin (core cost กินหมด) แต่สาขาที่ 3 เป็นต้นไป gross margin ต่อสาขา >70% — โมเดลนี้ workable ถ้าปิด T4 (multi-store) ได้ตาม P1 เพื่อไม่ต้อง deploy แยกชุดต่อร้าน

GPU ยังไม่ต้องรีบ: CPU 1 core รับ ~1-2 fps/กล้องไหว ตราบใดที่ <5 สาขา เมื่อเกินนั้นค่อยประเมิน GPU กลาง (~$200+/เดือน) เทียบกับการเพิ่ม CPU replica — ตัดสินใจด้วยข้อมูล latency จริงจาก pilot

---

## ภาคผนวก: Technical debt ที่ต้องพูดตรง ๆ

1. `Camera.password` มี comment ในโค้ดเองว่า plaintext — รู้อยู่แล้วว่าผิด แค่ยังไม่ได้จ่ายหนี้
2. `MATCH_THRESHOLD = 0.55` hard-coded — ค่าที่ถูกต้องต่างกันทุกร้าน/ทุกกล้อง
3. Zero tests ใน repo ที่มี 3 services คุยกันผ่าน WebSocket + HTTP — ทุกการแก้คือความเสี่ยง regression ที่มองไม่เห็น
4. Deploy ต้องมีมนุษย์เปิด Cloud Shell — single point of failure คือปฏิทินของคน ๆ เดียว
5. ข้อมูล purchase ทั้งหมดเป็นของปลอมจาก seed — ทุก demo ที่โชว์ recommendation คือการโชว์ข้อมูลสมมติ ต้องพูดกับลูกค้าให้ชัดว่า pilot ช่วงแรกคือช่วงสะสมข้อมูลจริง
