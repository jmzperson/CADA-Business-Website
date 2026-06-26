#!/usr/bin/env bash
# Phase 7 — metrics accuracy and brand isolation
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"

if [[ -z "${STAFF_JWT_BRAND_A:-}" ]]; then
  echo "ERROR: Set STAFF_JWT_BRAND_A (Studio Flow staff token)."
  exit 1
fi

if [[ -z "${STAFF_JWT_BRAND_B:-}" ]]; then
  echo "ERROR: Set STAFF_JWT_BRAND_B (Rival Gym staff token)."
  exit 1
fi

CHALLENGE_A="a0000000-0000-4000-8000-000000000021"
CHALLENGE_B="b0000000-0000-4000-8000-000000000021"

fetch_metrics() {
  local jwt="$1"
  local path="$2"
  curl -s -H "Authorization: Bearer $jwt" "${BASE}${path}"
}

echo "== Brand A metrics (30d) =="
A=$(fetch_metrics "$STAFF_JWT_BRAND_A" "/api/brands/metrics?range=30d")
echo "$A" | head -c 500
echo ""

for field in enrolled completions qr_issued qr_redeemed; do
  val=$(echo "$A" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$field', -1))" 2>/dev/null || echo "-1")
  case "$field" in
    enrolled) exp=8 ;;
    completions) exp=5 ;;
    qr_issued) exp=3 ;;
    qr_redeemed) exp=2 ;;
  esac
  if [[ "$val" == "$exp" ]]; then
    echo "PASS: $field = $val"
  else
    echo "FAIL: $field expected $exp got $val"
    exit 1
  fi
done

active=$(echo "$A" | python3 -c "import sys,json; print(json.load(sys.stdin).get('active_this_week', -1))" 2>/dev/null || echo "-1")
if [[ "$active" == "2" ]]; then
  echo "PASS: active_this_week = 2"
else
  echo "FAIL: active_this_week expected 2 got $active"
  exit 1
fi

echo ""
echo "== Brand B cannot read Brand A challenge =="
HTTP=$(curl -s -o /tmp/metrics-b-challenge.json -w "%{http_code}" \
  -H "Authorization: Bearer $STAFF_JWT_BRAND_B" \
  "${BASE}/api/brands/metrics/challenges/${CHALLENGE_A}")
if [[ "$HTTP" == "404" ]]; then
  echo "PASS: Brand B gets 404 for Brand A challenge"
else
  echo "FAIL: expected 404, got HTTP $HTTP"
  cat /tmp/metrics-b-challenge.json
  exit 1
fi

echo ""
echo "== Brand B metrics isolated =="
B=$(fetch_metrics "$STAFF_JWT_BRAND_B" "/api/brands/metrics?range=30d")
b_enrolled=$(echo "$B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('enrolled', -1))" 2>/dev/null || echo "-1")
b_redeemed=$(echo "$B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('qr_redeemed', -1))" 2>/dev/null || echo "-1")
if [[ "$b_enrolled" == "2" && "$b_redeemed" == "1" ]]; then
  echo "PASS: Brand B enrolled=2 qr_redeemed=1"
else
  echo "FAIL: Brand B expected enrolled=2 qr_redeemed=1 got enrolled=$b_enrolled qr_redeemed=$b_redeemed"
  exit 1
fi

echo ""
echo "== Redemptions log (Brand A) =="
R=$(fetch_metrics "$STAFF_JWT_BRAND_A" "/api/brands/redemptions?range=30d")
total=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total', -1))" 2>/dev/null || echo "-1")
if [[ "$total" == "2" ]]; then
  echo "PASS: Brand A redemptions total = 2"
else
  echo "FAIL: expected 2 redemptions, got $total"
  exit 1
fi

echo ""
echo "All Phase 7 metric checks passed."
