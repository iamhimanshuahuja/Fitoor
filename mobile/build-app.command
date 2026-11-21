#!/bin/bash
# Double-click in Finder. Installs, checks and builds the Fitoor mobile app with Expo / EAS.
cd "$(dirname "$0")" || exit 1
set -e
echo "== Fitoor mobile =="
if [ ! -t 0 ] && [ -z "$EXPO_TOKEN" ] && ! grep -q '^EXPO_TOKEN=' .env 2>/dev/null; then
  echo "This needs a real Terminal (it asks you to log in to Expo and pick a build)."
  echo "Open Terminal and run:  cd \"$(pwd)\" && ./build-app.command"
  echo "(Or add EXPO_TOKEN=... from expo.dev → Account settings → Access tokens to mobile/.env)"
  exit 1
fi
if [ ! -f .env ]; then cp .env.example .env; echo "Created mobile/.env — paste the anon key into it, then run this again."; open -e .env; exit 1; fi
npm install
npx expo install --fix || true
npx expo-doctor || true
set -a; source .env; set +a
npx eas-cli@latest whoami >/dev/null 2>&1 || npx eas-cli@latest login
grep -q '"projectId"' app.json || npx eas-cli@latest init --non-interactive --force || npx eas-cli@latest init
set -a; source .env; set +a
for k in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_WEB_URL; do
  npx eas-cli@latest env:create --name "$k" --value "${!k}" --environment preview --environment production --visibility plaintext --force --non-interactive >/dev/null 2>&1 || true
done
echo ""
echo "1) Android APK you can install / share (≈15 min, link appears at the end)"
echo "2) iOS build (needs Apple Developer account)"
echo "3) Just run on my phone with Expo Go (QR code)"
read -p "Pick 1, 2 or 3: " c
case "$c" in
  1) npx eas-cli@latest build --profile preview --platform android ;;
  2) npx eas-cli@latest build --profile production --platform ios ;;
  *) npx expo start ;;
esac
