# Handoff: v1.4.5 Android and M3 Expressive mobile pass

Date: 2026-05-19
Branch: `codex/fix-mobile-safe-area-regressions`

## Scope

This pass fixes the mobile fixed-layer regressions reported from Pixel/Android screenshots and broadens the app shell toward Material 3 Expressive principles across the main page-mode surfaces.

References used:
- https://m3.material.io/blog/building-with-m3-expressive
- https://developer.android.com/develop/ui/compose/designsystems/material3

## Version

- `app.js`: `APP_VERSION = "1.4.5"`
- `sw.js`: `APP_VERSION = "1.4.5"`, `CACHE_VERSION = "lift-v14"`
- `version.json`: `1.4.5`, build `2026-05-19`
- `android/app/build.gradle.kts`: `versionCode = 16`, `versionName = "1.4.5"`

## Main Changes

- Fixed Android/system-bar contrast by syncing light/dark status and navigation bar icon appearance from web theme changes into the Android bridge.
- Tightened bottom safe-area layout so workout content, rest timer, toasts, and bottom nav share one measured bottom spacing model.
- Kept page-mode destinations such as Plan, Progress, Body, Library, and Settings above the bottom nav while modal-mode sheets hide the nav and fixed rest controls.
- Reworked the Settings page into a Material 3 Expressive page surface with hero, grouped settings, segmented choices, switch rows, number controls, and Android integration status rows.
- Added shared M3 page-mode styling for cards, fields, actions, and page surfaces so drawer and tab pages use consistent container, shape, and control treatment.
- Added deeper Android bridge support:
  - `LiftAndroid.setSystemBars(theme)`
  - `LiftAndroid.getAndroidInfo()`
  - native `MainActivity.applySystemBars(theme)`
  - Android XML light status/navigation bar defaults
- Fixed a newly found snackbar overlap where set-completion toasts could cover the active rest timer. Toasts now move to the top snackbar position while a rest timer is present.

## Verification Run

Static checks:
- `node --check app.js`
- `node --check sw.js`
- `node --check features/*.js`
- `git diff --check`

Browser/mobile verification:
- Served locally at `http://127.0.0.1:4173`.
- Used Python Playwright with Pixel 7 sized viewport `425x917`, mobile/touch emulation.
- Blocked service workers for the UI-state assertion pass to avoid the expected reload triggered by the cache-version bump.
- Verified:
  - app reports version `1.4.5`
  - Plan page opens as `data-mode="page"` with nav visible and page sheet landing above nav
  - Settings page opens as `data-mode="page"` with 14 settings rows, 4 groups, 2 segmented controls, and 5 switches
  - Readiness opens as `data-mode="modal"` with bottom nav hidden, aria-hidden, and pointer-events disabled
  - active rest timer sits above nav
  - last visible set row scrolls above rest timer/nav
  - snackbar stack no longer overlaps rest timer or bottom nav while rest timer is visible

Screenshots:
- `screenshots/verify-v1.4.5-home-mobile.png`
- `screenshots/verify-v1.4.5-plan-mobile.png`
- `screenshots/verify-v1.4.5-settings-mobile.png`
- `screenshots/verify-v1.4.5-readiness-mobile.png`
- `screenshots/verify-v1.4.5-workout-bottom-mobile.png`

## Android Build Gap

The Android build was not runnable in this workspace. `android/gradlew.bat` is missing, no `gradle` command is on PATH, and `android/gradle/wrapper` contains `gradle-wrapper.properties` but not the wrapper JAR. The attempted command failed:

```powershell
.\android\gradlew.bat -p android :app:assembleDebug
```

Next verifier should run an Android assemble once a working Gradle wrapper or Gradle install is available.

## Follow-up Risks

- Physical Android/TWA/APK verification is still needed for actual system-bar icon rendering because the native build could not be assembled here.
- Service-worker update activation can reload the page after a cache version bump. The app already defers update reload while a workout is running, but UI screenshot tests should block service workers or wait for activation to settle.
