#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed.sql"
echo "Seed complete."
