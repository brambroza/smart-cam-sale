#!/usr/bin/env bash
# One-shot bootstrap: สร้าง Azure resource ทั้งหมดที่จำเป็นสำหรับ free-tier deploy
# ใช้แค่ครั้งแรก — หลังจากนั้น GitHub Actions จะ deploy อัตโนมัติ
#
# Prerequisites:
#   - az CLI ล็อกอินแล้ว (`az login`)
#   - Neon account พร้อม connection string (https://console.neon.tech)
#   - GitHub Personal Access Token (classic) ที่มี scope read:packages
#     สำหรับให้ ACA pull image จาก GHCR (ข้ามได้ถ้าตั้ง package เป็น public)
#
# Usage:
#   RG=smart-cam-rg LOCATION=southeastasia \
#   NEON_URL='postgresql://...neon.tech/smartcam?sslmode=require' \
#   GHCR_USER=brambroza GHCR_PAT=ghp_... \
#   ./infra/bootstrap.sh
#
set -euo pipefail

: "${RG:=smart-cam-rg}"
: "${LOCATION:=southeastasia}"
: "${ACA_ENV:=smart-cam-env}"
: "${API_APP:=smart-cam-api}"
: "${AI_APP:=smart-cam-ai}"
: "${SWA_NAME:=smart-cam-web}"
: "${GH_OWNER:=brambroza}"
: "${GH_REPO:=smart-cam-sale}"
: "${NEON_URL:?ต้องระบุ NEON_URL — connection string จาก Neon}"

echo "▶ สร้าง resource group $RG ที่ $LOCATION"
az group create -n "$RG" -l "$LOCATION" -o none

echo "▶ ติดตั้ง extension containerapp (ถ้ายังไม่มี)"
az extension add --name containerapp --upgrade -y || true
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

: "${EXISTING_ENV_RG:=$RG}"

echo "▶ ตรวจ Container Apps environment ($ACA_ENV in $EXISTING_ENV_RG)"
ENV_ID=$(az containerapp env show -n "$ACA_ENV" -g "$EXISTING_ENV_RG" --query id -o tsv 2>/dev/null || true)
if [[ -z "$ENV_ID" ]]; then
  echo "  → ไม่พบ, สร้างใหม่ที่ $RG / $LOCATION"
  az containerapp env create \
    -n "$ACA_ENV" -g "$RG" -l "$LOCATION" \
    --logs-destination none \
    -o none
  ENV_ID=$(az containerapp env show -n "$ACA_ENV" -g "$RG" --query id -o tsv)
else
  echo "  → ใช้ env เดิม: $ENV_ID"
fi

# Bootstrap uses a public placeholder image because real GHCR images
# don't exist until the GitHub Actions build+push workflow has run once.
# The deploy workflow later updates image + target-port to the real values.
PLACEHOLDER_IMAGE="mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"

# Clean up any failed apps from a previous partial bootstrap
for app in "$AI_APP" "$API_APP"; do
  STATE=$(az containerapp show -n "$app" -g "$RG" --query "properties.provisioningState" -o tsv 2>/dev/null || true)
  if [[ "$STATE" == "Failed" ]]; then
    echo "▶ ลบ $app ที่ค้างในสถานะ Failed"
    az containerapp delete -n "$app" -g "$RG" --yes -o none
  fi
done

# ---------- AI service (internal ingress) ----------
echo "▶ สร้าง AI service container app (internal, scale-to-zero, placeholder image)"
az containerapp create \
  -n "$AI_APP" -g "$RG" \
  --environment "$ENV_ID" \
  --image "$PLACEHOLDER_IMAGE" \
  --ingress internal --target-port 80 --transport auto \
  --min-replicas 0 --max-replicas 1 \
  --cpu 0.5 --memory 1.0Gi \
  --env-vars USE_MOCK=true MODEL_NAME=buffalo_s \
  -o none || echo "(AI app อาจมีอยู่แล้ว)"

AI_FQDN=$(az containerapp show -n "$AI_APP" -g "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
echo "  → AI internal FQDN: $AI_FQDN"

# ---------- API (external + WebSocket) ----------
echo "▶ สร้าง API container app (external, WebSocket enabled, placeholder image)"
az containerapp create \
  -n "$API_APP" -g "$RG" \
  --environment "$ENV_ID" \
  --image "$PLACEHOLDER_IMAGE" \
  --ingress external --target-port 80 --transport auto \
  --min-replicas 0 --max-replicas 1 \
  --cpu 0.5 --memory 1.0Gi \
  --secrets "database-url=$NEON_URL" \
  --env-vars \
    "DATABASE_URL=secretref:database-url" \
    "AI_SERVICE_URL=https://$AI_FQDN" \
    "PORT=3000" \
    "CORS_ORIGIN=*" \
  -o none || echo "(API app อาจมีอยู่แล้ว)"

API_FQDN=$(az containerapp show -n "$API_APP" -g "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
echo "  → API public URL: https://$API_FQDN"

# ---------- Registry credentials so the first workflow deploy can pull GHCR ----------
if [[ -n "${GHCR_PAT:-}" ]]; then
  echo "▶ ตั้ง GHCR pull credentials"
  for app in "$AI_APP" "$API_APP"; do
    az containerapp registry set \
      -n "$app" -g "$RG" \
      --server ghcr.io \
      --username "${GHCR_USER:-$GH_OWNER}" \
      --password "$GHCR_PAT" \
      -o none
  done
fi

# ---------- Static Web App ----------
echo "▶ สร้าง Static Web App สำหรับ frontend"
az staticwebapp create \
  -n "$SWA_NAME" -g "$RG" -l "$LOCATION" \
  --sku Free \
  -o none || echo "(SWA อาจมีอยู่แล้ว)"

SWA_TOKEN=$(az staticwebapp secrets list -n "$SWA_NAME" -g "$RG" --query "properties.apiKey" -o tsv)
SWA_URL=$(az staticwebapp show -n "$SWA_NAME" -g "$RG" --query "defaultHostname" -o tsv)

echo ""
echo "═════════════════════════════════════════════════════════════"
echo "✔ Bootstrap เสร็จ"
echo "═════════════════════════════════════════════════════════════"
echo ""
echo "ตั้งค่า GitHub secret ต่อไปนี้ที่ https://github.com/$GH_OWNER/$GH_REPO/settings/secrets/actions"
echo ""
echo "  AZURE_CREDENTIALS       — output จาก:"
echo "     az ad sp create-for-rbac --name smart-cam-deploy \\"
echo "       --role contributor \\"
echo "       --scopes /subscriptions/\$(az account show --query id -o tsv)/resourceGroups/$RG \\"
echo "       --sdk-auth"
echo ""
echo "  AZURE_STATIC_WEB_APPS_API_TOKEN = $SWA_TOKEN"
echo "  AZURE_RG           = $RG"
echo "  AZURE_API_APP      = $API_APP"
echo "  AZURE_AI_APP       = $AI_APP"
echo "  VITE_API_URL       = https://$API_FQDN"
echo ""
echo "URLs:"
echo "  API:    https://$API_FQDN"
echo "  Web:    https://$SWA_URL  (deploy ครั้งแรกผ่าน GH Actions)"
echo ""
echo "อย่าลืม migrate DB ครั้งแรก:"
echo "  DATABASE_URL='$NEON_URL' pnpm --filter @smart-cam/api prisma migrate deploy"
