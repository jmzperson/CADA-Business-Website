# CADA Brand Partnerships Platform — Architecture & MVP Scope

**Version:** 0.1  
**Date:** June 2026  
**Status:** Pre-implementation  
**Audience:** Engineering, product, iOS team  

---

## Executive summary

CADA today is a **social habit tracker** (iOS app with circles, feeds, knock-outs/crushes) plus a **static marketing site** (this repo). The brand partnerships platform is a **new product surface**: a web portal for businesses, APIs consumed by the iOS app, and a QR redemption loop that turns sponsored habits into measurable foot traffic.

The MVP proves one closed loop:

> Brand publishes challenge → User enrolls in app → User completes linked habit → App issues QR → Staff scans → Redemption recorded → Dashboard metrics update.

Everything else is V2+.

---

## 1. MVP vs V2 scope

### MVP (ship first)

| Area | In scope |
|------|----------|
| **Brand portal** | Signup, login, profile (name, logo, category), one admin per brand |
| **Staff** | Invite 1+ scanner staff; scanner role can only scan + view dashboard |
| **Challenges** | Create/edit/publish/end one active challenge per brand; link to existing habit type |
| **Offer** | First-time offer text + optional promo code stored on challenge |
| **App API** | List active challenges, enroll, report habit completion, fetch QR reward |
| **QR** | Issue on challenge completion; 24h expiry; one-time redeem |
| **Redeem** | Web scanner page (camera + manual fallback); atomic redeem |
| **Dashboard** | KPI cards + funnel + redemptions log (aggregates, minimal PII) |
| **Marketing bridge** | Partnerships page CTA → brand signup |
| **Locations** | Optional single `brand_location` field on brand profile (no multi-location UI) |

### V2 (explicitly later)

| Area | Deferred |
|------|----------|
| Multiple locations with per-location metrics |
| CSV export, scheduled email reports |
| Circle-level analytics (“3 of 5 in circle tried you”) |
| In-app scanner for staff (native) |
| Challenge templates, A/B copy, scheduled auto-start |
| Brand billing / self-serve plans |
| Influencer/creator-linked challenges |
| Offline redeem with delayed sync |
| Internal admin CRM (lead pipeline beyond simple table) |
| Auto-surface first-time offer in app UI before QR |
| Fraud ML, device binding, rotating QR |

### MVP success criteria

- One pilot brand can run a 2-week challenge with real users.
- Redemption rate and enrollment counts are trustworthy.
- No brand can read another brand’s data.
- QR cannot be redeemed twice or after expiry.

---

## 2. User roles

| Role | Surface | Permissions |
|------|---------|-------------|
| **CADA end user** | iOS app | Discover challenges, enroll, complete habits (existing), view/show QR reward |
| **Brand admin** | Web portal | Full brand profile, CRUD challenges, invite staff, view all metrics, access scanner |
| **Brand staff (scanner)** | Web portal | `/scan` + read-only dashboard; cannot edit challenges or billing |
| **CADA internal admin** | Internal tool (MVP: DB/scripts) | Approve brands, view cross-brand metrics, revoke QR, support |

**Auth separation:** Brand users and CADA app users are **different identity pools**. A gym owner is not a CADA app user unless they also install the app. Link only via business logic, not shared login.

---

## 3. Core entities and relationships

### Entity-relationship overview

```
Brand 1──* BrandStaff
Brand 1──* BrandLocation (optional MVP: 0–1)
Brand 1──* Challenge
Challenge 1──* UserChallengeEnrollment *──1 CadaUser (existing app user)
CadaUser 1──* HabitCompletionEvent (existing or mirrored)
UserChallengeEnrollment 1──0..1 QRReward
QRReward 1──0..1 Redemption
Redemption *──1 BrandStaff (scanner)
```

### Entity definitions

#### `brands`
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| name | text | Display name |
| slug | text | Unique, URL-safe |
| logo_url | text | Optional |
| category | enum | gym, food, wellness, retail, other |
| website | text | Optional |
| offer_default_copy | text | Optional template |
| status | enum | pending, active, suspended |
| created_at | timestamptz | |

#### `brand_locations` (optional MVP)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| brand_id | UUID | FK |
| name | text | e.g. "SoHo Studio" |
| address | text | Optional |
| created_at | timestamptz | |

