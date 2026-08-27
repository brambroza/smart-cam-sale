# Deploy บน Azure Free tier

Guide นี้ deploy ครบทุก service ด้วย $0/เดือน (ยอมรับ cold-start และ traffic ต่ำ)

**Stack ที่ใช้:**
- Web (React) → **Azure Static Web Apps · Free**
- API (NestJS) → **Azure Container Apps · Consumption**
- AI service (FastAPI) → **Azure Container Apps · Consumption**
- Postgres + pgvector → **Neon Free** (external)
- Container Registry → **GitHub Container Registry (GHCR)**
- CI/CD → **GitHub Actions**

---

## Step 1 — สร้าง Neon DB (ฟรี)

1. ไปที่ https://console.neon.tech → sign up
2. Create project ชื่อ `smart-cam` region ใกล้ไทย (Singapore)
3. Copy connection string ทั้ง 2 อัน:
   - **Pooled** (สำหรับ app runtime) — มี `-pooler` ใน hostname
   - **Direct** (สำหรับ migration) — hostname ปกติ
4. เข้า SQL Editor รันครั้งเดียว:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

## Step 2 — Bootstrap Azure resources (ครั้งเดียว)

Prerequisites: `az` CLI ล็อกอินแล้ว (`az login`)

```bash
export NEON_URL='postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/smartcam?sslmode=require'
export GH_OWNER=brambroza
export GHCR_USER=$GH_OWNER
export GHCR_PAT=ghp_xxxxxxxxxxxx   # Personal Access Token (classic) scope: read:packages

./infra/bootstrap.sh
```

Script จะสร้าง:
- Resource Group `smart-cam-rg`
- Container Apps environment `smart-cam-env`
- Container App `smart-cam-api` (external, WS)
- Container App `smart-cam-ai` (internal)
- Static Web App `smart-cam-web`

**สคริปต์จะ echo URL และ token ที่ต้องเอาไปตั้งเป็น GitHub secret** ตอนจบ

## Step 3 — สร้าง Azure service principal สำหรับ CI

```bash
SUB=$(az account show --query id -o tsv)
az ad sp create-for-rbac \
  --name smart-cam-deploy \
  --role contributor \
  --scopes /subscriptions/$SUB/resourceGroups/smart-cam-rg \
  --sdk-auth
```

Output เป็น JSON — copy ทั้งก้อนไปเป็น secret `AZURE_CREDENTIALS`

## Step 4 — Migrate DB ครั้งแรก

รันจากเครื่อง (ใช้ `DIRECT_DATABASE_URL` ที่ไม่ผ่าน pooler):

```bash
cd apps/api
DATABASE_URL='<pooled>' DIRECT_DATABASE_URL='<direct>' \
  pnpm prisma migrate deploy
DATABASE_URL='<direct>' pnpm ts-node prisma/seed.ts
```

## Step 5 — ตั้ง GitHub Secrets

ที่ https://github.com/brambroza/smart-cam-sale/settings/secrets/actions เพิ่ม:

| Secret | Value |
|---|---|
| `AZURE_CREDENTIALS` | JSON จาก step 3 |
| `AZURE_RG` | `smart-cam-rg` |
| `AZURE_API_APP` | `smart-cam-api` |
| `AZURE_AI_APP` | `smart-cam-ai` |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | จาก bootstrap output |
| `VITE_API_URL` | `https://<api-fqdn>` |

## Step 6 — Trigger deploy

Merge PR ลง `main` หรือ:

```bash
gh workflow run deploy-backend.yml
gh workflow run deploy-web.yml
```

---

## ตรวจสอบหลัง deploy

```bash
# API health
curl https://<api-fqdn>/health

# AI health (จาก inside — ไม่มี external ingress)
az containerapp exec -n smart-cam-api -g smart-cam-rg \
  --command "wget -qO- http://smart-cam-ai/health"

# View logs
az containerapp logs show -n smart-cam-api -g smart-cam-rg --follow
```

## ปิด/เปิด scale-to-zero

Free grant กินหมดเร็วถ้า min replica > 0 — ตั้งไว้ที่ 0 เสมอ:

```bash
az containerapp update -n smart-cam-api -g smart-cam-rg --min-replicas 0
az containerapp update -n smart-cam-ai  -g smart-cam-rg --min-replicas 0
```

## เมื่ออยาก deploy InsightFace จริง (ไม่ใช่ mock)

```bash
az containerapp update -n smart-cam-ai -g smart-cam-rg \
  --set-env-vars USE_MOCK=false MODEL_NAME=buffalo_s \
  --memory 2.0Gi \
  --cpu 1.0
```

**หมายเหตุ:** InsightFace bake model ~120MB (`buffalo_s`) หรือ ~320MB (`buffalo_l`) — โหลดตอน cold start ครั้งแรก ~30 วินาที เฟรมถัดไปเร็ว

## Rollback

```bash
# ดู revision list
az containerapp revision list -n smart-cam-api -g smart-cam-rg -o table
# activate revision เก่า
az containerapp revision activate -n smart-cam-api -g smart-cam-rg --revision <name>
```

## ลบทั้งหมด (ทำความสะอาด)

```bash
az group delete -n smart-cam-rg --yes
```

Neon และ GitHub package ลบแยก
