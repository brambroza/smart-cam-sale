# แผนแปลง Smart Cam Sale เป็น Multi-Tenant SaaS

> วิเคราะห์จากโค้ดจริง ณ commit ปัจจุบัน — ระบุทุกจุดที่ยังเป็น single-tenant
> พร้อมสถาปัตยกรรมเป้าหมาย ลำดับการทำ และประมาณ effort
> (ต่อยอด T4 จาก `docs/business/PRODUCT-OWNER-GAP-ANALYSIS.md`)

## 1. สถานะปัจจุบัน: อะไร tenant-ready แล้ว / อะไรยัง global

### พร้อมอยู่แล้ว (ออกแบบเผื่อไว้)

| จุด | ไฟล์ | หมายเหตุ |
|---|---|---|
| `storeCode` บน Purchase, VisitLog, PosApiKey | `schema.prisma` | แยก "สาขา" ได้แล้ว แต่ยังไม่แยก "เจ้าของกิจการ" |
| Camera ผูก `bridgeId` | `cameras.service.ts` | หนึ่ง bridge ต่อหนึ่ง site อยู่แล้ว — โครงถูกทาง |
| PosApiKey ต่อสาขา | `pos.service.ts` | key แยกร้านได้ แค่ยังไม่รู้จัก "องค์กร" |
| Auth + role (staff/admin) | `auth/` | เพิ่ม `orgId` เข้า JWT payload ได้ทันที |

### ยัง global (ต้องแก้ก่อนรับลูกค้า 2 รายพร้อมกัน)

| # | จุด | ไฟล์ | ความเสี่ยงถ้าปล่อยไว้ |
|---|---|---|---|
| G1 | **Face matching ค้นทั้งตาราง** | `recognition.service.ts` (pgvector cosine ทั้ง `FaceEmbedding`) | **ร้ายแรงสุด** — ลูกค้าร้าน A เดินเข้าร้าน B แล้วระบบจำได้พร้อมชื่อ/ประวัติซื้อ = ข้อมูลชีวภาพรั่วข้าม tenant ผิด PDPA ทันที |
| G2 | Member / Product / Camera / StaffUser ไม่มี `orgId` | `schema.prisma` | ทุกร้านเห็นสมาชิก+สินค้า+กล้องของกันและกัน |
| G3 | JWT ไม่มี `orgId` | `auth.service.ts` | แยกสิทธิ์ตามองค์กรไม่ได้ |
| G4 | WS channel เป็น namespace เดียว | `recognition.gateway.ts` (`join_channel`) | ร้าน A เดา channel ร้าน B แล้วดูภาพกล้องได้ |
| G5 | `BRIDGE_TOKEN` ตัวเดียวทั้งระบบ | env + gateway | token หลุดร้านเดียว = ทุกร้านเสี่ยง; เพิกถอนรายร้านไม่ได้ |
| G6 | unique constraints เป็น global | `phone`, `sku`, `channel` | ลูกค้า 2 ร้านมีสมาชิกเบอร์เดียวกัน/บาร์โค้ดเดียวกันไม่ได้ |
| G7 | Consent/PDPA ผูก "ร้าน" ไม่ได้ | `consent/` | DPA ต้องระบุ controller (ร้าน) ต่อ record |

## 2. สถาปัตยกรรมเป้าหมาย: Shared DB + Row-Level Tenancy

**เลือกแนวทาง: ตาราง `Organization` + คอลัมน์ `orgId` ทุกตาราง ใน DB เดียว**

| ทางเลือก | เหมาะเมื่อ | เหตุผลไม่เลือก |
|---|---|---|
| ✅ Row-level (orgId) | 2–200 ลูกค้า | — (deployment เดียว, ต้นทุนคงที่, marginal/ร้าน ~350-700฿ ตามแผน paid tier) |
| Schema-per-tenant | ลูกค้า enterprise ต้องการ isolation ระดับสัญญา | ops โตเชิงเส้น, Neon free/Launch ไม่เหมาะ |
| DB-per-tenant | regulated industries | เกินจำเป็นมากที่ scale นี้ |

### 2.1 Schema ใหม่

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String            // "ร้านกาแฟบ้านสวน จำกัด"
  slug      String   @unique  // "baansuan" — ใช้ใน URL/login
  plan      String   @default("pilot") // pilot | standard | suspended
  bridgeToken String @unique  // token ประจำองค์กร — เพิกถอนรายองค์กรได้ (แก้ G5)
  createdAt DateTime @default(now())
  stores    Store[]
}

