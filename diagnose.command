#!/bin/bash
cd "$(dirname "$0")"
set -a; source .env; set +a
python3 scripts/diagnose.py 2>&1 | tee diagnose.log
echo; echo "DONE — refresh the admin panel."
