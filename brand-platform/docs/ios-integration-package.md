# CADA iOS — Brand Partnerships Integration Package

**Audience:** iOS engineering (Swift)  
**Version:** 1.0 · Phases 4–6  
**You do not need to read backend code.** Everything required to ship is in this document and the companion Swift file.

| Resource | Path |
|----------|------|
| This guide | `docs/ios-integration-package.md` |
| Swift protocol + client | `docs/ios/CADABrandPartnershipsClient.swift` |
| OpenAPI 3.0 | `docs/openapi-mobile-v1.yaml` |
| QR deep-dive | `docs/qr-integration-guide-ios.md` |

---

## Quick reference

| Item | Value |
|------|-------|
| **Production base URL** | `https://api.cada.app/v1` |
| **Staging / local** | `https://<portal-host>/api/v1` (e.g. `http://localhost:3000/api/v1`) |
| **Auth** | `Authorization: Bearer <CADA app user JWT>` |
| **Content-Type** | `application/json` |
| **Identity** | CADA app user JWT only — brand staff tokens **will not work** |
| **Auto-provision** | First authenticated call creates `cada_users` row linked to JWT `sub` |

---

## End-to-end flow

```
Discover          Enroll           Knock out habit        Show QR
────────          ──────           ───────────────        ───────
GET               POST             POST                   GET (optional
/challenges/      /challenges/     /events/               re-open)
available         :id/enroll       habit-completed        /users/me/rewards/:id
                                                       │
                                                       ▼
                                              Encode qr_url in QR
                                              Staff scans → redeem (server)
```

**Important:** Circle feed / knock-out UI is unchanged. This API only adds **brand attribution** on top of your existing habit pipeline.

---

## 1. User stories & acceptance criteria

### US-1 — Discover brand challenge in app

**As a** CADA user  
**I want to** see active brand-sponsored challenges with clear offers  
**So that** I can decide to join and earn a reward

**Acceptance criteria**

- [ ] App calls `GET /challenges/available` when the Brand Challenges surface is shown (or on app foreground if cached > 15 min).
- [ ] Each card shows: brand name, logo (`brand.logo_url`), challenge title, `offer_headline`, linked `habit_type`, and optional `offer_code`.
- [ ] Challenges with `ends_at` in the past are not returned by the API; no client-side filter required.
- [ ] Empty state when `challenges` array is empty — hide section or show “No offers near you yet”.
- [ ] Tapping a card opens detail with full `description` and a **Join challenge** CTA.
- [ ] Feature flag `brands_challenges_enabled` off → section hidden, no API calls.

**API**

```http
GET /challenges/available
Authorization: Bearer <jwt>
```

```json
{
  "challenges": [{
    "id": "uuid",
    "title": "Try a class at Studio Flow",
    "description": "Complete one stretch habit…",
    "habit_type": "stretch",
    "offer_headline": "First class free",
    "offer_code": "CADA-STRETCH",
    "starts_at": "2026-06-05T00:00:00.000Z",
    "ends_at": "2026-07-05T00:00:00.000Z",
    "brand": {
      "id": "uuid",
      "name": "Studio Flow Yoga",
      "slug": "studio-flow-yoga",
      "logo_url": "https://…",
      "category": "wellness"
    }
  }],
  "meta": { "region": "all", "count": 1 }
}
```

---

### US-2 — Enroll in challenge

**As a** user who found an offer I like  
**I want to** join the challenge with one tap  
**So that** my next qualifying habit knock-out counts toward the reward

**Acceptance criteria**

- [ ] **Join** calls `POST /challenges/{id}/enroll` with empty body.
- [ ] On `201`, store `enrollment_id` locally (UserDefaults / Keychain / your persistence layer).
- [ ] On `200` with `already_enrolled: true`, treat as success — show “Already joined”.
- [ ] On `410`, show “This offer is no longer available”.
- [ ] On `404`, show “Offer not found”.
- [ ] Fire analytics `challenge_enrolled` (see §5).
- [ ] Show brief consent copy: completing the challenge shares completion status with the brand (no name in QR).

**API**

```http
POST /challenges/{challenge_id}/enroll
Authorization: Bearer <jwt>
Content-Type: application/json

{}
```

**Success `201`**

