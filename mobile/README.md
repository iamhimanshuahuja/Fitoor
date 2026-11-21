# Fitoor mobile app (Expo / React Native)

Native iOS + Android app for Fitoor. Uses the **same Supabase backend** as the website (same tables, RLS, edge functions `ai` and `track`), so a meal logged on the phone shows up on the web and for the coach straight away.

Netlify never builds or publishes this folder (see `ignore` in `../netlify.toml`). Distribution is via **Expo / EAS**.

## 1. Run it on your phone (5 minutes)

```bash
cd mobile
cp .env.example .env        # paste the anon/publishable key (same as VITE_SUPABASE_ANON_KEY)
npm install
npx expo start              # scan the QR code with Expo Go (Android) or the Camera app (iPhone)
```

`.env` only holds browser-safe values:

| Key | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://njqqqhiuaptiwvazqawn.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the anon / publishable key |
| `EXPO_PUBLIC_WEB_URL` | `https://fitoor.life` (terms, privacy, reset links, recipe share links) |

Never put the service-role key, AI keys, DB password or `SUPABASE_ACCESS_TOKEN` here: anything `EXPO_PUBLIC_*` is baked into the app.

## 2. Build and share (EAS)

**Easiest:** in Terminal run `cd /var/www/fitoor/mobile && ./build-app.command` (not VS Code's Code Runner, it can't take input). It installs, runs expo-doctor, logs you in to Expo, links the project, turns on over-the-air updates, copies the 3 `EXPO_PUBLIC_*` values to EAS, then asks:

1. **Android APK + share link**: anyone with the link installs Fitoor; it runs on its own, your Mac doesn't need to be on.
2. **iPhone → TestFlight**: needs an Apple Developer account ($99/yr). Add testers or a public TestFlight link in App Store Connect.
3. **Push a fix to installed apps**: JS/UI changes reach everyone's installed app on next open, no rebuild or store review (native changes like new packages still need option 1/2).
4. **Expo Go QR**: quick test on your own phone (needs your Mac running).

Or by hand:

```bash
npm i -g eas-cli            # or use npx eas-cli@latest
eas login                   # your Expo account
eas init                    # first time only: links the project, writes the projectId into app.json
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://njqqqhiuaptiwvazqawn.supabase.co --environment preview --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --environment preview --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_WEB_URL --value https://fitoor.life --environment preview --environment production --visibility plaintext

npm run build:preview       # Android .apk you can send on WhatsApp / install directly
npm run build:ios           # iOS build (needs an Apple Developer account, $99/yr)
eas submit -p android       # Play Store (needs a Google Play developer account)
eas submit -p ios           # App Store / TestFlight
npm run update              # push a JS-only fix to installed apps (EAS Update), no store review
```

Profiles are in `eas.json`: `development` (dev client), `preview` (internal .apk), `production` (store builds, auto version bump).

App ids: `life.fitoor.app` (iOS bundle id and Android package). Deep link scheme: `fitoor://`.

## 3. Supabase settings for the app

Supabase → Authentication → URL Configuration → Redirect URLs: add `fitoor://**` (keep the web ones). Password reset emails open the website reset page (`EXPO_PUBLIC_WEB_URL/reset`), which already works.

## 4. Code layout

```
src/app/                 Expo Router screens (file = route)
  index.jsx              entry: login / client app / coach app
  (auth)/                login, signup (coach code + ?coach= invite), reset
  (app)/(tabs)/          client tabs: today, calendar, progress, gym, plan
  (app)/                 me, weight, labs, scan (📸 guess calories), chat (✨ log by chat), recipes, recipe/[slug], recipe-new
  coach/                 coach + super admin: clients, client/[id] (day, calendar, progress, weight, gym, labs, plan, notes), recipe reviews
src/components/          DayView (the core day screen, user + coach mode), ui.jsx kit, charts, panels shared by client and coach
src/lib/                 supabase (AsyncStorage session), auth, ai, media (camera, compress, upload), events, recipes, track
src/shared/              COPIED from ../src/lib by `npm run sync-shared`. Don't edit here.
src/theme.js             colours from the web sticker theme
```

### Shared logic
Pure helpers (dates, constants, cycle, labNames, juices, legal, measure, cheer, chatLog, juiceDays) are copied from the website's `src/lib` so both apps behave the same. After changing one of those on the web:

```bash
npm run sync-shared
```

The script rewrites imports for React Native (window events → `src/lib/events.js`).

### Check before pushing
```bash
npm run check               # bundles the Android app with Metro (catches syntax/import errors)
```
The app also builds for the web (`npx expo export --platform web`), which is handy for clicking through every screen in a browser against a mocked Supabase. Text must always sit inside `<Text>`: a bare string or `{count && …}` with count 0 inside a `<View>` crashes iOS/Android (the web silently allows it).

## 5. What's web-only for now
Diet plan editor and templates, plan/feature matrix, coaches page, coach assignment, juice-day booking, activity/sign-in history, AI weekly check-in, printable plan, CSV export. The coach app links to the web panel for these.
