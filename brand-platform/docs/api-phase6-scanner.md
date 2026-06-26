# Phase 6 — QR Redemption & Web Scanner

**Audience:** Brand staff, engineering  
**Related:** [QR Integration Guide (iOS)](qr-integration-guide-ios.md)

---

## POST `/api/redeem` (alias: `/api/v1/redeem`)

Redeem a customer's QR reward. Requires **brand staff** session (cookie) or Bearer JWT.

### Auth

- Brand **admin** or **scanner** role
- `brand_id` on staff record must match reward's brand

### Request

```json
{
  "token": "raw-token-or-full-qr-url",
  "location_id": "optional-uuid"
}
```

`token` accepts:
- Raw opaque token from QR
- Full URL: `https://redeem.cada.app/r/{token}`

### Success `200`

```json
{
  "status": "redeemed",
  "message": "Reward redeemed",
  "redeemed_at": "2026-06-26T14:00:00.000Z",
  "challenge_title": "Try a class at Studio Flow"
}
```

No user name or PII is returned (MVP policy).

### Errors

| HTTP | `error` | Staff UI message |
|------|---------|------------------|
| 401 | `unauthorized` | Sign in as brand staff |
| 403 | `wrong_brand` | Not valid at this business |
| 404 | `invalid_token` | QR not recognized |
| 409 | `already_redeemed` | Already used |
| 410 | `expired` | Reward expired |
| 410 | `revoked` | No longer valid |

**Idempotent:** Second redeem of same token → `409` + `already_redeemed` (includes `redeemed_at` when known). Never `500` for duplicate.

### Example

```bash
curl -s -X POST http://localhost:3000/api/redeem \
  -H "Authorization: Bearer $STAFF_JWT" \
  -H "Content-Type: application/json" \
  -d '{"token":"https://redeem.cada.app/r/<token>"}'
```

---

## Web scanner — `/scan`

Mobile-friendly staff page:

| Feature | Implementation |
|---------|----------------|
| Camera | `getUserMedia` + `BarcodeDetector` (Chrome, Edge) |
| Fallback | Manual URL/token paste |
| Query param | `/scan?token={raw-or-url}` — auto-redeems when logged in (hardware scanners) |
| Auth | Redirects to `/login?next=/scan` if unsigned |
| Roles | Admin + scanner only |

Staff open **Scan** from the portal nav or go directly to `/scan`.

---

## QR URL landing — `GET /r/{token}`

When staff scan a customer QR with a phone camera (or open the encoded URL), the browser hits:

```text
https://redeem.cada.app/r/{token}
```

| Step | Behavior |
|------|----------|
| Not signed in | Middleware → `/login?next=/r/{token}` |
| After login | Returns to `/r/{token}` → auto `POST /api/redeem` |
| Signed in | Page loads → auto-redeem → success/error card |
| Audit | `x-scan-source: qr-url-landing` |

**UI:** Same messages as `/scan` (no PII on success). Actions: **Scan another** → `/scan`, **Back to dashboard**.

**Dev:** `http://localhost:3000/r/{token}` with seed tokens from `scripts/test-qr-rewards.sh`.

**Production:** Point `redeem.cada.app` at the same Next.js app as `partners.cada.app`.

---

## Audit log

Every redeem attempt writes to `redemption_attempts`:

| `outcome` | When |
|-----------|------|
| `success` | Redeemed |
| `invalid` | Unknown token or revoked |
| `expired` | Past TTL |
| `already_redeemed` | Second scan |
| `wrong_brand` | Token belongs to another brand |

---

## Atomic redeem flow

1. Hash token → lookup `qr_rewards`
2. Validate brand, status, expiry
3. `UPDATE qr_rewards SET status=redeemed WHERE status=issued` (optimistic lock)
4. `INSERT redemptions` (unique on `qr_reward_id`)
5. Log attempt

---

## Acceptance tests

```bash
export APP_JWT="..." STAFF_JWT="..."
./scripts/test-qr-rewards.sh      # issuance + redeem + already_redeemed
./scripts/test-redeem-phase6.sh   # wrong_brand isolation
```

---

## Phase 7

Dashboard KPIs, funnel, and redemptions log — see [api-phase7-metrics.md](api-phase7-metrics.md).
