# Phase 8 — Marketing site bridge

Connects the static CADA partnerships page to the brand portal signup and lead capture flow.

## User flows

### Hero CTA → contact form

1. Visitor clicks **Partner with CADA** on `cada_partnerships_page/code.html`.
2. Page scrolls to the **Get in touch** form (`#contact`).
3. They submit the form or use **Create your partner account** to open `{PORTAL_URL}/signup`.

### Lead capture (Get in touch form)

1. Visitor submits brand name, email, optional message on the partnerships contact form.
2. `POST {PORTAL_URL}/api/leads` creates a `partnership_leads` row with `status: new`.
3. Response includes a pre-filled `signup_url` (`/signup?email=…&business_name=…`).
4. When the same email later registers, the lead is auto-marked `signed_up` and linked to `brand_id`.

## Configuration

### Marketing page (`cada_partnerships_page/code.html`)

```javascript
window.CADA_PARTNERS_URL = 'https://partners.cada.app'; // production
```

### Portal env (`portal/.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Portal base URL (signup links, email redirects) |
| `MARKETING_SITE_ORIGINS` | CORS allowlist for `/api/leads` |
| `LEADS_ADMIN_TOKEN` | Protects internal leads admin |
| `SKIP_EMAIL_VERIFICATION` | Dev only — signup goes straight to dashboard |

## API

### `POST /api/leads` (public, CORS)

```json
{ "company_name": "Studio Flow", "email": "hi@studio.com", "message": "Optional note" }
```

### `GET /api/admin/leads?token=…`

List leads (newest first). Optional `&status=new|contacted|signed_up`.

### `PATCH /api/admin/leads?token=…`

```json
{ "id": "uuid", "status": "contacted" }
```

### `GET /api/brands/onboarding` (authenticated)

Returns checklist steps: profile → create challenge → publish.

## Internal admin (MVP)

**Web UI:** `/admin/leads?token=YOUR_LEADS_ADMIN_TOKEN`

Token is stored in `sessionStorage` for the session. Set `LEADS_ADMIN_TOKEN` in portal env.

**Manual SQL fallback:**

```sql
SELECT id, company_name, email, message, status, created_at
FROM partnership_leads
ORDER BY created_at DESC;

UPDATE partnership_leads SET status = 'contacted', updated_at = now() WHERE id = '…';
```

## Onboarding checklist

Shown on `/dashboard` until all steps complete:

1. **Complete your brand profile** — logo, website, or address
2. **Create your first challenge**
3. **Publish a challenge**

New signups see a welcome banner (`?welcome=1`) after verification.

## Branding

Portal login/signup use `/cada-logo.svg` (CADA wordmark, teal `#1CB0C8`) via `AuthShell`.

## Test checklist

- [ ] Hero CTA opens portal `/signup`
- [ ] Contact form creates lead (check `/admin/leads` or DB)
- [ ] Signup with lead email marks lead `signed_up`
- [ ] New brand dashboard shows onboarding + empty metrics CTA
- [ ] Logo visible on `/login` and `/signup`
