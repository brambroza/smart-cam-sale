#!/usr/bin/env bash
# Paid-tier helper — รันจาก Cloud Shell (az login แล้ว)
# รายละเอียด/ตัวเลขค่าใช้จ่าย: docs/PAID-TIER-PLAN.md
#
# Usage:
#   ./infra/paid-tier.sh status   # ดูสถานะ replicas/สเปคปัจจุบันของทั้ง 2 app
#   ./infra/paid-tier.sh warm     # เปิด always-on (min-replicas 1) — หมดปัญหา cold start, มีค่าใช้จ่าย
#   ./infra/paid-tier.sh cold     # กลับไป scale-to-zero (ฟรี แต่ request แรกช้า)
#   ./infra/paid-tier.sh swa-standard  # อัปเกรด Static Web App เป็น Standard ($9/เดือน, มี SLA)

set -euo pipefail

: "${RG:=smart-cam-rg}"
: "${API_APP:=smart-cam-api}"
: "${AI_APP:=smart-cam-ai}"
: "${SWA_NAME:=smart-cam-web}"

cmd="${1:-status}"

case "$cmd" in
  status)
    for app in "$API_APP" "$AI_APP"; do
      echo "── $app ──"
      az containerapp show -n "$app" -g "$RG" --query \
        "{minReplicas: properties.template.scale.minReplicas, maxReplicas: properties.template.scale.maxReplicas, cpu: properties.template.containers[0].resources.cpu, memory: properties.template.containers[0].resources.memory, running: properties.runningStatus}" -o table
    done
    ;;
  warm)
    echo "▶ ตั้ง min-replicas 1 (always-on) — ดูประมาณการค่าใช้จ่ายใน docs/PAID-TIER-PLAN.md"
    az containerapp update -n "$API_APP" -g "$RG" --min-replicas 1 --max-replicas 2 -o none
    az containerapp update -n "$AI_APP" -g "$RG" --min-replicas 1 --max-replicas 2 -o none
    echo "✔ เสร็จ — request แรกจะไม่ต้องรอ cold start อีก"
    ;;
  cold)
    echo "▶ กลับไป scale-to-zero (ฟรี)"
    az containerapp update -n "$API_APP" -g "$RG" --min-replicas 0 -o none
    az containerapp update -n "$AI_APP" -g "$RG" --min-replicas 0 -o none
    echo "✔ เสร็จ"
    ;;
  swa-standard)
    az staticwebapp update -n "$SWA_NAME" --sku Standard -o none
    echo "✔ Static Web App เป็น Standard แล้ว (มี SLA 99.95%)"
    ;;
  *)
    echo "unknown command: $cmd (ใช้ status | warm | cold | swa-standard)"
    exit 1
    ;;
esac
