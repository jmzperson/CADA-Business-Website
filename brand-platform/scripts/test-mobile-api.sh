#!/usr/bin/env bash
# Mobile API smoke test — requires APP_JWT and running portal
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
CHALLENGE_ID="${CHALLENGE_ID:-a0000000-0000-4000-8000-000000000021}"
SOURCE_ID="app-knockout-smoke-$(date +%s)"

if [[ -z "${APP_JWT:-}" ]]; then
  echo "ERROR: Set APP_JWT to a CADA app user access token."
  echo "See docs/api-mobile-phase4.md for how to obtain one."
  exit 1
fi

auth_header=(-H "Authorization: Bearer $APP_JWT" -H "Content-Type: application/json")

echo "==> GET /challenges/available"
available=$(curl -sf "$BASE_URL/challenges/available" "${auth_header[@]}")
echo "$available" | head -c 200
echo "..."

count=$(echo "$available" | grep -o '"count":[0-9]*' | head -1 | cut -d: -f2 || echo 0)
if [[ "${count:-0}" -lt 1 ]]; then
  echo "WARN: No available challenges. Run seed + publish a challenge first."
fi

echo ""
echo "==> POST /challenges/$CHALLENGE_ID/enroll"
enroll=$(curl -sf -X POST "$BASE_URL/challenges/$CHALLENGE_ID/enroll" "${auth_header[@]}")
echo "$enroll"

echo ""
echo "==> GET /users/me/challenges"
me=$(curl -sf "$BASE_URL/users/me/challenges" "${auth_header[@]}")
echo "$me" | head -c 300
echo "..."

echo ""
echo "==> POST /events/habit-completed (first call)"
body=$(cat <<EOF
{"habit_type":"stretch","completed_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","source_event_id":"$SOURCE_ID"}
EOF
)
result1=$(curl -sf -X POST "$BASE_URL/events/habit-completed" "${auth_header[@]}" -d "$body")
echo "$result1"

echo ""
echo "==> POST /events/habit-completed (idempotent replay)"
result2=$(curl -sf -X POST "$BASE_URL/events/habit-completed" "${auth_header[@]}" -d "$body")
echo "$result2"

if echo "$result2" | grep -q '"idempotent_replay":true'; then
  echo "PASS: Idempotent replay detected"
else
  echo "FAIL: Expected idempotent_replay:true on second call"
  exit 1
fi

echo ""
echo "==> POST /events/habit-completed (daily cap / already completed)"
SOURCE_ID2="${SOURCE_ID}-b"
body2=$(cat <<EOF
{"habit_type":"stretch","completed_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","source_event_id":"$SOURCE_ID2"}
EOF
)
result3=$(curl -sf -X POST "$BASE_URL/events/habit-completed" "${auth_header[@]}" -d "$body2")
echo "$result3"

if echo "$result3" | grep -qE '"attributed":false|"idempotent_replay":true'; then
  echo "PASS: Second distinct event did not double-attribute"
else
  echo "WARN: Check daily cap / completed enrollment handling"
fi

echo ""
echo "All mobile API smoke tests finished."