MVP default: skip table; store `primary_address` on `brands` if needed.

#### `brand_staff`
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| brand_id | UUID | FK |
| email | text | Unique per brand |
| role | enum | admin, scanner |
| auth_user_id | UUID | FK to auth provider user |
| invited_at | timestamptz | |
| accepted_at | timestamptz | Nullable until invite accepted |

#### `challenges`
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| brand_id | UUID | FK |
| title | text | e.g. "Try a class at [Brand]" |
| description | text | |
| habit_type | enum | Maps to app: `gym`, `text_friend`, `call_family`, `journal`, `stretch`, `run`, `custom` |
| offer_headline | text | e.g. "First class free" |
| offer_code | text | Optional promo code |
| status | enum | draft, active, ended |
| starts_at | timestamptz | |
| ends_at | timestamptz | Nullable |
| completion_rule | enum | MVP: `single_completion` (one knock-out of linked habit) |
| max_redemptions | int | Nullable cap |
| published_at | timestamptz | Nullable |
| created_at | timestamptz | |

#### `user_challenge_enrollments`
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| challenge_id | UUID | FK |
| user_id | UUID | FK → existing CADA `users.id` |
| status | enum | active, completed, expired |
| enrolled_at | timestamptz | |
| completed_at | timestamptz | Nullable |
| completion_count | int | Default 0; MVP uses 0 or 1 |

Unique constraint: `(challenge_id, user_id)`.

#### `habit_completion_events` (attribution layer)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| user_id | UUID | |
| habit_type | enum | |
| completed_at | timestamptz | |
| source_event_id | text | Idempotency key from app (existing knock-out ID) |
| enrollment_id | UUID | Nullable FK if attributed to challenge |

**Integration note:** Prefer **not duplicating** full habit storage. App sends completion events; this table links them to enrollments. If the iOS backend already stores completions, add a webhook or internal API call instead of a second source of truth.

#### `qr_rewards`
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| enrollment_id | UUID | FK unique (one QR per enrollment in MVP) |
| brand_id | UUID | Denormalized for redeem auth |
| token_hash | text | SHA-256 of raw token; never store raw token |
| status | enum | issued, redeemed, expired, revoked |
| issued_at | timestamptz | |
| expires_at | timestamptz | |
| redeemed_at | timestamptz | Nullable |

#### `redemptions`
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| qr_reward_id | UUID | FK unique |
| brand_id | UUID | |
| staff_id | UUID | FK brand_staff |
| location_id | UUID | Nullable |
| redeemed_at | timestamptz | |
| metadata | jsonb | Optional: user_agent, ip hash |

#### `redemption_attempts` (audit)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| token_hash | text | |
| brand_id | UUID | Nullable |
| staff_id | UUID | Nullable |
| outcome | enum | success, invalid, expired, already_redeemed, wrong_brand |
| created_at | timestamptz | |

---

## 4. Key user flows

### Flow A — Brand onboarding → published challenge

1. Brand clicks **Partner with CADA** on marketing site → `partners.cada.app/signup`.
2. Enters business email, password, business name.
3. Verifies email (magic link or code).
4. Completes profile: logo, category, optional offer boilerplate.
5. CADA internal admin approves brand (`status: active`) — **MVP manual gate** or auto-approve for pilot.
6. Admin creates challenge: selects habit type (e.g. `gym`), writes offer copy, sets dates.
7. Clicks **Publish** → `status: active`, challenge visible via `GET /v1/challenges`.
8. Dashboard shows empty metrics until enrollments arrive.

### Flow B — User discovers → enrolls → completes → QR

1. User opens CADA app (authenticated via existing app session).
2. App calls `GET /v1/challenges` → shows sponsored card(s).
3. User taps **Join** → `POST /v1/challenges/{id}/enroll` → enrollment `active`.
4. User knocks out linked habit (existing app flow) → circle feed updates as today.
5. App calls `POST /v1/events/habit-completed` with `{ habit_type, completed_at, source_event_id }`.
6. API matches active enrollment + habit_type → marks enrollment `completed`, increments attribution.
7. API issues `qr_reward` → returns `reward_id`, `expires_at`.
8. App shows **QR screen** with payload URL `https://redeem.cada.app/r/{raw_token}` (token only in app memory/QR, not logs).

