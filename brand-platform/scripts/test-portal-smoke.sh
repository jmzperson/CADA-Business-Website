#!/usr/bin/env bash
# Portal backend smoke test — Firebase Admin SDK + auth + optional signup.
#
# Usage:
#   BASE_URL=https://partners.cadaapp.com ./test-portal-smoke.sh
#   BASE_URL=http://localhost:3000 ./test-portal-smoke.sh
#
# Optional full signup test (creates a real Firebase user + Firestore brand):
#   RUN_SIGNUP=1 TEST_EMAIL=you+test@example.com TEST_PASSWORD=secret123 ./test-portal-smoke.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
RUN_SIGNUP="${RUN_SIGNUP:-0}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

echo "=== CADA portal smoke test ==="
echo "Base URL: $BASE_URL"
echo ""

echo "1. GET /api/health (Firebase Admin + Firestore)"
health=$(curl -sf -w "\n%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo -e '\n000')
health_body=$(echo "$health" | sed '$d')
health_code=$(echo "$health" | tail -n1)

if [[ "$health_code" == "200" ]] && echo "$health_body" | grep -q '"ok":true'; then
  green "   OK — backend connected"
  echo "   $health_body"
else
  red "   FAIL (HTTP $health_code)"
  echo "   $health_body"
  yellow ""
  yellow "   Fix: set FIREBASE_SERVICE_ACCOUNT_JSON on Vercel and redeploy the portal project."
  yellow "   Root directory must be brand-platform/portal"
  exit 1
fi

echo ""
echo "2. GET /api/auth/session-status (expect 401 when logged out)"
session_code=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/session-status" 2>/dev/null || echo "000")
if [[ "$session_code" == "401" ]]; then
  green "   OK — session route responds (401 unauthorized)"
else
  yellow "   Unexpected HTTP $session_code (expected 401)"
fi

echo ""
echo "3. GET /signup page"
signup_code=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/signup" 2>/dev/null || echo "000")
if [[ "$signup_code" == "200" ]]; then
  green "   OK — signup page loads"
else
  red "   FAIL — signup returned HTTP $signup_code"
  exit 1
fi

if [[ "$RUN_SIGNUP" == "1" ]]; then
  if [[ -z "$TEST_EMAIL" || -z "$TEST_PASSWORD" ]]; then
    red "RUN_SIGNUP=1 requires TEST_EMAIL and TEST_PASSWORD"
    exit 1
  fi
  echo ""
  echo "4. POST /api/brands/register (creates test account)"
  reg=$(curl -sf -w "\n%{http_code}" -X POST "$BASE_URL/api/brands/register" \
    -H "Content-Type: application/json" \
    -d "{\"business_name\":\"Smoke Test $(date +%s)\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"category\":\"other\"}" 2>/dev/null || echo -e '\n000')
  reg_body=$(echo "$reg" | sed '$d')
  reg_code=$(echo "$reg" | tail -n1)
  if [[ "$reg_code" == "200" || "$reg_code" == "201" ]]; then
    green "   OK — account created"
    echo "   Check Firestore: brands + brand_staff for $TEST_EMAIL"
  else
    red "   FAIL (HTTP $reg_code)"
    echo "   $reg_body"
    exit 1
  fi
else
  echo ""
  yellow "4. Partner signup is invite-only. Use /api/admin/partners/invite to test onboarding."
fi

echo ""
green "=== Smoke test passed ==="
echo ""
echo "Next: invite a test partner via POST /api/admin/partners/invite, then check Firebase Console → Firestore."
