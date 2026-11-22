# CLAUDE.md — Fitoor project memory

> Read this first. It is the source of truth for any AI assistant (Claude, Cursor, Copilot, Gemini…) working on this repo.
> **Keep it updated**: when you add a feature, table, route, env var or convention, update the matching section below in the same change.

## 1. What this is
**Fitoor** (फ़ितूर — Hindi for a craze / obsession; tagline **"Plate se PR tak."**) is a mobile-first PWA for diet, fitness and health tracking between a **client (user)** and a **coach (admin)**, aimed at Gen Z in India. Renamed from *AaharVihar* on 2026-11-21 (Supabase project, tables and storage paths unchanged).
- Owner: Himanshu. Coach/admin login: admin@himanshuahuja.in; his own client account: iamhimanshuahuja@gmail.com. Local path: `/var/www/fitoor` (macOS real path `/private/var/www/fitoor`). Git repo: `fitoor`.
- Hosting: **Netlify** (static SPA) + **Supabase** (Postgres, Auth, Storage, Edge Functions). Supabase project ref: `njqqqhiuaptiwvazqawn` (region Mumbai).
- **Native app:** Expo / React Native app in `mobile/` (iOS + Android via EAS, same Supabase backend) — see "Mobile app" section. Keep pure logic in `src/lib/*` free of DOM/Node APIs so `mobile/scripts/sync-shared.mjs` can copy it.

