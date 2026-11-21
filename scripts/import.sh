#!/usr/bin/env bash
# Import existing data (lab report 26 Oct 2026, diet chart, gym day 1, start weight) for one account.
# Usage: bash scripts/import.sh you@example.com     (sign up in the app first)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
EMAIL="${1:?Usage: bash scripts/import.sh you@example.com}"
sed "s/__EMAIL__/${EMAIL}/" supabase/import/import_himanshu.sql | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q
