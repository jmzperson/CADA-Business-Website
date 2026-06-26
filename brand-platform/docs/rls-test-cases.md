# Row Level Security — Test Cases

Run after migrations + seed:

```bash
cd brand-platform
docker compose up -d
./scripts/migrate.sh
./scripts/seed.sh
./scripts/test-rls.sh
```

## Simulating JWT identity (local)

Policies use `auth.uid()`. In local Docker, set the claim before queries as role `authenticated`:

```sql
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '<auth_user_id>', true);
SELECT count(*) FROM redemptions;
RESET ROLE;
```

## Seed identities

| Persona | auth_user_id | brand_id | role |
|---------|--------------|----------|------|
| Studio Flow admin | `11111111-1111-4111-8111-111111111101` | `a0000000-...-0001` | admin |
| Studio Flow scanner | `11111111-1111-4111-8111-111111111102` | `a0000000-...-0001` | scanner |
| Rival Gym admin | `22222222-2222-4222-8222-222222222201` | `b0000000-...-0001` | admin |
| App user 1 | `33333333-3333-4333-8333-333333333301` | — | cada_user |

---

## Test matrix

### Brand isolation

| # | Actor | Query | Expected |
|---|-------|-------|----------|
| B1 | Studio Flow admin | `SELECT count(*) FROM redemptions` | **2** (Brand A only) |
| B2 | Studio Flow admin | `SELECT count(*) FROM redemptions WHERE brand_id = 'b0000000-...-0001'` | **0** |
| B3 | Rival Gym admin | `SELECT count(*) FROM redemptions` | **1** (Brand B only) |
| B4 | **Brand A cannot read Brand B's redemptions** | Studio Flow admin: `SELECT * FROM redemptions WHERE brand_id = 'b0000000-0000-4000-8000-000000000001'` | **0 rows** |
| B5 | Studio Flow admin | `SELECT count(*) FROM user_challenge_enrollments uce JOIN challenges c ON c.id = uce.challenge_id WHERE c.brand_id = current setting` | **8** (Brand A enrollments only) |
| B6 | Rival Gym admin | Same join pattern | **2** |

### Scanner vs admin (challenge edits)

| # | Actor | Action | Expected |
|---|-------|--------|----------|
| S1 | Scanner | `SELECT count(*) FROM challenges` | **1** (own brand) |
| S2 | Scanner | `UPDATE challenges SET title = 'Hacked' WHERE id = 'a0000000-...-0021'` | **0 rows updated** (no UPDATE policy) |
| S3 | Scanner | `INSERT INTO challenges (...)` | **Denied** |
| S4 | Admin | `UPDATE challenges SET description = 'Updated' WHERE id = 'a0000000-...-0021'` | **1 row** (allowed) |
| S5 | Scanner | `SELECT count(*) FROM redemptions` | **2** (read dashboard aggregates) |
| S6 | Scanner | `INSERT INTO redemptions (qr_reward_id, brand_id, staff_id, ...)` matching own brand | **Allowed** (redeem flow) |

### App user self-access

| # | Actor | Query | Expected |
|---|-------|-------|----------|
| U1 | App user 1 | `SELECT count(*) FROM user_challenge_enrollments` | **2** (own enrollments: Brand A + Brand B) |
| U2 | App user 1 | `SELECT count(*) FROM user_challenge_enrollments WHERE user_id != current_cada_user_id()` | **0** |
| U3 | App user 2 | `SELECT count(*) FROM qr_rewards` | **2** (own rewards only) |
| U4 | App user 1 | `SELECT count(*) FROM qr_rewards` | **1** |
| U5 | App user 1 | `SELECT count(*) FROM challenges WHERE status = 'active'` | **≥1** (discovery of active challenges) |
| U6 | App user 1 | `SELECT count(*) FROM redemptions` | **0** (no brand staff role) |

### Cross-pool separation

| # | Scenario | Expected |
|---|----------|----------|
| X1 | Brand staff JWT on `user_challenge_enrollments` without being app user | Sees brand aggregate via staff policy, not other users' unrelated enrollments |
| X2 | App user JWT on `brand_staff` | **0 rows** |
| X3 | App user JWT on `brands` | **0 rows** (unless also brand staff) |

---

## Automated script

`scripts/test-rls.sh` runs the cases above and prints PASS/FAIL. Example output:

```
B4 Brand A cannot read Brand B redemptions: PASS (0 rows)
S2 Scanner cannot update challenges: PASS
U2 App user cannot read others enrollments: PASS
```

---

## Supabase hosted notes

- Use **service role** key only on server; never in browser.
- Brand portal: sign in via Supabase Auth → JWT `sub` must match `brand_staff.auth_user_id`.
- Mobile app: separate auth pool; `cada_users.auth_user_id` = app JWT `sub`.
- Internal admin operations (revoke QR, approve brands) use service role in Phase 2+.

---

## Policy reference

| Table | Staff SELECT | Staff WRITE | Scanner WRITE | App user |
|-------|-------------|-------------|---------------|----------|
| brands | own brand | admin UPDATE | — | — |
| challenges | own brand | admin CRUD | — | active only SELECT |
| enrollments | own brand challenges | — | — | own rows |
| qr_rewards | own brand | UPDATE (redeem) | UPDATE | own rows SELECT |
| redemptions | own brand | — | INSERT | — |
| redemption_attempts | own brand | INSERT | INSERT | — |