### Flow C — Staff scans → redeem → metrics

1. Staff logs into portal → navigates to **Scan** (mobile-friendly).
2. Camera reads QR → extracts token from URL path.
3. Portal calls `POST /v1/redeem` with `{ token }` + staff JWT.
4. API hashes token, looks up `qr_rewards`, validates brand match, expiry, status.
5. Transaction: update reward → `redeemed`, insert `redemptions`, insert audit success.
6. UI shows green **Redeemed** confirmation (no user full name in MVP).
7. Dashboard KPIs increment on next load (or realtime if websocket added later).

### Failure paths (must be explicit in UX)

| Case | API response | Staff UI |
|------|--------------|----------|
| Invalid token | 404 `invalid_token` | "QR not recognized" |
| Expired | 410 `expired` | "This reward has expired" |
| Already redeemed | 409 `already_redeemed` | "Already used" |
| Wrong brand staff | 403 `wrong_brand` | "Not valid at this business" |

---

## 5. API surface (REST)

Base URL: `https://api.cada.app/v1`  
Format: JSON  
Auth: `Authorization: Bearer <jwt>` unless noted.

### Brand portal (brand staff JWT)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/brands/register` | Signup |
| POST | `/auth/login` | Email/password → JWT |
| GET | `/brands/me` | Current brand profile |
| PATCH | `/brands/me` | Update profile |
| POST | `/brands/staff/invite` | Admin invites scanner |
| GET | `/brands/staff` | List staff |
| GET | `/brands/challenges` | List challenges |
| POST | `/brands/challenges` | Create draft |
| PATCH | `/brands/challenges/{id}` | Edit draft |
| POST | `/brands/challenges/{id}/publish` | Activate |
| POST | `/brands/challenges/{id}/end` | End early |
| GET | `/brands/metrics` | Dashboard aggregates |
| GET | `/brands/metrics/challenges/{id}` | Per-challenge metrics |
| GET | `/brands/redemptions` | Paginated log |
| POST | `/redeem` | Scanner redeems token |

### Mobile app (CADA user JWT — existing app auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/challenges` | Active challenges for user |
| POST | `/challenges/{id}/enroll` | Join challenge |
| GET | `/users/me/challenges` | My enrollments + progress |
| POST | `/events/habit-completed` | Idempotent completion |
| GET | `/users/me/rewards/{id}` | Reward details + QR payload material |

### Example shapes

**POST `/challenges/{id}/enroll`**
```json
// Request: empty body
// Response 201
{
  "enrollment_id": "uuid",
  "challenge_id": "uuid",
  "status": "active",
  "enrolled_at": "2026-06-26T12:00:00Z"
}
```

**POST `/events/habit-completed`**
```json
// Request
{
  "habit_type": "gym",
  "completed_at": "2026-06-26T12:05:00Z",
  "source_event_id": "app-knockout-abc123"
}
// Response 200 (attributed)
{
  "attributed": true,
  "enrollment_id": "uuid",
  "enrollment_status": "completed",
  "reward": {
    "id": "uuid",
    "qr_url": "https://redeem.cada.app/r/<token>",
    "expires_at": "2026-06-27T12:05:00Z"
  }
}
```

**POST `/redeem`**
```json
// Request
{ "token": "raw-token-from-qr" }
// Response 200
{
  "status": "redeemed",
  "redeemed_at": "2026-06-26T14:00:00Z",
  "challenge_title": "Try a class at Studio X"
}
```

**GET `/brands/metrics?range=30d`**
```json
{
  "range": "30d",
  "enrolled": 142,
  "completed": 89,
  "qr_issued": 89,
  "qr_redeemed": 61,
  "redemption_rate": 0.685,
  "funnel": {
    "enrolled": 142,
    "completed": 89,
    "redeemed": 61
  }
}
```

---

## 6. QR token design

### Recommendation: **opaque random token + server-side lookup** (not JWT for MVP)

| Approach | Pros | Cons |
|----------|------|------|
| **Opaque ID (recommended)** | Revocable, simple redeem logic, no clock skew issues | Requires DB lookup every scan |
| Signed JWT | Stateless verify | Harder to revoke; expiry-only invalidation |

