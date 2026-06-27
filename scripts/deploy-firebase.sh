#!/usr/bin/env bash
# Deploy the CADA marketing site to Firebase Hosting (project: cada-4ed7c).
#
# One-time setup:
#   1. Install Node.js from https://nodejs.org
#   2. npm install -g firebase-tools
#   3. firebase login
#
# Deploy:
#   ./scripts/deploy-firebase.sh

set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v firebase >/dev/null 2>&1; then
  echo "Firebase CLI not found. Install with: npm install -g firebase-tools"
  exit 1
fi

echo "Deploying to Firebase project cada-4ed7c..."
firebase deploy --only hosting

echo ""
echo "Done. Your site should be live at:"
echo "  https://cada-4ed7c.web.app"
echo "  https://cada-4ed7c.firebaseapp.com"
echo ""
echo "Check Analytics: Firebase Console → Analytics → Realtime"