```json
{
  "enrollment_id": "uuid",
  "challenge_id": "uuid",
  "status": "active",
  "enrolled_at": "2026-06-26T12:00:00.000Z"
}
```

**Already enrolled `200`**

```json
{
  "enrollment_id": "uuid",
  "challenge_id": "uuid",
  "status": "active",
  "enrolled_at": "2026-06-20T10:00:00.000Z",
  "already_enrolled": true
}
```

---

### US-3 — See progress (My Habits or Brand Challenges)

**As a** enrolled user  
**I want to** see which challenges I joined and my progress  
**So that** I know what habit to complete and when I earned a reward

**Acceptance criteria**

- [ ] App calls `GET /users/me/challenges` on Brand Challenges tab and optionally on My Habits when user has ≥1 enrollment.
- [ ] Active enrollments show progress: `progress.current` / `progress.required` (MVP: always `1` for `single_completion`).
- [ ] Completed enrollments with `reward.issued == true` show **View reward** → deep link to reward screen via `reward.reward_id`.
- [ ] Link enrollments to habits UI: if user has active enrollment for `habit_type: stretch`, show a small “Studio Flow offer” badge on the stretch habit row (optional but recommended).
- [ ] Pull-to-refresh re-fetches enrollments.
- [ ] If multiple active enrollments share the same `habit_type`, pass `challenge_id` when reporting habit completion (US-4).

**API**

```http
GET /users/me/challenges
Authorization: Bearer <jwt>
```

```json
{
  "enrollments": [{
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
      "logo_url": "https://…"
    },
    "progress": {
      "rule": "single_completion",
      "required": 1,
      "current": 0,
      "completed": false
    },
    "reward": {
      "issued": false,
      "reward_id": null
    }
  }]
}
```

**UI placement (pick one for v1)**

| Option | When to use |
|--------|-------------|
| **Dedicated “Brand Challenges” tab/section** | Recommended — clearest UX, easiest rollout |
| **My Habits row badges** | Supplement — links enrolled habit types to offers |
| **Post-knock-out modal** | Only if enrollment exists for that habit type |

---

### US-4 — On completion, show QR reward with expiry countdown

**As a** user who completed a sponsored habit  
**I want to** see a QR code I can show at the business  
**So that** I can redeem my first-time offer before it expires

**Acceptance criteria**

- [ ] After existing knock-out is saved locally, app calls `POST /events/habit-completed` with stable `source_event_id` (= your knock-out / crush ID).
- [ ] If `attributed: true` and `reward` present, navigate to **Reward screen** immediately.
- [ ] If `attributed: false` with `reason: enrollment_already_completed`, open existing reward via stored `reward_id` or `GET /users/me/challenges`.
- [ ] Reward screen shows: brand name, offer headline, optional offer code, QR encoding `qr_url`, countdown to `expires_at`.
- [ ] QR uses **HTTPS URL only** — `https://redeem.cada.app/r/{token}` — never embed PII or JSON.
- [ ] If user leaves and returns, `GET /users/me/rewards/{id}` re-fetches display payload.
- [ ] When `status` is `redeemed`, `expired`, or `revoked`, or `qr_url` is `null` → hide QR, show appropriate message.
- [ ] Fire `challenge_completed` when attribution succeeds; fire `qr_shown` when QR is rendered.
- [ ] Do **not** log `qr_url` or token to analytics, crash reporters, or NSLog in production.

**Attribution request**

```http
POST /events/habit-completed
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "habit_type": "stretch",
  "completed_at": "2026-06-26T12:05:00.000Z",
  "source_event_id": "app-knockout-abc123",
  "challenge_id": "optional-uuid-if-ambiguous"
}
```

