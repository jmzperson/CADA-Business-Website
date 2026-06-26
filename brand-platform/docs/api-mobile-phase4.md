# Phase 4 — Mobile API (CADA iOS)

**Base URL:** `https://api.cada.app/v1` (local: `http://localhost:3000/api/v1`)  
**Auth:** `Authorization: Bearer <CADA app user JWT>`  
**Format:** JSON

The mobile API uses the **CADA app user** identity pool (`cada_users.auth_user_id` = JWT `sub`). Brand portal staff tokens will not work on these routes.

OpenAPI spec: [openapi-mobile-v1.yaml](openapi-mobile-v1.yaml)

---

## Authentication

Obtain a JWT from your existing CADA app auth (Supabase Auth recommended):

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export ANON_KEY="your-anon-key"

# Create a test app user in Supabase Auth (once), then:
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"mobile-test@cada.app","password":"your-password"}' \
  | jq -r '.access_token'
```

Set `export APP_JWT="<access_token>"` for the examples below.

On first authenticated call, the API **auto-provisions** a `cada_users` row linked to `auth.uid()`.

---

## Attribution rules (read this)

| Rule | Behavior |
|------|----------|
| Enrollment required | Habit knock-outs only count toward a challenge after `POST .../enroll` |
| Habit type match | `habit_type` must exactly match `challenge.habit_type` |
| Challenge must be active | Challenge `status=active`, within `starts_at` / `ends_at` window |
| Completion rule | MVP: `single_completion` — one attributed knock-out completes the enrollment |
| Idempotency | Same `source_event_id` for a user → same response, no double-count |
| Daily cap | At most **one attributed completion per enrollment per UTC calendar day** |
| Circle feed | Independent — this API only tracks brand attribution |

`source_event_id` should be the app’s knock-out / crush ID (stable, unique per habit event).

---

## GET `/challenges/available`

Active published challenges (no geo filter in MVP — all markets).

**Response `200`**
```json
{
  "challenges": [
    {
      "id": "a0000000-0000-4000-8000-000000000021",
      "title": "Try a class at Studio Flow",
      "description": "Complete one stretch habit and redeem your first class free.",
      "habit_type": "stretch",
      "offer_headline": "First class free",
      "offer_code": "CADA-STRETCH",
      "starts_at": "2026-06-05T00:00:00.000Z",
      "ends_at": "2026-07-05T00:00:00.000Z",
      "brand": {
        "id": "a0000000-0000-4000-8000-000000000001",
        "name": "Studio Flow Yoga",
        "slug": "studio-flow-yoga",
        "logo_url": "https://cdn.example.com/studio-flow-logo.png",
        "category": "wellness"
      }
    }
  ],
  "meta": { "region": "all", "count": 1 }
}
```

```bash
curl -s http://localhost:3000/api/v1/challenges/available \
  -H "Authorization: Bearer $APP_JWT" | jq
```

---

## POST `/challenges/:id/enroll`

Join a challenge. Duplicate enrollments return `200` with `already_enrolled: true`.

**Request:** empty body

**Response `201`**
```json
{
  "enrollment_id": "uuid",
  "challenge_id": "uuid",
  "status": "active",
  "enrolled_at": "2026-06-26T12:00:00.000Z"
}
```

**Response `200` (already enrolled)**
```json
{
  "enrollment_id": "uuid",
  "challenge_id": "uuid",
  "status": "active",
  "enrolled_at": "2026-06-20T10:00:00.000Z",
  "already_enrolled": true
}
```

**Errors:** `404` challenge not found · `410` not available · `401` unauthorized

```bash
CHALLENGE_ID="a0000000-0000-4000-8000-000000000021"

curl -s -X POST "http://localhost:3000/api/v1/challenges/$CHALLENGE_ID/enroll" \
  -H "Authorization: Bearer $APP_JWT" \
  -H "Content-Type: application/json" | jq
```

---

## GET `/users/me/challenges`

User’s enrollments with progress and reward status.

**Response `200`**
```json
{
  "enrollments": [
    {
      "enrollment_id": "uuid",
      "challenge_id": "uuid",
      "status": "active",
      "enrolled_at": "2026-06-26T12:00:00.000Z",
      "completed_at": null,
      "completion_count": 0,
      "challenge": {
        "title": "Try a class at Studio Flow",
        "habit_type": "stretch",
        "offer_headline": "First class free",
        "offer_code": "CADA-STRETCH",
        "status": "active"
      },
      "brand": {
        "id": "uuid",
        "name": "Studio Flow Yoga",
        "logo_url": "https://..."
      },
      "progress": {
        "rule": "single_completion",
        "required": 1,
        "current": 0,
        "completed": false
      },
      "reward": {
        "issued": false,
        "pending_phase": false,
        "reward_id": null
      }
    }
  ]
}
```

```bash
curl -s http://localhost:3000/api/v1/users/me/challenges \
  -H "Authorization: Bearer $APP_JWT" | jq
