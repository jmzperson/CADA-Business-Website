# Phase 7 — Brand dashboard metrics API

Brand staff can view partnership KPIs, per-challenge breakdowns, and a redemptions log. All endpoints require an authenticated brand staff session (portal cookie or `Authorization: Bearer`).

## Endpoints

### `GET /api/brands/metrics`

Brand-wide aggregates for the selected date range.

**Query**

| Param | Values | Default |
|-------|--------|---------|
| `range` | `7d`, `30d`, `90d`, `custom` | `30d` |
| `from` | ISO date (`YYYY-MM-DD`) | — (required with `custom`) |
| `to` | ISO date | — (required with `custom`) |

**Response**

```json
{
  "range": "30d",
  "from": "2026-05-27T00:00:00.000Z",
  "to": "2026-06-26T23:59:59.999Z",
  "label": "Last 30 days",
  "enrolled": 8,
  "active_this_week": 2,
  "completions": 5,
  "qr_issued": 3,
  "qr_redeemed": 2,
  "redemption_rate": 0.667,
  "funnel": {
    "enrolled": 8,
    "completed": 5,
    "qr_issued": 3,
    "qr_redeemed": 2
  }
}
```

### `GET /api/brands/metrics/challenges/:id`

Same KPIs scoped to one challenge (must belong to the signed-in brand).

### `GET /api/brands/redemptions`

Paginated redemptions log.

**Query:** same `range` / `from` / `to`, plus `page` (default 1), `page_size` (default 25, max 100), and optional `challenge_id` to filter one campaign.

Each row is written on successful QR redeem (`redemptions.challenge_id`, `staff_id`, `redeemed_at`).

```json
{
  "total": 2,
  "redemptions": [
    {
      "id": "…",
      "redeemed_at": "…",
      "challenge_title": "Try a class at Studio Flow",
      "staff_email": "scanner@studioflow.example",
      "user_label": "User #A1"
    }
  ]
}
```

## Metric definitions

| KPI | Definition |
|-----|------------|
| **Enrolled** | `user_challenge_enrollments` with `enrolled_at` in range |
| **Active this week** | Distinct users with attributed `habit_completion_events` in rolling last 7 days (not range-filtered) |
| **Completions** | `habit_completion_events` linked to brand challenge enrollments, `completed_at` in range |
| **QR issued** | `qr_rewards` with `status IN (issued, redeemed)` and `issued_at` in range |
| **QR redeemed** | `redemptions.redeemed_at` in range |
| **Redemption rate** | `qr_redeemed / qr_issued` (null if issued = 0) |

**Funnel:** enrolled → completed (enrollments with `completed_at` in range) → QR issued → QR redeemed.

## Indexes (Phase 1)

Queries align with existing indexes:

- `user_challenge_enrollments (challenge_id)`, `(enrolled_at)`
- `habit_completion_events (enrollment_id)`, `(completed_at)`
- `qr_rewards (brand_id)`, `(issued_at)`, `(challenge_id)`
- `redemptions (brand_id)`, `(redeemed_at)`

## Caching

Aggregates are cached in-process for **60 seconds** per `(brandId, challengeId?, from, to)` key (`portal/src/lib/metrics/aggregate.ts`).

- **Invalidation:** `invalidateMetricsCache(brandId)` runs after a successful redeem so dashboard counts update immediately.
- **Scale-out:** For multiple portal instances, replace the in-memory `Map` with Redis (same key pattern, same TTL) or drop cache and rely on read replicas + indexed queries.

## Privacy

**Default (MVP):** Dashboard shows counts and anonymized user labels from `cada_users.display_label` (e.g. `User #A1`). No email, phone, or full name in the redemptions log.

**Opt-in first name (future):**

1. Add `share_first_name_with_brands BOOLEAN DEFAULT false` on `cada_users` (or a per-enrollment consent flag).
2. In `getRedemptionsLog`, select `first_name` only when consent is true; otherwise keep `display_label`.
3. Document consent in the mobile app challenge enrollment flow.

Staff emails are shown in the redemptions log (brand’s own team).

## Brand isolation

- API routes use `getStaffContext().brandId` — never accept `brand_id` from the client.
- Challenge detail returns 404 if the challenge belongs to another brand.
- RLS on underlying tables provides defense in depth.

## UI routes

| Path | Purpose |
|------|---------|
| `/dashboard` | KPI cards + funnel |
| `/dashboard/challenges/:id` | Per-challenge metrics |
| `/dashboard/redemptions` | Redemptions table |

## Seed expectations (Brand A, 30d)

After `supabase db reset` / seed:

| Metric | Expected |
|--------|----------|
| Enrolled | 8 |
| Completed (funnel) | 5 |
| Completions | 5 |
| Active this week | 2 |
| QR issued | 3 |
| QR redeemed | 2 |
| Redemption rate | ~0.667 |

Brand B (Rival Gym) should see only its own counts (2 enrollments, 1 redemption, etc.).

## Test script

```bash
STAFF_JWT_BRAND_A=… STAFF_JWT_BRAND_B=… ./scripts/test-metrics-phase7.sh
```
