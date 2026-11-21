#!/bin/bash
cd "$(dirname "$0")"
set -a; source .env; set +a
python3 scripts/fix_auth.py 2>&1 | tee fix-auth.log
echo; echo "DONE — go back to the app and sign up / log in again."
