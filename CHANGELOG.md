# Changelog

All notable changes to **Lift** are documented in this file.

## [2.0.0] - 2026-11-27 (Planned Major Release)

### Added
- **On-Device Zero-API Adaptive AI Coach (`features/coach.js`)**: 100% offline athlete analysis (`analyzeAthlete`), dynamic daily brief strip (`getDailyBrief`, `renderCoachStrip`), conversational exercise/history/nutrition intent parser (`askCoach`, `quickPrompts`), one-tap session mutations (`express-mode`, `autoregulate-light`, `pr-push`, `set-tone`), and interactive `coach` sheet (`renderCoachSheet`) with persistent `coachMemory` (capped at 30 messages).
- **Behavioral-Psychology Anti-Hiatus & Momentum Engine (`features/engagement.js`)**: Built to prevent multi-month layoffs by neutralizing the abstinence-violation effect through a Hooked Loop (`onSetCompleted`, `onWorkoutFinished`), Zeigarnik XP & rank ladder (`levelInfo`), 3 daily micro-quests (`dailyQuests`), Streak Freeze Shields (`activateShield`, up to 3 shields), Variable-Ratio Mystery Reward Crates (`claimLoot`), Implementation-Intention Comeback Pledges (`setPledge`), escalating hiatus defense (`hiatusDefense` + 10-Min Express Rescue), interactive milestone feed (`feed` sheet, `hypeFeedItem`, `share-story`), and history-safe XP backfilling (`seedFromHistory`).
- **Live In-Session Motivational Quote Engine (`features/quotes.js`)**: 100% offline curated library of 60+ quotes across 7 workout contexts (`start`, `grind`, `rest`, `pr`, `reentry`, `final_stretch`, `low_readiness`) and 4 tones (`grit`, `stoic`, `science`, `hype`), with session-stable caching, non-repeating rotation (`quote-next`), favorites (`quote-fav`), `.quote-gadget` card, and concise rest/notification quotes (`getRestQuoteText`).
- **Android 17 (API 37) Upgrade & Material 3 Expressive Widgets (`android/`)**:
  - Upgraded `compileSdk = 37`, `targetSdk = 37`, `versionCode = 26`, `versionName = "2.0.0"` (keeping AGP `9.1.1` built-in Kotlin and Gradle `9.3.1`), plus CI SDK `platforms;android-37` / `build-tools;37.0.0`.
  - Added large-screen/foldable `resizeableActivity="true"` + expanded `configChanges`, API 35–37 edge-to-edge system-bar guards, predictive back synchronization (`setBackConsumerActive` -> `navigate-back`), `window.LIFT_ANDROID_SDK`, and upgraded `getAndroidInfo()` diagnostics.
  - Added `HabitReminderReceiver.kt` with `scheduleHabitReminder`, `cancelHabitReminder`, and `openNotificationSettings` bridge methods.
  - Upgraded `WorkoutNotification.kt` to render optional in-session `quote` subtext and phase-aware accents on Live Updates.
  - Upgraded `LiftWidgetProvider.kt`, `lift_widget.xml`, `lift_widget_info.xml`, and `values-v31/colors.xml` to a 3-layer Material 3 Expressive `home_screen|keyguard` widget with persisted engagement snapshots (`updateWidgetEngagement`), zero bitmaps, and rate-limited `setWidgetPreview`.
- **Anti-AI-Slop Design System (`docs/design-system-v2.md`)**: Unified Material 3 Expressive geometry, tonal elevation, `tabular-nums` typography, and crisp inline geometric SVGs across Light, Dark, Neural, Expressive, and Calm visual modes.

### Changed
- **Home-Screen Gadget Hierarchy (`app.js`, `index.html`)**: Stacked running-session quote gadget (`.quote-gadget`, active sessions only), coach brief strip (`.coach-gadget`), and momentum gadget (`.momentum-gadget`) cleanly above `<main class="content">`, with `coach` and `feed` sheets registered in navigation.
- **Anti-Slop Feature HTML Refactor (`features/streaks.js`, `features/marketplace.js`, `features/strength.js`, `features/measurements.js`, `features/recap.js`)**: Replaced raw emoji entities (`&#128293;`) and inline `style="..."` clutter with semantic CSS classes and inline SVGs while preserving all `data-*` contracts.
- **Durable State & Service Worker (`features/state.js`, `sw.js`)**: Preserved `STORE_KEY = "lift.v3.state"` and `SCHEMA_VERSION = 4` while safely normalizing and merging `engagement`, `coachMemory`, and `favoriteQuotes`; added v2 feature modules to `APP_SHELL` (`CACHE_VERSION = "lift-v23"`).

---

## [1.9.1] - 2026-11-27