## 2. Features (current)
| Area | User can | Admin can |
|---|---|---|
| Diet plan | View active plan (slots: Early Morning → Bed time, each with options + **avoid** list, plus guidelines) | Create / edit / version per user, start from **templates**, save as template |
| Meals | Log per slot with text and/or **camera photo** (compressed client-side to ~1280px WebP ≤200 KB), mark on/off plan | See every meal + photo, mark on/off plan, delete, comment |
| Weight | Daily weight + waist, scale photo (AI reads number), trend chart with 7-day avg, BMI, target | Same charts per client |
| Body measurements (optional) | Weight page → 📏 Body measurements (`#inches`; Today's weight card has a 📏 Inches link): neck, chest, arm, waist, belly, hips, thigh, calf — every spot optional, one row per date (re-saving a date updates it). Inches/cm toggle (stored in inches, display pref in localStorage `ft_measure_unit`), "how to measure" tips, total inches lost (sum of first→latest per spot), per-spot change + trend chart, history with edit/delete, CSV. Chat: "waist 36, hips 41" → 📏 card (merges into that day's row). Progress shows an "Inches lost" sticker only if measured | Same in client → Weight tab |
| Habits & supplements | Water glasses, checklist from diet chart (detox water, nuts, NOD, 12-hr fasting…), whey/pre-workout/L-carnitine | View |
| Gym | Log workout (day label Push/Pull/Legs…, exercises × sets × reps × kg; cardio min/incline/km), exercise library by muscle + equipment/machine, **AI machine photo → exercise suggestions**, progress (workouts/week, sets by muscle, strength trend, PRs, streak) | Same per client; manage exercise library |
| Lab reports | Upload PDF/photo → **AI extracts every test** → review/edit table → save; date-wise **compare table** with ↑/↓ flags and per-test trend chart | Same + upload on client's behalf, health notes |
| Calendar | `/app/calendar` — month grid (Mon-first). Each day: meal dots (green on plan / pink off / grey unmarked) + count, 🏋️ day label, ⚖️ weight, ✅ habits done, 💬 notes, 🧪 lab report; day tint = day score; month stats; layer filter chips. Tap a day → DayView in a bottom sheet (phone) / side panel (desktop), editable | Client page → **Calendar** tab, same view in coach mode (`components/CalendarView.jsx`) |
| Juice feast plan (feature `juices`) | Today → 🥤 tracker (Red 8am, smoothie 9:30, Green 1 11am, Green 2 1:30pm or Tangy alt, smoothie 4:30, White 7pm) with ml for their eGFR group; ticks stored in `habit_logs.habits.juices`; recipes + prep rules in Plan → Juices; 🥤 x/6 on calendar | Plan & access → set `profiles.juice_group` ('90' >90, '60' 60–90, '30' 30–60); app suggests from latest eGFR (`labKey==='egfr'`), coach confirms. Data in `src/lib/juices.js` |
| Learn | Plan → Learn: cards from the coach's slides (50/25/25 plate, alkaline vs acidic, high-GI swaps, insulin up/down, diet causes of insulin resistance) — `components/Learn.jsx`; chakra/medical-condition slides intentionally left out | — |
| Printable plan | Plan → "Print / PDF" → `/print/plan`: 2 A4 pages (personal header, coach sticky note, timeline with times + emojis, 50/25/25 plate, juice amounts, house rules; page 2 weekly fridge tick-sheet + swap list). Print CSS at end of styles.css (`.pp-*`) | Diet plan tab → "Print / PDF for client" → `/print/plan/:id` |
| Progress photos | Front/side photos stored under `<uid>/progress` in bucket `media` (no table); Day 1 vs Now compare (`components/ProgressPhotos.jsx`) | Same, per client |
| Daily extras | Fasting gap (yesterday's last meal → first meal today, plan target 12 h), protein total, 🔥 streak, "New note from your coach" banner (seen-time in localStorage) | — |
| Log by chat (AI) | ✨ button (bottom-right; round on phones) → chat sheet. Type or snap a photo ("lunch 2 roti dal salad, weighed 88.7, 30 min incline walk") → AI returns entry cards (meal / weight / water / habit / supplement / workout) → user checks/edits → **Save** or **Save all**. Nothing is saved without a tap. Chat history in localStorage `ft_chat_<uid>` (last 40). `components/ChatLog.jsx`, `lib/chatLog.js` (`askChat`, `saveAction`), edge task `chat`. Cards are filtered by the user's features; dates limited to the last 60 days. Saving fires `ft:data-changed` so DayView/Calendar reload | — |
| Stay signed in | Login → "Keep me signed in on this device" (default on). On: session in localStorage (auto-refresh). Off: session in sessionStorage, ends when the tab/browser closes. `lib/supabase.js` custom `authStorage` + `ft_remember` flag | — |
| Sign-in & activity logs | Me → "Recent sign-ins on your account" (last 5) | Client page → **Activity** tab: feature usage (7/30/90 d), activity timeline, sign-in history (time, event, IP, approx. city/region/country, ISP, device, kept signed in). Tables `login_events` (written only by edge fn `track` with service role; IP from `x-forwarded-for`, geo via ipwho.is, 2 s timeout) and `activity_logs` (triggers `log_activity` on meal/weight/habit/workout/lab/comment/juice/diet tables + `ai_<task>` rows from the ai function). Both read-only for clients; 1-year retention (pruned by `track`). Migration `supabase/migration_v5_logs.sql` |
| Women's health | Only shown when profile gender = Female. Me → 🌸 Women's health (optional): PCOS/PCOD (yes/no/not sure), pregnancy (not pregnant / trying / pregnant + due date / postpartum / breastfeeding), "Track my periods". Period tracker: start/end, flow, symptoms → cycle day, avg cycle, next expected, late by, regular/irregular (`lib/cycle.js cycleStats`, descriptive only). Today shows a one-time prompt, then a cycle-day strip. Chat can log "period started/ended". Calendar 🩸 layer | Client page Overview → 🌸 card (PCOS, pregnancy week, cycle stats, editable); header tags 🤰 Pregnant/Breastfeeding, PCOS/PCOD; booking a juice day for pregnant/breastfeeding asks to confirm. Columns `profiles.pcos/pregnancy/due_date/track_cycle/wh_updated_at`, table `period_logs` — `supabase/migration_v7_womens_health.sql` |
| Cheer toasts | After every successful save a lime toast shows an emoji, title and a random motivating line for that action (meal, on plan, weigh-in, workout, all habits, water goal 8 glasses, all juices, lab report, progress photo, period, chat, profile). Lines praise effort/consistency, never weight or body size. `lib/cheer.js` (`cheer(kind)`, `CHEERS`), `components/CheerToast.jsx` mounted in main.jsx; coaches get a plain "Saved · Updated for your client." | — |
| Recipe book (public, SEO) | `/recipes` (no login): filters diet (default from `profiles.diet_pref` veg/egg/nonveg, set under Me), goal tags, meal, search; `/recipes/:slug` with nutrition, tick-off ingredients, reference credit, share, **Print / Save PDF** (print-only About Fitoor box + QR to the recipe). Plan → Recipes = my recipes; `/recipes/new` editor with dish photo. Visibility: Private, or "Share on the website" → **pending** until a coach approves | Coach/super admin publish directly; Coach panel → **Recipes**: review queue (Publish / Send back with note), published list with views. Public pages credit "Fitoor Kitchen" (staff) or "Fitoor community" (clients), never member names |
| Meal logging (review first) | Slot → add form: photo (AI fills description + kcal/protein/carbs/fat) → user edits any number → **Add meal**. Nothing is saved until Add; closing/clearing deletes the draft photo. `ai.edited_by_user` marks hand-changed numbers ("· edited"). Logged meals show kcal · P · C · F and an "AI breakdown" (items, portions, kcal). Day summary shows kcal, protein, carbs/fat | Same numbers visible/editable per client; Progress sticker "Carbs · fat (avg/day)" |
| 📸 Guess calories (feature `ai`) | Today → "Guess calories from a photo" → `components/CalorieScanner.jsx`: camera/gallery → AI (edge task `meal`, now returns `breakdown[]`, `confidence`, `swap_tip`) → total, editable kcal/P/C/F, portion ½/1/1½/2×, per-item list, tip → "Log this meal" (slot by time of day, cheat option) or just close (photo not kept) | Logged scans show in the client's day with the breakdown |
| Cheat meals / day | Meal ‘🍕 Cheat’ chip or checkbox when adding; Meals card “🍕 Cheat day?” toggle (`habit_logs.habits.cheat_day`) tags all new meals that day. Cheat meals have `followed = null`, are left out of on-plan % (DayView, Calendar, Progress ring) and don’t break streaks. Calendar 🍕 tag + haldi dot | Coach can set a cheat day / mark cheat; weekly AI summary gets `cheat` |
| Terms & Privacy | `/terms`, `/privacy` (`pages/legal/`, constants in `lib/legal.js`: TERMS_VERSION, contact). Signup requires an 18+ / agree checkbox (stored in user metadata). `components/TermsGate.jsx` (in AppLayout + AdminLayout) asks anyone whose `profiles.terms_version` ≠ TERMS_VERSION to agree once; server sets `terms_accepted_at` (trigger `guard_terms`, staff can’t accept for a client). Links: auth pages, home + public footers, Me → Privacy & terms (data request email), chat sheet and scanner AI notes. Bump TERMS_VERSION to re-ask everyone | Same gate for coaches (adds a confidentiality point) |
| Profile photos | Me → photo (Change / Remove); shown in the top bar, “My coach” card and notes | Same on Admin → **My profile** (`/admin/me`, name + phone + photo); photos in client list, client header, Coaches page, dashboard lists, notes. Private bucket `avatars` (`<uid>/<file>.webp`, ≤1 MB, square 512 px cropped on the device) — readable by self, your coach, your clients, super admin; only you can change yours (trigger guard). `profiles.avatar_path`, `user_activity.avatar_path`. `components/Avatar.jsx` (`Avatar`, `AvatarEditor`), `lib/media.js setAvatar/removeAvatar`, `useSignedUrl(path, bucket)`. Mobile: same, `mobile/src/components/Avatar.jsx`, `pickAvatar`. Migration `supabase/migration_v13_avatars.sql` |
| Pricing & AI allowance (v15) | Home → **Pricing** (`#pricing`, from table `ai_tiers`): Free ₹0 = 3 AI chats/day, Plus ₹999 = 19/day, Pro ₹1,999 = 50/day + **Ask AI**. Every feature is on every plan; only AI is metered (chat logs + Ask AI questions, counted from `activity_logs` ai_chat/ai_ask since IST midnight). Me → **Your plan** card (`components/PlanCard.jsx`: usage bar, offer end, "Get Plus/Pro" = upgrade request, no payment gateway). Chat sheet shows "x of y AI chats left today" and stops at 0. **Ask AI** card (`components/AskAI.jsx`, edge task `ask`, data from `lib/askData.js`) on Progress | Same limits for coaches; Ask AI about a client on client Overview (web) / Progress tab (mobile). **Super admin** → `/admin/pricing` (`pages/admin/Pricing.jsx`): edit plans (price, chats/day, Ask AI, shown on home, order, home-page line, add plan), upgrade requests (approve/dismiss), everyone's plan. Per person (`components/TierEditor.jsx`, also client → Plan & access): plan, offer end date (`tier_until`, after it → Free), custom chats/day (`ai_chat_limit`), Ask AI on/off (`ai_ask`), agreed price, note. RPC `ai_quota(uid)`; edge fn returns 429 `code:'limit'` / 403 `code:'upgrade'`. Only super admin can change tier fields (`protect_profile_fields`). `lib/aiQuota.js` (web) / `mobile/src/lib/aiQuota.js`. Migration `supabase/migration_v15_pricing_workouts.sql` |
| Workout logging (v15) | One workout per day + day label: `lib/workouts.js saveWorkout` merges into the existing workout and **replaces** sets of an exercise logged again (chat + manual use it; v15 merged old duplicates). Logger: quick sets "12x20, 10x25" → Fill (`parseSets`), "Last time … Copy", PR hint + "New PR!" tag. **PRs up front**: `components/PRBoard.jsx` on Gym (mobile: "🏆 Your PRs" card), est. 1RM, 🆕 for last 7 days; DayView workout shows PR badges | Same per client |
| Meal saving | Slot → tick several plan options + "Anything else you had?" + note → **Save meal (n items)**. Ticked-only = on plan. Saving no longer jumps the page to the top (quiet reload) | Same |
| Export | CSV for weight history and the lab compare table (`lib/csv.js`) | Same |
| Notes | Thread with coach (per day or general, context tags) | Comment anywhere |
| AI weekly check-in | — | Client Overview → "Draft with AI": 7-day review (wins / watch / suggestions + editable message) → "Send as note" (`components/AiWeeklySummary.jsx`, edge task `summary`, coach-only) |
| Invite | — | Clients → Copy signup link / Invite on WhatsApp |
| Admin dashboard | — | KPIs, meals/day (on vs off plan), weigh-ins & workouts/day, **Needs attention** list, latest meal photos feed |
| Admin user detail | — | Tabs: Overview (30-day heatmap, adherence, kcal, weight), Daily log, Weight, Gym, Labs, Diet plan, **Plan & access**, Notes |
| Plans & feature flags | Sees own enabled features on Profile | Edit plan → feature matrix; **per-user overrides**; pause account; make admin |

### Roles & editing (who can change what) — multi-coach since v6 (2026-11-21)
- Roles (`profiles.role`): **user** (client) · **coach** · **super_admin**. admin@himanshuahuja.in is the super admin (was `admin`). Staff (coach + super_admin) use the `/admin` panel; `/app` redirects them there.
- **Super admin** sees and manages everything: all clients, the **Coaches** page (`/admin/coaches`: make a coach by email, edit coach codes, remove a coach → their clients become unassigned), assigns/changes a client's coach (client page → Plan & access → Coach, with history in `coach_assignments`), subscription plans and per-client feature switches, sign-in history (IP/location). Only the super admin sees coach names on other coaches' work and the assignment history. The super admin also has a coach code and can coach clients.
- **Coach** sees ONLY clients whose `profiles.coach_id` = them (current assignment). When a client moves coach, the old coach loses access immediately; the new coach sees the full history, but the old coach's profile is hidden by RLS, so their notes show as **"Previous coach"** (`Comments.jsx authorLabel`). Coaches can't change plan/features/role/coach (trigger `protect_profile_fields`), can set juice amounts.
- **Signup**: optional **coach code** field; an invite link `/signup?coach=CODE` pre-fills and locks it (`useCoachCode` in Auth.jsx, RPC `coach_lookup(code)` shows the coach's first name). `handle_new_user` assigns `coach_id` from `raw_user_meta_data.coach_code`. No/invalid code → unassigned → super admin's Overview card **"Waiting for a coach"** + Clients filter.
- **Templates**: super admin's diet templates are shared with all coaches; a coach's own templates are private (`diet_plans.created_by`). Exercise library is shared.
- SQL helpers: `is_super()`, `is_staff()`, `is_admin()` (= is_staff, legacy), `coaches(uid)` (super admin or the client's current coach), `coaches_path(text)` (storage), `my_coach_id()`. Every data policy is "owner or `coaches(user_id)`" — see `supabase/migration_v6_coaches.sql`. View `user_activity` is `security_invoker` so coaches only see their own clients.
- **Coach** can view, **add, edit and delete** everything for their clients: meals (text, kcal, protein, on/off plan), weight, habits, workouts (sets, day label, notes), lab values (Labs → Edit values), diet plan, plan/features, and comment anywhere (`DayView mode="admin"`, all panels take `userId`).
- **Client** can do the same on their own data and sees every coach change and note immediately (same tables; Today → Coach's notes, Labs → Health notes, Plan shows "Updated <date>"), and can reply.
- RLS: select/update/delete = owner or `coaches(user_id)`; insert = (owner + feature) or `coaches(user_id)` — see `supabase/migration_v6_coaches.sql` (supersedes policies_v2.sql).

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
`plans(name, features[])` · `profiles(id=auth.uid, full_name, email, phone, role user|admin, plan_id, height_cm, start_weight, target_weight, goal, active)` · `user_features(user_id, feature, enabled)` · `diet_plans(user_id|null, is_template, is_active, slots jsonb, guidelines[], notes)` · `meal_logs(user_id, log_date, slot, description, photo_path, followed, kcal, protein_g, carbs_g, fat_g, ai jsonb)` · `weight_logs(user_id, log_date UNIQUE per user, weight_kg, waist_cm, photo_path, source manual|ai)` · `habit_logs(user_id, log_date PK, habits jsonb, supplements jsonb)` · `exercises(name unique, muscle_group, equipment, kind strength|cardio|mobility)` · `workouts(user_id, log_date, day_label, duration_min, notes)` · `workout_sets(workout_id, user_id, exercise_id, set_no, reps, weight_kg, duration_min, distance_km, incline)` · `lab_reports(user_id, report_date, lab_name, file_path)` · `lab_results(report_id, user_id, panel, test_name, value, value_text, unit, ref_low, ref_high, ref_text, flag low|high|normal)` · `comments(user_id, author_id, log_date, context, body)` · `body_measurements(user_id, log_date UNIQUE per user, neck, chest, arm, waist, belly, hips, thigh, calf — inches, note)` (v9, `supabase/migration_v9_measurements.sql`; helpers `src/lib/measure.js`, UI `components/Measurements.jsx`) · view `user_activity` (admin stats per user).

Rules:
- **All dates are local calendar dates** `YYYY-MM-DD` (`lib/dates.js`), never UTC-derived.
- Helper fns `is_admin()`, `has_feature()`, `my_features()` are `security definer` — use them in policies, never query `profiles` directly inside a `profiles` policy (recursion).
- Trigger `protect_profile_fields` stops non-admins changing their own `role/plan_id/active` (SQL editor / service role allowed).
- New signups get a profile automatically (trigger on `auth.users`) with plan **Diet + Fitness**.
- Schema changes: edit `schema.sql` so it stays idempotent (`if not exists`, `create or replace`, policies are dropped & recreated), then re-run it. Test locally if possible.
- Storage: private bucket `media`, path `<user_id>/<folder>/<file>` (folders: meals, scale, machines, labs). Read via signed URLs (`useSignedUrl`). Owner or admin only.

## 5. AI
Edge function `supabase/functions/ai` (150 s limit on free plan — Netlify functions were too short at 10 s). Client: `runAI(task, { image|file: base64, mime, ...})`.
- Tasks: `ask` (question + `about` self|client + data snapshot → `{answer, follow_ups[]}`, needs `can_ask`), `chat` (text and/or image, log-by-chat → `{reply, actions[]}`, client confirms each action before it's saved), `summary` (text-only, coach-only) → `{headline, wins[], watch[], suggestions[], message_to_client}`; `scale` → `{weight_kg}`; `meal` (+slot, plan items/avoid) → `{items, kcal, protein_g, carbs_g, fat_g, plan_check, plan_note}`; `machine` (+library names) → `{machine, how_to, exercises[]}`; `lab` (PDF/image, client sends `known` test names) → model returns pipe lines `DATE|`, `LAB|`, `R|panel|test|value|unit|low|high|ref` which the function parses into `{report_date, lab_name, results[]}` (one big JSON blob broke on a 41-page report).
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
- Mobile-first: test at 390px wide. Touch targets ≥ 44px. Floating bottom nav on mobile (up to 6 items: Today, Calendar, Progress, Gym, Labs, Plan; Me lives in the top bar). **Laptop ≥ 900px: top menu `DeskBar` in `Layout.jsx`** (row 1: logo, greeting + date + daily tip, Me, Sign out; row 2: menu tabs). The old sidebar is hidden. Coach panel uses the same bar in ink. Today's title is "Your day" on laptop so the greeting isn't shown twice (`.desk-only` / `.phone-only`).
- Dev helpers (vite.config.js, dev server only, localhost only): `/__dev/deploy-ai` redeploys the AI edge function (`?name=track` for another function); `/__dev/sql?file=supabase/dev/x.sql` runs SQL via Management API; `/__dev/login-as?email=…` opens a one-time magic link for testing as that user.
- **Design language (v2, Gen Z "sticker" theme — Nov 2026):** mint paper bg `--paper-bg #EEF6E8`, ink `--ink #12261B` outlines (2px) and offset "pop" shadows (`--pop: 3px 3px 0 ink`) on things you tap; sticker colours `--lime #C8F25A` (primary highlight / active states), `--lav #BBA8FF`, `--sky #8FD3FF`, `--haldi #FFB627`, `--chilli #FF5D73` (off-plan / high flags); brand greens `--deep #1A5A3C`, `--fresh #2FA35F`. Buttons: `.btn-primary` = ink bg + lime text, `.btn-pop` = lime + ink border; they press down on :active. Stat tiles cycle lime/lav/sky/haldi. Fonts: **Bricolage Grotesque** (display/headings), **DM Sans** (body). Theme overrides live at the END of `src/styles.css` (v2 section) — base rules above it are older.
- Tone: casual, short, Gen Z-friendly but clear (sentence case, emojis only as markers: meal slots 🌅🥤🥞🍛☕🥣🌙✨, streak 🔥).
- Gamification: streak = consecutive days with any meal/weight/workout logged (`Today.jsx useStreak`).
- Home (`pages/Home.jsx`): interactive **Build-your-thali** (25% plate rule, live balance score), goal picker chips, marquee, bento feature grid, how-it-works, FAQ accordion. No fake testimonials or user counts.
- **Brand:** name **Fitoor**, tagline **"Plate se PR tak."** (deep-green text under the wordmark); homepage headline **"Thali on point. Reps on track. Streak on fire."**. Logo mark = flame (haldi + chilli) rising from a lime thali on an ink rounded tile = junoon on your plate. Wordmark Bricolage Grotesque ExtraBold as outlined paths. Files (`brand/`, `public/`): `logo(-dark).svg` full lockup with tagline (home footer, auth card), `logo-inline(-dark).svg` icon + Fitoor for nav bars (`<Logo />` default, `<Logo full />` = lockup), `icon.svg` favicon, `app-icon.svg` full-bleed ink square for iOS/PWA.
- Health content: the app **never gives medical advice**; lab flags only compare to the report's reference range and tell users to consult their doctor.
- Copy is friendly, short, Indian-English; food names in common Indian terms (chilla, makhana, dal…).
- Photos are compressed **before** upload (`uploadMedia`) — keep storage under the 1 GB free tier.

### Recipes & SEO (v8, 21 Nov 2026)
- Table `recipes` (slug, title, summary, diet, tags[], meal_types[], prep/cook min, servings, kcal/protein/carbs/fat, ingredients jsonb [{qty,item}], steps[], tips, image_path, source_name/url, author_id, by_staff, status private|pending|public|rejected, review_note, reviewed_by, published_at, views) — `supabase/migration_v8_recipes.sql`. Trigger `recipe_guard`: client "public" → pending, client edit of a public recipe → pending, sets slug/by_staff/published_at. RLS: anon sees status='public' only; owner/super/coach-of-author see the rest; staff can approve pending. RPC `recipe_view(slug)` counts views. Public storage bucket `recipes` (`<uid>/<file>.webp`).
- Constants/helpers in `src/lib/recipes.js` (DIETS, TAGS, MEALS, STATUS, imageUrl, uploadRecipeImage). Pages `src/pages/recipes/` (RecipeList, RecipeDetail with `recipeJsonLd`, RecipeEditor), `src/components/PublicShell.jsx`, `MyRecipes.jsx`, `pages/admin/Recipes.jsx`.
- SEO: Netlify edge functions `netlify/edge-functions/recipe-seo.ts` (injects title, meta, OG, canonical, Recipe + Breadcrumb JSON-LD and plain HTML of the recipe into index.html for /recipes and /recipes/*; 404 + noindex for unknown slugs) and `sitemap.ts` (/sitemap.xml from public recipes). Both read Netlify env VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at runtime. `public/robots.txt`. Tag pages are `/recipes?tag=…` / `?diet=…`.
- Starter recipes (`supabase/seed_recipes.sql`): 6 popular healthy Indian dishes written in our own words with a reference link. Never copy recipe text or photos from other sites.

## Mobile app (Expo / React Native) — `mobile/` (v12, 21 Nov 2026)
- Separate Expo SDK 58 app (React 19.3, RN 0.88, Expo Router, routes in `mobile/src/app/`) on the **same Supabase project**, same tables/RLS/edge functions (`ai`, `track`). Distributed with **EAS** (`eas.json`: development / preview .apk / production). App id `life.fitoor.app`, scheme `fitoor://`. See `mobile/README.md`.
- **Netlify never builds or publishes it**: `netlify.toml [build] ignore` skips the website build when a push only changes `mobile/` (first builds / same-ref deploys still build). Vite only bundles `src/`.
- Env: `mobile/.env` (git-ignored) with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_URL` only — never service-role/AI keys. For EAS builds set the same 3 with `eas env:create`.
- Client screens: tabs Today (streak, 📸 scanner CTA, juice reminder + move request, cycle strip, coach-note banner, `DayView`, ✨ chat FAB), Calendar, Progress, Gym, Plan (diet / juices / recipes / learn); stack: Me (profile, DOB 18+, diet pref, 🌸 women's health + period tracker, coach, plan features, last 5 sign-ins, terms/privacy, data-request mailto, sign out), Weight & inches, Labs (PDF/photo → AI → review → save, compare + trend), Scan, Chat, Recipes (list/mine/detail/share/editor with photo). TermsGate modal, cheer toasts.
- Coach screens (`/coach`, coach + super admin): client list (search, needs attention, super-admin filter incl. waiting for a coach), juice-day move requests, recipe review queue (publish / send back), client page tabs Day (`DayView mode="admin"`, can add/edit), Calendar, Progress, Weight, Gym, Labs, Plan (juice group + diet plan view + women's health), Notes. Plan editor/templates, plans & features, coaches, assignment, juice booking, activity logs, AI weekly check-in, print, CSV stay **web-only** (button opens the web panel).
- Shared logic: `mobile/src/shared/*` is COPIED from `src/lib` (dates, constants, cycle, labNames, juices, legal, measure, cheer, chatLog, juiceDays) by `npm run sync-shared` (`mobile/scripts/sync-shared.mjs`, rewrites window events → `mobile/src/lib/events.js`). **When you change one of those web libs, run sync-shared** (and keep `mobile/src/lib/recipes.js` in step with `src/lib/recipes.js`).
- Native helpers: `mobile/src/lib/media.js` (expo-image-picker → expo-image-manipulator JPEG ≤1280px → upload to `media`/`recipes`; expo-document-picker for lab PDFs ≤4 MB; signed URLs), `supabase.js` (AsyncStorage session, AppState auto-refresh), `auth.jsx` (same `has()`/roles as web), `components/ui.jsx` kit, `theme.js` (sticker colours), `LineChart.jsx` (react-native-svg).
- Install packages with `EXPO_OFFLINE=1 npx expo install <pkg>` in the sandbox (proxy blocks api.expo.dev). Check with `npm run check` (Metro Android bundle); `npx expo-doctor` needs network.

## 9. Roadmap / ideas not built yet
- Push reminders at meal times (PWA push; iOS 16.4+ when installed to home screen) — needs a Supabase cron + web-push.
- ~~Capacitor iOS build~~ → replaced by the Expo app in `mobile/`. Next: push notifications (expo-notifications + Supabase cron), store listings.
- Wearable import (Apple Health) once native.

## 10. Changelog
- 2026-11-22 — **Pricing + AI limits** (v15): Free/Plus/Pro AI tiers on the home page, per-day AI allowance for clients and coaches, Ask AI (Pro), super admin Pricing page with custom offers per person, upgrade requests. Workouts merge per day+label (no more repeated "Pull"), quick-set logger, PR board. Meal slot multi-select + Save button, no scroll-to-top on save, chat "Try again" after a dropped connection (`lib/ai.js` retries once on network errors). Mobile: same (Me plan card, chat allowance, Ask AI, gym logger/PRs). `askData` + `workouts` added to `sync-shared`.
- 2026-11-21 — Juice days (v14): per-client coach setting “Food on juice days” (juices only / allow logging, tagged 🧃 + off plan). Log-by-chat now tells the AI which cards were SAVED / NOT saved / skipped (`cardNote` in `lib/chatLog.js`), so it no longer claims a failed save was logged.
- 2026-11-21 — Logging fixes (web + mobile): tapping a diet-plan option in a meal slot now **logs it in one tap** as on plan (was only filling the text box, so nothing saved); every save shows a toast (new `cheer('saved')`, `cheer('removed')`, `cheer('error', msg)`), habit/supplement ticks included; DayView changes fire `ft:data-changed` so Calendar/Progress refresh (incl. editing a day inside the calendar sheet).
- 2026-11-21 — **Profile photos** (v13): clients and coaches add a photo (web + mobile); shown in top bar, My coach, notes, coach lists and client header. Coaches get `/admin/me`. Private `avatars` bucket + RLS, `migration_v13_avatars.sql`.
- 2026-11-21 — Mobile QA pass: every client/coach/auth screen and main tap flows checked at 390 px (web build + mocked Supabase). Fixes: crash in segmented control, screens rendering before the profile loaded, tab bar height on iPhones with a home bar, macro inputs running off-screen (now 2×2 `MacroFields`), meal edit/delete icons, typed YYYY-MM-DD dates → `DateField` ‹ date › picker, DOB as DD/MM/YYYY, comma decimals, iOS keyboard insets, gallery without permission prompt, coach invite Share button. Added expo-updates (OTA) and a publish menu in `mobile/build-app.command` (Android APK link, iOS TestFlight, push update, Expo Go).
- 2026-11-21 — **Expo mobile app** (v12): new `mobile/` folder, iOS + Android app on the same Supabase backend with client + coach screens (see Mobile app section). Netlify `ignore` rule so mobile-only pushes don't rebuild the site.
- 2026-11-21 — **Pre-launch QA** (v11): end-to-end test of visitor, client, coach and super admin at 360/390/768/1024/1440 px. Fixes: Weight page sideways scroll on phones (measurement table in a grid), template dropdown overflow, chat/scanner meals now tagged cheat on a cheat day, AI weekly check-in no longer criticises cheat meals, friendlier login/signup errors, under-18 DOB blocked on Me, short-range chart axes, bigger tap targets (water glasses, toggles, footer links), labels on gym set inputs and note box. DB: helper functions no longer callable by visitors; public `recipes` bucket limited to images ≤ 3 MB (`supabase/migration_v11_hardening.sql`). QA accounts `qa-*@fitoor.life` kept on purpose (credentials in git-ignored `supabase/dev/QA_ACCOUNTS.md`); harness `supabase/dev/qa2.js`.
- 2026-11-21 — v10: meals are reviewed before saving with editable kcal/protein/carbs/fat, 📸 Guess calories scanner, cheat meals/days, Terms of Service + Privacy Policy (DPDP Act) with consent gate. Weekly AI check-in now sends first name only. Migration `supabase/migration_v10_cheat_terms.sql`.
- 2026-11-21 — **Body measurements** (v9): optional inches at 8 spots, inches lost, trends, chat logging, Progress sticker.
- 2026-11-21 — **Recipe book** (v8): public /recipes with filters + SEO edge function + sitemap, print/PDF with QR + About Fitoor, client recipes reviewed by coaches, diet preference on profile, 6 starter recipes.
- 2026-11-21 — **Multi-coach** (v6): roles user/coach/super_admin, coach codes + invite links, Coaches page, assignment + history, previous coach hidden from new coach, RLS rewritten around `coaches(uid)`. **Women's health** (v7): PCOS/PCOD, pregnancy, period tracker.
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
- On a juice day DayView shows the juice checklist; food depends on the coach's per-client setting `profiles.juice_allow_food` (Plan & access → Juice days → “Food on juice days”; mobile coach Plan tab toggle). false (default) = juices only, the trigger `block_food_on_juice_day` rejects client meal inserts; true = client sees “+ I ate something, log it”, the meal is tagged `ai.juice_day = true` and `followed = false` (unless cheat). Coaches can always record. Only the coach/super admin can change the setting (`protect_profile_fields`). `supabase/migration_v14_juice_day_food.sql`.
- Trigger `guard_juice_day`: clients can only set request_day/reason (→ pending) or mark done. The old `juices` plan feature was removed from all plans.
- Personal data import scripts (`supabase/import/`, `RUN_IN_SUPABASE_v2.sql`) are git-ignored: the GitHub repo is public.

### QA / testing (21 Nov 2026)
- Accounts: qa-admin (super_admin), qa-coach (coach, code QA59), qa-client (female, client of QA59, signed up via invite link), qa-client2 (assigned by super admin). Credentials: `supabase/dev/QA_ACCOUNTS.md` (git-ignored).
- Harness (dev server only): in the browser console on localhost:5173 → `const q = await import('/supabase/dev/qa2.js'); await q.check(['/app','/app/weight'], [360,390,768,1024,1440])` loads each route in hidden iframes and reports sideways overflow, console errors, broken images and small tap targets; `q.problems(res)` lists only failures. Helpers `fill`, `byLabel`, `card`, `btn` drive React forms.
- The browser pane auto-dismisses `confirm()`; call `q.stubDialogs()` before clicking buttons that confirm.

