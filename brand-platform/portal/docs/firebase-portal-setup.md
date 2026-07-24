# Firebase portal setup

This guide covers deploying the CADA brand portal (`brand-platform/portal`) on Firebase project **cada-4ed7c**.

## 1. Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) → project `cada-4ed7c`.
2. Enable **Authentication** → Email/Password sign-in.
3. Enable **Firestore** (production mode) in your preferred region.
4. Enable **Storage** with a default bucket (`cada-4ed7c.firebasestorage.app`).

## 2. Service account

1. Project settings → Service accounts → Generate new private key.
2. Copy the JSON and set `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env.local` as either:
   - The raw JSON string, or
   - Base64-encoded JSON (supported by `lib/firebase/admin.ts`).

Never commit the service account file to git.

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_FIREBASE_*` | Web client config (from Firebase project settings) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server Admin SDK |
| `NEXT_PUBLIC_APP_URL` | Portal base URL for emails and redirects |
| `RESEND_API_KEY` | Transactional email (verification, invites) |
| `REWARD_TOKEN_ENCRYPTION_KEY` | QR token encryption |
| `CRON_SECRET` | Protects cron API routes |

Optional: `SKIP_EMAIL_VERIFICATION=true` for local dev only.

## 4. Firestore indexes

Deploy composite indexes:

```bash
firebase deploy --only firestore:indexes --project cada-4ed7c
```

Index definitions live in `firestore.indexes.json`.

## 5. Storage rules (brand logos)

Deploy rules from the portal directory:

```bash
cd brand-platform/portal
npm run firebase:deploy
```

Or deploy storage only — rules live in `storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /brand-logos/{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

Logo uploads go through `POST /api/brands/logo` using the Admin SDK.

## 6. Auth email templates

Firebase sends password-reset links when using `sendPasswordResetEmail` (Identity Toolkit REST). Verification emails are sent via Resend using `generateEmailVerificationLink` from the Admin SDK.

Add authorized domains in Firebase Auth → Settings → Authorized domains (e.g. `localhost`, `partners.cadaapp.com`).

## 7. Portal staff vs app users vs CADA admins

| Identity | Purpose |
|----------|---------|
| `brand_staff` | Partner portal login (brand dashboard) |
| `cada_users` | CADA iOS app users |
| `CADA_ADMIN_EMAILS` / claim `cadaAdmin` | Platform admins — approve challenges at `/admin/challenges` |

Portal sessions use the `__portal_session` HTTP-only cookie. Custom claims (`portalStaff`, `brandId`, `staffRole`, optional `cadaAdmin`) are set on Firebase Auth users.

### Grant a CADA admin (e.g. james@cadaapp.com)

1. Set `CADA_ADMIN_EMAILS=james@cadaapp.com,tannermesaric@gmail.com` in `.env.local` and Vercel.
2. Create/update each Firebase Auth user and claim:

```bash
cd brand-platform/portal
# FIREBASE_SERVICE_ACCOUNT_JSON must be set (or present in .env.local)
node ../scripts/grant-cada-admin.mjs james@cadaapp.com
node ../scripts/grant-cada-admin.mjs tannermesaric@gmail.com
```

3. Sign in at `/login` → redirects to `/admin/challenges` with the pending queue.

`CADA_ADMIN_TOKEN` remains optional for scripts and automation.

## 8. Local development

```bash
cd brand-platform/portal
npm install
cp .env.example .env.local
# Edit .env.local with service account + secrets
npm run dev
```

## 9. Production deploy

Deploy the Next.js app to your host (Vercel, Cloud Run, etc.) with the same env vars. Ensure:

- `NEXT_PUBLIC_APP_URL` matches the production portal URL
- Firestore indexes are deployed
- Storage bucket allows public read for logo URLs (`https://storage.googleapis.com/{bucket}/brand-logos/...`)

**Step-by-step Vercel checklist:** [vercel-deploy-checklist.md](./vercel-deploy-checklist.md)

**Verify backend after deploy:**

```bash
curl -s https://YOUR-PORTAL-URL/api/health
# expect: {"ok":true,"checks":{"adminSdk":true,"firestore":true,...}}
```

From repo root:

```bash
BASE_URL=https://YOUR-PORTAL-URL brand-platform/scripts/test-portal-smoke.sh
```

Deploy indexes and rules from `brand-platform/portal`:

```bash
cd brand-platform/portal
npm run firebase:deploy
```

## 10. Data model

Firestore collections mirror the former Supabase tables with **snake_case** field names for API compatibility. See `src/lib/db/types.ts` for `COLLECTIONS` and document shapes.
