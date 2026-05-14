# Agent Handoff: Lift Android PR Workflow

This document describes the exact workflow used to develop, debug, and ship
changes to the Lift Android wrapper. Follow it precisely when picking up this
repo as an AI agent.

---

## Repository layout

```
lift/
├── app.js                          # PWA entry point — contains APP_VERSION string
├── version.json                    # {"version":"x.y.z","build":"YYYY-MM-DD"}
├── features/
│   └── cloud.js                    # Backup/restore logic (downloadBackup, shareBackup)
├── .github/workflows/
│   └── build-apk.yml               # CI: assembles debug APK, publishes to GitHub release
└── android/
    ├── build.gradle.kts            # Root Gradle — plugin version declarations (AGP only)
    ├── settings.gradle.kts         # pluginManagement.plugins{} — canonical version source
    ├── gradle/wrapper/
    │   └── gradle-wrapper.properties  # distributionUrl for Gradle binary
    └── app/
        ├── build.gradle.kts        # App module — compileSdk, versionCode, versionName
        └── src/main/
            ├── AndroidManifest.xml
            └── kotlin/io/github/blayalems/lift/
                ├── MainActivity.kt         # WebView host, fullscreen, file chooser
                ├── LiftBridge.kt           # @JavascriptInterface exposed as window.LiftAndroid
                ├── WorkoutService.kt       # Foreground service for API 35+ Live Update chip
                └── LiftWidgetProvider.kt   # Native home-screen workout widget
```

---

## PR workflow (step by step)

### 1. Always work on a named branch — never commit to main directly

```bash
git checkout -b claude/v<version>-pr<N>
git push -u origin claude/v<version>-pr<N>
```

Branch naming convention: `claude/v1.2.3-pr21`, `claude/fix-<short-description>`, etc.

### 2. Make changes, commit with a descriptive message

Commit message format:
```
<imperative summary under 72 chars>

<body: what changed and why — reference the specific error text
if fixing a CI failure>

https://claude.ai/code/session_01AYwrqDBsgPwzPePJgjD7w6
```

### 3. Push to the branch

```bash
git push -u origin <branch-name>
```

If push fails due to network error, retry up to 4 times with 2s / 4s / 8s / 16s backoff.

### 4. Close the previous PR (if one exists for this feature)

Use the GitHub MCP tool `mcp__github__update_pull_request`:
- Set `state: "closed"`
- Update the title to `"<original title> (superseded by #<new-number>)"`

### 5. Create the new PR

Use `mcp__github__create_pull_request`:
- `base`: `main`
- `head`: the new branch name
- `title`: short, includes version e.g. `"v1.2.3: fix scrollbar, live notifications, AGP 9.1.1"`
- `body`: include Summary bullets, Changed files table, Test plan checklist

### 6. After CI runs, read the failure log

The user will paste CI log output. Read it, identify the root cause, fix it,
commit to the **same branch**, push. The PR updates automatically — do not
create a new PR just for a CI fix unless the user asks.

Only create a new PR when the user explicitly says "push to PR N" or
"create a new PR".

---

## Version bump checklist

When bumping the app version, update ALL THREE locations atomically in one commit:

| File | What to change |
|---|---|
| `app.js` | `var APP_VERSION = "x.y.z";` (line ~11) |
| `version.json` | `{"version":"x.y.z","build":"YYYY-MM-DD"}` |
| `android/app/build.gradle.kts` | `versionCode = N` (increment by 1) and `versionName = "x.y.z"` |

The `build` date in `version.json` should be today's date in `YYYY-MM-DD` format.

---

## Android Gradle / SDK version matrix

Tested working combination as of v1.2.3:

| Component | Version |
|---|---|
| AGP | 9.1.1 |
| Gradle | 9.3.1 |
| Kotlin | Not declared — AGP 9 built-in Kotlin handles `.kt` compilation |
| compileSdk / targetSdk | 36 |
| minSdk | 26 |
| Java | 17 (Temurin) |
| CI SDK platform | `android-36` |
| CI build-tools | `36.0.0` |

### AGP 9.x rules (IMPORTANT)

- **Do NOT apply `org.jetbrains.kotlin.android` anywhere.** AGP 9 ships with
  built-in Kotlin. Applying the plugin explicitly causes:
  `Cannot add extension with name 'kotlin', as there is an extension already registered`
- **Do NOT use `kotlinOptions { }` block.** It requires the explicit KGP DSL.
  AGP 9 built-in Kotlin reads JVM target from `compileOptions { sourceCompatibility = VERSION_17 }`.
- Plugin versions live in `settings.gradle.kts` → `pluginManagement { plugins { } }`, not in `build.gradle.kts`.

---

## Foreground service type reference

Valid `foregroundServiceType` values for `compileSdk = 36` (confirmed by AAPT):

| Type | Value | Extra permission required | Notes |
|---|---|---|---|
| `health` | 256 | `FOREGROUND_SERVICE_HEALTH` | **Use this for workout/fitness services** |
| `mediaProcessing` | 8192 | None | Media processing tasks |
| `shortService` | 2048 | None | Max 3 minutes — do not use for long workouts |
| `dataSync` | 1 | None | **Banned on targetSdk ≥ 35** |
| `location` | 8 | Fine/coarse location | GPS tracking |
| `mediaPlayback` | 2 | None | Audio/video playback |
| `camera` | 64 | CAMERA | Camera use |
| `microphone` | 128 | RECORD_AUDIO | Mic use |

