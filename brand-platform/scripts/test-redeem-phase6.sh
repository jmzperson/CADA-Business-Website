#!/usr/bin/env bash
# Phase 6 — wrong brand cannot redeem another brand's QR
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api/redeem}"

if [[ -z "${STAFF_JWT_BRAND_B:-}" ]]; then
  echo "ERROR: Set STAFF_JWT_BRAND_B (Rival Gym admin/scanner token)."
  exit 1
fi

if [[ -z "${TOKEN_BRAND_A:-}" ]]; then
  echo "ERROR: Set TOKEN_BRAND_A (raw token or URL for Studio Flow reward)."
  echo "Issue one with: APP_JWT=... STAFF_JWT=... ./scripts/test-qr-rewards.sh"
  exit 1
fi

response=$(curl -s -o /tmp/wrong-brand.json -w "%{http_code}" -X POST "$BASE_URL" \
  -H "Authorization: Bearer $STAFF_JWT_BRAND_B" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN_BRAND_A\"}")

body=$(cat /tmp/wrong-brand.json)
echo "HTTP $response: $body"

if [[ "$response" == "403" ]] && echo "$body" | grep -q 'wrong_brand'; then
  echo "PASS: Brand B staff cannot redeem Brand A token"
else
  echo "FAIL: Expected 403 wrong_brand"
  exit 1
fi
