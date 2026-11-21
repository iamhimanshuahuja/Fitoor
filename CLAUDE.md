# CLAUDE.md — Fitoor project memory

> Read this first. It is the source of truth for any AI assistant (Claude, Cursor, Copilot, Gemini…) working on this repo.
> **Keep it updated**: when you add a feature, table, route, env var or convention, update the matching section below in the same change.

## 1. What this is
**Fitoor** (फ़ितूर — Hindi for a craze / obsession; tagline **"Plate se PR tak."**) is a mobile-first PWA for diet, fitness and health tracking between a **client (user)** and a **coach (admin)**, aimed at Gen Z in India. Renamed from *AaharVihar* on 2026-11-21 (Supabase project, tables and storage paths unchanged).
- Owner: Himanshu. Coach/admin login: admin@himanshuahuja.in; his own client account: iamhimanshuahuja@gmail.com. Local path: `/var/www/fitoor` (macOS real path `/private/var/www/fitoor`). Git repo: `fitoor`.
- Hosting: **Netlify** (static SPA) + **Supabase** (Postgres, Auth, Storage, Edge Functions). Supabase project ref: `njqqqhiuaptiwvazqawn` (region Mumbai).
- Future: same code wrapped with **Capacitor** for the iPhone App Store (needs Mac + Xcode + Apple Developer account). Keep everything web-standard so that stays possible (camera via `<input capture>`, no Node-only APIs in `src/`).

