#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$f")..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "Migrations complete."
