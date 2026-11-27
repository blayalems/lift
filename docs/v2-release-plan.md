# Lift v2.0.0 Major Release Plan & Architecture Blueprint

- **Target Release:** `2.0.0` (`versionCode = 26`, `CACHE_VERSION = "lift-v23"`, `build = "2026-11-27"`)
- **Baseline:** `v1.9.1` (`versionCode = 25`, `lift-v22`, `SCHEMA_VERSION = 4`, `STORE_KEY = "lift.v3.state"`)
- **Scope:** Local-first PWA (`index.html`, `app.js`, `data.js`, `sw.js`, `features/*.js`) + Android 17 (API 37) native wrapper (`android/`)

---

## 1. Baseline Architecture Audit (`v1.9.1`)

Lift v1.9.1 established a durable, local-first PWA and Android WebView shell tailored to Lem's recomposition cycle (`Asia/Manila` timezone):

- **Training Plan (`data.js`)**:
  - `LIFT_PLAN` spans **May 12, 2026 – January 31, 2027** (`w1`–`w30`, 30 fixed weeks).
  - Weeks `w1`–`w20` are preserved untouched so verified August 10–22, 2026 working logs and indices stay intact.
  - **Week 21 (`v1.9.1` Fri/Sat Compressed Reentry, Nov 23–29, 2026)**: Mon–Thu (`2026-11-23`..`2026-11-26`) are `Off / Pre-Renewal` rest days (`type: "rest"`), compressing reentry into **Fri `2026-11-27` (`Full Body A - Reentry`)** and **Sat `2026-11-28` (`Full Body B - Reentry`)** at ~70–75% of August working peaks with `3+ RIR`, no Assisted Dips, and `addSpecialization()` guarded (`tuesday.type !== "rest"`, `saturday.type !== "rest"`) so rest days stay clean.
  - **Weeks 22–30 (`2026-11-30` – `2027-01-31`)**: Full volume return (`w22`), strength recapture (`w23`), August peak match (`w24`), Christmas-week deload (`w25`), New Year consolidation across the `2026-12-31` → `2027-01-01` boundary (`w26`), January load push targeting 30 kg Incline DB Press (`w27`–`w29`), and January cycle reset deload (`w30`), followed by automatic 4-week rolling continuation blocks (`features/program.js`) starting **`2027-02-01`**.
- **State & Recovery (`features/state.js`, `features/persistence.js`, `app.js`)**:
  - Browser canonical state lives in `localStorage["lift.v3.state"]` (`STORE_KEY = "lift.v3.state"`) using explicit `SCHEMA_VERSION = 4`.
  - Saves trigger debounced IndexedDB snapshots (max 8 generations), 3 `localStorage` rollback slots (`lift.v4.rollback.0..2`), and atomic Android app-private mirroring (`lift_state.json` via `LiftBridge.saveStateMirror`).
- **Progression & Reentry (`features/progression.js`, `features/reentry.js`, `features/history.js`)**:
  - `progression.suggest()` enforces `action: "reentry"` on Reentry weeks and when `gapDays >= 21` so pre-layoff PRs never override ramp loads.
  - `history.resolveStatus()` keeps past unlogged days `"unknown"` instead of fake `"missed"`, and `streakMetrics()` breaks streaks on >14-day layoffs while tolerating isolated unknown gaps.
- **Native Shell (`android/`)**:
  - Currently targets `compileSdk = 36`, `targetSdk = 36`, `minSdk = 26`, Java 17, AGP `9.1.1` (built-in Kotlin), Gradle `9.3.1`, `WorkoutService` (`FOREGROUND_SERVICE_HEALTH`), `WorkoutNotification` (`ProgressStyle` Live Updates on API 36+), and `LiftWidgetProvider` (`home_screen` widget).

---

## 2. v2.0.0 Vision & Five-Pillar Architecture

Lift v2.0.0 transforms a passive workout tracker into an **offline, behaviorally intelligent training companion** designed around one primary risk observed in Lem's training history: **preventing another multi-month layoff (like Aug 23 – Nov 22, 2026) while elevating daily execution on Android 17.**

### Pillar (a): On-Device Zero-API Adaptive AI Coach (`features/coach.js`)

