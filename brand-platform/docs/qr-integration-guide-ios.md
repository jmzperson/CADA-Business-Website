# CADA iOS — QR Reward Integration Guide

**Phase 5** · Audience: iOS engineers  
**Related:** [**iOS Integration Package**](ios-integration-package.md) (start here) · [Mobile API (Phase 4)](api-mobile-phase4.md) · [OpenAPI](openapi-mobile-v1.yaml)

---

## Overview

When a user completes a brand-sponsored challenge, the backend issues a **one-time QR reward**. The user shows the QR at the business; staff scan it to redeem the first-time offer.

The QR contains **only an unguessable token** — no name, email, or user ID.

---

## When is the QR issued?

| Trigger | Default (MVP) |
|---------|----------------|
| Enrollment status | `active` → `completed` |
| Completion rule | `single_completion` — first attributed habit knock-out |
| API moment | Synchronously in `POST /events/habit-completed` response |

The QR is **not** issued at enroll time. The user must:

1. Enroll in the challenge
2. Knock out the linked habit type in the app
3. App calls `POST /events/habit-completed`
4. Backend marks enrollment `completed` and issues exactly **one** `qr_rewards` row per enrollment

---

## iOS call sequence

```
┌─────────────┐     GET /challenges/available      ┌─────────┐
│  CADA App   │ ─────────────────────────────────► │   API   │
└─────────────┘                                    └─────────┘
       │ POST /challenges/:id/enroll
       ├──────────────────────────────────────────►
       │ (user knocks out habit — existing app flow)
       │ POST /events/habit-completed
       ├──────────────────────────────────────────►
       │◄── { attributed: true, reward: { id, qr_url, expires_at } }
       │
       │ GET /users/me/rewards/:id  (re-open reward screen)
       ├──────────────────────────────────────────►
       │◄── { qr_url, offer_headline, status, ... }
       │
       │ Render QR encoding qr_url
       ▼
```

### 1. Discover challenges

`GET /api/v1/challenges/available`  
Show sponsored cards with brand name, offer headline, linked habit type.

### 2. Enroll

`POST /api/v1/challenges/{challenge_id}/enroll`  
Empty body. Store `enrollment_id` locally if useful.

### 3. Report habit completion

Call **after** the knock-out is saved in your existing habit pipeline:

```http
POST /api/v1/events/habit-completed
Authorization: Bearer <app_jwt>
Content-Type: application/json

{
  "habit_type": "stretch",
  "completed_at": "2026-06-26T12:05:00Z",
  "source_event_id": "<stable_knockout_id>",
  "challenge_id": "<optional — if multiple active enrollments share habit type>"
}
```

**`source_event_id`** must be stable and unique per knock-out (e.g. existing feed event ID). Re-sending the same ID is idempotent and will not double-count.

### 4. Handle response

**Success — challenge completed, QR issued:**

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

**Not attributed (no QR):**

```json
{
  "attributed": false,
  "reason": "no_matching_enrollment"
}
```

| `reason` | Show user |
|----------|-----------|
| `no_matching_enrollment` | Silent or “Not linked to a brand challenge” |
| `enrollment_already_completed` | Open existing reward screen |
| `daily_cap_reached` | “Already counted today for this challenge” |
| `enrollment_not_active` | Generic error |

### 5. Reward screen

**Option A — use `habit-completed` response**  
Navigate immediately with `reward.qr_url`.

**Option B — re-fetch**  
`GET /api/v1/users/me/rewards/{reward.id}`

```json
{
  "id": "uuid",
  "status": "issued",
  "expires_at": "2026-06-27T12:05:00Z",
  "qr_url": "https://redeem.cada.app/r/<token>",
  "qr_payload": "https://redeem.cada.app/r/<token>",
  "brand_name": "Studio Flow Yoga",
  "challenge_title": "Try a class at Studio Flow",
  "offer_headline": "First class free",
  "offer_code": "CADA-STRETCH"
}
```

