#!/usr/bin/env python3
"""Run a .sql file on the Supabase project through the Management API (no DB connection needed).
Usage: python3 scripts/run_sql.py file.sql   (needs SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF in env)"""
import json, os, sys, urllib.request, urllib.error
ref, tok = os.environ["SUPABASE_PROJECT_REF"], os.environ["SUPABASE_ACCESS_TOKEN"]
sql = open(sys.argv[1], encoding="utf-8").read()
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query",
    data=json.dumps({"query": sql}).encode(), method="POST",
    headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "User-Agent": "fitoor-setup"})
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read().decode()
        print("OK", r.status, body[:600])
except urllib.error.HTTPError as e:
    print("ERROR", e.code, e.read().decode()[:2000]); sys.exit(1)