- **Zero External Network Calls**: Strictly zero `fetch()` calls — 100% deterministic local intelligence executing inside `window.LIFT_FEATURES.coach` (with CommonJS export for Jest).
- **Persistent Coach Memory**: `ensureCoachMemory(state)` normalizes `state.coachMemory = { tone: "analytical" | "stoic" | "hype", messages: [], checkins: [], lastBriefDate: null }` (message history capped at 30 entries; all dynamic strings HTML-escaped via `ctx.escapeHtml`).
- **Multi-Signal Athlete Analysis (`analyzeAthlete(ctx, referenceDate)`)**:
  - Inspects `ctx.allDays()`, `ctx.state.days`, `nutrition`, `bodyweight`, `measurements`, `progression`, and `reentry`.
  - Computes `readinessScore`, `daysSinceLast`, `hiatusRisk` (0–100 composite of layoff gap, 7d/14d adherence, missed streaks, low protein), `hiatusTier` (`"low" | "moderate" | "elevated" | "critical"`), `momentumLabel`, `adherence14d`, `proteinTodayG`, `proteinTargetG`, `proteinHitRate`, `plateauLifts` (3+ verified sessions at flat max weight without rep/load progress), `surgingLifts` (recent PR or load increase), `topRecommendation`, and `expressAvailable`.
- **Dynamic Daily Brief (`getDailyBrief(ctx, day)`)**:
  - Returns `{ headline, subline, badge, tone, actionType, actionLabel, actionPayload }` tailored to Reentry phase, Deload/Test phase, low readiness (`<= 5`), high hiatus risk (`>= 60`), plateau alerts, or healthy Load progression.
- **Offline Conversational Intent & Entity Engine (`askCoach(ctx, question)`, `quickPrompts(ctx, day)`)**:
  - Parses exercise entities (`leg press`, `incline db`, `lat pulldown`, `rdl`, `squat`, etc.) and quotes verified last date, weight, reps, e1RM, and next progression target.
  - Handles intent classes: today's plan summary, fatigue/soreness (`autoregulate-light`), time-crunched sessions (`express-mode`), plateaus (double-progression / micro-load tweaks), protein & waist recomp trends (`profile.proteinTargetG` gap), anti-hiatus motivation, and tone switching (`analytical` / `stoic` / `hype`).
- **One-Tap Target Mutations (`applyCoachAction(ctx, actionType, payload)`)**:
  - `"express-mode"`: updates uncompleted exercises' `ds.adaptiveTargets` so compounds cap at 2 working sets and accessories cap at 1 crisp set (never alters completed sets).
  - `"autoregulate-light"`: reduces uncompleted `ds.adaptiveTargets` load by ~10% (rounded to 2.5 kg) and trims 1 working set (min 1).
  - `"pr-push"`: sets next progression weight step (`+incrementKg`) or `+1 rep` target on the primary lift.
  - `"set-tone"`: persists `state.coachMemory.tone`.
- **UI Surfaces**: Compact `.coach-gadget` brief strip (`renderCoachStrip`) and full `coach` sheet (`renderCoachSheet`) with diagnostics cards, tone switcher, quick prompt pills, `.coach-chat-log`, and input form.

### Pillar (b): Behavioral-Psychology Anti-Hiatus & Momentum Engine (`features/engagement.js`)

Engineered explicitly to eliminate the **"what-the-hell" (abstinence-violation) effect**, where 1–2 missed sessions trigger guilt and snowball into a 90-day layoff:

1. **Hooked Loop (Trigger → Action → Variable Reward → Investment)**:
   - *Trigger*: Escalating hiatus defense cues + Android Habit Reminders (`HabitReminderReceiver`) + Live Widget status chip.
   - *Action*: Completing a single set (`onSetCompleted`), starting a 10-Min Express session, or activating a shield.
   - *Variable Reward*: Combo multipliers (`1x` → `1.5x` → `2x` → `3x`), feed milestones, and post-workout **Mystery Reward Crates**.
   - *Investment*: XP accumulation, lifetime tonnage equivalents (`tonnageEquivalent(kg)`), Comeback Pledges, and feed hypes (`hypeFeedItem`).
2. **Zeigarnik XP, Rank Ladder & Daily Micro-Quests**:
   - `levelInfo(xp)` drives a deterministic ladder (`Novice`, `Iron Regular`, `Steel Lifter`, `Hypertrophy Tactician`, `Barbell Architect`, `Titan`, `Apex Legend`) with progress bar percentages (`xpToNext`) keeping the next rank visibly close.
   - `dailyQuests(ctx, dateId)` generates 3 deterministic micro-quests anchored to today's plan (e.g., *First Working Set*, *Log Readiness & Cue*, *Session Volume / 3-Set Combo*).
   - `seedFromHistory` backfills starter XP from existing verified and reconstructed history (`state.days`) on first upgrade without fabricating fake sets.
