#!/usr/bin/env bash
# One-time setup: GitHub Actions → Azure passwordless deploy (OIDC federated
# credentials — no client secret stored anywhere). รันจาก Cloud Shell ที่ az login แล้ว
#
#   ./infra/setup-oidc.sh
#
# หมายเหตุ: การสร้าง app registration ต้องมีสิทธิ์ใน Entra ID — tenant เดียวกับที่
# เคย block `az ad sp create-for-rbac` อาจ block อันนี้ด้วย ถ้าเจอ error
# "Insufficient privileges" แปลว่า tenant ไม่ยอม → ใช้ ./infra/deploy.sh ต่อไปตามเดิม
set -euo pipefail

: "${RG:=smart-cam-rg}"
: "${APP_NAME:=smart-cam-github-deploy}"
: "${GH_REPO:=brambroza/smart-cam-sale}"
: "${GH_BRANCH:=claude/realtime-customer-recognition-l03h3j}"

SUB_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

echo "▶ สร้าง app registration: $APP_NAME"
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
echo "  appId: $APP_ID"

echo "▶ สร้าง service principal"
az ad sp create --id "$APP_ID" -o none 2>/dev/null || echo "  (มีอยู่แล้ว — ข้าม)"

echo "▶ สร้าง federated credentials (main + branch ปัจจุบัน)"
for REF in "refs/heads/main" "refs/heads/$GH_BRANCH"; do
  SAFE_NAME=$(echo "$REF" | tr '/' '-')
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"gh-$SAFE_NAME\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$GH_REPO:ref:$REF\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none 2>/dev/null || echo "  (credential ของ $REF มีอยู่แล้ว — ข้าม)"
done

echo "▶ ให้สิทธิ์ Contributor เฉพาะ resource group $RG"
az role assignment create \
  --assignee "$APP_ID" \
  --role Contributor \
  --scope "/subscriptions/$SUB_ID/resourceGroups/$RG" -o none 2>/dev/null \
  || echo "  (role assignment มีอยู่แล้ว — ข้าม)"

cat <<EOF

✅ เสร็จ — ไปตั้งค่าใน GitHub repo ($GH_REPO):

Settings → Secrets and variables → Actions → **Secrets** (New repository secret):
  AZURE_CLIENT_ID       = $APP_ID
  AZURE_TENANT_ID       = $TENANT_ID
  AZURE_SUBSCRIPTION_ID = $SUB_ID

Settings → Secrets and variables → Actions → **Variables** (New repository variable):
  AZURE_OIDC_READY = 1

จากนั้น workflow "Deploy backend" จะ deploy เข้า Azure ให้เองทุกครั้ง —
ไม่ต้องรัน ./infra/deploy.sh มืออีก (เก็บไว้เป็น fallback ได้)
EOF
