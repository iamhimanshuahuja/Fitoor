#!/usr/bin/env python3
"""Auth settings for testing: no email confirmation, local + LAN redirect URLs; confirm existing users."""
import json, os, urllib.request, urllib.error
ref, tok = os.environ["SUPABASE_PROJECT_REF"], os.environ["SUPABASE_ACCESS_TOKEN"]
H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "User-Agent": "fitoor-setup"}
def call(method, path, body=None):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}{path}", method=method, headers=H,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
print("auth config:", *call("PATCH", "/config/auth", {
    "mailer_autoconfirm": True,
    "site_url": "http://localhost:5173",
    "uri_allow_list": "http://localhost:5173/**,http://192.168.1.17:5173/**",
})[:1])
print("confirm users:", *call("POST", "/database/query", {"query":
    "update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) returning email"}))
print("profiles:", *call("POST", "/database/query", {"query":
    "select p.email, p.role, pl.name as plan from public.profiles p left join public.plans pl on pl.id = p.plan_id order by p.created_at"}))