3. **Loss Aversion & Streak Freeze Shields**:
   - Athletes hold up to `maxShields: 3` (starting with `1` shield, earning `+1` every 4 completed sessions).
   - `activateShield(ctx, dateId)` records `shieldedDates[dateId] = true`, preserving momentum across unavoidable life/work disruptions without falsifying training history.
4. **Variable-Ratio Mystery Reward Crates**:
   - `onWorkoutFinished(ctx, dayId)` awards workout completion XP (`+50` + adherence bonus + fulfilled `+150 XP` pledge bonus) and rolls `pendingLoot` across rarities (`Common`, `Rare`, `Epic`, `Mythic`: `XP Surge`, `Bonus Shield`, `Title Unlock`, `Coach Secret`, `PR Crown`).
   - `claimLoot(ctx)` resolves the crate into `unlockedLoot` and appends a feed milestone (capped at 40 entries).
5. **Implementation-Intention Comeback Pledges**:
   - `setPledge(ctx, whenLabel, slotLabel)` stores `{ when: "Today"|"Tomorrow", slot: "Morning"|"Afternoon"|"Evening", createdDate, targetDate, bonusXp: 150, status: "active" }` — pairing time-of-day specificity with native habit reminders.
6. **Escalating Anti-Hiatus Defense & 10-Min Express Rescue (`hiatusDefense(ctx, refDate)`)**:
   - `0–1d`: `active` (`"Momentum locked"`)
   - `2–3d`: `watch` (`"Protect the groove"` → `Lock Tomorrow Pledge`)
   - `4–6d`: `warning` (`"Break the friction barrier"` → `Launch 10-Min Express`)
   - `7–13d`: `rescue` (`"One light session resets the chain"` → `Activate Shield + Reset`)
   - `>= 14d` or `reentry` phase: `reentry` (`"Fresh Reentry Ramp Ready"` → `Start Minimum Dose`)
- **UI & Native Bridge Surfaces**: `renderMomentumGadget(ctx, day)` (`.momentum-gadget`), `renderFeedSheet(ctx)` (rendered in `feed` sheet, including Shareable Workout Story Card), and `widgetPayload(ctx)`.

### Pillar (c): Live In-Session Motivational Quote Engine (`features/quotes.js`)

- **100% Offline Curated Library (`QUOTES`)**: Zero `fetch()` calls; 60+ grounded strength/hypertrophy/stoic/consistency quotes with `{ id, text, author, category, tone }` across 4 tones (`"grit"`, `"stoic"`, `"science"`, `"hype"`).
- **Deterministic Context Engine (`pickContext(ctx, day, runtime)`)**:
  - Priority order: `"pr"` (recent PR hit) → `"rest"` (active `runtime.rest.remaining > 0`) → `"final_stretch"` (`completed / total >= 0.75 && < 1`) → `"low_readiness"` (`ds.readiness <= 5`) → `"reentry"` (`reentry` phase or gap `>= 14d`) → `"start"` (`completed === 0`) → `"grind"` (default mid-session).
- **Session Stability & Non-Repeating Rotation (`getActiveQuote`, `toggleFavorite`)**:
  - Caches active quote per context on `runtime.sessionQuote` so routine UI re-renders never flicker quotes unexpectedly.
  - `forceNext === true` rotates via `runtime.quoteHistory` avoiding immediate repeats and respecting `state.settings.quoteTone` / `state.coachMemory.tone`.
  - `toggleFavorite(ctx, quoteId)` persists IDs in `state.favoriteQuotes`.
- **Surfaces**:
  - `renderSessionQuote(ctx, day, runtime)` → `.quote-gadget` rendered during active workouts (`quote-next` and `quote-fav` controls).
  - `getRestQuoteText(ctx, day, runtime)` → concise single-line string injected into the floating Rest Timer banner and Android 17 Live Update `quote` payload (`setSubText`).

### Pillar (d): Android 17 (API 37) Upgrade + Material 3 Expressive Widgets/Gadgets