**Attributed success `200`**

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
    "expires_at": "2026-06-27T12:05:00.000Z",
    "status": "issued"
  }
}
```

**Not attributed `200`**

```json
{ "attributed": false, "reason": "no_matching_enrollment" }
```

| `reason` | User-facing copy (suggested) |
|----------|---------------------------|
| `no_matching_enrollment` | Silent — normal knock-out, no brand link |
| `enrollment_already_completed` | Open reward screen |
| `daily_cap_reached` | “Already counted today for this challenge” |
| `enrollment_not_active` | “This challenge is no longer active” |
| `invalid_completed_at` | Internal error — retry with valid ISO timestamp |

**Reward detail (re-open screen)**

```http
GET /users/me/rewards/{reward_id}
```

```json
{
  "id": "uuid",
  "enrollment_id": "uuid",
  "brand_id": "uuid",
  "challenge_id": "uuid",
  "status": "issued",
  "issued_at": "2026-06-26T12:05:00.000Z",
  "expires_at": "2026-06-27T12:05:00.000Z",
  "qr_url": "https://redeem.cada.app/r/<token>",
  "qr_payload": "https://redeem.cada.app/r/<token>",
  "brand_name": "Studio Flow Yoga",
  "challenge_title": "Try a class at Studio Flow",
  "offer_headline": "First class free",
  "offer_code": "CADA-STRETCH"
}
```

When not redeemable: `qr_url` and `qr_payload` are `null`, `status` is `expired` | `redeemed` | `revoked`.

---

## 2. API client interface

See **`docs/ios/CADABrandPartnershipsClient.swift`** for copy-paste-ready Swift:

- `BrandPartnershipsAPI` protocol
- `BrandPartnershipsModels` (Codable types)
- `URLSessionBrandPartnershipsClient` reference implementation
- `BrandPartnershipsError` enum mapped to HTTP + domain reasons

**Integration steps**

1. Add the Swift file to your networking module (or retype into your existing API layer).
2. Inject the user’s Supabase / CADA access token via `tokenProvider: () async throws -> String`.
3. Set `baseURL` per environment (see Quick reference).
4. Wire calls from your habit knock-out pipeline → `reportHabitCompleted`.
5. Unit-test with mocked protocol; integration-test against `scripts/test-mobile-api.sh` backend.

---

## 3. QR display specification

### Payload

| Field | Spec |
|-------|------|
| **Encode** | Full `qr_url` string (not token alone, not JSON) |
| **Format** | `https://redeem.cada.app/r/{token}` |
| **Token** | Base64url, ~43 characters, 256-bit opaque random |
| **PII** | None — no user ID, name, or email in QR |
| **Error correction** | QR **Level M** (default) — good balance for screen display |
| **Module size** | Minimum **4pt per module** at displayed size |
| **Quiet zone** | ≥ 4 modules white margin on all sides |
| **On-screen size** | **240×240 pt minimum** on iPhone; scale up on Plus/Max |
| **Contrast** | Black modules on **white** background — avoid colored QR backgrounds |

### Brightness & accessibility

- On reward screen `onAppear`, set `UIScreen.main.brightness` to **1.0** (save previous value, restore on `onDisappear`).
- Show helper text: “Increase brightness if the scanner has trouble reading.”
- Support Dynamic Type for offer copy; QR size stays fixed.

### Token rotation (MVP: **does not rotate**)

- One `qr_rewards` row per enrollment; token is fixed at issuance.
- Re-fetching `GET /users/me/rewards/:id` returns the **same** `qr_url` until `redeemed`, `expired`, or `revoked`.
- **Do not** poll for a new token. Only refresh when:
  - User opens reward screen (fetch latest `status`)
  - App returns from background and `expires_at` may have passed
  - Countdown hits zero → re-fetch once to confirm `expired`

### Offline behavior

| Scenario | Behavior |
|----------|----------|
| **Knock-out offline** | Queue `habit-completed` call; retry with same `source_event_id` when online (idempotent). |
| **Reward screen offline** | If `qr_url` was cached in memory from prior fetch, **may** display QR for in-store use. Show banner: “Offline — reward status may be outdated.” |
| **Never cached** | Require network for first reward display; show “Connect to load your reward.” |
| **Expiry while offline** | On reconnect, `GET /users/me/rewards/:id` — if `status: expired`, hide QR. |
| **Redeemed while offline** | On reconnect, refresh — show “Already used”. |

**Cache policy:** You may keep `reward_id`, `qr_url`, `expires_at`, `status` in memory for the active session only. Do not persist `qr_url` to disk long-term.

### Countdown UI

- Parse `expires_at` as ISO 8601 UTC.
- Display `Time remaining: 23h 14m` updating every minute (or every second in final 5 minutes).
- At `expires_at`, call `GET /users/me/rewards/:id` once; if expired, transition UI.

---

## 4. Error handling matrix

### Transport & HTTP

