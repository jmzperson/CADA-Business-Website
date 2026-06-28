# CADA Brand Platform — Database Schema (Phase 1)

**ORM choice:** SQL migrations (not Prisma/Drizzle as source of truth). Supabase Row Level Security policies are PostgreSQL-native; keeping schema + RLS in versioned SQL avoids ORM/RLS drift and matches the architecture recommendation.

---

## Entity-relationship diagram

```mermaid
erDiagram
    brands ||--o{ brand_locations : has
    brands ||--o{ brand_staff : employs
    brands ||--o{ challenges : publishes
    challenges ||--o{ user_challenge_enrollments : receives
    cada_users ||--o{ user_challenge_enrollments : joins
    cada_users ||--o{ habit_completion_events : completes
    user_challenge_enrollments ||--o| qr_rewards : earns
    qr_rewards ||--o| redemptions : redeemed_as
    brand_staff ||--o{ redemptions : scans
    brand_locations ||--o{ redemptions : at
    brands ||--o{ qr_rewards : owns
    brands ||--o{ redemptions : records
    brands ||--o{ redemption_attempts : audits
    user_challenge_enrollments ||--o{ habit_completion_events : attributes

    brands {
        uuid id PK
        text name
        text slug UK
        brand_category category
        brand_status status
        timestamptz created_at
    }

    brand_staff {
        uuid id PK
        uuid brand_id FK
        text email
        brand_staff_role role
        uuid auth_user_id UK
        timestamptz accepted_at
    }

    challenges {
        uuid id PK
        uuid brand_id FK
        text title
        habit_type habit_type
        challenge_status status
        timestamptz starts_at
        timestamptz ends_at
    }

    user_challenge_enrollments {
        uuid id PK
        uuid challenge_id FK
        uuid user_id FK
        enrollment_status status
        timestamptz enrolled_at
        timestamptz completed_at
        int completion_count
    }

    qr_rewards {
        uuid id PK
        uuid enrollment_id FK UK
        uuid brand_id FK
        text token_hash UK
        qr_reward_status status
        timestamptz expires_at
    }

    redemptions {
        uuid id PK
        uuid qr_reward_id FK UK
        uuid brand_id FK
        uuid staff_id FK
        timestamptz redeemed_at
    }
```

---

## Tables

### `cada_users`
Shadow reference for iOS app users. `auth_user_id` maps to JWT `sub` when app auth shares Supabase.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| auth_user_id | UUID | Unique; links to `auth.users` |
| display_label | TEXT | Optional anonymized label |
| created_at | TIMESTAMPTZ | |

### `brands`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | |
| slug | TEXT | Unique, URL-safe |
| logo_url | TEXT | Optional |
| category | `brand_category` | gym, food, wellness, retail, other |
| website | TEXT | |
| offer_default_copy | TEXT | |
| primary_address | TEXT | MVP single-location shortcut |
| status | `brand_status` | pending, active, suspended |
| created_at, updated_at | TIMESTAMPTZ | |

### `brand_locations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| brand_id | UUID | FK → brands |
| name | TEXT | |
| address | TEXT | |

### `brand_staff`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| brand_id | UUID | FK → brands |
| email | TEXT | Unique per `(brand_id, email)` |
| role | `brand_staff_role` | **admin**, **scanner** |
| auth_user_id | UUID | FK → auth provider |
| invited_at | TIMESTAMPTZ | |
| accepted_at | TIMESTAMPTZ | Null until invite accepted |

### `challenges`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| brand_id | UUID | FK → brands |
| title, description | TEXT | |
| habit_type | `habit_type` | Aligns with iOS knock-out types |
| offer_headline, offer_code | TEXT | |
| status | `challenge_status` | **draft**, **pending_review**, **rejected**, **active**, **ended** |
| starts_at, ends_at | TIMESTAMPTZ | |
| completion_rule | `completion_rule` | MVP: `single_completion` |
| max_redemptions | INT | Optional cap |
| published_at | TIMESTAMPTZ | Set when CADA approves (`active`) |
| submitted_at | TIMESTAMPTZ | When brand submitted for review |
| reviewed_at | TIMESTAMPTZ | When CADA approved or rejected |
| reviewed_by | TEXT | Admin identifier |
| rejection_reason | TEXT | Shown to brand on reject |