### Specification

1. Generate `raw_token` = 32 bytes cryptographically random → base64url (~43 chars).
2. Store `token_hash = SHA-256(raw_token)` in `qr_rewards`; **never** store raw token.
3. QR encodes: `https://redeem.cada.app/r/{raw_token}` (HTTPS only).
4. **One-time use:** redeem sets `status = redeemed`; unique constraint on `redemptions.qr_reward_id`.
5. **Expiry:** `expires_at = issued_at + 24 hours` (configurable per challenge in V2).
6. **Replay:** second redeem with same token → `409 already_redeemed` (idempotent response body).
7. **Brute force:** rate limit `/redeem` per staff IP + per brand (e.g. 60/min); lock after 10 failures.
8. **Screenshot sharing:** short TTL mitigates; V2 can add rotating QR (new token every 60s while screen open).

### Why not put user PII in QR

QR may be photographed. Payload should only contain unguessable token — staff learns nothing until server validates.

---

## 7. Privacy & consent

### What brands see in MVP

| Data | Visible? |
|------|----------|
| Aggregate enrollment/completion/redemption counts | Yes |
| Redemption timestamp + challenge name | Yes |
| Staff member who scanned | Yes (internal to brand) |
| User display name | **No** (default) |
| User email / phone | **No** |
| Circle membership | **No** |
| Anonymized user label | Optional: "User #A4F2" in redemptions log |

### What users consent to (in-app copy required)

- Opting into a brand challenge shares **completion status** with that brand.
- Showing QR at business is voluntary redemption of offer.
- CADA is not selling personal data; brands receive aggregated attribution.

### GDPR / compliance checklist (MVP)

- [ ] Privacy policy update: brand partnership section
- [ ] Challenge enroll = explicit tap consent
- [ ] Data retention: redemptions kept 24 months; audit logs 90 days
- [ ] User can delete account → anonymize enrollments (`user_id` nulled, counts preserved)
- [ ] Brand contract: DPA for processors (Supabase/AWS)

---

## 8. Authentication

### Brand portal

- **Provider:** Supabase Auth or Clerk (email/password + magic link).
- **JWT claims:** `sub` (auth user id), `brand_id`, `role` (admin | scanner).
- **Session:** HTTP-only cookie for web; Bearer for API clients.
- **Invite flow:** Admin sends invite → email link → staff sets password → `accepted_at` set.

### CADA iOS app users

- **Use existing app auth** (whatever issues user JWT today — likely same backend).
- Brand APIs validate user JWT on mobile routes; `user_id` from token `sub`.
- **Do not** merge brand auth into app login.

### Scanner

- Same brand staff JWT as portal.
- `/redeem` requires `role IN (admin, scanner)` and `brand_id` matches reward’s brand.

### CADA internal admin

- MVP: separate admin flag in DB + env allowlist.
- V2: proper admin portal.

---

## 9. Tech stack recommendation

This repo (`CADA-Website-Stitch`) is **static HTML only** — no backend. The brand platform is a **new codebase** (or monorepo folder) that integrates with the **existing iOS app backend** for user identity and habit events.

### Recommended stack (MVP)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Brand portal** | Next.js 14 (App Router) + TypeScript | SSR auth, API routes, fast dashboards, good DX |
| **Database** | PostgreSQL via **Supabase** | RLS for brand isolation, auth built-in, realtime optional later |
| **ORM** | Drizzle or Prisma | Type-safe migrations; Drizzle lighter for serverless |
| **API** | Next.js Route Handlers or separate **Hono** service on Fly.io | Start colocated; split if iOS traffic isolates |
| **Auth** | Supabase Auth | Brand users; map to `brand_staff.auth_user_id` |
| **File storage** | Supabase Storage | Brand logos |
| **Hosting** | Vercel (portal) + Supabase (DB) | Low ops for pilot |
| **QR scanner** | Browser `BarcodeDetector` API + fallback manual entry | No native app required for MVP |
| **Marketing site** | Keep static; link to `partners.cada.app` | No merge required |

### Connection to existing iOS backend

**Assumption:** iOS app already has a backend with `users`, habit knock-outs, and JWT auth.

**Integration pattern (choose one in open questions):**