model Store {
  id     String @id @default(cuid())
  orgId  String
  code   String        // "BKK-01"
  name   String
  @@unique([orgId, code])
}
```

เพิ่ม `orgId String` + index ลงทุกตาราง: `Member, Product, Camera, StaffUser,
PosApiKey, Purchase, VisitLog, ConsentRecord` (FaceEmbedding ไม่ต้อง — scope ผ่าน
`member.orgId` ตอน join)

unique เดิมเปลี่ยนเป็น composite (แก้ G6):
`@@unique([orgId, phone])`, `@@unique([orgId, sku])`, `@@unique([orgId, channel])`
— ยกเว้น `StaffUser.username` คงเป็น global unique (login ไม่ต้องพิมพ์ชื่อองค์กร)

### 2.2 การ scope ทุกชั้น

1. **JWT** — payload เพิ่ม `orgId` (แก้ G3); `JwtAuthGuard` ใส่ `req.user.orgId`
2. **Service layer** — สร้าง helper `forOrg(orgId)` หรือใช้ Prisma client extension
   `$extends` ที่ inject `where: { orgId }` อัตโนมัติทุก query ของ model ที่มี orgId
   → กันคน "ลืม where" ได้ทั้งระบบ จุดเดียว
3. **Face matching (แก้ G1 — สำคัญสุด)** — query ใน `recognition.service.ts`
   ต้อง join Member และ filter ก่อนวัด cosine:
   ```sql
   SELECT f."memberId", 1 - (f.embedding <=> $1::vector) AS similarity
   FROM "FaceEmbedding" f JOIN "Member" m ON m.id = f."memberId"
   WHERE m."orgId" = $2
   ORDER BY f.embedding <=> $1::vector LIMIT 1
   ```
   HNSW index ยังใช้ได้ (pgvector รองรับ filtered search) — ที่ scale หมื่น embedding
   ต่อ tenant ไม่มีปัญหา performance
4. **WebSocket (แก้ G4)** — ตอน handshake รู้ org จาก JWT/bridgeToken แล้ว
   prefix ทุก room เป็น `${orgId}:${channel}` ฝั่ง server เท่านั้น (client ส่งชื่อ
   channel เดิม server เติม prefix เอง — client ปลอม prefix ไม่ได้)
5. **Bridge (แก้ G5)** — bridge ส่ง `bridgeToken` ประจำองค์กร → server resolve เป็น
   orgId; endpoint `GET /cameras/bridge/:bridgeId` ตรวจ token ขององค์กรนั้น
6. **POS** — `PosApiKey.orgId` → ยอดขายเข้าองค์กรที่ถูกต้องอัตโนมัติ ไม่ต้องแก้ payload
7. **Recommendation + Claude script** — ทำงานต่อ member ที่ scope แล้ว ไม่ต้องแก้

### 2.3 Provisioning + ระดับสิทธิ์ใหม่

- เพิ่ม role `superadmin` (เรา — เจ้าของ platform): `POST /admin/orgs`
  สร้างองค์กร + admin คนแรก + bridgeToken ในคลิกเดียว
- role เดิม `admin` กลายเป็น "เจ้าของร้าน" (จัดการได้เฉพาะ org ตัวเอง)
- หน้าหลังบ้านเดิมใช้ต่อได้เลย — ทุก query โดน scope อัตโนมัติจากข้อ 2.2

### 2.4 Migration ข้อมูลเดิม

1. สร้าง `Organization` แถวแรก (org ของร้าน pilot ปัจจุบัน) ใน migration SQL
2. `orgId` ทุกตารางตั้ง default เป็น org นั้น → backfill → เอา default ออก
3. ค่า `BRIDGE_TOKEN` env เดิมย้ายเข้า `Organization.bridgeToken` ของ org แรก
4. Zero-downtime: ระบบเดิมอ่านต่อได้ระหว่าง backfill เพราะเป็น additive columns

## 3. ลำดับการทำ + Effort

| Phase | งาน | Effort | ปลดล็อก |
|---|---|---|---|
| **A — Isolation** | schema+migration, JWT orgId, Prisma scoping extension, face-match filter, WS prefix, bridge token per org, **test ข้าม-tenant ทุก endpoint** | ~2.5-3 คน-สัปดาห์ | รับลูกค้า >1 รายได้อย่างถูกกฎหมาย |
| **B — Operate** | POST /admin/orgs + หน้า superadmin, Store model, per-store report, org suspend | ~1.5-2 | ขาย/เปิดร้านใหม่ได้ใน 10 นาที |
| **C — Monetize** | Billing (เริ่ม invoice มือ → Omise/Stripe), self-serve signup, usage metering (visits/เดือน) | ~2+ | scale เกิน 10 ลูกค้าโดยไม่จมงาน ops |

**จุดตัดสินสำคัญ:** Phase A ต้องเสร็จ**ก่อนเซ็นลูกค้ารายที่ 2** — ตราบใดที่มีลูกค้า
รายเดียว ระบบปัจจุบันใช้ได้เลย ไม่ต้องรอ

**Test ที่ไม่มีไม่ได้ (นิยาม "เสร็จ" ของ Phase A):** สร้าง org A + org B ใน test DB,
enroll หน้าเดียวกันทั้งคู่ แล้วยืนยันว่า (1) กล้อง org B ไม่ match สมาชิก org A
(2) ทุก REST endpoint ที่ยิงด้วย token org A ไม่เห็นข้อมูล org B (3) join channel
ข้าม org ไม่ได้

## 4. สิ่งที่ *ไม่ต้อง* แก้ (ประหยัดไปได้เยอะ)

- **Infra** — deployment เดียว รับทุก tenant (นี่คือเหตุผลที่เลือก row-level)
- **AI service** — stateless ไม่รู้จัก tenant อยู่แล้ว
- **หน้า console/หลังบ้าน** — UI เดิมทั้งหมด ใช้ต่อได้เพราะ scope เกิดที่ API
- **CI/CD** — pipeline OIDC ที่เพิ่งเสร็จใช้ต่อได้เลย
