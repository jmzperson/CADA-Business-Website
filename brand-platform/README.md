# CADA Brand Platform

PostgreSQL schema + RLS (Phase 1) and Next.js brand portal (Phase 2).

## Phase 2 — Brand portal (Firebase)

```bash
cd brand-platform/portal
cp .env.example .env.local   # Firebase keys + service account
npm install
npm run dev
```

**Backend:** Firebase Auth + Firestore + Storage (project `cada-4ed7c`). See [Firebase portal setup](portal/docs/firebase-portal-setup.md).

Portal staff sign-in is **separate** from CADA app users (`brand_staff` vs `cada_users` collections).

Open [http://localhost:3000](http://localhost:3000).

**Docs:** [API reference](docs/api-phase2.md) · [Mobile API (Phase 4)](docs/api-mobile-phase4.md) · [**iOS Integration Package**](docs/ios-integration-package.md) · [Schema ERD](docs/schema-erd.md) · [RLS tests](docs/rls-test-cases.md)

### Phase 2 features

- Brand signup (name, email, password, category, website, logo)
- Email verification gate before dashboard
- Login / logout / password reset
- Brand profile edit (admin)
- Staff invites (`admin` | `scanner`) + accept flow
- Protected routes + role-based UI
- **Challenge CRUD** — create, submit for review, end sponsored habit campaigns (Phase 3)
- **CADA challenge approval** — brands submit; internal admin queue approves before mobile visibility

### Phase 3 — Challenges

See [API reference](docs/api-phase3.md).

```text
/dashboard/challenges          List (all staff)
/dashboard/challenges/new      Create draft (admin)
/dashboard/challenges/:id/edit Manage / view
/admin/challenges              CADA approval queue (token)
```

Brand flow: **draft** → **Submit for review** → **pending_review** → CADA **approve** → **active** (visible in app).

On submit for review, Resend emails `james@cadaapp.com` with challenge details and an admin review link. Portal env:

```bash
CHALLENGE_NOTIFY_EMAIL=james@cadaapp.com
RESEND_API_KEY=re_...
RESEND_FROM=CADA Partners <notifications@cadaapp.com>
```

Verify `cadaapp.com` in [Resend](https://resend.com) before production. See `scripts/setup-production.sh` for full checklist.

### Phase 4 — Mobile API (iOS)

See [Mobile API docs](docs/api-mobile-phase4.md), [**iOS Integration Package**](docs/ios-integration-package.md) (start here for Swift), and [OpenAPI spec](docs/openapi-mobile-v1.yaml).

```bash
export APP_JWT="<cada-app-user-access-token>"
./scripts/test-mobile-api.sh
```

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/challenges/available` | Discover active challenges |
| `POST /api/v1/challenges/:id/enroll` | Join challenge |
| `GET /api/v1/users/me/challenges` | My progress |
| `POST /api/v1/events/habit-completed` | Attribute habit knock-out |

### Phase 5 — QR rewards

See [iOS QR Integration Guide](docs/qr-integration-guide-ios.md).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/users/me/rewards/:id` | Reward + QR URL for display |
| `POST /api/v1/redeem` | Staff redeem (validation) |
| `POST /api/v1/cron/expire-rewards` | Mark expired rewards (cron) |

### Phase 6 — Web scanner & redeem

See [Scanner API](docs/api-phase6-scanner.md).

| Route | Purpose |
|-------|---------|
| `POST /api/redeem` | Staff redeem token |
| `GET /r/{token}` | QR URL landing — auto-redeem after staff login |
| `/scan` | Web QR scanner (camera + manual) |

```bash
./scripts/test-redeem-phase6.sh   # wrong_brand isolation
```

### Phase 7 — Dashboard metrics

See [Metrics API](docs/api-phase7-metrics.md).

| Route | Purpose |
|-------|---------|
| `/dashboard` | KPI cards + funnel |
| `/dashboard/challenges/:id` | Per-challenge metrics |
| `/dashboard/redemptions` | Redemptions log |
| `GET /api/brands/metrics` | Brand-wide aggregates |
| `GET /api/brands/redemptions` | Paginated redemption rows |

```bash
STAFF_JWT_BRAND_A=... STAFF_JWT_BRAND_B=... ./scripts/test-metrics-phase7.sh
```

### Phase 8 — Marketing site bridge

See [Bridge docs](docs/api-phase8-bridge.md).

| Item | Purpose |
|------|---------|
| `cada_partnerships_page/code.html` | CTAs → portal signup; contact form → `/api/leads` |
| `POST /api/leads` | Lead capture (company, email, message) |
| `/admin/leads` | Internal lead list (token-protected) |
| `/dashboard` onboarding | Profile → challenge → publish checklist |

Set `window.CADA_PARTNERS_URL` on the marketing page and `MARKETING_SITE_ORIGINS` + `LEADS_ADMIN_TOKEN` + `CADA_ADMIN_TOKEN` in portal env.

## Phase 1 — Database

### Why SQL migrations (not Prisma/Drizzle alone)

The architecture targets **Supabase PostgreSQL with Row Level Security**. RLS policies, helper functions, and enum types are **native SQL** — they do not generate cleanly from Prisma/Drizzle alone and are awkward to maintain as application-level-only checks.

**Approach:**
- **Source of truth:** `supabase/migrations/*.sql`
- **Optional later:** Drizzle schema generated from or kept in sync with SQL for the Next.js API layer (Phase 2+)

## Quick start (local)

Requires [Docker](https://docs.docker.com/get-docker/).

```bash
cd brand-platform
docker compose up -d
./scripts/migrate.sh
./scripts/seed.sh
```

Connect: `postgresql://postgres:postgres@localhost:54322/postgres`

## Supabase (production)

```bash
supabase link --project-ref <your-ref>
supabase db push
psql $DATABASE_URL -f supabase/seed.sql   # dev/staging only
```

## Files

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260626100001_init_schema.sql` | Tables, enums, indexes |
| `supabase/migrations/20260626100002_rls_policies.sql` | RLS + helper functions |
| `supabase/seed.sql` | Dev seed data (2 brands for RLS testing) |
| `docs/schema-erd.md` | ERD + field reference |
| `supabase/migrations/20260626200001_staff_invites.sql` | Invite tokens + logo storage |
| `portal/` | Next.js brand portal (Phase 2) |
| `docs/api-phase2.md` | REST API documentation (auth) |
| `docs/api-phase3.md` | REST API documentation (challenges) |
| `docs/api-mobile-phase4.md` | Mobile API for iOS |
| `docs/openapi-mobile-v1.yaml` | OpenAPI 3.0 spec |
| `docs/ios-integration-package.md` | **iOS team — complete integration guide** |
| `docs/ios/CADABrandPartnershipsClient.swift` | Swift protocol + reference client |
| `docs/qr-integration-guide-ios.md` | iOS QR integration guide |
| `docs/api-phase7-metrics.md` | Dashboard metrics API + privacy |
| `docs/api-phase8-bridge.md` | Marketing site → portal bridge |
| `supabase/migrations/20260626500001_partnership_leads.sql` | Lead capture table |
| `supabase/migrations/20260626300001_daily_attribution_cap.sql` | One attribution per enrollment per UTC day |
| `supabase/migrations/20260626400001_qr_reward_fields.sql` | QR user_id, challenge_id, token_ciphertext |

## Schema docs

See [docs/schema-erd.md](docs/schema-erd.md) and [docs/rls-test-cases.md](docs/rls-test-cases.md).