Encode **`qr_url`** (or `qr_payload`) in the QR — not a JSON blob.

### 6. What to show the user

| Element | Source |
|---------|--------|
| Brand name | `brand_name` |
| Offer | `offer_headline` + optional `offer_code` |
| QR code | Encode `qr_url` |
| Expiry countdown | `expires_at` (24h default) |
| Instructions | “Show this screen at {brand_name} to redeem” |

**Do not** log `qr_url` or token to analytics/crash reporters.

---

## QR payload format (scanner contract)

```
https://redeem.cada.app/r/{token}
```

| Part | Spec |
|------|------|
| Scheme | `https` only in production |
| Host | `redeem.cada.app` (configurable via `REDEEM_BASE_URL`) |
| Path | `/r/{token}` |
| Token | Base64url, 43 chars, 256-bit random opaque string |
| PII | **None** |

Staff scanner (Phase 6) extracts `{token}` from the URL path and calls `POST /api/v1/redeem`.

---

## Token design — why opaque, not JWT

| Approach | Chosen? | Rationale |
|----------|---------|-----------|
| **Opaque random + DB lookup** | **Yes (MVP)** | Revocable, one-time redeem, no clock skew, simple expiry job |
| Signed JWT in QR | No | Hard to revoke; expiry-only invalidation; larger QR |

**Storage:**

- `token_hash` = SHA-256(raw token) — used for redeem lookup
- `token_ciphertext` = AES-256-GCM encrypted raw token — allows `GET /users/me/rewards/:id` to re-display QR for the owner
- Raw token is **never** stored in plaintext

**Entropy:** 32 bytes (256 bits) — exceeds 128-bit minimum.

---

## Error states (reward screen)

| `status` | UI |
|----------|-----|
| `issued` | Show QR + countdown |
| `expired` | “This reward has expired” — hide QR |
| `redeemed` | “Already used” — hide QR |
| `revoked` | “This reward is no longer valid” — contact support |

`GET /users/me/rewards/:id` returns `qr_url: null` when not redeemable.

---

## Redeem errors (for reference — staff scanner)

When staff scan, your app does not call redeem. Document for support:

| HTTP | `error` | Meaning |
|------|---------|---------|
| 404 | `invalid_token` | QR not recognized |
| 410 | `expired` | Past `expires_at` |
| 409 | `already_redeemed` | One-time use consumed |
| 403 | `wrong_brand` | Token valid at different business |
| 410 | `revoked` | Admin revoked |

---

## Rate limits

| Endpoint | Limit |
|----------|-------|
| `POST /events/habit-completed` | 120 / min / user |
| `GET /users/me/rewards/:id` | 60 / min / user |
| `POST /redeem` (staff) | 60 / min / staff |

---

## Local testing

```bash
# Prerequisites: portal running, migrations applied, env vars set
export APP_JWT="<app-user-access-token>"
export STAFF_JWT="<brand-scanner-access-token>"
export CHALLENGE_ID="a0000000-0000-4000-8000-000000000021"

./scripts/test-qr-rewards.sh
```

Required env in `portal/.env.local`:

```bash
REWARD_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
REDEEM_BASE_URL=https://redeem.cada.app
QR_TTL_HOURS=24
```

---

## Checklist before ship

- [ ] Call `habit-completed` with stable `source_event_id` after knock-out sync
- [ ] Handle idempotent replay (`idempotent_replay: true`) without duplicate UI
- [ ] QR encodes HTTPS URL only — no PII
- [ ] Cache `reward.id` to deep-link reward screen
- [ ] Hide QR when `status` ≠ `issued` or past `expires_at`
- [ ] Consent copy: completing challenge shares status with brand (per privacy policy)

---

## Phase 6 preview

Staff web scanner at `redeem.cada.app/r/{token}` opens the portal landing page and auto-redeems after staff sign-in. See [api-phase6-scanner.md](api-phase6-scanner.md).
