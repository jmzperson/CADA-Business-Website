#!/usr/bin/env bash
# Challenge lifecycle smoke test — brand portal + CADA admin APIs
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
BRAND_EMAIL="${BRAND_EMAIL:-}"
BRAND_PASSWORD="${BRAND_PASSWORD:-}"
CADA_ADMIN_TOKEN="${CADA_ADMIN_TOKEN:-}"
CRON_SECRET="${CRON_SECRET:-}"

if [[ -z "$BRAND_EMAIL" || -z "$BRAND_PASSWORD" ]]; then
  echo "ERROR: Set BRAND_EMAIL and BRAND_PASSWORD for a brand admin account."
  exit 1
fi

if [[ -z "$CADA_ADMIN_TOKEN" ]]; then
  echo "ERROR: Set CADA_ADMIN_TOKEN for admin approval endpoints."
  exit 1
fi

cookie_jar=$(mktemp)
trap 'rm -f "$cookie_jar"' EXIT

echo "==> Brand login"
login=$(curl -sf -c "$cookie_jar" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BRAND_EMAIL\",\"password\":\"$BRAND_PASSWORD\"}")
echo "$login" | head -c 120
echo "..."

starts_at=$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)
ends_at=$(date -u -v+7d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+7 days' +%Y-%m-%dT%H:%M:%SZ)

echo ""
echo "==> POST /api/brands/challenges (draft)"
create=$(curl -sf -b "$cookie_jar" -X POST "$BASE_URL/api/brands/challenges" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "title": "Smoke test challenge $(date +%s)",
  "description": "Automated lifecycle test",
  "habit_type": "stretch",
  "offer_headline": "Free intro class",
  "starts_at": "$starts_at",
  "ends_at": "$ends_at",
  "max_redemptions": 5
}
EOF
)")
challenge_id=$(echo "$create" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "challenge_id=$challenge_id"

echo ""
echo "==> POST /api/brands/challenges/$challenge_id/publish"
publish=$(curl -sf -b "$cookie_jar" -X POST "$BASE_URL/api/brands/challenges/$challenge_id/publish")
echo "$publish"

echo ""
echo "==> GET /api/admin/challenges?status=pending_review"
queue=$(curl -sf "$BASE_URL/api/admin/challenges?status=pending_review&token=$CADA_ADMIN_TOKEN")
echo "$queue" | head -c 200
echo "..."

echo ""
echo "==> POST /api/admin/challenges/$challenge_id/approve"
approve=$(curl -sf -X POST "$BASE_URL/api/admin/challenges/$challenge_id/approve?token=$CADA_ADMIN_TOKEN")
echo "$approve"

echo ""
echo "==> GET /api/admin/challenges/$challenge_id"
detail=$(curl -sf "$BASE_URL/api/admin/challenges/$challenge_id?token=$CADA_ADMIN_TOKEN")
echo "$detail" | head -c 240
echo "..."

echo ""
echo "==> GET /api/brands/challenges/$challenge_id"
brand_detail=$(curl -sf -b "$cookie_jar" "$BASE_URL/api/brands/challenges/$challenge_id")
if echo "$brand_detail" | grep -q '"status":"active"'; then
  echo "PASS: Brand sees active challenge"
else
  echo "FAIL: Expected active status after approval"
  exit 1
fi

if [[ -n "$CRON_SECRET" ]]; then
  echo ""
  echo "==> POST /api/v1/cron/expire-challenges"
  cron=$(curl -sf -X POST "$BASE_URL/api/v1/cron/expire-challenges" \
    -H "x-cron-secret: $CRON_SECRET")
  echo "$cron"
fi

echo ""
echo "==> POST /api/brands/challenges/$challenge_id/end"
end=$(curl -sf -b "$cookie_jar" -X POST "$BASE_URL/api/brands/challenges/$challenge_id/end")
echo "$end"

echo ""
echo "All challenge lifecycle smoke tests finished."
