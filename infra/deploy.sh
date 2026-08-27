#!/usr/bin/env bash
# Manual deploy — รันจาก Cloud Shell ที่ auth กับ Azure อยู่แล้ว
# ใช้แทน GitHub Actions ตอนที่ยังไม่มี service principal
#
# Usage:
#   ./infra/deploy.sh                # ใช้ tag latest
#   ./infra/deploy.sh sha-1fa8920    # ใช้ tag เฉพาะ
#
# Prerequisites:
#   - GH Actions "Deploy backend" workflow build+push image ไปที่ GHCR สำเร็จ
#     (deploy job จะ fail — ปกติ เพราะยังไม่มี AZURE_CREDENTIALS secret)

set -euo pipefail

: "${RG:=smart-cam-rg}"
: "${API_APP:=smart-cam-api}"
: "${AI_APP:=smart-cam-ai}"
: "${GH_OWNER:=brambroza}"
TAG="${1:-latest}"

API_IMAGE="ghcr.io/$GH_OWNER/smart-cam-api:$TAG"
AI_IMAGE="ghcr.io/$GH_OWNER/smart-cam-ai:$TAG"

# --revision-suffix forces a new revision even when the image tag string
# hasn't changed — otherwise ACA sees ":latest" as the same image and skips
# the pull.
SUFFIX="$(date -u +%Y%m%d%H%M%S)"

echo "▶ AI: $AI_IMAGE (rev: $SUFFIX)"
az containerapp update -n "$AI_APP" -g "$RG" --image "$AI_IMAGE" --revision-suffix "$SUFFIX" -o none
az containerapp ingress update -n "$AI_APP" -g "$RG" --target-port 8000 -o none 2>/dev/null || true

echo "▶ API: $API_IMAGE (rev: $SUFFIX)"
az containerapp update -n "$API_APP" -g "$RG" --image "$API_IMAGE" --revision-suffix "$SUFFIX" -o none
az containerapp ingress update -n "$API_APP" -g "$RG" --target-port 3000 -o none 2>/dev/null || true

echo ""
echo "✔ Deploy เสร็จ — ตรวจสถานะ:"
API_FQDN=$(az containerapp show -n "$API_APP" -g "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
echo "  API: https://$API_FQDN/health"
echo ""
echo "az containerapp logs show -n $API_APP -g $RG --follow"
