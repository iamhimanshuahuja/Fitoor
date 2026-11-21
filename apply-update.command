#!/bin/bash
# Applies supabase/RUN_IN_SUPABASE_v2.sql (coach can add entries + move personal data to the Gmail account)
cd "$(dirname "$0")"
set -a; source .env; set +a
python3 scripts/run_sql.py supabase/RUN_IN_SUPABASE_v2.sql 2>&1 | tee apply-update.log
echo; echo "DONE - refresh the app."
