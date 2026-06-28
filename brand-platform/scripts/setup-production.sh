#!/usr/bin/env bash
# Production setup for CADA brand portal (Firebase Auth + Firestore).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTAL="$ROOT/portal"

echo "=== CADA Brand Portal — Firebase production setup ==="
echo ""
echo "1. FIREBASE (project: cada-4ed7c)"
echo "   - Enable Authentication → Email/Password"
echo "   - Create Firestore database"
echo "   - Enable Storage (brand logos)"
echo "   - Auth → Authorized domains: localhost, partners.cadaapp.com"
echo "   - Project settings → Service accounts → Generate private key"
echo "   - Deploy indexes: firebase deploy --only firestore:indexes --project cada-4ed7c"
echo "   - See portal/docs/firebase-portal-setup.md"
echo ""
echo "2. PORTAL ENV (Vercel → brand-platform/portal project)"
echo "   NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET / etc."
echo "   FIREBASE_SERVICE_ACCOUNT_JSON=<service account JSON>"
echo "   NEXT_PUBLIC_APP_URL=https://partners.cadaapp.com"
echo "   MARKETING_SITE_ORIGINS=https://cadaapp.com,https://www.cadaapp.com"
echo "   LEADS_ADMIN_TOKEN=$(openssl rand -hex 24 2>/dev/null || echo 'generate-a-secret')"
echo "   CADA_ADMIN_TOKEN=$(openssl rand -hex 24 2>/dev/null || echo 'generate-a-secret')"
echo "   CHALLENGE_NOTIFY_EMAIL=james@cadaapp.com"
echo "   RESEND_API_KEY=re_..."
echo "   RESEND_FROM=CADA Partners <notifications@cadaapp.com>"
echo ""
echo "3. VERCEL — portal project (Root Directory: brand-platform/portal)"
echo ""
echo "4. MARKETING SITE — js/portal-links.js → partners.cadaapp.com"
echo ""
echo "5. TEST — /signup → /dashboard → create challenge → submit for review"
echo ""

if [[ -f "$PORTAL/.env.local" ]]; then
  echo "Local: cd brand-platform/portal && npm install && npm run dev"
else
  echo "Local: cp brand-platform/portal/.env.example brand-platform/portal/.env.local"
  echo "       cd brand-platform/portal && npm install && npm run dev"
fi
