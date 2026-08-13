# Lift v1.8.0 - Adaptive Recomposition Companion

Build date: 2026-08-13  
State schema: v4 (compatible storage key: `lift.v3.state`)  
Android: versionCode 23 / versionName 1.8.0

## Product changes

- Honest history states: completed, planned, rest, missed, unknown, and reconstructed. Empty legacy placeholders migrate to unknown; reconstructed training never fabricates performance.
- Deterministic adaptive targets use verified sets, reps, load, RIR, readiness, pain/form flags, recent muscle recovery, recent volume, exercise increments, assistance direction, and deload phase.
- Effective weekly muscle-set analytics cover every major hypertrophy group and prioritize upper chest, side delts, lats, abs, and spinal erectors.
- Weeks 14-20 include 2-3 direct ab exposures and two intelligently spaced erector exposures. A repeatable post-September four-week generator can append additional blocks without rewriting fixed history.
- Added fast 1 km cardio logging, protein-first Filipino food presets/custom entries, meal distribution, optional supplement check-ins/usual creatine dose, and recomposition body/waist/strength trends.
- Quick Add is prominent in active training, supports contextual presets and explicit load semantics, persists custom exercises, and removes/remaps them safely.
- PRs distinguish baseline, weight, rep, estimated-1RM, and volume records; assisted movements treat less assistance as progress.

## Durability and migration

- Every state is explicitly migrated to schema v4. Existing v2/v3 backups remain importable.
- Saves use the primary localStorage state plus debounced IndexedDB generations (maximum eight), three localStorage fallback generations, and an atomically written Android app-private mirror. Snapshot digests are checked before recovery.
- Startup compares timestamps across the native mirror, fallback generations, legacy state, and IndexedDB and restores the newest valid candidate before rendering. Reset clears every recovery layer so deleted state cannot resurrect.
- Android backup/data-extraction rules include only the validated canonical `lift_state.json` mirror.
- Restore validates JSON before mutation, creates a pre-restore snapshot, and supports replace or merge. Merge resolves sets by timestamp, retains notes/profile/preferences, unions history, and deduplicates sessions/custom exercises.
- Backup UI reports local/external timestamps, generation count, app/schema versions, and overdue status. Lift has no server and performs no silent upload.

## Verification

Final web command:

```powershell
npm test -- --runInBand
```

Result: 22 suites, 142 tests, all passed.

Additional web checks:

```powershell
node --check app.js
node --check data.js
node --check sw.js
Get-ChildItem features -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
npm audit --audit-level=high
```

Result: all passed; npm reported zero known vulnerabilities. Git emitted only expected LF/CRLF conversion notices.

Browser smoke passed twice from independent clean profiles and once while repairing a previously incomplete QA cache. It covered a true 320px viewport, no horizontal overflow, five in-bounds 44px navigation targets, visible non-color history marks, goal-aware home labels, page-sheet/nav semantics, modal ARIA/focus/Escape behavior, recovery from a deliberately corrupted primary state, complete core cache inventory, and service-worker offline reload. No runtime exceptions occurred. Service-worker activation now fails closed if any declared shell asset cannot be cached.

Android command (using the isolated Java 17 / Gradle 9.3.1 / API 36 toolchain):

```powershell
gradle.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug --no-daemon --console=plain
```

Result: passed. Lint: 0 errors / 36 non-blocking warnings. The Android unit-test task has no native unit-test sources; bridge contracts are covered in Jest and the Kotlin/resources were compiled by the APK and lint tasks.

Debug APK metadata:

- Package: `io.github.blayalems.lift.debug`
- Version: 23 / 1.8.0-debug
- minSdk 26; target/compile SDK 36
- Size: 3,666,026 bytes
- SHA-256: `a8720b86eba94c2571881db2dfc19bd58b4c5506872506514e5e7d42ea8087f2`

## Known limitations

- Android Auto Backup is controlled by Android/device/account policy and is not guaranteed; a portable external JSON remains necessary for device-loss recovery.
- Progress photos remain outside Lift: the app stores the check-in date and protocol, not image bytes or a side-by-side gallery.
- Heart rate is manually entered; there is no Health Connect/wearable ingestion or server sync.
- The Android wrapper loads the hosted PWA, so a first successful online load is still required before WebView/PWA caches can serve it offline.
- Android lint retains 36 pre-existing/non-blocking warnings (mostly unused resources, optional newer dependencies, and intentional JavaScript-enabled WebView usage).

No commit, push, pull request, release, or deployment was performed.
