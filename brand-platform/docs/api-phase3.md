# Phase 3 API — Challenges

Base URL: `/api/brands/challenges`  
Auth: Supabase session (brand staff). Admin required for create, edit, publish, end, delete.

---

## GET `/api/brands/challenges`

List all challenges for the current brand with enrollment metrics.

**Roles:** admin, scanner (read-only)

**Response `200`**
```json
{
  "challenges": [
    {
      "id": "uuid",
      "title": "Try a class at Studio Flow",
      "description": "Complete one stretch habit...",
      "habit_type": "stretch",
      "offer_headline": "First class free",
      "offer_code": "CADA-STRETCH",
      "status": "active",
      "starts_at": "2026-06-01T00:00:00Z",
      "ends_at": "2026-06-30T23:59:59Z",
      "max_redemptions": 100,
      "published_at": "2026-06-01T12:00:00Z",
      "submitted_at": null,
      "reviewed_at": null,
      "rejection_reason": null,
      "enrolled_count": 8,
      "completion_count": 5,
      "redemption_count": 2
    }
  ]
}
```

Metrics come from `user_challenge_enrollments` and `redemptions` (seed data in dev until app sync in Phase 4).

---

## POST `/api/brands/challenges`

Create a new challenge in **draft** status.

**Roles:** admin only

**Request**
```json
{
  "title": "Knock out Gym at Rival Gym",
  "description": "Visit us this week after your gym habit.",
  "habit_type": "gym",
  "offer_headline": "Free day pass",
  "offer_code": "CADA-GYM",
  "starts_at": "2026-07-01T09:00:00Z",
  "ends_at": null,
  "max_redemptions": 50
}
```

| Field | Required | Notes |
|-------|----------|-------|
| title | yes | |
| habit_type | yes | `gym`, `text_friend`, `call_family`, `journal`, `stretch`, `run`, `custom` |
| offer_headline | yes | First-time offer text |
| starts_at | yes | ISO 8601 or datetime-local converted |
| description | no | Defaults to `""` |
| offer_code | no | Promo code |
| ends_at | no | Must be after `starts_at` |
| max_redemptions | no | Positive integer cap |

**Response `201`**
```json
{
  "challenge": { "...": "same shape as list item, counts = 0" }
}
```

---

## GET `/api/brands/challenges/:id`

Single challenge with metrics.

**Roles:** admin, scanner

---

## GET `/api/brands/challenges/:id/redemptions`

Paginated redemption log for one challenge. Each successful QR scan creates a row in `redemptions` with `challenge_id`, `staff_id`, and `redeemed_at`.

**Roles:** admin, scanner

**Query:** `page`, `page_size`, `range` / `from` / `to` (same as brand redemptions), or `all_time=true` for no date filter.

**Response `200`**
```json
{
  "challenge": { "id": "uuid", "title": "...", "status": "active" },
  "total": 12,
  "redemptions": [
    {
      "id": "uuid",
      "redeemed_at": "2026-06-20T14:30:00Z",
      "challenge_id": "uuid",
      "challenge_title": "Try a class at Studio Flow",
      "staff_email": "scanner@brand.com",
      "user_label": "User #A1"
    }
  ]
}
```

---

## PATCH `/api/brands/challenges/:id`

Update challenge.

**Roles:** admin only

| Status | Editable fields |
|--------|-----------------|
| `draft` | All fields |
| `rejected` | All fields (edit and resubmit via publish) |
| `pending_review` | None (409 — locked until CADA acts) |
| `active` | `description`, `offer_headline`, `offer_code`, `max_redemptions` |
| `ended` | None (409) |

Brands cannot PATCH `status` to `active`; approval is CADA admin only.

**Response `200`** — updated `challenge` object.

---

## DELETE `/api/brands/challenges/:id`

Delete a **draft** or **rejected** challenge with no enrollments and no redemptions.

**Roles:** admin only

**Errors:** `409` if not draft/rejected, has enrollments, or has redemptions.

---

## POST `/api/brands/challenges/:id/publish`

Submit for CADA review → `status: pending_review`, `submitted_at: now`. Does **not** set `active` or `published_at`.

**Roles:** admin only

**Rules:**
- Only `draft` or `rejected` challenges can be submitted
- Required: title, habit_type, offer_headline, starts_at (same as former publish validation)
- `ends_at` must be after `starts_at` if set
- Clears `rejection_reason` on resubmit
- Sets `status: pending_review` and emails `CHALLENGE_NOTIFY_EMAIL` (default `james@cadaapp.com`) via **Resend** (`RESEND_API_KEY`, `RESEND_FROM`)

**Response `200`**
```json
{
  "challenge": { "...": "status pending_review" },
  "message": "Submitted for CADA approval."
}
```

---

## CADA admin — challenge approval

Token: `CADA_ADMIN_TOKEN` (Bearer header or `?token=` query). Same pattern as partnership leads.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/admin/challenges?status=pending_review` | Approval queue (all brands) |
| `GET /api/admin/challenges/:id` | Full challenge detail + brand + metrics |
| `POST /api/admin/challenges/:id/approve` | → `active`, sets `published_at`, `reviewed_at`, `reviewed_by` |
| `POST /api/admin/challenges/:id/reject` | → `rejected`, optional `rejection_reason` in body |

**Web UI:** `/admin/challenges?token=YOUR_CADA_ADMIN_TOKEN`

Approved challenges become visible in the mobile app (`GET /api/v1/challenges/available`, `GET /api/v1/challenges/:id`). `pending_review`, `draft`, and `rejected` are excluded. Challenges past `ends_at` are auto-ended on discovery requests and via `POST /api/v1/cron/expire-challenges` (same `CRON_SECRET` as expire-rewards).

`max_redemptions` is enforced across discovery, enrollment, reward issuance, and QR redeem. Available challenges include `spots_remaining` (null = unlimited).

---

## POST `/api/brands/challenges/:id/end`

End an active challenge early → `status: ended`, `ends_at` set to now (if not already past).

**Roles:** admin only

**Response `200`**
```json
{
  "challenge": { "...": "status ended" },
  "message": "Challenge ended. It is no longer visible in the app."
}
```

---

## Portal routes

| Route | Access |
|-------|--------|
| `/dashboard/challenges` | All staff (list) |
| `/dashboard/challenges/new` | Admin only |
| `/dashboard/challenges/:id/edit` | All staff (admin edit, scanner view) |
| `/admin/challenges` | CADA internal (token) |

---

## Status lifecycle

```
draft ──submit for review──► pending_review ──approve──► active ──end──► ended
  │                                │
  │                                └──reject──► rejected ──resubmit──► pending_review
  │
  └── delete (if draft/rejected, no enrollments/redemptions)
```

`published_at` is set only when CADA approves (`active`). Brand KPIs include only `active` and `ended` challenges.

---

## Habit types (align with iOS)

| Value | App display |
|-------|-------------|
| `gym` | Knocked Out · Gym |
| `text_friend` | Crushed · Text a Friend |
| `call_family` | Call Family |
| `run` | Run |
| `stretch` | Stretch |
| `journal` | Journal |
| `custom` | Custom |