- **Gradle / SDK / CI Matrix (`android/app/build.gradle.kts`, `.github/workflows/build-apk.yml`, `AGENTS.md`)**:
  - Upgrade to `compileSdk = 37`, `targetSdk = 37`, `versionCode = 26`, `versionName = "2.0.0"`, keeping `minSdk = 26`, `JavaVersion.VERSION_17`, AGP `9.1.1` (built-in Kotlin — **never** apply `org.jetbrains.kotlin.android` or `kotlinOptions { }`), and Gradle `9.3.1`.
  - CI workflow installs `"platforms;android-37"` and `"build-tools;37.0.0"`.
- **Android 17 Platform Readiness (`AndroidManifest.xml`, `MainActivity.kt`, `WorkoutNotification.kt`, `WorkoutService.kt`)**:
  - Mandatory large-screen/foldable resizability: `android:resizeableActivity="true"` and expanded `android:configChanges="orientation|screenSize|smallestScreenSize|screenLayout|keyboardHidden|density|uiMode"`.
  - Clean API 35–37 edge-to-edge bars (`WindowCompat.setDecorFitsSystemWindows(window, false)` + `WindowInsetsControllerCompat`, guarding deprecated `statusBarColor`/`navigationBarColor` setters to `SDK_INT < 35`).
  - Predictive back cooperation: `LiftBridge.setBackConsumerActive(active: Boolean)` coordinates with `OnBackPressedCallback` to dispatch `"navigate-back"` to the PWA before `webView.goBack()` or app exit.
  - Exposes `window.LIFT_ANDROID_SDK = Build.VERSION.SDK_INT` at `onPageFinished`.
  - Live Updates (`WorkoutNotification.kt`): phase-aware accent colors, optional `quote` `.setSubText(quote)`, strict vector icon (`ic_dumbbell`, zero large bitmaps), and safe reflection check for `canPostPromotedNotifications()`.
- **Native Habit Reminders (`HabitReminderReceiver.kt`, `LiftBridge.kt`)**:
  - `scheduleHabitReminder(delayMinutes, title, body)` + `cancelHabitReminder()` via `AlarmManager.setAndAllowWhileIdle` (no `SCHEDULE_EXACT_ALARM` permission required) posting anti-hiatus nudges on channel `"lift_reminders"` (guarded by `POST_NOTIFICATIONS` check).
  - `openNotificationSettings()` deep-links to `Settings.ACTION_APP_NOTIFICATION_SETTINGS`.
  - `getAndroidInfo()` adds `release`, `isAndroid17`, `supportsLiveUpdates`, `supportsWidgetPreview`, `canPostPromotedNotifications`, and `isLargeScreen`.
- **Material 3 Expressive Widget (`LiftWidgetProvider.kt`, `lift_widget.xml`, `lift_widget_info.xml`, `values-v31/colors.xml`, `res/drawable*/`)**:
  - `android:widgetCategory="home_screen|keyguard"`, `targetCellWidth="4"`, `targetCellHeight="2"`, dynamic `@android:color/system_*` tokens on API 31+ with tonal day/night fallbacks.
  - 3-layer layout: top eyebrow + `#widget_chip` (streak & level), middle `#widget_status` / `#widget_chronometer` + `#widget_detail`, and `#widget_cta` 1-tap action pill (`Start` / `Skip rest` / `Open`).
  - Persists `PREFS_KEY_ENGAGEMENT` via `LiftWidgetProvider.updateEngagement(context, payload)` so idle/lockscreen widgets retain streak, level, and comeback cues.
  - Strictly zero `Bitmap`s in `RemoteViews` (Android 17 widget memory compliance) and `setWidgetPreview` rate-limited (`>= 35 min`) for both `WIDGET_CATEGORY_HOME_SCREEN` and `WIDGET_CATEGORY_KEYGUARD`.

### Pillar (e): Anti-AI-Slop Visual Consistency System (`docs/design-system-v2.md`, `index.html`)