| Condition | HTTP | Response body | iOS action |
|-----------|------|---------------|------------|
| No network | — | — | Queue retry (habit-completed); show offline banner elsewhere |
| Invalid / expired JWT | 401 | `{ "error": "…" }` | Refresh CADA session; retry once |
| Validation error | 400 | `{ "error": "…" }` | Log non-fatal; fix request |
| Challenge not found | 404 | `{ "error": "…" }` | Remove stale UI |
| Already enrolled (race) | 409 | `{ "error": "…" }` | Treat as enrolled; refresh list |
| Challenge unavailable | 410 | `{ "error": "…" }` | Show “Offer ended” |
| Reward not found | 404 | `{ "error": "…" }` | Pop screen; refresh enrollments |
| Rate limited | 429 | `{ "error": "Rate limit exceeded" }` | Backoff 30s; retry |
| Server error | 500 | `{ "error": "…" }` | Retry with exponential backoff (max 3) |

### `habit-completed` domain (`attributed: false`)

| `reason` | Retry? | UX |
|----------|--------|-----|
| `no_matching_enrollment` | No | Silent — user wasn't enrolled or wrong habit |
| `enrollment_already_completed` | No | Navigate to reward |
| `daily_cap_reached` | No | Toast — already counted today |
| `enrollment_not_active` | No | Toast — challenge inactive |
| `invalid_completed_at` | Yes (fix timestamp) | Internal bug |

### Idempotent replay (`idempotent_replay: true`)

Same `source_event_id` sent twice → `attributed: true`, no double-count.  
**Do not** show duplicate celebration UI. Navigate to reward only if not already showing.

### Reward screen states (from `GET /users/me/rewards/:id`)

| `status` | `qr_url` | UI |
|----------|----------|-----|
| `issued` + before `expires_at` | non-null | Show QR + countdown |
| `issued` + past `expires_at` | null | “This reward has expired” |
| `expired` | null | “This reward has expired” |
| `redeemed` | null | “Already used at {brand_name}” |
| `revoked` | null | “No longer valid — contact support” |

### Staff redeem errors (support reference — **iOS does not call redeem**)

| HTTP | `error` | Meaning for user |
|------|---------|------------------|
| 404 | `invalid_token` | Scanner didn't recognize QR — check brightness |
| 410 | `expired` | Show expired state on next refresh |
| 409 | `already_redeemed` | Show “Already used” on next refresh |
| 403 | `wrong_brand` | User at wrong location — ask staff |

---

## 5. Analytics events

### Client-side (fire from iOS)

Use your existing analytics SDK (Amplitude, Mixpanel, etc.). **Never include `qr_url`, raw token, or PII** in properties.

#### `challenge_enrolled`

**When:** `POST /challenges/:id/enroll` returns `201` or `200` with `already_enrolled: true`.

| Property | Type | Example |
|----------|------|---------|
| `challenge_id` | string | uuid |
| `brand_id` | string | uuid |
| `habit_type` | string | `stretch` |
| `already_enrolled` | bool | false |
| `surface` | string | `discovery` \| `detail` \| `habits_badge` |

#### `challenge_completed`

**When:** `POST /events/habit-completed` returns `attributed: true` and `enrollment_status: completed` (including idempotent replay).

| Property | Type | Example |
|----------|------|---------|
| `challenge_id` | string | uuid (from request or enrollment) |
| `enrollment_id` | string | uuid |
| `habit_type` | string | `stretch` |
| `reward_id` | string | uuid |
| `idempotent_replay` | bool | false |

#### `qr_shown`

**When:** Reward screen renders QR (`qr_url` non-null, `status == issued`).

| Property | Type | Example |
|----------|------|---------|
| `reward_id` | string | uuid |
| `challenge_id` | string | uuid |
| `brand_id` | string | uuid |
| `seconds_until_expiry` | int | 82800 |

---

### Server-side — `qr_redeemed` (do not fire from iOS)

Redemption is performed by **brand staff scanner**, not the app. The server records:

- `redemptions` table — successful redeem with `redeemed_at`
- `redemption_attempts` — audit log (`success`, `already_redeemed`, etc.)

**iOS responsibility:** Optionally detect redemption by polling `GET /users/me/rewards/:id` when user opens reward screen or app foregrounds. When `status` changes from `issued` → `redeemed`, fire a **client** event for UX only:

#### `challenge_reward_redeemed_detected` (optional client event)

