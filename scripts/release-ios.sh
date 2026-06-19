#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEVICE_ID="${IOS_DEVICE_ID:-38A49622-3C0D-5EDB-81B3-8564E4830456}"
BUNDLE_ID="${IOS_BUNDLE_ID:-com.ralhkt.hkelectricity}"
DERIVED_DATA="${IOS_DERIVED_DATA:-$ROOT/ios/DerivedData/device}"
APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphoneos/App.app"

cd "$ROOT"
npm run verify
npm run cap:sync

cd "$ROOT/ios/App"
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -destination "id=$DEVICE_ID" \
  -allowProvisioningUpdates \
  -derivedDataPath "$DERIVED_DATA" \
  build

xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"

echo "Installed and launched on device $DEVICE_ID"