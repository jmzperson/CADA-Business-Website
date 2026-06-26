#!/usr/bin/env bash
# RLS smoke tests — requires migrate + seed
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"

run_as() {
  local auth_id="$1"
  local sql="$2"
  psql "$DATABASE_URL" -t -A -v ON_ERROR_STOP=1 -c "
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${auth_id}', true);
    ${sql}
    RESET ROLE;
  " | tr -d '[:space:]'
}

assert_eq() {
  local name="$1"
  local got="$2"
  local want="$3"
  if [[ "$got" == "$want" ]]; then
    echo "PASS: $name (got $got)"
  else
    echo "FAIL: $name (got $got, want $want)"
    exit 1
  fi
}

BRAND_A='a0000000-0000-4000-8000-000000000001'
BRAND_B='b0000000-0000-4000-8000-000000000001'
CHALLENGE_A='a0000000-0000-4000-8000-000000000021'

ADMIN_A='11111111-1111-4111-8111-111111111101'
SCANNER_A='11111111-1111-4111-8111-111111111102'
ADMIN_B='22222222-2222-4222-8222-222222222201'
APP_USER_1='33333333-3333-4333-8333-333333333301'
APP_USER_2='33333333-3333-4333-8333-333333333302'

echo "Running RLS tests..."

# B1: Brand A admin sees 2 redemptions
assert_eq "B1 Brand A admin redemption count" \
  "$(run_as "$ADMIN_A" "SELECT count(*)::text FROM redemptions;")" "2"

# B4: Brand A cannot read Brand B redemptions
assert_eq "B4 Brand A cannot read Brand B redemptions" \
  "$(run_as "$ADMIN_A" "SELECT count(*)::text FROM redemptions WHERE brand_id = '${BRAND_B}';")" "0"

# B3: Brand B admin sees 1 redemption
assert_eq "B3 Brand B admin redemption count" \
  "$(run_as "$ADMIN_B" "SELECT count(*)::text FROM redemptions;")" "1"

# S2: Scanner cannot update challenges
updated="$(run_as "$SCANNER_A" "UPDATE challenges SET title = title WHERE id = '${CHALLENGE_A}'; SELECT count(*)::text FROM challenges WHERE id = '${CHALLENGE_A}';")"
assert_eq "S1 Scanner can read challenges" "$updated" "1"

# S2: verify no update policy — title unchanged after attempted hack
run_as "$SCANNER_A" "UPDATE challenges SET title = 'Hacked' WHERE id = '${CHALLENGE_A}';" >/dev/null || true
title="$(run_as "$SCANNER_A" "SELECT title FROM challenges WHERE id = '${CHALLENGE_A}';")"
if [[ "$title" != *"Hacked"* ]]; then
  echo "PASS: S2 Scanner cannot update challenges"
else
  echo "FAIL: S2 Scanner updated challenge title"
  exit 1
fi

# U1: App user 1 sees 2 enrollments
assert_eq "U1 App user 1 enrollment count" \
  "$(run_as "$APP_USER_1" "SELECT count(*)::text FROM user_challenge_enrollments;")" "2"

# U4: App user 1 sees 1 qr_reward
assert_eq "U4 App user 1 qr_reward count" \
  "$(run_as "$APP_USER_1" "SELECT count(*)::text FROM qr_rewards;")" "1"

# U6: App user cannot see redemptions
assert_eq "U6 App user cannot read redemptions" \
  "$(run_as "$APP_USER_1" "SELECT count(*)::text FROM redemptions;")" "0"

# U3: App user 2 sees 2 qr_rewards
assert_eq "U3 App user 2 qr_reward count" \
  "$(run_as "$APP_USER_2" "SELECT count(*)::text FROM qr_rewards;")" "2"

echo "All RLS tests passed."