```

---

## POST `/events/habit-completed`

Report a habit knock-out for brand attribution. **Idempotent** on `source_event_id`.

**Request**
```json
{
  "habit_type": "stretch",
  "completed_at": "2026-06-26T12:05:00.000Z",
  "source_event_id": "app-knockout-abc123",
  "challenge_id": "optional-uuid"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| habit_type | yes | Must match enrolled challenge |
| completed_at | yes | ISO 8601 |
| source_event_id | yes | Stable app event ID |
| challenge_id | no | Disambiguate if multiple active enrollments share habit type |

**Response `200` — attributed & completed**
```json
{
  "attributed": true,
  "enrollment_id": "uuid",
  "enrollment_status": "completed",
  "completion_count": 1,
  "reward": {
    "id": "uuid",
    "enrollment_id": "uuid",
    "qr_url": "https://redeem.cada.app/r/<token>",
    "expires_at": "2026-06-27T12:05:00Z",
    "status": "issued"
  }
}
```

**Response `200` — not attributed**
```json
{
  "attributed": false,
  "reason": "no_matching_enrollment"
}
```

| `reason` | Meaning |
|----------|---------|
| `no_matching_enrollment` | Not enrolled, wrong habit type, or challenge inactive |
| `enrollment_already_completed` | Challenge already finished |
| `enrollment_not_active` | Enrollment dropped |
| `daily_cap_reached` | Already attributed a completion today for this enrollment |
| `invalid_completed_at` | Bad timestamp |

**Response `200` — idempotent replay**
```json
{
  "attributed": true,
  "idempotent_replay": true,
  "enrollment_id": "uuid",
  "enrollment_status": "completed",
  "completion_count": 1,
  "reward": { "pending": true, "...": "..." }
}
```

### End-to-end curl

```bash
# 1. Enroll (stretch challenge from seed)
curl -s -X POST "http://localhost:3000/api/v1/challenges/$CHALLENGE_ID/enroll" \
  -H "Authorization: Bearer $APP_JWT" | jq

# 2. Report habit completion
curl -s -X POST http://localhost:3000/api/v1/events/habit-completed \
  -H "Authorization: Bearer $APP_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "habit_type": "stretch",
    "completed_at": "2026-06-26T12:05:00Z",
    "source_event_id": "app-knockout-test-001"
  }' | jq

# 3. Idempotent replay (same source_event_id — no double-count)
curl -s -X POST http://localhost:3000/api/v1/events/habit-completed \
  -H "Authorization: Bearer $APP_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "habit_type": "stretch",
    "completed_at": "2026-06-26T12:05:00Z",
    "source_event_id": "app-knockout-test-001"
  }' | jq

# 4. Second event same day (different source_event_id) — daily cap
curl -s -X POST http://localhost:3000/api/v1/events/habit-completed \
  -H "Authorization: Bearer $APP_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "habit_type": "stretch",
    "completed_at": "2026-06-26T18:00:00Z",
    "source_event_id": "app-knockout-test-002"
  }' | jq
# Expected: { "attributed": false, "reason": "enrollment_already_completed" }
#   OR if not yet completed: { "reason": "daily_cap_reached" }
```

Automated smoke test: `../scripts/test-mobile-api.sh`

---

## Error format

```json
{ "error": "Human-readable message" }
```

| Status | When |
|--------|------|
| 401 | Missing/invalid Bearer token |
| 400 | Validation error |
| 404 | Resource not found |
| 409 | Conflict |
| 410 | Challenge unavailable |
| 500 | Server error |

---

## iOS integration checklist

**→ Full package:** [ios-integration-package.md](ios-integration-package.md) (user stories, QR spec, errors, analytics, feature flags, Swift client)

- [ ] Attach CADA user JWT on every request
- [ ] Call `habit-completed` after knock-out with stable `source_event_id`
- [ ] Use `challenge_id` in body when user has multiple active enrollments for same habit type
- [ ] Handle `reward.pending` until Phase 5 QR endpoint ships
- [ ] Do not rely on this API for circle feed — local only

---

## Phase 5 preview

`GET /users/me/rewards/:id` returns `qr_url` for the app reward screen. See [QR Integration Guide](qr-integration-guide-ios.md).
