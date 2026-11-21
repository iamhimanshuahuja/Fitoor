#!/bin/bash
# Fitoor one-click setup (double-click in Finder). Log: setup.log
cd "$(dirname "$0")"
exec > >(tee setup.log) 2>&1
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/opt/homebrew/opt/libpq/bin:/usr/local/bin:/usr/local/opt/libpq/bin:$HOME/.homebrew/bin:$HOME/.homebrew/opt/libpq/bin:$PATH"
set -a; source .env; set +a
step(){ echo; echo "==== $* ===="; }

step "Tools"
echo "node $(node -v 2>/dev/null || echo MISSING)  npm $(npm -v 2>/dev/null || echo MISSING)  brew $(brew --version 2>/dev/null | head -1 || echo MISSING)"
command -v psql >/dev/null || { echo "installing libpq (psql)…"; brew install libpq; }
command -v supabase >/dev/null || { echo "installing supabase cli…"; brew install supabase/tap/supabase; }
echo "psql: $(command -v psql)  supabase: $(supabase --version 2>/dev/null)"

step "npm install"
npm install --no-fund --no-audit

step "Database schema"
REF="$SUPABASE_PROJECT_REF"; PW="$SUPABASE_DB_PASSWORD"
DB=""
for URL in "$SUPABASE_DB_URL" \
  "postgresql://postgres.$REF:$PW@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" \
  "postgresql://postgres.$REF:$PW@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"; do
  if psql "$URL" -Atc "select 1" >/dev/null 2>&1; then DB="$URL"; echo "connected via ${URL#*@}"; break; fi
  echo "could not connect via ${URL#*@}"
done
if [ -n "$DB" ]; then
  echo "DB_OK_URL=$DB" > .db-url.local
  psql "$DB" -v ON_ERROR_STOP=1 -q -f supabase/setup_all.sql 2>&1 | grep -v NOTICE && echo "SCHEMA_OK"
else
  echo "SCHEMA_FAILED (no DB connection)"
fi

step "AI edge function"
supabase projects list >/dev/null 2>&1 || supabase login
if supabase functions deploy ai --project-ref "$REF" --use-api; then echo "FUNCTION_OK"; else echo "FUNCTION_FAILED"; fi
supabase secrets set --project-ref "$REF" AI_PROVIDER="$AI_PROVIDER" AI_API_KEY="$AI_API_KEY" AI_MODEL="$AI_MODEL" AI_BASE_URL="$AI_BASE_URL" && echo "SECRETS_OK"

step "Gateway check"
curl -s -m 20 -o /dev/null -w "gateway HTTP %{http_code}\n" "$AI_BASE_URL/v1/messages" -H "x-api-key: $AI_API_KEY" -H "Authorization: Bearer $AI_API_KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d "{\"model\":\"$AI_MODEL\",\"max_tokens\":10,\"messages\":[{\"role\":\"user\",\"content\":\"ok\"}]}"

step "ALL DONE — starting the app at http://localhost:5173"
npm run dev -- --open