| Property | Type | Notes |
|----------|------|-------|
| `reward_id` | string | |
| `challenge_id` | string | |
| `brand_id` | string | |
| `detected_via` | string | `poll` \| `foreground_refresh` |

**Canonical `qr_redeemed` for reporting** lives in backend / warehouse (join `redemptions` → `qr_rewards` → `challenges`). Product analytics dashboards should use server data for redemption funnel, not client-only detection.

---

## 6. Feature flag recommendations

Use your existing flag system (LaunchDarkly, Firebase Remote Config, in-house). Suggested flags:

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `brands_challenges_enabled` | Boolean | `false` | Master kill switch — hides all brand UI and API calls |
| `brands_discovery_enabled` | Boolean | `false` | `GET /challenges/available` + discovery cards |
| `brands_enrollment_enabled` | Boolean | `false` | Allow `POST …/enroll` |
| `brands_attribution_enabled` | Boolean | `false` | Call `habit-completed` after knock-outs |
| `brands_qr_rewards_enabled` | Boolean | `false` | Show reward / QR screen |
| `brands_surface` | String | `dedicated_tab` | `dedicated_tab` \| `habits_section` \| `both` |
| `brands_rollout_pct` | Int 0–100 | `0` | Percentage rollout by `user_id` hash |

### Rollout plan

1. **Internal dogfood** — `brands_challenges_enabled=true` for `@cada.app` emails only (allowlist).
2. **1%** — enable discovery + enrollment; attribution off; verify API volume.
3. **5%** — enable attribution; monitor completion rate.
4. **10%** — enable QR rewards end-to-end with one pilot brand.
5. **50% → 100%** — expand after redemption funnel stable.

### Kill switch

Set `brands_challenges_enabled=false` to instantly hide UI. Queued offline `habit-completed` calls should check flag before retry to avoid surprise attributions after incident.

---

## 7. Attribution rules (must-read)

| Rule | Behavior |
|------|----------|
| Enrollment required | Knock-outs count only **after** enroll |
| Habit type match | `habit_type` must match challenge exactly |
| Challenge active | `status=active`, within `starts_at` / `ends_at` |
| MVP completion | `single_completion` — one attributed knock-out completes enrollment |
| Idempotency | Same `source_event_id` → same response, no double-count |
| Daily cap | Max **one** attributed completion per enrollment per **UTC calendar day** |
| Circle feed | Unchanged — this API does not drive feed |

`source_event_id` **must** be your existing knock-out / crush event ID (stable, unique per habit event).

---

## 8. Rate limits

| Endpoint | Limit |
|----------|-------|
| `POST /events/habit-completed` | 120 / min / user |
| `GET /users/me/rewards/:id` | 60 / min / user |

On `429`, backoff and retry — do not hammer.

---

## 9. Habit types (enum)

Must match exactly in enroll, discover, and habit-completed:

`gym` · `text_friend` · `call_family` · `journal` · `stretch` · `run` · `custom`

---

## 10. Local integration testing

Backend team runs:

```bash
export APP_JWT="<cada-app-user-access-token>"
export CHALLENGE_ID="a0000000-0000-4000-8000-000000000021"
./scripts/test-mobile-api.sh
./scripts/test-qr-rewards.sh
```

**iOS checklist before TestFlight**

- [ ] Bearer token attached on all calls
- [ ] `habit-completed` uses stable `source_event_id`
- [ ] `challenge_id` sent when multiple enrollments share habit type
- [ ] Idempotent replay does not duplicate UI
- [ ] QR encodes HTTPS URL only
- [ ] `qr_url` excluded from logs and analytics
- [ ] Reward screen handles expired / redeemed / revoked
- [ ] Brightness boost on reward screen
- [ ] Feature flags wired with kill switch
- [ ] Offline queue for `habit-completed` with idempotent retry

---

## 11. Support & contacts

| Question | Doc |
|----------|-----|
| API field definitions | `openapi-mobile-v1.yaml` |
| QR / token design | `qr-integration-guide-ios.md` |
| Staff scanner / redeem | `api-phase6-scanner.md` (not iOS) |
| Brand dashboard metrics | `api-phase7-metrics.md` (not iOS) |

**Staging credentials:** Request `APP_JWT` test user from backend / platform team.

---

*This package is self-contained. No architecture meeting required to begin implementation.*