1. **Extend existing API (preferred if you own it):** Add `/v1/challenges/*` routes to current backend; single user table.
2. **Sidecar service:** New `brand-service` DB + APIs; iOS calls both; sync user_id via shared UUID from main auth.
3. **Event bus:** iOS publishes `habit.completed` to queue; brand service subscribes (heavier, V2).

MVP recommendation: **Option 1 or 2** depending on whether the iOS backend is in your control and tech stack. If backend is Firebase, use Firebase Functions + Firestore with same entity model adapted.

### Domains

| Domain | Purpose |
|--------|---------|
| `cada.app` | Marketing (static) |
| `partners.cada.app` | Brand portal + dashboard |
| `redeem.cada.app` | Scanner UI (can be same app as partners) |
| `api.cada.app` | REST API (portal + mobile) |

---

## 10. Build order (phases with dependencies)

```
Phase 0  Architecture doc (this document)
   ↓
Phase 1  Database schema + RLS + seed data
   ↓
Phase 2  Brand auth + profile + staff invites
   ↓
Phase 3  Challenge CRUD + publish (portal only)
   ↓
Phase 4  Mobile API: list, enroll, habit-completed (stub reward)
   ↓
Phase 5  QR issuance + app reward endpoint
   ↓
Phase 6  Redeem API + web scanner
   ↓
Phase 7  Dashboard metrics + redemptions log
   ↓
Phase 8  Marketing site CTA → signup + lead capture
   ↓
Phase 9  iOS integration guide + Swift client stubs
   ↓
Phase 10 Hardening, tests, staging, launch checklist
```

**Critical path:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 (iOS) can start after 5 with mocked QR.

**Parallelizable:** Phase 8 anytime after Phase 2; Phase 10 throughout.

---

## 11. Open questions (with recommended defaults)

| # | Question | Options | **Recommended default (MVP)** |
|---|----------|---------|------------------------------|
| 1 | When is QR issued? | First habit complete vs challenge fully complete vs first visit | **On first attributed habit completion** after enroll |
| 2 | One challenge per user per brand? | Single vs multiple concurrent | **One active enrollment per challenge; user can enroll in multiple brands** |
| 3 | Habit match rule | Exact habit_type vs any habit | **Exact match** to `challenge.habit_type` |
| 4 | Brand approval | Auto vs manual | **Manual approve first 10 brands; auto after** |
| 5 | What brands see on redeem | Anonymous vs first name | **Anonymous** ("Reward redeemed") |
| 6 | QR TTL | 15 min / 24h / 7d | **24 hours** |
| 7 | iOS backend integration | Extend vs sidecar | **Sidecar if backend is closed; extend if you own monolith** |
| 8 | Scanner surface | Web only vs in-app | **Web scanner only** for MVP |
| 9 | Completion idempotency | Per day vs per event | **Per `source_event_id`** (one knock-out = one completion) |
| 10 | Pilot geography | National vs city | **No geo filter MVP**; all active challenges visible |

---

## Appendix A — Dashboard metrics definitions

| Metric | Definition |
|--------|------------|
| **Enrolled** | Count of `user_challenge_enrollments` for challenge/brand |
| **Completed** | Enrollments with `status = completed` |
| **QR issued** | `qr_rewards` with `status IN (issued, redeemed)` |
| **QR redeemed** | `qr_rewards.status = redeemed` |
| **Redemption rate** | redeemed / issued (exclude expired un-redeemed from denominator optional — document as `redeemed / (issued - expired)`) |
| **Active this week** | Users with ≥1 `habit_completion_event` in 7 days linked to enrollment |

---

## Appendix B — Habit type enum (align with iOS)

Sync this table with the app team before Phase 4:

| `habit_type` | App display | Example brand |
|--------------|-------------|---------------|
| `gym` | Knocked Out · Gym | Equinox, Barry's |
| `text_friend` | Crushed · Text a Friend | — |
| `call_family` | Call Family | — |
| `run` | Run | — |
| `stretch` | Stretch | Yoga studio |
| `journal` | Journal | — |

---

## Appendix C — Next prompt

Use **Prompt 1** from the build series:

> Implement Phase 1: database schema and security model from `docs/brand-platform-mvp.md`.

No implementation code belongs in this document revision; schema SQL is Phase 1.

---

*End of document.*