- **Zero Raw Emoji Clutter**: Replace raw emoji entities (`&#128293;` / 🔥 / 🏆 / 💪 / 🎯 / ⚡) in JS-rendered HTML (`features/streaks.js` and all v2 modules) with crisp, uniform geometric inline SVGs (`viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"`) or `ctx.icon()` with local SVG fallback.
- **Zero Messy Inline `style="..."` Hacks**: Migrate inline chart/span/card styling in `features/streaks.js`, `features/marketplace.js`, `features/strength.js`, `features/measurements.js`, and `features/recap.js` to semantic CSS classes while preserving every `data-*` hook and accessibility label (allowing inline `%` `width`/`height` only on dynamic runtime progress/bar fills).
- **Material 3 Expressive Discipline**:
  - Quiet tonal elevation hierarchy (`--md-surface-container` + `1px solid var(--md-outline-variant)` supporting cards, `--md-surface-container-high` nested rows), unified shape scale (`--md-shape-xl: 28px` cards, `--md-shape-lg: 24px` banners, `--md-shape-md: 16px` nested items, `--md-shape-full` pills), `Roboto Flex` + `Roboto Mono` (`tabular-nums`), spring curves (`cubic-bezier(0.34, 1.56, 0.64, 1)`), `>= 4.5:1` Light & Dark WCAG contrast (`--md-on-*` ink pairs), `>= 44px` mobile touch targets (`@media (min-width: 360px)`), `min-width: 0` overflow safety, and zero gratuitous neon halo glows or rainbow blobs.
  - **Shared v2 & Refactored Feature CSS Classes**:
    - V2 gadgets/sheets: `.quote-gadget`, `.quote-head`, `.quote-eyebrow`, `.quote-text`, `.quote-author`, `.quote-actions`, `.quote-btn`, `.coach-gadget`, `.coach-head`, `.coach-badge`, `.coach-brief`, `.coach-actions`, `.coach-chips`, `.coach-chip`, `.coach-insight-grid`, `.coach-chat-log`, `.coach-bubble`, `.coach-compose`, `.momentum-gadget`, `.xp-bar-track`, `.xp-bar-fill`, `.combo-badge`, `.shield-pill`, `.quest-list`, `.quest-item`, `.hiatus-card`, `.loot-crate`, `.feed-list`, `.feed-card`, `.story-card`.
    - Refactored v1 features: `.streak-ring-goal`, `.streak-pip`, `.streak-pip-icon`, `.streak-bars`, `.streak-bar-col`, `.streak-bar-track`, `.streak-bar-fill`, `.streak-bar-label`, `.market-tag-duration`, `.market-tag-sessions`, `.market-filter-strip`, `.market-detail`, `.market-detail-summary`, `.market-detail-table`, `.market-detail-actions`, `.est-unit`, `.strength-table`, `.strength-trend-item`, `.strength-trend-head`, `.strength-sparkline`, `.strength-sparkline-line`, `.measure-date-field`, `.measure-field-row`, `.measure-empty`, `.measure-history-table`, `.measure-delta[data-trend="up|down"]`, `.summary-body-grid`.

---

## 3. Exact Integration Blueprint (`@v2-integrator` & `@design-director`)

### 3.1 Script Load Order (`index.html`) & Precache (`sw.js`)

In `index.html`, load the three v2 feature scripts **after** `./features/reentry.js` and **immediately before** `./app.js`:

```html
<script src="./features/reentry.js"></script>
<script src="./features/quotes.js"></script>
<script src="./features/engagement.js"></script>
<script src="./features/coach.js"></script>
<script src="./app.js"></script>
```

In `sw.js`, add the exact three entries to `APP_SHELL` (required by `tests/tech-debt.test.js` and offline precache checks):

```js
"./features/quotes.js",
"./features/engagement.js",
"./features/coach.js",
```

### 3.2 Preserved Durable State Keys & v4 Backward Compatibility

**HARD CONTRACT (`tests/platform-contract.test.js`)**:
- Keep `var STORE_KEY = "lift.v3.state";` in `app.js` unchanged.
- Keep `var SCHEMA_VERSION = 4;` in `features/state.js` unchanged.

