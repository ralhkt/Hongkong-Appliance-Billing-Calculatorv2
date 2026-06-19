# App Store Submission Checklist — 港電費計算器

Saved for later. Project: `Hongkong-Appliance-Billing-Calculatorv2`

## Current app state (as of handoff)

| Item | Value |
|------|-------|
| App name | 港電費計算器 |
| Bundle ID | `com.ralhkt.hkelectricity` |
| Version | 2.1.0 |
| Team ID | `6XU2SSHC7M` |
| Stack | Capacitor 7 + inline web UI + MEELS on-device lookup |
| Device deploy | `npm run release:ios` (Debug → connected iPhone) |

## What works today

- HK electricity bill calculator (CLP / HKE tariffs)
- MEELS model lookup (~7,491 models, free, on-device, fuzzy matching)
- Energy label scan (camera / album + ML Kit OCR)
- Grok paste fallback when model not in MEELS
- Privacy strings in `ios/App/App/Info.plist`

## App Store — still to do

### 1. Apple Developer Program
- Enroll: https://developer.apple.com (US$99/year)
- Same Apple ID as Xcode team `6XU2SSHC7M`

### 2. App Store Connect
- https://appstoreconnect.apple.com → My Apps → New App
- Bundle ID: `com.ralhkt.hkelectricity`
- SKU example: `hkelectricity-2026`

### 3. Release build (not Debug)
```bash
cd /Users/Personal/Hongkong-Appliance-Billing-Calculatorv2
npm run verify
npm run cap:sync
open ios/App/App.xcworkspace
```
Xcode: **Any iOS Device** → **Product → Archive** → **Distribute → App Store Connect**

### 4. Required assets
- [ ] Full App Icon set (1024×1024 master → all sizes in `Assets.xcassets`)
- [ ] iPhone screenshots (6.7" and 6.5" minimum)
- [ ] App description (EN + ZH)
- [ ] Keywords: 電費, MEELS, CLP, 中電, electricity, etc.
- [ ] Support URL (GitHub or simple page)
- [ ] Privacy Policy URL (recommended — data stays on-device)

### 5. App Privacy label
- Declare: no server collection; camera/photos for label scan only; no tracking

### 6. Review prep
- [ ] Test **Release** build on real device before upload
- [ ] Export compliance: typically “No” (standard encryption only)
- [ ] Age rating: likely 4+
- [ ] Cite EMSD MEELS as data source in description

## Suggested path
1. TestFlight internal test (same archive as App Store)
2. Fix any issues
3. Submit for review (usually 1–3 days)

## Optional next engineering tasks
- [ ] `scripts/release-appstore.sh` (Release archive + upload)
- [ ] Complete App Icon asset catalog
- [ ] App Store description + privacy policy draft
- [ ] `ITSAppUsesNonExemptEncryption = NO` in Info.plist if needed
- [ ] GitHub push (needs `workflow` scope for CI — `npm run push:github`)

## MEELS lookup test examples (for QA before submit)
| Brand | Model | Expected kWh |
|-------|-------|--------------|
| Siemens | KI38VA00HK | 283 |
| Siemens | KI38VA00H | 283 (typo) |
| Panasonic | NR-C320EH-N3 | 242 |
| 大金 | FTXS25EVMA8 | 263 |
| Samsung | WA70M4000SW | 22 |
| LG | 43UK6500PLL | 104 |

## Key paths
- Main UI: `index.html`
- MEELS search: `src/domain/meels-registry.js`
- MEELS data build: `scripts/build-meels-index.mjs` → `data/meels-index.json`
- iOS project: `ios/App/App.xcworkspace`
- Capacitor config: `capacitor.config.json`