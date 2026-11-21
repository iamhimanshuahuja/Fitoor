#!/usr/bin/env bash
# One-time Supabase setup for Fitoor. Run from the project root:  bash scripts/setup.sh
# Needs: psql (brew install libpq) and the Supabase CLI (brew install supabase/tap/supabase)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

echo "▸ 1/3  Applying database schema…"
if command -v psql >/dev/null; then
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/schema.sql
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed_diet_template.sql
  echo "  ✓ schema + diet template applied"
else
  echo "  ✗ psql not found. Either: brew install libpq && brew link --force libpq"
  echo "    or paste supabase/schema.sql then supabase/seed_diet_template.sql into Supabase → SQL Editor."
fi

echo "▸ 2/3  Deploying the AI edge function…"
if command -v supabase >/dev/null; then
  supabase link --project-ref "$SUPABASE_PROJECT_REF" -p "$SUPABASE_DB_PASSWORD" >/dev/null
  supabase functions deploy ai --project-ref "$SUPABASE_PROJECT_REF"
  if [ -n "${AI_API_KEY:-}" ]; then
    supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" \
      AI_PROVIDER="$AI_PROVIDER" AI_API_KEY="$AI_API_KEY" \
      ${AI_MODEL:+AI_MODEL="$AI_MODEL"} ${AI_BASE_URL:+AI_BASE_URL="$AI_BASE_URL"}
    echo "  ✓ AI secrets set"
  else
    echo "  ! AI_API_KEY is empty in .env — AI features stay off until you add it and re-run."
  fi
else
  echo "  ✗ Supabase CLI not found: brew install supabase/tap/supabase  (then re-run)"
fi

echo "▸ 3/3  Next:"
echo "  • npm install && npm run dev → open http://localhost:5173 and sign up"
echo "  • make yourself admin:  psql \"\$SUPABASE_DB_URL\" -c \"update profiles set role='admin' where email='YOUR@EMAIL'\""
