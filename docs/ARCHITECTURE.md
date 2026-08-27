# Architecture

## Real-time recognition pipeline

```
[Camera]
   │  MediaStream getUserMedia({video:{width:640,height:480}})
   ▼
[React CameraPanel]
   │  ทุก 500ms grab frame → canvas.toDataURL('image/jpeg', 0.7)
   │  socket.emit('frame', {imageBase64, ts})
   ▼
[NestJS RecognitionGateway]
   │  throttle per client (skip if previous inference still running)
   │  → POST http://ai-service:8000/analyze  {image}
   ▼
[Python AI Service — InsightFace]
   │  RetinaFace: detect bbox
   │  ArcFace: 512-dim embedding
   │  genderage model: age, gender
   │  return { faces: [{ bbox, embedding, age, gender, det_score }] }
   ▼
[NestJS RecognitionService]
   │  สำหรับ face ที่ det_score > 0.7:
   │    SELECT * FROM members
   │      ORDER BY embedding <=> $1
   │      LIMIT 1
   │    ถ้า cosine similarity > 0.6 → matched member
   │  Query purchases (last 90d, same time-of-day bucket)
   │  Build recommendations (see below)
   │  socket.emit('recognition', payload)
   ▼
[React CustomerCard]
   Framer Motion enter animation
   แสดง: ชื่อ / อายุ / เพศ / member badge / ประวัติซื้อล่าสุด
         + สินค้าแนะนำ 3 อย่าง (พร้อมเหตุผลสั้น ๆ)
         + CTA "ชวนสมัครสมาชิก" (ถ้ายังไม่เป็น)
```

## Recommendation strategy

### Member
1. **Time-of-day pattern** — สินค้าที่ลูกค้าคนนี้ซื้อบ่อยในช่วงเวลาเดียวกัน (± 2 ชม.)
2. **Recency** — สินค้าที่เคยซื้อภายใน 30 วัน + จวนหมด (rough guess จาก interval)
3. **Basket affinity** — "คนที่ซื้อ A มักซื้อ B" จาก transaction ทั้งหมดของร้าน
4. รวมคะแนน weighted → top 3

### Guest (ไม่เจอในระบบ)
1. Filter สินค้าตาม age bucket (18-25 / 26-35 / 36-50 / 50+) และ gender
2. เรียงตาม top-seller ในช่วงเวลาปัจจุบัน
3. + CTA สมัครสมาชิก (แสดงสิทธิพิเศษ)

## Privacy & PDPA

- Face embedding เก็บเป็น vector (ไม่ใช่ภาพ) — reverse ยาก
- ต้องมีป้ายแจ้งลูกค้าตาม PDPA มาตรา 26
- Guest face **ไม่บันทึกลง DB** — เก็บเฉพาะใน memory ระหว่าง session
- Member ต้อง opt-in ตอนสมัคร (ให้เก็บ face embedding)
- API มี endpoint `DELETE /members/:id/face` ลบ embedding ตามคำขอ

## Scalability notes

- AI Service stateless → scale แนวนอนได้ ใช้ nginx round-robin
- pgvector index: `CREATE INDEX ON members USING hnsw (embedding vector_cosine_ops)`
- WebSocket sticky sessions ถ้ามีหลาย NestJS instance (Redis adapter)
- Frame rate ปรับได้จาก client (ค่าเริ่มต้น 2 fps ก็พอสำหรับ retail)

## Deployment target

- **Single-store MVP:** docker-compose บน mini PC หลังเคาน์เตอร์
- **Chain:** k8s + Redis + object storage สำหรับ ML artifacts
