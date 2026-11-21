#!/usr/bin/env python3
import json, os, urllib.request, urllib.error
ref, tok = os.environ["SUPABASE_PROJECT_REF"], os.environ["SUPABASE_ACCESS_TOKEN"]
def q(sql, label):
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{ref}/database/query", method="POST",
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json", "User-Agent": "fitoor"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: print(f"{label}: {r.read().decode()[:1500]}")
    except urllib.error.HTTPError as e: print(f"{label}: ERROR {e.code} {e.read().decode()[:1500]}")
AS_ADMIN = """begin; set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where email='admin@himanshuahuja.in'), true);
select set_config('request.jwt.claims', json_build_object('sub',(select id from public.profiles where email='admin@himanshuahuja.in'),'role','authenticated')::text, true);
select public.is_admin() as is_admin, (select count(*) from public.plans) as plans, (select count(*) from public.profiles) as profiles,
       (select count(*) from public.user_activity) as clients, (select count(*) from public.lab_results) as labs; commit;"""
q("select email, role, created_at from auth.users u left join public.profiles p using (id) order by u.created_at", "auth users")
q("select u.email, p.role, pl.name plan from auth.users u left join public.profiles p on p.id=u.id left join public.plans pl on pl.id=p.plan_id", "profiles")
q("select grantee, count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by grantee", "grants BEFORE")
q(AS_ADMIN, "as admin BEFORE")
q(open('supabase/grants.sql').read(), "apply grants")
q("insert into public.profiles (id, email, full_name, phone, plan_id) select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)), u.raw_user_meta_data->>'phone', (select id from public.plans where name='Diet + Fitness') from auth.users u where not exists (select 1 from public.profiles p where p.id=u.id) returning email", "missing profiles created")
q(AS_ADMIN, "as admin AFTER")