`activeProcessing` is **NOT** a valid type in any currently released Android SDK.
Do not use it regardless of what documentation or prior commits say.

The Lift workout service uses `health` with `FOREGROUND_SERVICE_HEALTH` permission.

---

## JavascriptInterface threading rule

`@JavascriptInterface` methods are called on a **WebView background thread**, not the main thread.

Any Android API that requires the main thread must be dispatched explicitly:

```kotlin
Handler(Looper.getMainLooper()).post {
    try {
        context.startForegroundService(intent)
    } catch (e: Exception) {
        // fallback — e.g. direct NotificationManagerCompat.notify()
    }
}
```

APIs that require the main thread in this project:
- `startForegroundService()` on API 35+ → wrap in Handler post
- `stopService()` on API 35+ → wrap in Handler post
- `Toast.makeText(...).show()` → use `(context as? Activity)?.runOnUiThread { }`

---

## Known CI failure patterns and fixes

### `Cannot add extension with name 'kotlin'`
**Cause:** Explicit `org.jetbrains.kotlin.android` applied alongside AGP 9 built-in Kotlin.
**Fix:** Remove all `id("org.jetbrains.kotlin.android")` declarations from every Gradle file.

### `Unresolved reference 'kotlinOptions'`
**Cause:** `kotlinOptions { }` block used without the KGP plugin.
**Fix:** Delete the `kotlinOptions { }` block. Use `compileOptions { sourceCompatibility = VERSION_17 }` instead.

### `'activeProcessing' is incompatible with attribute foregroundServiceType`
**Cause:** `activeProcessing` is not a valid Android SDK foreground service type.
**Fix:** Use `health` + declare `FOREGROUND_SERVICE_HEALTH` permission in manifest.

### `Minimum supported Gradle version is X. Current version is 8.7`
**Cause:** The CI workflow `gradle/actions/setup-gradle` step has `gradle-version` hardcoded.
**Fix:** Update `.github/workflows/build-apk.yml` — change `gradle-version`, `platforms;android-XX`, and `build-tools;XX.0.0` to match the project's versions.

### `AAPT: error: style/Theme.Material.NoTitleBar.Fullscreen not found`
**Cause:** Theme removed from newer platform SDKs.
**Fix:** Change parent to `Theme.AppCompat.NoActionBar` in `res/values/themes.xml`.

### `ForegroundServiceStartNotAllowedException` (app crashes on Save and Start)
**Cause:** `startForegroundService()` called from a `@JavascriptInterface` background thread.
**Fix:** Dispatch via `Handler(Looper.getMainLooper()).post { }` with a direct-notify fallback.

### `Export backup does nothing`
**Cause:** Blob URL + anchor click is silently ignored inside WebView.
**Fix:** Detect `window.LIFT_IS_NATIVE` in `cloud.js` and call `window.LiftAndroid.saveBackupFile(filename, json)` instead.

### `PWA stuck at old version after APK update`
**Cause:** WebView HTTP cache survives in-place APK install.
**Fix:** In `MainActivity.onCreate()`, compare stored versionCode in SharedPreferences; call `webView.clearCache(true)` if changed.

---

## CI workflow file location and key fields

`.github/workflows/build-apk.yml` — triggered on push to `main` and `workflow_dispatch`.

Fields to keep in sync with the Gradle project:

```yaml
- name: Install required Android SDK components
  run: |
    yes | "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
      "platforms;android-36"   # ← must match compileSdk
      "build-tools;36.0.0"     # ← must match compileSdk
      "platform-tools"

- name: Setup Gradle 9.3.1
  uses: gradle/actions/setup-gradle@v3
  with:
    gradle-version: '9.3.1'    # ← must match gradle-wrapper.properties
```

---

## JavaScript ↔ Native bridge API (`window.LiftAndroid`)

| Method | Called from | What it does |
|---|---|---|
| `onWorkoutState(json)` | PWA workout loop | Posts/updates workout notification; routes through WorkoutService on API 35+ |
| `clearWorkout()` | PWA on finish | Cancels notification, stops service |
| `isNative()` | PWA startup | Returns `true` — used to gate native-only paths |
| `saveBackupFile(filename, json)` | `cloud.js` downloadBackup | Writes JSON to MediaStore Downloads (API 29+) |
| `saveImageFile(filename, dataUrl)` | `app.js` workout image export | Writes PNG snapshots to Downloads |
| `shareText(title, text)` | `app.js` copy/share log | Opens Android Sharesheet for text logs |
| `shareJsonFile(filename, json, title)` | `app.js` / `cloud.js` backup share | Shares a JSON backup through a FileProvider content URI |
| `shareImageFile(filename, dataUrl, title)` | `app.js` workout image share | Shares a PNG through a FileProvider content URI |
| `haptic(patternJson)` | `app.js` haptic helper | Routes tap and waveform haptics through Android |

`window.LIFT_IS_NATIVE` is set to `true` by the WebViewClient's `onPageFinished` injection.
Check this flag before calling any `window.LiftAndroid.*` method from JS.

---

## File restore flow

The "Restore file" button opens a system file picker via `WebChromeClient.onShowFileChooser()`.
This is handled in `MainActivity`'s `LiftChromeClient` inner class using
`ActivityResultContracts.StartActivityForResult`. No JS changes are needed.

---

## Signing

The debug keystore is committed at `android/debug.keystore` with:
- alias: `androiddebugkey`
- storePassword / keyPassword: `android`

This ensures every CI build produces an APK installable over the previous one
without uninstalling (consistent signature). Do not regenerate the keystore.
