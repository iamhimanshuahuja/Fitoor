#!/bin/bash
# Fitoor mobile: install, check, build and share with Expo / EAS.
# Run in Terminal:  cd /var/www/fitoor/mobile && ./build-app.command
cd "$(dirname "$0")" || exit 1
echo "== Fitoor mobile =="
if [ ! -t 0 ] && [ -z "$EXPO_TOKEN" ] && ! grep -q '^EXPO_TOKEN=' .env 2>/dev/null; then
  echo "This needs a real Terminal (it asks you to log in to Expo and pick a build)."
  echo "Open Terminal and run:  cd \"$(pwd)\" && ./build-app.command"
  exit 1
fi
if [ ! -f .env ]; then cp .env.example .env; echo "Created mobile/.env — paste the anon key into it, then run this again."; open -e .env; exit 1; fi
set -e
set -a; source .env; set +a
EAS="npx --yes eas-cli@latest"
npm install
npx expo install --fix || true
npx expo-doctor || true
$EAS whoami >/dev/null 2>&1 || $EAS login
grep -q '"projectId"' app.json || $EAS init
grep -q '"url": "https://u.expo.dev' app.json || $EAS update:configure --non-interactive || true
for k in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_WEB_URL; do
  for env in preview production; do
    $EAS env:create --name "$k" --value "${!k}" --environment "$env" --visibility plaintext --force --non-interactive >/dev/null 2>&1 || true
  done
done
echo ""
echo "What do you want to do?"
echo "  1) Android app: build an installable APK + share link (anyone with the link can install)"
echo "  2) iPhone app: build and send to TestFlight (needs Apple Developer account, \$99/yr)"
echo "  3) Push a fix to installed apps (no rebuild, no store review)"
echo "  4) Just try it on my phone with Expo Go (QR code)"
echo "  5) iPhone by cable, free (needs Xcode; free Apple ID; reinstall every 7 days)"
read -p "Pick 1-5: " c
case "$c" in
  1) $EAS build --profile preview --platform android
     echo ""; echo "Share the install link above (or the QR code) with your users. Android will ask to allow installs from this source." ;;
  2) $EAS build --profile production --platform ios --auto-submit
     echo ""; echo "When Apple finishes processing, open App Store Connect → TestFlight → add testers or turn on a public link." ;;
  3) read -p "What changed (one line)? " msg
     $EAS update --channel preview --message "${msg:-Update}" --environment preview
     $EAS update --channel production --message "${msg:-Update}" --environment production ;;
  5) if ! xcodebuild -version >/dev/null 2>&1; then
       echo "Xcode isn't installed. Opening the App Store page: install it, open it once, then run this again."
       open "macappstore://apps.apple.com/app/id497799835"; exit 1
     fi
     echo ""
     echo "Before it builds:"
     echo "  • Plug in your iPhone with a cable, unlock it and tap Trust."
     echo "  • Xcode → Settings → Accounts → + → sign in with your Apple ID (free is fine)."
     echo "  • iPhone: Settings → Privacy & Security → Developer Mode → On (it restarts)."
     read -p "Done? Press Enter to build (first build takes 10–20 min)… " _
     npx expo run:ios --device --configuration Release
     echo ""
     echo "If the app won't open: iPhone Settings → General → VPN & Device Management → tap your Apple ID → Trust."
     echo "With a free Apple ID the app stops opening after 7 days. Run option 5 again to reinstall (your data stays in Fitoor)." ;;
  *) npx expo start ;;
esac
