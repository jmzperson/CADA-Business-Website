# Portal Vercel deploy checklist

Use this for the **partner portal** — a **separate** Vercel project from the marketing site (`cada-website-stitch` / www.cadaapp.org).

## 1. Create the Vercel project

1. [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
2. **Root Directory:** `brand-platform/portal`
3. **Framework:** Next.js (auto-detected)
4. Deploy once (will fail or be incomplete until env vars are set).

## 2. Environment variables (portal project)

Copy from `brand-platform/portal/.env.example`. **All of these matter:**

### Firebase — client (browser login UI)

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | From Firebase Console → Project settings → Web app |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `cada-4ed7c.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `cada-4ed7c` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `cada-4ed7c.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase web config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | From Firebase web config |

### Firebase — server (required for all API routes)

| Variable | How to get it |
|----------|----------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Console → Project settings → Service accounts → **Generate new private key** → paste full JSON or base64 into Vercel |

Without this, every server route throws and `/api/health` returns 503.

### App URL

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://partners.cadaapp.com` (or your Vercel URL until custom domain is live) |

### Email (production)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Verification + challenge review emails |
| `RESEND_FROM` | e.g. `CADA Partners <notifications@cadaapp.com>` |
| `CHALLENGE_NOTIFY_EMAIL` | `james@cadaapp.com` |

Local dev only: `SKIP_EMAIL_VERIFICATION=true`

### Admin & cron

Generate secrets with `openssl rand -hex 24`:

| Variable | Purpose |
|----------|---------|
| `CADA_ADMIN_TOKEN` | `/admin/challenges` approve/reject |
| `LEADS_ADMIN_TOKEN` | `/admin/leads` |
| `CRON_SECRET` | `/api/v1/cron/*` |
| `REWARD_TOKEN_ENCRYPTION_KEY` | QR rewards (`openssl rand -base64 32`) |

### Marketing site bridge

| Variable | Purpose |
|----------|---------|
| `MARKETING_SITE_ORIGINS` | CORS for `POST /api/leads` from your marketing site |

Include every domain that hosts the static site, e.g.:

```
https://www.cadaapp.org,https://cadaapp.com,https://www.cadaapp.com
```

## 3. Redeploy

After saving env vars: **Deployments → ⋯ → Redeploy**.

Env changes do not apply to existing deployments until you redeploy.

## 4. Firebase Console (`cada-4ed7c`)

- [ ] Authentication → Email/Password enabled
- [ ] Firestore database created
- [ ] Storage enabled
- [ ] Auth → Authorized domains: `localhost`, your Vercel URL, `partners.cadaapp.com`

## 5. Deploy Firestore indexes + rules + storage rules

From `brand-platform/portal`:

```bash
npm install -g firebase-tools   # if needed
firebase login
npm run firebase:deploy
```

Or manually:

```bash
cd brand-platform/portal
firebase deploy --only firestore:indexes,firestore:rules,storage --project cada-4ed7c
```

## 6. Custom domain

Vercel → portal project → **Settings → Domains** → add `partners.cadaapp.com`.

Update `NEXT_PUBLIC_APP_URL` to match → redeploy.

Marketing site links: `js/portal-links.js` → `CADA_PARTNERS_URL`.

## 7. Verify backend connection

```bash
# Replace with your portal URL
curl -s https://partners.cadaapp.com/api/health | jq .
```

Expected:

```json
{
  "ok": true,
  "project": "cada-4ed7c",
  "checks": { "publicConfig": true, "adminSdk": true, "firestore": true }
}
```

Or run the smoke script:

```bash
BASE_URL=https://partners.cadaapp.com brand-platform/scripts/test-portal-smoke.sh
```

## 8. End-to-end partner test (invite-only)

Partners **cannot** self-register on `/signup`. You invite them from CADA admin:

```bash
curl -X POST 'https://YOUR-PORTAL-URL/api/admin/partners/invite?token=YOUR_CADA_ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "business_name": "Test Brand",
    "email": "partner@example.com",
    "category": "retail"
  }'
```

The partner receives an email with a link to `/invite?token=…` where they set their password.

1. Partnership form on marketing site → lead in Firestore `partnership_leads`
2. You run the invite API (or share `invite_url` from the response if email fails)
3. Partner opens invite link → sets password → `/dashboard`

For local dev only, you can re-enable open registration: `ALLOW_PUBLIC_SIGNUP=true`

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `FIREBASE_SERVICE_ACCOUNT_JSON is required` | Add service account JSON to **portal** Vercel project, redeploy |
| `/api/health` 503, `publicConfig: false` | Add all `NEXT_PUBLIC_FIREBASE_*` vars |
| Signup blocked (403) on production | Expected — use `/api/admin/partners/invite` instead |
| `auth/operation-not-allowed` | Enable Email/Password in Firebase Auth |
| Firestore index error | Run `npm run firebase:deploy` from portal |
| Partnership form → portal lead fails | Add marketing domain to `MARKETING_SITE_ORIGINS` |

## Two Vercel projects (don’t mix them up)

| Project | Root directory | Domain | Key env var |
|---------|----------------|--------|-------------|
| Marketing site | repo root | www.cadaapp.org | `GOOGLE_APPS_SCRIPT_URL` |
| Partner portal | `brand-platform/portal` | partners.cadaapp.com | `FIREBASE_SERVICE_ACCOUNT_JSON` |

See also: [firebase-portal-setup.md](./firebase-portal-setup.md)
