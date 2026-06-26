#!/usr/bin/env bash
# QR reward end-to-end test — issuance, GET, redeem, expired
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
REDEEM_URL="${REDEEM_URL:-http://localhost:3000/api/redeem}"
CHALLENGE_ID="${CHALLENGE_ID:-a0000000-0000-4000-8000-000000000021}"
SOURCE_ID="qr-test-$(date +%s)"

if [[ -z "${APP_JWT:-}" ]]; then
  echo "ERROR: Set APP_JWT (CADA app user access token)."
  exit 1
fi

if [[ -z "${STAFF_JWT:-}" ]]; then
  echo "ERROR: Set STAFF_JWT (brand scanner/admin access token)."
  exit 1
fi

app_auth=(-H "Authorization: Bearer $APP_JWT" -H "Content-Type: application/json")
staff_auth=(-H "Authorization: Bearer $STAFF_JWT" -H "Content-Type: application/json")

echo "==> Enroll"
curl -sf -X POST "$BASE_URL/challenges/$CHALLENGE_ID/enroll" "${app_auth[@]}" | head -c 200
echo ""

echo "==> Habit completed (issues QR)"
response=$(curl -sf -X POST "$BASE_URL/events/habit-completed" "${app_auth[@]}" -d "{
  \"habit_type\": \"stretch\",
  \"completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"source_event_id\": \"$SOURCE_ID\",
  \"challenge_id\": \"$CHALLENGE_ID\"
}")
echo "$response" | head -c 400
echo "..."

REWARD_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
QR_URL=$(echo "$response" | grep -o '"qr_url":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

if [[ -z "$REWARD_ID" || -z "$QR_URL" ]]; then
  echo "FAIL: No reward issued. Is enrollment already completed? Use a fresh app user."
  exit 1
fi
echo "PASS: Reward issued id=$REWARD_ID"

TOKEN="${QR_URL##*/r/}"

echo ""
echo "==> GET /users/me/rewards/$REWARD_ID"
get_response=$(curl -sf "$BASE_URL/users/me/rewards/$REWARD_ID" -H "Authorization: Bearer $APP_JWT")
echo "$get_response" | head -c 300
echo "..."
if echo "$get_response" | grep -q '"qr_url"'; then
  echo "PASS: GET returns qr_url"
else
  echo "FAIL: GET missing qr_url"
  exit 1
fi

echo ""
echo "==> Idempotent habit-completed (no duplicate QR)"
replay=$(curl -sf -X POST "$BASE_URL/events/habit-completed" "${app_auth[@]}" -d "{
  \"habit_type\": \"stretch\",
  \"completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"source_event_id\": \"$SOURCE_ID\",
  \"challenge_id\": \"$CHALLENGE_ID\"
}")
if echo "$replay" | grep -q '"idempotent_replay":true'; then
  echo "PASS: Idempotent replay"
else
  echo "WARN: Expected idempotent_replay"
fi

echo ""
echo "==> Redeem (staff)"
redeem=$(curl -s -X POST "$REDEEM_URL" "${staff_auth[@]}" -d "{\"token\":\"$TOKEN\"}")
echo "$redeem"
if echo "$redeem" | grep -q '"message":"Reward redeemed"'; then
  echo "PASS: Redeem succeeded"
elif echo "$redeem" | grep -q '"status":"redeemed"'; then
  echo "PASS: Redeem succeeded"
else
  echo "FAIL: Redeem failed — $redeem"
  exit 1
fi

echo ""
echo "==> Redeem again (already_redeemed)"
redeem2=$(curl -s -o /tmp/redeem2.json -w "%{http_code}" -X POST "$REDEEM_URL" "${staff_auth[@]}" -d "{\"token\":\"$TOKEN\"}")
body=$(cat /tmp/redeem2.json)
echo "HTTP $redeem2: $body"
if [[ "$redeem2" == "409" ]] && echo "$body" | grep -q 'already_redeemed'; then
  echo "PASS: already_redeemed"
else
  echo "WARN: Expected 409 already_redeemed"
fi

echo ""
echo "==> Expired token test (use seed token if available)"
# Seed dev-token-expired-004 — only works if you know raw token; skip if not set
if [[ -n "${EXPIRED_TOKEN:-}" ]]; then
  expired=$(curl -s -o /tmp/expired.json -w "%{http_code}" -X POST "$REDEEM_URL" "${staff_auth[@]}" -d "{\"token\":\"$EXPIRED_TOKEN\"}")
  echo "HTTP $expired: $(cat /tmp/expired.json)"
  if [[ "$expired" == "410" ]]; then
    echo "PASS: Expired returns 410"
  else
    echo "FAIL: Expected 410 for expired token"
    exit 1
  fi
else
  echo "SKIP: Set EXPIRED_TOKEN=dev-token-expired-004 to test expiry (from seed)"
fi

echo ""
echo "All QR reward tests finished."
