# Phase 2 API — Brand Auth & Profile

Base URL: `/api` (Next.js Route Handlers)  
Production: `https://partners.cada.app/api`  
Auth: Supabase session cookie (set by login/register) or `Authorization: Bearer <jwt>` via Supabase client.

---

## POST `/api/brands/register`

Create a new brand account with an admin user.

**Request**
```json
{
  "business_name": "Studio Flow Yoga",
  "email": "owner@studioflow.test",
  "password": "securepass123",
  "website": "https://studioflow.test",
  "category": "wellness",
  "logo_url": null
}
```

| Field | Required | Notes |
|-------|----------|-------|
| business_name | yes | Display name |
| email | yes | Contact + login email |
| password | yes | Min 8 characters |
| category | no | `gym`, `food`, `wellness`, `retail`, `other` (default: `other`) |
| website | no | |
| logo_url | no | Or upload later via `/api/brands/logo` |

**Response `201`**
```json
{
  "brand": {
    "id": "uuid",
    "name": "Studio Flow Yoga",
    "slug": "studio-flow-yoga",
    "status": "active"
  },
  "message": "Account created. Please verify your email before using the dashboard.",
  "email_verification_required": true
}
```

**Errors:** `400` validation, `409` email exists, `500` server error

Side effects:
- Creates Supabase Auth user
- Creates `brands` + `brand_staff` (role: `admin`)
- Signs in user (session cookie)
- Sends verification email

---

## POST `/api/auth/login`

**Request**
```json
{
  "email": "owner@studioflow.test",
  "password": "securepass123"
}
```

**Response `200`**
```json
{
  "user": {
    "id": "uuid",
    "email": "owner@studioflow.test",
    "email_verified": true
  },
  "staff": {
    "id": "uuid",
    "brand_id": "uuid",
    "role": "admin"
  }
}
```

**Errors:** `401` invalid credentials, `403` no brand staff record (pending invite)

---

## POST `/api/auth/logout`

Clears session cookie.

**Response `200`**
```json
{ "ok": true }
```

---

## GET `/api/brands/me`

Returns current brand profile and staff role. Requires authenticated staff with accepted invite.

**Response `200`**
```json
{
  "brand": {
    "id": "uuid",
    "name": "Studio Flow Yoga",
    "slug": "studio-flow-yoga",
    "logo_url": "https://...",
    "category": "wellness",
    "website": "https://studioflow.test",
    "offer_default_copy": "First class free",
    "primary_address": "42 Mercer St",
    "status": "active"
  },
  "staff": {
    "id": "uuid",
    "email": "owner@studioflow.test",
    "role": "admin"
  }
}
```

---

## PATCH `/api/brands/me`

Update brand profile. **Admin only.**

**Request** (all fields optional)
```json
{
  "name": "Studio Flow",
  "website": "https://studioflow.test",
  "category": "wellness",
  "logo_url": "https://cdn.../logo.png",
  "offer_default_copy": "First class free",
  "primary_address": "42 Mercer St, NY"
}
```

**Response `200`** — same `brand` object as GET.

**Errors:** `403` scanner role

---

## POST `/api/brands/logo`

Upload brand logo to Supabase Storage. **Admin only.** Multipart form.

**Request:** `multipart/form-data` with field `file` (JPEG/PNG/WebP/GIF, max 5MB)

**Response `200`**
```json
{
  "logo_url": "https://<project>.supabase.co/storage/v1/object/public/brand-logos/<brand_id>/logo.png"
}
```

---

## GET `/api/brands/staff`

List team members for current brand.

**Response `200`**
```json
{
  "staff": [
    {
      "id": "uuid",
      "email": "scanner@studioflow.test",
      "role": "scanner",
      "status": "active",
      "invited_at": "2026-06-20T12:00:00Z",
      "accepted_at": "2026-06-21T09:00:00Z"
    },
    {
      "id": "uuid",
      "email": "new@studioflow.test",
      "role": "scanner",
      "status": "pending",
      "invited_at": "2026-06-26T12:00:00Z",
      "accepted_at": null
    }
  ]
}
```

---

## POST `/api/brands/staff/invite`

Invite a team member. **Admin only.**

**Request**
```json
{
  "email": "scanner@studioflow.test",
  "role": "scanner"
}
```

| role | Permissions |
|------|-------------|
| `admin` | Full portal access |
| `scanner` | Dashboard read + QR scan (Phase 6); no challenge edits |

**Response `201`**
```json
{
  "email": "scanner@studioflow.test",
  "role": "scanner",
  "invite_url": "https://partners.cada.app/invite?token=...",
  "expires_at": "2026-07-03T12:00:00Z",
  "message": "Invite created. Share the invite link with your team member."
}
```

MVP returns `invite_url` in response for dev; production should email the link.

---

## GET `/api/brands/staff/accept?token=...`

Preview invite details (public).

**Response `200`**
```json
{
  "email": "scanner@studioflow.test",
  "role": "scanner",
  "brand_name": "Studio Flow Yoga",
  "expires_at": "2026-07-03T12:00:00Z"
}
```

---

## POST `/api/brands/staff/accept`

Accept invite and create/link auth account.

**Request**
```json
{
  "token": "invite-token-from-url",
  "password": "securepass123"
}
```

**Response `200`**
```json
{
  "message": "Invite accepted. Welcome to the team.",
  "staff": {
    "id": "uuid",
    "brand_id": "uuid",
    "role": "scanner",
    "email": "scanner@studioflow.test"
  }
}
```

Signs in user on success.

---

## Auth flows (UI routes)

| Route | Purpose |
|-------|---------|
| `/signup` | Brand registration |
| `/login` | Sign in |
| `/verify-email` | Block dashboard until email confirmed |
| `/forgot-password` | Request reset link |
| `/reset-password` | Set new password (from email link) |
| `/invite?token=` | Staff accept invite |
| `/dashboard` | Protected home |
| `/dashboard/profile` | Profile edit (admin write, scanner read) |
| `/dashboard/staff` | Team management (admin only) |

---

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
SKIP_EMAIL_VERIFICATION=true   # local dev only
```

---

## Role matrix (Phase 2)

| Action | Admin | Scanner |
|--------|-------|---------|
| View dashboard | ✓ | ✓ |
| Edit brand profile | ✓ | read-only |
| Invite staff | ✓ | ✗ |
| List staff | ✓ | ✓ |
| Accept own invite | — | ✓ |

Challenge CRUD, QR, metrics: Phase 3+.
