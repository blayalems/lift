# Handoff: v1.4.6 Android wrapper API 34-36 pass

Date: 2026-05-19
Branch: `codex/android-wrapper-api36-material-you`

## Scope

This pass modernizes the Lift Android PWA wrapper for Android 12-16 behavior while keeping API 26+ compatibility.

## Version

- `app.js`: `APP_VERSION = "1.4.6"`
- `sw.js`: `APP_VERSION = "1.4.6"`, `CACHE_VERSION = "lift-v15"`
- `version.json`: `1.4.6`, build `2026-05-19`
- `android/app/build.gradle.kts`: `versionCode = 17`, `versionName = "1.4.6"`

## Implemented

- Widget layout no longer uses a raw `<View>` rail. The rail is now a `FrameLayout` for RemoteViews launcher compatibility.
- Widget metadata now includes `targetCellWidth="3"` and `targetCellHeight="2"`.
- Generated widget previews use the official `android:generatedPreviewCategories="home_screen"` metadata path. I did not add `android:widgetFeatures="generatedPreviews"` because current Android docs expose generated previews through generated preview categories / preview APIs, while `widgetFeatures` is for different feature flags.
- Widget rest countdown uses a native `Chronometer`, reducing per-second RemoteViews churn.
- Widget IPC is throttled by a stable phase/day/exercise/set signature plus a 30-second floor for repeated identical updates.
- `WorkoutService` routes widget writes through the same throttled widget update path.
- Splash screen uses `androidx.core:core-splashscreen:1.2.0` and is held until the native bridge marks `window.LIFT_IS_NATIVE`, with an 8-second safety timeout.
- Dark-mode cold start now detects native night mode before the WebView loads.
- Edge-to-edge is enabled with `WindowCompat.setDecorFitsSystemWindows(window, false)`, transparent system bars, and disabled contrast enforcement on API 29+.
- The APK asset-refresh loop guard now clears `pendingAssetRefreshVersion` before cache/service-worker refresh JavaScript runs.
- Fallback haptic feedback is time-gated to prevent main-thread flooding.
- `FOREGROUND_SERVICE_HEALTH` remains declared for API 34+ health foreground-service startup.
- API 31+ widget colors and radius use Material You resources:
  - `@android:color/system_neutral1_900`
  - `@android:color/system_accent1_100`
  - `@android:dimen/system_app_widget_background_radius`

## Verification

Completed locally:
- `node --check app.js`
- `node --check sw.js`
- XML parse check for all Android resource XML files
- `git diff --check` passed with CRLF warnings only

Blocked:
- Android assemble could not run because this checkout still has no `android/gradlew.bat`, no Gradle command on PATH, and no Gradle wrapper JAR under `android/gradle/wrapper`.

## Follow-up

- Run `:app:assembleDebug` after restoring a working Gradle wrapper or installing Gradle.
- Verify widget preview and RemoteViews rendering on Pixel Launcher API 31, 34, 35, and 36 emulator/device.
- Verify dark-mode cold start on a physical Android device because system-bar/splash behavior is device-launcher sensitive.
