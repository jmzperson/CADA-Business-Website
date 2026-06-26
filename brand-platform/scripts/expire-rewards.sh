#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
CRON_SECRET="${CRON_SECRET:?Set CRON_SECRET}"

count=$(curl -sf -X POST "$BASE_URL/cron/expire-rewards" \
  -H "x-cron-secret: $CRON_SECRET")

echo "Expired rewards: $count"
