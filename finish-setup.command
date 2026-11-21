#!/bin/bash
# Fitoor — finish setup (double-click). Log: finish-setup.log
cd "$(dirname "$0")"
exec > >(tee finish-setup.log) 2>&1
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/libpq/bin:/usr/local/bin:$PATH"
set -a; source .env; set +a
REF="$SUPABASE_PROJECT_REF"
step(){ echo; echo "==== $* ===="; }
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then echo "SUPABASE_ACCESS_TOKEN missing in .env"; exit 1; fi
export SUPABASE_ACCESS_TOKEN

step "Check access"
curl -s -o /dev/null -w "management API: HTTP %{http_code}\n" "https://api.supabase.com/v1/projects/$REF" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

step "Database schema"
python3 scripts/run_sql.py supabase/setup_all.sql && echo "SCHEMA_OK" || echo "SCHEMA_FAILED"

step "Import Himanshu's data"
python3 scripts/run_sql.py supabase/import/import_admin.sql && echo "IMPORT_OK" || echo "IMPORT_FAILED"

step "AI edge function"
supabase functions deploy ai --project-ref "$REF" --use-api --yes && echo "FUNCTION_OK" || echo "FUNCTION_FAILED"
supabase secrets set --project-ref "$REF" --yes AI_PROVIDER="$AI_PROVIDER" AI_API_KEY="$AI_API_KEY" AI_MODEL="$AI_MODEL" AI_BASE_URL="$AI_BASE_URL" && echo "SECRETS_OK" || echo "SECRETS_FAILED"

step "Gateway reachable from Supabase? (calls the deployed function without login → expect 401)"
curl -s -m 30 -w "  HTTP %{http_code}\n" "$VITE_SUPABASE_URL/functions/v1/ai" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{}'

step "FINISHED — refresh http://localhost:5173 and log in"