### `user_challenge_enrollments`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| challenge_id | UUID | FK → challenges |
| user_id | UUID | FK → cada_users |
| status | `enrollment_status` | **active**, **completed**, **dropped** |
| enrolled_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| completion_count | INT | Default 0 |

**Unique:** `(challenge_id, user_id)`

### `habit_completion_events`
Attribution layer; idempotent on `(user_id, source_event_id)`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → cada_users |
| habit_type | `habit_type` | |
| completed_at | TIMESTAMPTZ | |
| source_event_id | TEXT | App knock-out ID |
| enrollment_id | UUID | Nullable FK → enrollments |

### `qr_rewards`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| enrollment_id | UUID | FK unique (one QR per enrollment) |
| brand_id | UUID | Denormalized for redeem RLS |
| token_hash | TEXT | SHA-256; never store raw token |
| status | `qr_reward_status` | **issued**, **redeemed**, **expired**, **revoked** |
| issued_at, expires_at | TIMESTAMPTZ | |
| redeemed_at | TIMESTAMPTZ | |

### `redemptions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| qr_reward_id | UUID | FK unique |
| brand_id | UUID | FK → brands |
| challenge_id | UUID | FK → challenges (denormalized for per-campaign counts) |
| staff_id | UUID | FK → brand_staff |
| location_id | UUID | Optional FK → brand_locations |
| redeemed_at | TIMESTAMPTZ | |
| metadata | JSONB | user_agent, ip_hash |

### `redemption_attempts`
Audit log for failed/successful scan attempts.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| token_hash | TEXT | |
| brand_id, staff_id | UUID | Nullable |
| outcome | `redemption_attempt_outcome` | success, invalid, expired, etc. |
| created_at | TIMESTAMPTZ | |

---

## Enums (status fields)

| Enum | Values |
|------|--------|
| `challenge_status` | `draft`, `pending_review`, `rejected`, `active`, `ended` |
| `enrollment_status` | `active`, `completed`, `dropped` |
| `qr_reward_status` | `issued`, `redeemed`, `expired`, `revoked` |
| `brand_staff_role` | `admin`, `scanner` |

---

## Dashboard indexes

| Query | Index |
|-------|-------|
| Enrollments by challenge | `idx_enrollments_challenge_id`, `idx_enrollments_challenge_status` |
| Completions by date | `idx_habit_completions_completed_at`, `idx_habit_completions_user_completed` |
| Redemptions by brand | `idx_redemptions_brand_id`, `idx_redemptions_brand_redeemed_at` |
| QR funnel by brand | `idx_qr_rewards_brand_status` |
| Admin challenge queue | `idx_challenges_status_submitted` (`pending_review`) |

---

## RLS summary

| Actor | Access |
|-------|--------|
| Brand admin | Full CRUD on own `brand_id`: profile, staff, challenges, read all metrics |
| Brand scanner | SELECT challenges + metrics; INSERT redemptions; **no** challenge writes |
| CADA app user | SELECT own enrollments + QR rewards; INSERT enrollments; read active challenges |
| Service role | Bypasses RLS (API atomic redeem, internal admin) |

Helper functions: `current_brand_staff()`, `current_brand_id()`, `is_brand_admin()`, `current_cada_user_id()`.

See [rls-test-cases.md](rls-test-cases.md) for verification matrix.

---

## Seed data (dev)

| Entity | Brand A (Studio Flow) | Brand B (Rival Gym) |
|--------|----------------------|---------------------|
| Staff | 1 admin, 1 scanner | 1 admin |
| Challenge | 1 active | 1 active |
| Enrollments | 8 | 2 |
| QR rewards | 5 | 1 |
| Redemptions | 2 | 1 |

Fixed UUIDs and auth IDs are documented in `rls-test-cases.md`.
