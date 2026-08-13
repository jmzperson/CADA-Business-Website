# CADA Brand Platform

Partner portal + mobile API for **brand-sponsored challenges**. Brands create campaigns in the web portal; CADA admins approve them; the **Swift iOS CADA app** discovers, enrolls, and completes them over the shared Firebase backend.

## How it connects to the iOS app

This repo and the Swift iOS app share Firebase project **`cada-4ed7c`** (same Auth + Firestore).

| Surface | Who | Identity in Firestore |
|---------|-----|------------------------|
| **Swift iOS app** | End users (habits, feed, brand challenges) | `users/{uid}` (+ partnership `cada_users` auto-provisioned on first mobile API call) |
| **Partners portal** | Brand staff | `brand_staff` / `brands` |
| **Admin queue** | CADA platform admins | Email allowlist (`CADA_ADMIN_EMAILS`) + optional `cadaAdmin` claim |

**Flow**

```text
Brand creates challenge (portal)
  → Submit for review → pending_review
  → CADA admin approves at /admin/challenges → active
  → iOS calls GET /api/v1/challenges/available
  → User joins via POST /api/v1/challenges/:id/enroll
  → Habit knock-out → POST /api/v1/events/habit-completed → QR reward
```

Personal/group challenges users create **inside the iOS app** are separate (e.g. `users/{uid}/personal_incomplete`). Brand challenges do **not** auto-write into that collection; the app must use the mobile API.

**iOS integration (start here):** [docs/ios-integration-package.md](docs/ios-integration-package.md) · Swift client: [docs/ios/CADABrandPartnershipsClient.swift](docs/ios/CADABrandPartnershipsClient.swift) · Mac paste prompt: [docs/ios/MAC-CURSOR-PROMPT.md](docs/ios/MAC-CURSOR-PROMPT.md)

## Production

| Item | Value |
|------|--------|
| Portal | https://the-cada-portal.vercel.app |
| Mobile API base | `https://the-cada-portal.vercel.app/api/v1` |
| Firebase project | `cada-4ed7c` |
| Vercel root | `brand-platform/portal` |

Set `NEXT_PUBLIC_APP_URL=https://the-cada-portal.vercel.app`. Add that host under Firebase Auth → Authorized domains (password reset / action links).

## Local portal

```bash
cd brand-platform/portal
cp .env.example .env.local   # Firebase web config + FIREBASE_SERVICE_ACCOUNT_JSON
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Setup: [Firebase portal setup](portal/docs/firebase-portal-setup.md) · [Vercel deploy checklist](portal/docs/vercel-deploy-checklist.md)

## Who does what

### Brand partners (`/dashboard`)

- Sign up / login / password reset
- Brand profile, staff invites (`admin` | `scanner`)
- Challenge CRUD: draft → **Submit for review** → wait for approval → end campaigns
- Metrics, redemptions log, web QR scanner (`/scan`)

### CADA admins (`/admin/challenges`)

Approve or reject `pending_review` challenges before they appear in the iOS app.

Default allowlist (override with env):

```bash
CADA_ADMIN_EMAILS=james@cadaapp.com,tannermesaric@gmail.com
```

Admins sign in at `/login` and land on `/admin/challenges`.

Optional notify on submit:

```bash
CHALLENGE_NOTIFY_EMAIL=james@cadaapp.com
RESEND_API_KEY=re_...
RESEND_FROM=CADA Partners <notifications@cadaapp.com>
```

### iOS app users (mobile API)

Auth: `Authorization: Bearer <Firebase ID token>` from the signed-in CADA app user (not brand staff tokens).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/challenges/available` | Active brand challenges to join |
| `POST /api/v1/challenges/:id/enroll` | Join |
| `GET /api/v1/users/me/challenges` | Enrollment progress |
| `POST /api/v1/events/habit-completed` | Attribute knock-out → issue QR |
| `GET /api/v1/users/me/rewards/:id` | Reward + QR payload |

More: [Mobile API](docs/api-mobile-phase4.md) · [OpenAPI](docs/openapi-mobile-v1.yaml) · [QR guide](docs/qr-integration-guide-ios.md)

## Portal routes

```text
/dashboard                     Brand home + metrics
/dashboard/challenges          List challenges
/dashboard/challenges/new      Create draft
/dashboard/challenges/:id/edit Manage / submit for review
/dashboard/redemptions         Redemptions log
/dashboard/staff               Staff invites
/scan                          Web QR scanner
/admin/challenges              CADA approval queue
```

Challenge status: **draft** → **pending_review** → **active** (live for iOS) → **ended**.

## Docs index

| Doc | Purpose |
|-----|---------|
| [ios-integration-package.md](docs/ios-integration-package.md) | Swift team integration guide |
| [CADABrandPartnershipsClient.swift](docs/ios/CADABrandPartnershipsClient.swift) | Reference API client |
| [api-mobile-phase4.md](docs/api-mobile-phase4.md) | Mobile REST details |
| [api-phase3.md](docs/api-phase3.md) | Brand challenge APIs |
| [qr-integration-guide-ios.md](docs/qr-integration-guide-ios.md) | QR display + redeem |
| [api-phase6-scanner.md](docs/api-phase6-scanner.md) | Staff scanner |
| [api-phase7-metrics.md](docs/api-phase7-metrics.md) | Dashboard metrics |
| [api-phase8-bridge.md](docs/api-phase8-bridge.md) | Marketing site → leads |
| [firebase-portal-setup.md](portal/docs/firebase-portal-setup.md) | Firebase + portal env |
| [vercel-deploy-checklist.md](portal/docs/vercel-deploy-checklist.md) | Deploy |

## Legacy note (Supabase / SQL)

Early design docs and `supabase/migrations/*.sql` describe a PostgreSQL + RLS approach. **Production runs on Firebase Auth + Firestore** in `portal/`. Treat the SQL migrations and older “Phase 1” Postgres quick-start as historical reference unless you are explicitly reviving that path.