## 2. Features (current)
| Area | User can | Admin can |
|---|---|---|
| Diet plan | View active plan (slots: Early Morning → Bed time, each with options + **avoid** list, plus guidelines) | Create / edit / version per user, start from **templates**, save as template |
| Meals | Log per slot with text and/or **camera photo** (compressed client-side to ~1280px WebP ≤200 KB), mark on/off plan | See every meal + photo, mark on/off plan, delete, comment |
| Weight | Daily weight + waist, scale photo (AI reads number), trend chart with 7-day avg, BMI, target | Same charts per client |
| Habits & supplements | Water glasses, checklist from diet chart (detox water, nuts, NOD, 12-hr fasting…), whey/pre-workout/L-carnitine | View |
| Gym | Log workout (day label Push/Pull/Legs…, exercises × sets × reps × kg; cardio min/incline/km), exercise library by muscle + equipment/machine, **AI machine photo → exercise suggestions**, progress (workouts/week, sets by muscle, strength trend, PRs, streak) | Same per client; manage exercise library |
| Lab reports | Upload PDF/photo → **AI extracts every test** → review/edit table → save; date-wise **compare table** with ↑/↓ flags and per-test trend chart | Same + upload on client's behalf, health notes |
| Calendar | `/app/calendar` — month grid (Mon-first). Each day: meal dots (green on plan / pink off / grey unmarked) + count, 🏋️ day label, ⚖️ weight, ✅ habits done, 💬 notes, 🧪 lab report; day tint = day score; month stats; layer filter chips. Tap a day → DayView in a bottom sheet (phone) / side panel (desktop), editable | Client page → **Calendar** tab, same view in coach mode (`components/CalendarView.jsx`) |
| Juice feast plan (feature `juices`) | Today → 🥤 tracker (Red 8am, smoothie 9:30, Green 1 11am, Green 2 1:30pm or Tangy alt, smoothie 4:30, White 7pm) with ml for their eGFR group; ticks stored in `habit_logs.habits.juices`; recipes + prep rules in Plan → Juices; 🥤 x/6 on calendar | Plan & access → set `profiles.juice_group` ('90' >90, '60' 60–90, '30' 30–60); app suggests from latest eGFR (`labKey==='egfr'`), coach confirms. Data in `src/lib/juices.js` |
| Learn | Plan → Learn: cards from the coach's slides (50/25/25 plate, alkaline vs acidic, high-GI swaps, insulin up/down, diet causes of insulin resistance) — `components/Learn.jsx`; chakra/medical-condition slides intentionally left out | — |
| Printable plan | Plan → "Print / PDF" → `/print/plan`: 2 A4 pages (personal header, coach sticky note, timeline with times + emojis, 50/25/25 plate, juice amounts, house rules; page 2 weekly fridge tick-sheet + swap list). Print CSS at end of styles.css (`.pp-*`) | Diet plan tab → "Print / PDF for client" → `/print/plan/:id` |
| Progress photos | Front/side photos stored under `<uid>/progress` in bucket `media` (no table); Day 1 vs Now compare (`components/ProgressPhotos.jsx`) | Same, per client |
| Daily extras | Fasting gap (yesterday's last meal → first meal today, plan target 12 h), protein total, 🔥 streak, "New note from your coach" banner (seen-time in localStorage) | — |
| Export | CSV for weight history and the lab compare table (`lib/csv.js`) | Same |
| Notes | Thread with coach (per day or general, context tags) | Comment anywhere |
| AI weekly check-in | — | Client Overview → "Draft with AI": 7-day review (wins / watch / suggestions + editable message) → "Send as note" (`components/AiWeeklySummary.jsx`, edge task `summary`, coach-only) |
| Invite | — | Clients → Copy signup link / Invite on WhatsApp |
| Admin dashboard | — | KPIs, meals/day (on vs off plan), weigh-ins & workouts/day, **Needs attention** list, latest meal photos feed |
| Admin user detail | — | Tabs: Overview (30-day heatmap, adherence, kcal, weight), Daily log, Weight, Gym, Labs, Diet plan, **Plan & access**, Notes |
| Plans & feature flags | Sees own enabled features on Profile | Edit plan → feature matrix; **per-user overrides**; pause account; make admin |

### Roles & editing (who can change what)
- **Admin = coach-only login** (admin@himanshuahuja.in). No personal tracking: `/app` redirects admins to `/admin`, and the admin nav has no "My app".
- **Coach** can view, **add, edit and delete** everything for any client: meals (text, kcal, protein, on/off plan), weight, habits, workouts (sets, day label, notes), lab values (Labs → Edit values), diet plan, plan/features, and comment anywhere (`DayView mode="admin"`, all panels take `userId`).
- **Client** can do the same on their own data and sees every coach change and note immediately (same tables; Today → Coach's notes, Labs → Health notes, Plan shows "Updated <date>"), and can reply.
- RLS: select/update/delete = owner or admin; insert = (owner + feature) or admin — see `supabase/policies_v2.sql`.

### Feature flags (very important)
Keys: `diet, meals, meal_photos, weight, habits, gym, supplements, labs, ai, juices` — defined in **both** `supabase/schema.sql` (`my_features()`) and `src/lib/constants.js` (`FEATURES`). Keep them in sync.
- Effective feature = `user_features` override if present, else plan's `features[]`. SQL: `public.has_feature(uid, key)`; client: `useAuth().has(key)` (admins get everything).
- Enforced in **three** places: menu/routes (`App.jsx RequireAuth feature=`), UI (`has()`), and **RLS insert policies** + the AI edge function. When adding a feature, add all three.

## 3. Tech stack & layout
React 18 + Vite 5 + React Router 6, plain CSS (`src/styles.css`, design tokens at top), Recharts, lucide-react, `@supabase/supabase-js`, `browser-image-compression`, `vite-plugin-pwa`. JavaScript (no TypeScript) in `src/`; the edge function is TypeScript/Deno.

```
src/
  main.jsx, App.jsx            routes + RequireAuth (auth / admin / feature guards), lazy-loaded heavy pages
  styles.css                   all styles; mobile-first, desktop ≥900px gets sidebar
  lib/  supabase.js  auth.jsx (AuthProvider: session, profile, features, has(), isAdmin)
        constants.js (SLOTS, FEATURES, HABITS, SUPPLEMENTS, MUSCLES, EQUIPMENT)  dates.js (local YYYY-MM-DD)
        media.js (compress + upload to bucket 'media', signed URLs)  ai.js (calls edge fn 'ai')
  components/ ui.jsx (Card, Stat, PhotoInput, SignedImg, Lightbox, Tabs, Toggle, DateStrip, useToast)
        Layout.jsx (AppLayout / AdminLayout: sidebar desktop, bottom nav mobile)
        DayView.jsx (one user's day — mode 'user' editable / 'admin' review)  Comments.jsx
        Charts.jsx (WeightChart, DailyBars, TrendLine)  DietPlanEditor.jsx
  pages/ Home.jsx (landing)  Auth.jsx (Login, Signup, ResetPassword)
         app/ Today, Weight (exports WeightPanel), Gym (exports GymPanel, useExercises), Labs (exports LabCompare, LabUploader), Plan (PlanView), Profile
         admin/ Dashboard (attentionReasons), Users, UserDetail, Plans (plan matrix, diet templates, exercise library)
supabase/
  schema.sql                   ALL tables, helper fns, triggers, RLS, storage bucket+policies, user_activity view — idempotent, re-runnable
  seed_diet_template.sql       default "Alkaline diet" template from the client's chart
  functions/ai/index.ts        AI edge function (tasks: scale | meal | machine | lab), provider-agnostic
scripts/setup.sh               applies SQL via psql, deploys edge fn, sets AI secrets from .env
brand/                         logo.svg, logo-dark.svg, icon.svg, app-icon.svg + PNG sizes, favicon.ico
public/                        copies of brand assets used by the app + PWA icons
```
Shared panels are reused by admin pages by passing `userId` (e.g. `<WeightPanel userId>`, `<GymPanel userId>`, `<LabCompare userId>`, `<DayView mode="admin">`). Prefer extending these over duplicating.

## 4. Database (Supabase Postgres) — see `supabase/schema.sql`
`plans(name, features[])` · `profiles(id=auth.uid, full_name, email, phone, role user|admin, plan_id, height_cm, start_weight, target_weight, goal, active)` · `user_features(user_id, feature, enabled)` · `diet_plans(user_id|null, is_template, is_active, slots jsonb, guidelines[], notes)` · `meal_logs(user_id, log_date, slot, description, photo_path, followed, kcal, protein_g, carbs_g, fat_g, ai jsonb)` · `weight_logs(user_id, log_date UNIQUE per user, weight_kg, waist_cm, photo_path, source manual|ai)` · `habit_logs(user_id, log_date PK, habits jsonb, supplements jsonb)` · `exercises(name unique, muscle_group, equipment, kind strength|cardio|mobility)` · `workouts(user_id, log_date, day_label, duration_min, notes)` · `workout_sets(workout_id, user_id, exercise_id, set_no, reps, weight_kg, duration_min, distance_km, incline)` · `lab_reports(user_id, report_date, lab_name, file_path)` · `lab_results(report_id, user_id, panel, test_name, value, value_text, unit, ref_low, ref_high, ref_text, flag low|high|normal)` · `comments(user_id, author_id, log_date, context, body)` · view `user_activity` (admin stats per user).

Rules:
- **All dates are local calendar dates** `YYYY-MM-DD` (`lib/dates.js`), never UTC-derived.
- Helper fns `is_admin()`, `has_feature()`, `my_features()` are `security definer` — use them in policies, never query `profiles` directly inside a `profiles` policy (recursion).
- Trigger `protect_profile_fields` stops non-admins changing their own `role/plan_id/active` (SQL editor / service role allowed).
- New signups get a profile automatically (trigger on `auth.users`) with plan **Diet + Fitness**.
- Schema changes: edit `schema.sql` so it stays idempotent (`if not exists`, `create or replace`, policies are dropped & recreated), then re-run it. Test locally if possible.
- Storage: private bucket `media`, path `<user_id>/<folder>/<file>` (folders: meals, scale, machines, labs). Read via signed URLs (`useSignedUrl`). Owner or admin only.

## 5. AI
Edge function `supabase/functions/ai` (150 s limit on free plan — Netlify functions were too short at 10 s). Client: `runAI(task, { image|file: base64, mime, ...})`.
- Tasks: `summary` (text-only, coach-only) → `{headline, wins[], watch[], suggestions[], message_to_client}`; `scale` → `{weight_kg}`; `meal` (+slot, plan items/avoid) → `{items, kcal, protein_g, carbs_g, fat_g, plan_check, plan_note}`; `machine` (+library names) → `{machine, how_to, exercises[]}`; `lab` (PDF/image, client sends `known` test names) → model returns pipe lines `DATE|`, `LAB|`, `R|panel|test|value|unit|low|high|ref` which the function parses into `{report_date, lab_name, results[]}` (one big JSON blob broke on a 41-page report).
- Lab test names are matched across reports with `src/lib/labNames.js` `labKey()` (synonyms like ALT/SGPT, HDL, TSH…, else word-order-insensitive). LabCompare groups by this key.
- Secrets (Supabase, **never in the browser**): `AI_PROVIDER` anthropic|openai|gemini, `AI_API_KEY`, optional `AI_MODEL`, `AI_BASE_URL` (gateway/proxy).
- Checks caller is signed in and has feature `ai` (or is admin). AI output is always **shown for review/edit** before it matters; never auto-trust it.
- Request size: keep uploads ≤ ~4 MB (client checks).

## 6. Env & secrets
- `.env` (git-ignored) holds `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public), plus `SUPABASE_DB_URL` / `SUPABASE_DB_PASSWORD` / AI keys for scripts only.
- Only `VITE_*` vars reach the browser. Never import server secrets into `src/`. Never use the `service_role` key in the app.
- Netlify env: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only.

## 7. Commands
```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # → dist/ (Netlify publishes this)
bash scripts/setup.sh  # (legacy) apply SQL via psql — direct DB/pooler connections did NOT work from Himanshu's network
```
**What actually works for deploys (2026-11-21):**
- `finish-setup.command` (double-click in Finder) — runs SQL through the **Supabase Management API** (`scripts/run_sql.py`, needs `SUPABASE_ACCESS_TOKEN` in `.env`), deploys the `ai` edge function and sets AI secrets with the Supabase CLI.
- Run any SQL file: `set -a; source .env; set +a; python3 scripts/run_sql.py path/to/file.sql` (or paste it into Supabase → SQL Editor).
- The machine's default Supabase CLI login is a different (work) account → always export `SUPABASE_ACCESS_TOKEN` from `.env` before CLI commands.
- Direct DB host is IPv6-only (fails on this network) and the ap-south-1 pooler returns "tenant not found"; don't rely on psql.
- New Supabase projects do NOT auto-grant table privileges to `authenticated` → `supabase/grants.sql` (also appended to schema.sql) is required, otherwise every query fails with "permission denied".
- Email confirmation is OFF for testing (built-in mailer rate-limits signups). Before real users: add custom SMTP and turn "Confirm email" back on.
- AI runs through an Anthropic-compatible gateway: `AI_BASE_URL` + `AI_MODEL=claude-auto-router-no-opus` (secrets on Supabase).
First admin: sign up in the app, then `update public.profiles set role='admin' where email='…';`

## 8. Conventions
- Mobile-first: test at 390px wide. Touch targets ≥ 44px. Floating bottom nav on mobile (up to 6 items: Today, Calendar, Weight, Gym, Labs, Plan; Me lives in the top bar), sidebar ≥ 900px.
- Dev helpers (vite.config.js, dev server only, localhost only): `/__dev/deploy-ai` redeploys the AI edge function; `/__dev/sql?file=supabase/dev/x.sql` runs SQL via Management API; `/__dev/login-as?email=…` opens a one-time magic link for testing as that user.
- **Design language (v2, Gen Z "sticker" theme — Nov 2026):** mint paper bg `--paper-bg #EEF6E8`, ink `--ink #12261B` outlines (2px) and offset "pop" shadows (`--pop: 3px 3px 0 ink`) on things you tap; sticker colours `--lime #C8F25A` (primary highlight / active states), `--lav #BBA8FF`, `--sky #8FD3FF`, `--haldi #FFB627`, `--chilli #FF5D73` (off-plan / high flags); brand greens `--deep #1A5A3C`, `--fresh #2FA35F`. Buttons: `.btn-primary` = ink bg + lime text, `.btn-pop` = lime + ink border; they press down on :active. Stat tiles cycle lime/lav/sky/haldi. Fonts: **Bricolage Grotesque** (display/headings), **DM Sans** (body). Theme overrides live at the END of `src/styles.css` (v2 section) — base rules above it are older.
- Tone: casual, short, Gen Z-friendly but clear (sentence case, emojis only as markers: meal slots 🌅🥤🥞🍛☕🥣🌙✨, streak 🔥).
- Gamification: streak = consecutive days with any meal/weight/workout logged (`Today.jsx useStreak`).
- Home (`pages/Home.jsx`): interactive **Build-your-thali** (25% plate rule, live balance score), goal picker chips, marquee, bento feature grid, how-it-works, FAQ accordion. No fake testimonials or user counts.
- **Brand:** name **Fitoor**, tagline **"Plate se PR tak."** (deep-green text under the wordmark); homepage headline **"Thali on point. Reps on track. Streak on fire."**. Logo mark = flame (haldi + chilli) rising from a lime thali on an ink rounded tile = junoon on your plate. Wordmark Bricolage Grotesque ExtraBold as outlined paths. Files (`brand/`, `public/`): `logo(-dark).svg` full lockup with tagline (home footer, auth card), `logo-inline(-dark).svg` icon + Fitoor for nav bars (`<Logo />` default, `<Logo full />` = lockup), `icon.svg` favicon, `app-icon.svg` full-bleed ink square for iOS/PWA.
- Health content: the app **never gives medical advice**; lab flags only compare to the report's reference range and tell users to consult their doctor.
- Copy is friendly, short, Indian-English; food names in common Indian terms (chilla, makhana, dal…).
- Photos are compressed **before** upload (`uploadMedia`) — keep storage under the 1 GB free tier.

## 9. Roadmap / ideas not built yet
- Push reminders at meal times (PWA push; iOS 16.4+ when installed to home screen) — needs a Supabase cron + web-push.
- Body measurements beyond waist.
- Capacitor iOS build.
- Wearable import (Apple Health) once native.

## 10. Changelog
- 2026-11-21 — Juice feast plan (feature `juices`, `profiles.juice_group`, migration `supabase/migration_v3_juices.sql`), Learn cards, printable 2-page A4 plan, AI meal check flags high-GI/acidic foods, homepage thali shows 50/25/25.
- 2026-11-21 — Rebrand AaharVihar → **Fitoor** ("Plate se PR tak."): new flame-on-thali logo set, PWA name/colours, homepage headline, invite copy; folder renamed to /var/www/fitoor for a new git repo; localStorage prefix `ft_`.
- 2026-11-21 — Calendar view for client and coach (month grid + day sheet). Sheet animations slide only (no opacity) so a paused animation never leaves the panel see-through.
- 2026-11-21 — Recheck: verified AI from Supabase via gateway (scale 4.6 s, lab PDF 93 results 33 s, summary 12 s); RLS security test passed (client can't read/write others, can't self-promote). Added: lab pipe-format parsing + name matching, progress photos, fasting gap + protein, coach-note banner, CSV export, invite/WhatsApp, AI weekly check-in, ErrorBoundary.
- 2026-11-21 — UI v2: Gen Z sticker theme, new homepage (thali builder, goal picker, bento, FAQ), streak counter, slot emojis, Me button in mobile top bar. Fix: auth context now recovers from a missing/stale profile (was causing blank Me page + hidden Labs); refreshes features when the app regains focus.
- 2026-11-21 — Coach & client editing: inline edit for meals, workouts (sets/day/notes, delete), lab values; coach can add entries for clients (policies_v2.sql). Admin made coach-only. Personal data moved from admin@himanshuahuja.in to iamhimanshuahuja@gmail.com (Full plan) via `supabase/import/move_admin_data_to_client.sql`.
- 2026-11-21 — Deployed to Supabase project njqqqhiuaptiwvazqawn: schema, AI edge function, secrets. Imported Himanshu's data (lab report, gym log, weight, diet plan). Import SQL template: `supabase/import/import_himanshu.sql` (__EMAIL__).
- 2026-11-21 — v0.1: initial build (homepage, auth, user app, admin panel, feature flags, AI edge function, schema with RLS, brand assets).

### Progress dashboard (Nov 2026)
- `src/components/ProgressDashboard.jsx` — shared by user `/app/progress` (nav tab "Progress") and the top of admin UserDetail → Overview.
- Shows: journey card (kg lost since day 1, % to goal, track with lowest marker), rings (meals on plan, gym days, days logged), stickers (avg kcal eaten, est. gym kcal, protein/day, lowest weight), food-in vs gym-out chart, weight chart, lab gauges (first vs latest, ref band).
- Filters: date presets (7d / 30d / 3m / since day 1 / custom from–to; >31 days buckets the energy chart weekly) and lab filters (from-report, to-report, panel, only-out-of-range).
- Gym kcal is an estimate (MET × body kg × minutes) in `workoutKcal()`; the journey card always uses all weigh-ins.


### Logo v4 (21 Nov 2026)
- Mark: thali seen from above, split 50/25/25 (lime / haldi / chilli wedges) inside a lime progress ring (290° arc) on an ink disc. The plate = the 50/25/25 rule, the ring = progress.
- Wordmark: lowercase "fitoor" in Unbounded 800, converted to paths. Tagline: "Plate se PR tak." in DM Sans 700 (deep green; lime on dark).
- Replaces the flame-on-thali tile and the "Fit ka junoon." tagline. Generator: fitoor-brand/v4/gen.py (fontTools + uharfbuzz text-to-path).
- Files in public/: logo(-dark).svg, logo-inline(-dark).svg, icon.svg, app-icon.svg, icons/*.png, favicon.ico. The app top bar uses logo-inline.svg.


## Deploy to Netlify

1. Push this folder to your new Git repo (`.env`, logs and `node_modules` are git-ignored — check `git status` before the first commit).
2. Netlify → **Add new site → Import from Git** → pick the repo. Build settings come from `netlify.toml` (`npm ci && npm run build`, publish `dist`, Node 22).
3. Netlify → Site configuration → **Environment variables**, add only:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = the publishable/anon key
   Never add the AI key, service-role key, DB password or access token — AI keys live in Supabase secrets.
4. Deploy. Then in **Supabase → Authentication → URL Configuration**:
   - Site URL = `https://<your-site>.netlify.app` (or your custom domain)
   - Redirect URLs: add `https://<your-site>.netlify.app/**` (keep `http://localhost:5173/**` for local dev)
5. Open the site, sign in, and on a phone use **Add to Home Screen** to install it as an app.

### Juice days (21 Nov 2026) — booked by the coach, not a plan feature
- Table `juice_days(user_id, day, note, status scheduled|done|missed, request_day, request_reason, request_status pending|approved|declined)` — `supabase/migration_v4_juice_days.sql`.
- Coach: UserDetail → Plan & access → "🧃 Juice days" (book dates, set juice amounts group, mark done/missed, approve/decline moves). Admin Overview shows pending requests + next 7 days.
- Client: Today banner from 2 days before (`REMIND_DAYS`), "Request another day", "Add to my calendar" (.ics with alerts 2 days before + 7 am). Plan → Juices lists upcoming days.
- On a juice day DayView shows the juice checklist instead of meal slots; DB trigger `block_food_on_juice_day` rejects client meal inserts that day (coach can still record).
- Trigger `guard_juice_day`: clients can only set request_day/reason (→ pending) or mark done. The old `juices` plan feature was removed from all plans.
- Personal data import scripts (`supabase/import/`, `RUN_IN_SUPABASE_v2.sql`) are git-ignored: the GitHub repo is public.