Extend `features/state.js` (`migrateState` and `mergeStates`) and `app.js` (`normalizeState`) cleanly with optional v2 fields so existing v2/v3/v4 backups (including Lem's `user-backup-2026-11-23.json`) load and merge without data loss or schema bumps:

| State Key | Owner Module | Default / Shape | `mergeStates` Rule |
|---|---|---|---|
| `state.engagement` | `features/engagement.js` | `{ xp, shields, maxShields, combo, bestCombo, shieldEarnedSessions, quests, pledge, pendingLoot, unlockedLoot, feed, shieldedDates, lifetimeSessions, lifetimeVolumeKg, hypes, lastWorkoutDate }` | Monotonic max on `xp`, `bestCombo`, `lifetimeSessions`, `lifetimeVolumeKg`, `hypes`, `shields`; union by `id` on `feed` (cap 40) & `unlockedLoot`; merge `shieldedDates` & `quests`; newest `pledge` / `pendingLoot`. |
| `state.coachMemory` | `features/coach.js` | `{ tone: "analytical"\|"stoic"\|"hype", messages: [], checkins: [], lastBriefDate: null }` | Deduplicate/merge `messages` chronologically (cap 30) & `checkins`; prefer non-empty `tone` & latest `lastBriefDate`. |
| `state.favoriteQuotes` | `features/quotes.js` | `[]` (array of quote ID strings) | Set union of unique string IDs. |
| `state.settings.quoteTone` | `features/quotes.js` | `"auto"` (optional `"grit"\|"stoic"\|"science"\|"hype"`) | Standard `Object.assign` inside `out.settings`. |

### 3.3 Exact Sheet Registry (`app.js`: `sheetTitle`, `sheetBody`, `renderNavDrawer`, `menuSheet`)

Register the two new v2 sheets in `app.js`:

| Sheet ID | `sheetTitle(type)` | `sheetBody(type)` Delegation | Entry Points |
|---|---|---|---|
| `"coach"` | `"Adaptive Coach"` | `featureSheet("coach", "renderCoachSheet")` | Coach brief strip (`[data-action="open-sheet"][data-sheet="coach"]`), Nav Drawer (`Train` or `Coach` section), Menu sheet |
| `"feed"` | `"Momentum & Quests"` | `featureSheet("engagement", "renderFeedSheet")` | Momentum gadget CTA (`[data-action="open-sheet"][data-sheet="feed"]`), Nav Drawer (`Trends` section), Menu sheet |

- Update `renderNavDrawer()` and `menuSheet()` to expose both `"coach"` and `"feed"`.
- Keep existing `settingsSheet()` extended cleanly if exposing Quote Tone selector (`state.settings.quoteTone`) or Android 17 diagnostic/notification settings link (`openNotificationSettings()`).

### 3.4 Home-Screen Gadget Stacking Order (`app.js` `render()`)

Inside `render()`, preserve the existing top navigation and hero, then stack the v2 home gadgets in this **exact order** above `<main class="content">`:

1. **Top Chrome**: `.topbar` → `.week-strip` → `.phase-row` → `.day-strip`
2. **Weekly Recap Card** (Monday only, when `recap.shouldShowWeeklyRecap` is true)
3. **Hero Card** (`.hero`)
4. **Reentry Banner** (`reentry.renderBanner`, when `reentry.shouldShowBanner` is true)
5. **Gadget 1 — Running-Session Quote Gadget** (`quotes.renderSessionQuote(ctx, day, runtime)` → `.quote-gadget`): rendered **only when `isWorkoutRunning(day.id)`** so rest days and idle views stay uncluttered.
6. **Gadget 2 — Coach Brief Strip** (`coach.renderCoachStrip(ctx, day)` → `.coach-gadget`): always surfaces today's deterministic coach headline + 1-tap action + `"Ask Coach"` trigger.
7. **Gadget 3 — Momentum Gadget** (`engagement.renderMomentumGadget(ctx, day)` → `.momentum-gadget`): surfaces XP bar, level, combo/shields pills, daily micro-quests, pending Mystery Crate prompt, and escalating anti-hiatus/pledge CTA.
8. **Companion Snapshot** (`renderCompanionSnapshot(day, week)` → `.companion-card`)
9. **Workout Content** (`<main class="content">` → notices, warm-up, exercise cards, footer) + `renderRestFab()` (which surfaces `quotes.getRestQuoteText(ctx, day, runtime)` when resting).

### 3.5 Exact Delegated Action Registry (`app.js` `handleClick`)

Wire all 11 v2 actions inside `handleClick(event)` (plus `keydown` Enter submit on `[data-coach-input]` and workout lifecycle hooks):

| `data-action` | Handler Behavior & Target API | Post-Action Sync |
|---|---|---|
| `quote-next` | Calls `quotes.getActiveQuote(ctx, day, runtime, true)` to advance to a non-repeating contextual quote. | `render()`, `updateWorkoutNotification(true)` |
| `quote-fav` | Calls `quotes.toggleFavorite(ctx, btn.dataset.quoteId)` to toggle ID in `state.favoriteQuotes`. | `saveState("quote-fav")`, `render()` |
| `coach-ask` | Reads `[data-coach-input]` in `#sheet`, trims non-empty text, calls `coach.askCoach(ctx, text)`, clears input. | `renderSheet()` + scroll `.coach-chat-log` to bottom |
| `coach-quick-ask` | Reads `btn.dataset.prompt || btn.textContent`, calls `coach.askCoach(ctx, prompt)`. | `renderSheet()` + scroll `.coach-chat-log` to bottom |
| `coach-action` | Reads `btn.dataset.coachAction \|\| btn.dataset.type` and optional `btn.dataset.payload`; handles `"open-coach"` (`openSheet("coach")`), `"readiness"` (`openSheet("readiness")`), or delegates to `coach.applyCoachAction(ctx, type, payload)`. | `saveState("coach-action")`, `toast(...)`, `render()`, `syncNativeWidgetEngagement()` |
| `coach-tone` | Calls `coach.applyCoachAction(ctx, "set-tone", btn.dataset.tone)` (`"analytical" \| "stoic" \| "hype"`). | `saveState("coach-tone")`, `render()` |
| `claim-loot` | Calls `engagement.claimLoot(ctx)` to unbox `state.engagement.pendingLoot`. | `saveState("claim-loot")`, `haptic("pr")`, `toast(...)`, `syncNativeWidgetEngagement()`, `render()` |
| `activate-shield` | Calls `engagement.activateShield(ctx, btn.dataset.date \|\| todayId())`. | `saveState("activate-shield")`, `haptic("select")`, `toast(...)`, `syncNativeWidgetEngagement()`, `render()` |
| `set-pledge` | Reads `btn.dataset.when` / `btn.dataset.slot` (or sheet `[data-pledge-when]` / `[data-pledge-slot]` inputs), calls `engagement.setPledge(ctx, when, slot)`. | `saveState("set-pledge")`, `scheduleHabitReminderFromPledge(...)`, `syncNativeWidgetEngagement()`, `toast(...)`, `render()` |
| `hype-feed` | Calls `engagement.hypeFeedItem(ctx, btn.dataset.id)`. | `saveState("hype-feed")`, `haptic("tap")`, `renderSheet()` |
| `share-story` | Builds workout/milestone story summary from `engagement` (or active day), shares via `nativeShareText` → `navigator.share` → `copyText` fallback. | `toast(...)`, `haptic("success")` |

#### Workout Lifecycle Hooks (`app.js`)
- **`toggleSet` (when completing a set)** & **`didAsPlanned` (per newly logged set)**:
  - Invoke `engagement.onSetCompleted(ctx, { dayId: day.id, ex, exIndex, setIndex, weight, reps, rir, pr })`.
  - Surface concise toast feedback on level-up or high-combo milestone without spamming every routine set.
- **`startWorkout`**:
  - Cancel any pending anti-hiatus reminder via `window.LiftAndroid.cancelHabitReminder()` and sync widget engagement.
- **`finishWorkout`**:
  - If `verifiedSets > 0`, invoke `engagement.onWorkoutFinished(ctx, state.activeDayId)` before `saveState()`, then call `syncNativeWidgetEngagement()` and schedule next-day habit nudge if enabled.
- **`init()` / `saveState()`**:
  - Call `syncNativeWidgetEngagement()` cleanly on startup and significant engagement/streak updates (throttled/try-caught so non-native browsers ignore it cleanly).

### 3.6 Exact Android Bridge Contracts (`app.js` ↔ `LiftBridge.kt` / `MainActivity.kt` / `LiftWidgetProvider.kt`)

All native calls in `app.js` MUST be guarded by `canUseNative(methodName)` (`window.LIFT_IS_NATIVE && window.LiftAndroid && typeof window.LiftAndroid[method] === "function"`):

1. **`window.LiftAndroid.onWorkoutState(json)` — `quote` field**:
   - Extend `buildNotifSnapshot()` in `app.js` with:
     ```js
     quote: quotes && typeof quotes.getRestQuoteText === "function"
       ? quotes.getRestQuoteText(makeCtx(), day, runtime)
       : ""
     ```
   - `WorkoutNotification.kt` reads `snap.optString("quote")` and applies `.setSubText(quote)` when non-blank on API 36+ `ProgressStyle` Live Updates; `LiftWidgetProvider.kt` may display it on active sessions.

2. **`window.LiftAndroid.updateWidgetEngagement(json)`**:
   - Payload produced by `engagement.widgetPayload(makeCtx())`:
     ```json
     {
       "level": 4,
       "title": "Hypertrophy Tactician",
       "xp": 1420,
       "xpPct": 68,
       "shields": 2,
       "streak": 6,
       "hiatusTier": "active",
       "gapDays": 1,
       "pledgeText": "Tomorrow · Morning (+150 XP)",
       "nextQuest": "Hit 3-Set Combo (2/3)"
     }
     ```
   - Forwarded in `LiftBridge.kt` to `LiftWidgetProvider.updateEngagement(context, payload)` (`companion object` method accepting `JSONObject?`), stored in `PREFS_KEY_ENGAGEMENT`, and reflected in `#widget_chip`, `#widget_detail`, and `#widget_cta` even when no workout is active.

3. **`window.LiftAndroid.scheduleHabitReminder(delayMinutes, title, body)` & `cancelHabitReminder()`**:
   - Signature: `scheduleHabitReminder(delayMinutes: Int, title: String, body: String): Boolean` and `cancelHabitReminder(): Boolean`.
   - Called when a user locks a Comeback Pledge (`set-pledge`) — computing minutes until the pledged Morning (08:00), Afternoon (14:00), or Evening (18:30) window in `Asia/Manila` (minimum 15 min) — or on workout finish / elevated hiatus risk when `state.settings.workoutNotifications !== false`.
   - Cancelled immediately inside `startWorkout()` or when notifications are disabled.

4. **`window.LiftAndroid.setBackConsumerActive(active)` & Predictive Back**:
   - Call `window.LiftAndroid.setBackConsumerActive(!!(runtime.sheet || runtime.drawerOpen || runtime.summaryDayId))` whenever sheet, drawer, or summary overlay visibility changes.
   - Extend `handleNotifAction(action)` in `app.js` to handle `"navigate-back"`: close `runtime.drawerOpen` first, else dismiss `runtime.summaryDayId`, else call `closeSheet()`.

5. **`window.LiftAndroid.openNotificationSettings()` & `getAndroidInfo()`**:
   - Settings sheet uses `getAndroidInfo()` (`sdk`, `release`, `isAndroid17`, `supportsLiveUpdates`, `supportsWidgetPreview`, `canPostPromotedNotifications`, `isLargeScreen`) for accurate Android 17 status rows and offers a button calling `openNotificationSettings()` when notifications are denied.

### 3.7 Atomic Version Bump & Verification Checklist (`v2.0.0`)

`@v2-integrator` must bump all version surfaces atomically in one commit:

| File | Field / Change |
|---|---|
| `app.js` | `var APP_VERSION = "2.0.0";` |
| `sw.js` | `const APP_VERSION = "2.0.0";`, `const CACHE_VERSION = "lift-v23";`, add `"./features/quotes.js"`, `"./features/engagement.js"`, `"./features/coach.js"` to `APP_SHELL` |
| `version.json` | `{"version":"2.0.0","build":"2026-11-27"}` |
| `package.json`, `package-lock.json` | `"version": "2.0.0"` |
| `android/app/build.gradle.kts` | `compileSdk = 37`, `targetSdk = 37`, `versionCode = 26`, `versionName = "2.0.0"` |
| `features/healthkit.js` | Update fallback version `"1.9.1"` → `"2.0.0"` |
| `tests/release.test.js`, `tests/tech-debt.test.js`, `tests/platform-contract.test.js` | Update expected version (`2.0.0`, `versionCode = 26`, `lift-v23`, `build = 2026-11-27`) and extend `platform-contract.test.js` offline checks for `quotes`, `engagement`, `coach` |
| `tests/v2-integration.test.js` | End-to-end integration tests: v4 Lem backup load + starter XP backfill, sheet routing (`coach`, `feed`), home gadget stacking order, all 11 actions, Android bridge payloads, `APP_SHELL` parity |

**Design & QA Gate (Wave 2.5 & Wave 3)**:
- `@design-director` performs holistic visual consistency pass over `index.html` after Wave 2 integration (`Light`/`Dark` × `Neural`/`Expressive`/`Calm`).
- `@v2-qa` verifies `npm test -- --runInBand`, `node --check` on every `.js` file, `git diff --check`, XML well-formedness & Android 17 static contracts, 100% `APP_SHELL` HTTP 200, and Chrome CDP E2E at `320x568`, `390x844`, and `1280x800` with 0 console/page errors, 0 horizontal overflow, and 0 overlapping elements.