### Changed
- **Compressed Week 21 Fri/Sat Reentry (`data.js`)**: Updated Week 21 (`2026-11-23`–`2026-11-29`) for Friday gym renewal by converting Mon–Thu (`2026-11-23`–`2026-11-26`) to `Off / Pre-Renewal` rest days and restructuring Fri `2026-11-27` (`Full Body A - Reentry`: quads, pull, light upper-chest primer, calves, biceps, abs) and Sat `2026-11-28` (`Full Body B - Reentry`: chest press, RDL hinge, light unilateral legs, face pulls, cable lateral raises, triceps, bodyweight `45 Degree Back Extension`) at ~70–75% of August working peaks with `3+ RIR` and no Assisted Dips.
- **Specialization Guard (`data.js`)**: Guarded `addSpecialization()` on `tuesday.type !== "rest"` and `saturday.type !== "rest"` so compressed rest days do not receive automatic Tue/Sat specialization movements.
- **Version Bump**: Updated release metadata atomically to `1.9.1` (`versionCode = 25`, `CACHE_VERSION = "lift-v22"`, `build = "2026-11-27"`) across `app.js`, `sw.js`, `version.json`, `package.json`, `package-lock.json`, `android/app/build.gradle.kts`, `features/healthkit.js`, and release/tech-debt tests (`tests/plan.test.js`, `tests/program-continuation.test.js`, `tests/bug-fixes.test.js`, `tests/release.test.js`, `tests/tech-debt.test.js`).

---

## [1.9.0] - 2026-11-23

### Added
- **10-Week Plan Extension through January 2027 (`data.js`, `features/program.js`, `features/progression.js`)**:
  - Extended `LIFT_PLAN` cleanly past `w20` (`May 12, 2026-January 31, 2027`) with `w21`–`w30` (`2026-11-23` to `2027-01-31`), leaving `w1`–`w20` intact so historical August 2026 logs remain aligned.
  - Added `reentry` phase support in `addSpecialization()` and `features/progression.js` (`action: "reentry"` plus `>= 21`-day detraining gap safeguard so pre-layoff peaks never override reentry ramp loads).
  - Updated `features/program.js` to exclude `deload`/`reentry` from `templateWeek()`, prefer normal-phase verified sessions in `actualByExercise()`, clamp `adaptExercise()` reps to `[minRep, maxRep]`, start rolling continuation blocks on `2027-02-01`, and auto-extend up to 12 blocks via `ensureRollingPlan(state, plan, referenceDate)`.
- **Gym Reentry Quality-of-Life Features (`features/reentry.js`, `features/cardio.js`, `features/library.js`, `app.js`)**:
  - Added welcome-back reentry banner (`daysSinceLastWorkout`, `shouldShowBanner`, `renderBanner`) with start, measurements shortcut, and per-week dismiss persistence (`reentryDismissedWeekId`).
  - Added per-hand dumbbell weight helper (`.db-hint`), exercise-specific kg stepping via `progression.incrementFor`, `Match S1` (`copy-set1`) target carry button, rest timer quick-dismiss (`rest-dismiss`), cardio entry deletion (`cardio.deleteEntry` / `cardio-delete`), real template application (`library.applyTemplateToDay` across `DEFAULTS`, `customWorkouts`, and Marketplace-imported `state.library`), and richer `lastSessionHint` labels.

### Fixed
- **Workout Logging & Readiness Flow (`app.js`)**:
  - Fixed `save-readiness` clearing `runtime.pendingAction` before `executePendingAction()` (`49f5baa`), restoring seamless `toggle-set` and `did-planned` execution after readiness check-in.
  - Fixed blank RIR `<select>` defaulting to `0` instead of `""` (`-`), `removeSet` orphaned keys under adaptive targets, `handleLaunchParams` (`startWorkout(false); render()`), `didAsPlanned` overwriting custom completed sets or using `Math.max` on assisted lifts, `AudioContext` exhaustion in `beep()`, `plate-input` / `rm-input` focus loss on keystroke, `rm-save` persistence (`state.strengthEstimates`), `runtime.quickMeal` selection persistence, and `todayId()` consistency in calendar navigation.
- **History, Analytics & State Merging (`features/*.js`)**:
  - Fixed `features/history.js` so past `"planned"` placeholders resolve to `"unknown"` and `streakMetrics()` resets after >14-day layoffs; updated `features/heatmap.js` for 2026–2027 UTC-safe date ranges; fixed `features/strength.js` 1RM edge cases (`reps === 1`, `reps >= 36`, assisted lifts); guarded 0-rep sets in `features/achievements.js` and `features/summary.js`; rendered `state.library` and escaped HTML in `features/marketplace.js` / `features/library.js`; made `features/recap.js` cycle title dynamic; and merged `customWorkouts`/`library` by ID in `features/state.js`.

### Changed
- **Technical Debt & UI Unification (`sw.js`, `index.html`, `features/healthkit.js`)**:
  - Absorbed `sw.js` `UI_LAYER_FIX_STYLE` hotfixes cleanly into `index.html`, removed dead `legacyPatchAppScriptText`/`replaceFunction` from `sw.js`, removed dead helpers from `app.js`, implemented RFC 4180 CSV escaping in `features/healthkit.js`, and paired `<label for>` / `id` attributes across cardio, measurements, steps, and body forms.
  - Added first-class `reentry` phase design, fixed `.day-pill` `.status-dot` overlap, and enforced `>= 44x44px` `.check-btn` mobile touch targets.
  - Released as `1.9.0` (`versionCode = 24`, `CACHE_VERSION = "lift-v21"`, `build = "2026-11-23"`).
