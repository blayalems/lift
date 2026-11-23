(function () {
  "use strict";

  var PLAN = window.LIFT_PLAN;
  var app = document.getElementById("app");
  var toastRoot = document.getElementById("toast-root");
  var sheet = document.getElementById("sheet");
  var sheetBackdrop = document.getElementById("sheet-backdrop");
  var summaryOverlay = document.getElementById("summary-overlay");

  var APP_VERSION = "1.8.0";
  window.LIFT_APP_VERSION = APP_VERSION;

  var STORE_KEY = "lift.v3.state";
  var V2_STORE_KEY = "lift.v2.state";
  var THEME_KEY = "lift.v2.theme";
  var REST_KEY = "lift.v2.rest";
  var V1_STORE_KEY = "lift.v1.state";
  var V1_THEME_KEY = "lift.v1.theme";
  var APP_TIME_ZONE = (PLAN && PLAN.meta && PLAN.meta.timeZone) || "Asia/Manila";

  var DEFAULT_SETTINGS = {
    units: "kg",
    defaultRest: 90,
    weightStep: 2.5,
    theme: "system",
    visualStyle: "neural",
    haptics: true,
    sound: true,
    workoutNotifications: true,
    notifSkipped: false,
    autoStartRest: true,
    voiceRestCue: false,
    barWeight: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25]
  };
  var DEFAULT_GOALS = {
    weeklySessions: 6,
    weeklyVolumeKg: 10000,
    dailySteps: 7000,
    monthlyVolumeKg: 40000
  };
  var DEFAULT_PROFILE = {
    athlete: "Lem",
    heightCm: 167,
    goalMode: "recomposition",
    goalStatement: "Smaller waist + visible abs while preserving muscle",
    proteinTargetG: 130,
    proteinRangeMinG: 120,
    proteinRangeMaxG: 145
  };
  var HAPTICS = {
    tap: 10,
    select: 14,
    completeSet: [12, 24, 18],
    pr: [20, 30, 20, 40, 30],
    warning: [35, 40, 35],
    success: [16, 32, 24],
    workoutStart: [12, 60, 12],
    workoutFinish: [16, 32, 24],
    restStart: 14,
    restDone: [16, 32, 24]
  };
  var REST_PRESETS = [60, 90, 120, 180];
  var runtime = {
    now: Date.now(),
    sheet: null,
    copyScope: "day",
    readinessValue: 8,
    pendingAction: null,
    progressExercise: "",
    plate: null,
    importBusy: false,
    summaryDayId: null,
    cycleReview: false,
    recordsSort: "recency",
    lastNotifSig: "",
    lastNotifSnapshot: null,
    pendingReload: false,
    activeTab: "today",
    drawerOpen: false,
    calYear: null,
    calMonth: null,
    marketFilter: "all",
    marketSelected: null,
    quickAddDraft: null,
    historyDate: null,
    lastLog: null,
    focusBeforeSheet: null,
    recoveredFrom: null,
    recoveryCandidateAt: 0,
    snapshotRecoveryNeeded: false,
    primaryStateValid: false,
    strengthCalc: { weight: null, reps: 5 },
    quickMeal: "breakfast"
  };

  var state = loadState();
  var rest = loadRest();
  var wakeLock = null;
  var audioCtx = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function richText(value) {
    return escapeHtml(value)
      .replace(/&lt;b&gt;/g, "<b>")
      .replace(/&lt;\/b&gt;/g, "</b>")
      .replace(/\n/g, "<br>");
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function localDateId(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function todayId() {
    try {
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: APP_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date()).reduce(function (acc, part) {
        acc[part.type] = part.value;
        return acc;
      }, {});
      return parts.year + "-" + parts.month + "-" + parts.day;
    } catch (err) {
      return localDateId(new Date());
    }
  }

  function parseDateId(id) {
    var parts = String(id || "").split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isoWeekId(date) {
    var d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var week1 = new Date(d.getFullYear(), 0, 4);
    var week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return d.getFullYear() + "-W" + pad2(week);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function numberOr(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function haptic(pattern) {
    if (!(state && state.settings && state.settings.haptics)) return;
    var resolved = typeof pattern === "string" ? HAPTICS[pattern] : pattern;
    if (nativeHaptic(resolved)) return;
    if (navigator.vibrate) {
      navigator.vibrate(resolved || HAPTICS.tap);
    }
  }

  function cleanNumber(value, decimals) {
    var n = numberOr(value, 0);
    var fixed = n.toFixed(decimals == null ? 1 : decimals);
    return fixed.replace(/\.0$/, "");
  }

  function formatDuration(totalSeconds) {
    var seconds = Math.max(0, Math.floor(numberOr(totalSeconds, 0)));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h > 0) return h + ":" + pad2(m) + ":" + pad2(s);
    return m + ":" + pad2(s);
  }

  function kgToDisplay(kg) {
    var value = numberOr(kg, 0);
    if (state.settings.units === "lb") return value * 2.2046226218;
    return value;
  }

  function displayToKg(value) {
    var n = numberOr(value, 0);
    if (state.settings.units === "lb") return n / 2.2046226218;
    return n;
  }

  function formatWeight(kg) {
    var value = kgToDisplay(kg);
    return cleanNumber(value, state.settings.units === "lb" ? 1 : 1);
  }

  function unitLabel() {
    return state.settings.units;
  }

  function icon(name) {
    var paths = {
      today: '<path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M12 13h.01M9 13h.01M15 13h.01M12 16h.01M9 16h.01M15 16h.01"/>',
      moon: '<path d="M21 13.4A8.5 8.5 0 0 1 10.6 3a7 7 0 1 0 10.4 10.4Z"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
      more: '<path d="M12 12h.01M19 12h.01M5 12h.01"/>',
      play: '<path d="m8 5 11 7-11 7V5Z"/>',
      pause: '<path d="M8 5h3v14H8ZM13 5h3v14h-3Z"/>',
      stop: '<path d="M6 6h12v12H6Z"/>',
      copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
      share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 16V3M7 8l5-5 5 5"/>',
      note: '<path d="M5 4h10l4 4v12H5Z"/><path d="M14 4v5h5M8 13h8M8 17h8M8 9h3"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      gear: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.4a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.97 4.03 1.7 1.7 0 0 0 10 2.47V2a2 2 0 1 1 4 0v.47a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
      chart: '<path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 3 5-7"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      minus: '<path d="M5 12h14"/>',
      plate: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/><path d="M9 9v6M15 9v6"/>',
      download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
      upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 21h14"/>',
      close: '<path d="M6 6l12 12M18 6 6 18"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      rings: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>',
      bag: '<path d="M7 8V7a5 5 0 0 1 10 0v1"/><path d="M5 8h14l-1 12H6L5 8Z"/>',
      target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
      grid: '<path d="M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z"/>',
      badge: '<circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-1.5 6 5-3 5 3-1.5-6"/>',
      book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3-3Z"/><path d="M5 4v13"/><path d="M8 8h7M8 12h6"/>',
      shoe: '<path d="M4 14c2.2 1.8 5.3 3 9.2 3H20c.6 0 1-.4 1-1v-1.4c0-.6-.4-1-1-1h-3.6c-1.7 0-3.2-.7-4.4-1.8L9.5 9.5 7.4 12 5 10.4 4 14Z"/><path d="M8 13h4M11 11l1.5-1.5"/>',
      refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M21 3v5h-5M3 21v-5h5"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      'chevron-left': '<path d="m15 6-6 6 6 6"/>',
      'chevron-right': '<path d="m9 6 6 6-6 6"/>',
      mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
      ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 11 2 2M11 7l2 2M15 11l2 2"/>',
      heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
      market: '<path d="M3 6h18l-2 6H5L3 6Z"/><path d="M6 12v8h12v-8M9 4l1-2h4l1 2"/>'
    };
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.more) + "</svg>";
  }

  function normalizeState(loaded) {
    loaded = migrateToV3(loaded);
    loaded.settings = Object.assign({}, DEFAULT_SETTINGS, loaded.settings || {});
    loaded.days = loaded.days || {};
    loaded.bodyweight = Array.isArray(loaded.bodyweight) ? loaded.bodyweight : [];
    loaded.measurements = Array.isArray(loaded.measurements) ? loaded.measurements : [];
    loaded.progressPhotos = Array.isArray(loaded.progressPhotos) ? loaded.progressPhotos : [];
    loaded.prs = loaded.prs || {};
    loaded.achievements = loaded.achievements || {};
    loaded.goals = Object.assign({}, DEFAULT_GOALS, loaded.goals || {});
    loaded.profile = Object.assign({}, DEFAULT_PROFILE, loaded.profile || {});
    var weeklyGoalPlanVersion = numberOr(loaded.weeklyGoalPlanVersion, 0);
    if (weeklyGoalPlanVersion < 1 && numberOr(loaded.goals.weeklySessions, 6) === 5) {
      loaded.goals.weeklySessions = 4;
    }
    if (weeklyGoalPlanVersion < 2 && numberOr(loaded.goals.weeklySessions, 6) === 4) {
      loaded.goals.weeklySessions = 6;
    }
    loaded.weeklyGoalPlanVersion = 2;
    loaded.steps = loaded.steps || {};
    loaded.calories = loaded.calories || {};
    loaded.restingHr = Array.isArray(loaded.restingHr) ? loaded.restingHr : [];
    loaded.customWorkouts = Array.isArray(loaded.customWorkouts) ? loaded.customWorkouts : [];
    loaded.strengthEstimates = Array.isArray(loaded.strengthEstimates) ? loaded.strengthEstimates : [];
    loaded.cloudSync = Object.assign({ provider: null, lastBackupAt: null, autoWeekly: false }, loaded.cloudSync || {});
    loaded.weeklyRecapDismissedIso = loaded.weeklyRecapDismissedIso || null;
    loaded.reentryDismissedWeekId = loaded.reentryDismissedWeekId || null;
    loaded.cycleReviewSeen = !!loaded.cycleReviewSeen;
    var program = feature("program");
    if (program && typeof program.ensureRollingPlan === "function" && PLAN) {
      program.ensureRollingPlan(loaded, PLAN, todayId());
    }
    annotateCustomExerciseIndexes(loaded);
    return loaded;
  }

  function annotateCustomExerciseIndexes(sourceState) {
    if (!sourceState || !sourceState.days || !PLAN) return sourceState;
    var planDays = {};
    var weeks = (PLAN.weeks || []).filter(function (week) { return !week.generated; })
      .concat(sourceState.rollingPlan && Array.isArray(sourceState.rollingPlan.weeks) ? sourceState.rollingPlan.weeks : []);
    weeks.forEach(function (week) {
      (week.days || []).forEach(function (day) { planDays[day.id] = day; });
    });
    Object.keys(sourceState.days).forEach(function (date) {
      var ds = sourceState.days[date];
      if (!ds || !Array.isArray(ds.customExercises) || !ds.customExercises.length || !planDays[date]) return;
      ds.baseExerciseCount = (planDays[date].exercises || []).length;
    });
    return sourceState;
  }

  function loadState() {
    var loaded = null;
    var primaryRaw = null;
    var candidates = [];
    try {
      primaryRaw = localStorage.getItem(STORE_KEY);
      loaded = JSON.parse(primaryRaw || "null");
      if (loaded && !isUsableStoredState(loaded)) throw new Error("Primary state shape is invalid");
      runtime.primaryStateValid = !!loaded;
    } catch (err) {
      loaded = null;
      runtime.primaryStateValid = false;
    }
    if (!loaded) {
      try {
        var persistence = window.LIFT_FEATURES && window.LIFT_FEATURES.persistence;
        var nativeRaw = persistence && persistence.loadNativeMirror ? persistence.loadNativeMirror() : "";
        var nativeState = nativeRaw ? JSON.parse(nativeRaw) : null;
        if (isUsableStoredState(nativeState)) {
          candidates.push({ state: nativeState, source: "Android state mirror", at: stateUpdatedAt(nativeState), priority: 4 });
        }
      } catch (nativeErr) {
        // Continue through the remaining independent recovery layers.
      }
      for (var rollbackIndex = 0; rollbackIndex < 3; rollbackIndex += 1) {
        try {
          var record = JSON.parse(localStorage.getItem("lift.v4.rollback." + rollbackIndex) || "null");
          if (record && record.digest && persistence && persistence.digest && persistence.digest(String(record.json || "")) !== record.digest) continue;
          var fallbackState = record && record.json ? JSON.parse(record.json) : null;
          if (isUsableStoredState(fallbackState)) {
            candidates.push({ state: fallbackState, source: "local rollback snapshot", at: Math.max(Number(record.createdAt || 0), stateUpdatedAt(fallbackState)), priority: 3 });
          }
        } catch (fallbackErr) {}
      }
      try {
        var legacyState = JSON.parse(localStorage.getItem(V2_STORE_KEY) || "null");
        if (isUsableStoredState(legacyState)) {
          candidates.push({ state: legacyState, source: primaryRaw ? "legacy state after corruption" : "legacy state migration", at: stateUpdatedAt(legacyState), priority: 2 });
        }
      } catch (err1) {
        // A broken legacy copy cannot block newer recovery layers.
      }
      try {
        var v1State = JSON.parse(localStorage.getItem(V1_STORE_KEY) || "null");
        if (isUsableStoredState(v1State)) candidates.push({ state: v1State, source: "v1 state migration", at: stateUpdatedAt(v1State), priority: 1 });
      } catch (v1Err) {}

      var selected = chooseRecoveryCandidate(candidates);
      if (selected) {
        loaded = selected.state;
        runtime.recoveredFrom = selected.source;
        runtime.recoveryCandidateAt = selected.at;
      }
      runtime.snapshotRecoveryNeeded = true;
    }
    if (!loaded) {
      loaded = { v: 3, settings: {}, days: {}, bodyweight: [], prs: {}, activeWeekId: null, activeDayId: null };
      migrateV1(loaded);
    }
    loaded = normalizeState(loaded);
    var selection = chooseInitialSelection(loaded);
    loaded.activeWeekId = selection.weekId;
    loaded.activeDayId = selection.dayId;
    try {
      var theme = localStorage.getItem(THEME_KEY);
      if (theme && !loaded.settings.theme) loaded.settings.theme = theme;
    } catch (err2) {}
    return loaded;
  }

  async function recoverDurableSnapshot() {
    if (!runtime.snapshotRecoveryNeeded) return;
    var persistence = feature("persistence");
    if (!persistence || typeof persistence.latestValidSnapshot !== "function") return;
    try {
      var recovered = await persistence.latestValidSnapshot(false);
      if (!recovered || !isUsableStoredState(recovered.state)) return;
      var recoveredAt = Math.max(Number(recovered.record && recovered.record.createdAt || 0), stateUpdatedAt(recovered.state));
      if (runtime.recoveryCandidateAt && recoveredAt < runtime.recoveryCandidateAt) return;
      state = normalizeState(recovered.state);
      var selection = chooseInitialSelection(state);
      state.activeWeekId = selection.weekId;
      state.activeDayId = selection.dayId;
      runtime.recoveredFrom = "durable local snapshot";
      runtime.recoveryCandidateAt = recoveredAt;
    } catch (err) {
      // A failed optional recovery layer must not prevent a valid fallback from loading.
    } finally {
      runtime.snapshotRecoveryNeeded = false;
    }
  }

  function stateUpdatedAt(value) {
    if (!value || typeof value !== "object") return 0;
    return Math.max(
      Number(value.updatedAt || 0),
      Number(value.backup && value.backup.lastRestoreAt || 0),
      Number(value.migration && value.migration.migratedAt || 0)
    );
  }

  function chooseRecoveryCandidate(candidates) {
    return (Array.isArray(candidates) ? candidates : []).filter(function (candidate) {
      return candidate && isUsableStoredState(candidate.state);
    }).sort(function (a, b) {
      return Number(b.at || 0) - Number(a.at || 0) || Number(b.priority || 0) - Number(a.priority || 0);
    })[0] || null;
  }

  function isUsableStoredState(value) {
    return !!value && typeof value === "object" && !Array.isArray(value) && value.days && typeof value.days === "object" && !Array.isArray(value.days);
  }

  function migrateToV3(loaded) {
    var stateMod = window.LIFT_FEATURES && window.LIFT_FEATURES.state;
    if (stateMod && typeof stateMod.migrateState === "function") return stateMod.migrateState(loaded);
    if (!loaded || typeof loaded !== "object") loaded = {};
    return Object.assign({}, loaded, { v: 4, schemaVersion: 4 });
  }

  function migrateV1(next) {
    try {
      var theme = localStorage.getItem(V1_THEME_KEY);
      if (theme) next.settings.theme = theme;
    } catch (err) {}
    try {
      var old = JSON.parse(localStorage.getItem(V1_STORE_KEY) || "null");
      if (old && old.days) next.days = Object.assign({}, old.days);
      if (old && old.activeDayId) next.activeDayId = old.activeDayId;
    } catch (err2) {}
  }

  function saveState(reason) {
    state = migrateToV3(state);
    runAchievementEvaluation();
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      localStorage.setItem(THEME_KEY, state.settings.theme || "system");
      var persistence = feature("persistence");
      if (persistence && typeof persistence.scheduleSnapshot === "function") {
        persistence.scheduleSnapshot(state, reason || "state-change");
      }
    } catch (err) {
      toast("Storage is full or blocked. Export a backup before adding more data.");
    }
  }

  function loadRest() {
    try {
      return JSON.parse(localStorage.getItem(REST_KEY) || "null") || idleRest();
    } catch (err) {
      return idleRest();
    }
  }

  function saveRest() {
    try {
      localStorage.setItem(REST_KEY, JSON.stringify(rest));
    } catch (err) {}
  }

  function idleRest() {
    return { duration: DEFAULT_SETTINGS.defaultRest, endsAt: 0, pausedRemaining: DEFAULT_SETTINGS.defaultRest, running: false, label: "Rest", completedAt: 0 };
  }

  function allDays() {
    if (!PLAN || !Array.isArray(PLAN.weeks)) return [];

    var cache = allDays._flatCache;
    if (!cache || cache.plan !== PLAN || cache.weeks !== PLAN.weeks || cache.weekCount !== PLAN.weeks.length) {
      var flat = [];
      PLAN.weeks.forEach(function (week) {
        (week.days || []).forEach(function (day) {
          flat.push({ week: week, day: day });
        });
      });
      cache = {
        plan: PLAN,
        weeks: PLAN.weeks,
        weekCount: PLAN.weeks.length,
        flat: flat
      };
      allDays._flatCache = cache;
    }

    return cache.flat.map(function (entry) {
      var day = entry.day;
      var ds = (state && state.days && state.days[day.id]) || {};
      var custom = Array.isArray(ds.customExercises) ? ds.customExercises : [];
      var mergedDay = custom.length
        ? Object.assign({}, day, { exercises: (day.exercises || []).concat(custom) })
        : day;

      return { week: entry.week, day: mergedDay };
    });
  }

  function getWeek(id) {
    return (PLAN.weeks || []).find(function (week) { return week.id === id; }) || (PLAN.weeks || [])[0];
  }

  var _dayMapCache = null;
  var _weekMapCache = null;
  var _dayMapWeeksRef = null;
  var _dayMapWeekCount = -1;
  function ensureDayMaps() {
    var weeks = PLAN && PLAN.weeks || [];
    if (!_dayMapCache || _dayMapWeeksRef !== weeks || _dayMapWeekCount !== weeks.length) {
      _dayMapCache = {};
      _weekMapCache = {};
      weeks.forEach(function (week) {
        (week.days || []).forEach(function (day) {
          _dayMapCache[day.id] = day;
          _weekMapCache[day.id] = week;
        });
      });
      _dayMapWeeksRef = weeks;
      _dayMapWeekCount = weeks.length;
    }
  }

  function getDay(id) {
    ensureDayMaps();
    var day = _dayMapCache[id];
    if (!day) return null;

    var ds = (state && state.days && state.days[id]) || {};
    var custom = Array.isArray(ds.customExercises) ? ds.customExercises : [];
    return custom.length
      ? Object.assign({}, day, { exercises: (day.exercises || []).concat(custom) })
      : day;
  }

  function feature(name) {
    return window.LIFT_FEATURES && window.LIFT_FEATURES[name];
  }

  function makeCtx() {
    return {
      state: state,
      plan: PLAN,
      allDays: allDays,
      getDay: getDay,
      getWeek: getWeek,
      weekForDayId: weekForDayId,
      dayState: dayState,
      totalSetCount: totalSetCount,
      totalSetCountForSource: totalSetCountForSource,
      completedSetCount: completedSetCount,
      exerciseSets: exerciseSets,
      completedVolume: completedVolume,
      workoutElapsed: workoutElapsed,
      formatWeight: formatWeight,
      kgToDisplay: kgToDisplay,
      displayToKg: displayToKg,
      unitLabel: unitLabel,
      cleanNumber: cleanNumber,
      formatDuration: formatDuration,
      escapeHtml: escapeHtml,
      richText: richText,
      icon: icon,
      toast: toast,
      haptic: haptic,
      nativeShareText: nativeShareText,
      nativeShareJson: nativeShareJson,
      nativeShareImage: nativeShareImage,
      openSheet: openSheet,
      closeSheet: closeSheet,
      downloadDayImage: downloadDayImage,
      exportData: exportData,
      importData: importData,
      saveState: saveState,
      appVersion: APP_VERSION,
      checkForUpdates: checkForUpdates,
      cycleAdherence: cycleAdherence,
      trainingStreak: trainingStreak,
      dayStatus: dayStatus,
      historyStatus: historyStatus,
      localDateId: localDateId,
      todayId: todayId,
      normalizePhase: normalizePhase,
      isoWeekId: isoWeekId,
      defaultGoals: DEFAULT_GOALS,
      runtime: runtime,
      PLAN: PLAN
    };
  }

  function runAchievementEvaluation() {
    var mod = feature("achievements");
    if (!mod || typeof mod.evaluate !== "function" || !state) return [];
    try {
      var unlocked = mod.evaluate(makeCtx()) || [];
      unlocked.forEach(function (badge) {
        if (badge && badge.title) toast("Badge unlocked: " + badge.title);
      });
      return unlocked;
    } catch (err) {
      console.warn("Achievement evaluation failed", err);
      return [];
    }
  }

  function weekForDayId(dayId) {
    ensureDayMaps();
    return _weekMapCache[dayId] || null;
  }

  function parseWeekBounds(week) {
    var ids = (week.days || []).map(function (d) { return d.id; }).sort();
    return ids.length ? { start: parseDateId(ids[0]), end: parseDateId(ids[ids.length - 1]) } : null;
  }

  function chooseInitialSelection(sourceState) {
    if (!PLAN || !Array.isArray(PLAN.weeks) || !PLAN.weeks.length) return { weekId: null, dayId: null };
    var entries = allDays().sort(function (a, b) { return a.day.id.localeCompare(b.day.id); });
    var currentTodayId = todayId();
    var exact = entries.find(function (entry) { return entry.day.id === currentTodayId; });
    if (exact) return { weekId: exact.week.id, dayId: exact.day.id };

    var first = entries[0];
    var last = entries[entries.length - 1];
    var today = parseDateId(currentTodayId);
    if (today < parseDateId(first.day.id)) return { weekId: first.week.id, dayId: first.day.id };

    var containing = (PLAN.weeks || []).find(function (week) {
      var bounds = parseWeekBounds(week);
      return bounds && today >= bounds.start && today <= bounds.end;
    });
    if (containing) {
      var firstOpen = firstIncompleteDay(containing, sourceState) || containing.days[containing.days.length - 1];
      return { weekId: containing.id, dayId: firstOpen.id };
    }

    if (today > parseDateId(last.day.id)) {
      var lastWeek = PLAN.weeks[PLAN.weeks.length - 1];
      var open = firstIncompleteDay(lastWeek, sourceState) || lastWeek.days[lastWeek.days.length - 1];
      return { weekId: lastWeek.id, dayId: open.id };
    }

    if (sourceState.activeDayId && getDay(sourceState.activeDayId)) {
      return { weekId: (weekForDayId(sourceState.activeDayId) || PLAN.weeks[0]).id, dayId: sourceState.activeDayId };
    }

    var anyOpen = entries.find(function (entry) {
      return dayStatus(entry.day, sourceState) !== "done" && (entry.day.exercises || []).length;
    });
    if (anyOpen) return { weekId: anyOpen.week.id, dayId: anyOpen.day.id };
    return { weekId: first.week.id, dayId: first.day.id };
  }

  function firstIncompleteDay(week, sourceState) {
    return (week.days || []).find(function (day) {
      return (day.exercises || []).length && dayStatus(day, sourceState) !== "done";
    });
  }

  function dayState(dayId) {
    if (!state.days[dayId]) {
      var plannedDay = getDay(dayId);
      var status = plannedDay && !(plannedDay.exercises || []).length
        ? "rest"
        : dayId < todayId() ? "unknown" : "planned";
      state.days[dayId] = { completed: {}, extraSets: {}, drafts: {}, status: status, source: "runtime" };
    }
    state.days[dayId].completed = state.days[dayId].completed || {};
    state.days[dayId].extraSets = state.days[dayId].extraSets || {};
    state.days[dayId].drafts = state.days[dayId].drafts || {};
    state.days[dayId].exerciseFlags = state.days[dayId].exerciseFlags || {};
    state.days[dayId].adaptiveTargets = state.days[dayId].adaptiveTargets || {};
    return state.days[dayId];
  }

  function plannedSet(set) {
    return {
      reps: numberOr(set && (set.reps != null ? set.reps : set.r), 0),
      weight: numberOr(set && (set.weight != null ? set.weight : set.w), 0)
    };
  }

  function exerciseSets(day, exIndex) {
    var ex = (day.exercises || [])[exIndex];
    if (!ex) return [];
    var base = (ex.sets || []).map(plannedSet);
    var target = adaptiveTarget(day, ex, exIndex);
    if (target && Number(target.sets) > 0 && Number(target.sets) < base.length) {
      base = base.slice(0, Number(target.sets));
    }
    var extraCount = numberOr(dayState(day.id).extraSets[String(exIndex)], 0);
    var last = base[base.length - 1] || { reps: 0, weight: 0 };
    for (var i = 0; i < extraCount; i += 1) {
      base.push({ reps: last.reps, weight: last.weight, extra: true });
    }
    return base;
  }

  function totalSetCount(day) {
    return (day.exercises || []).reduce(function (sum, ex, exIndex) {
      return sum + exerciseSets(day, exIndex).length;
    }, 0);
  }

  function isCompletedSet(entry) {
    return !!entry && numberOr(entry.reps, 0) > 0;
  }

  function completedSetCount(day, sourceState) {
    var ds = (sourceState || state).days[day.id] || {};
    var completed = ds.completed || {};
    return Object.keys(completed).filter(function (key) { return isCompletedSet(completed[key]); }).length;
  }

  function dayStatus(day, sourceState) {
    var total = totalSetCountForSource(day, sourceState || state);
    if (!total) return ((sourceState || state).days[day.id] || {}).finishedAt ? "done" : "rest";
    var completed = completedSetCount(day, sourceState || state);
    if (completed >= total) return "done";
    if (completed > 0) return "partial";
    return "rest";
  }

  function historyStatus(day, sourceState) {
    var history = feature("history");
    if (history && typeof history.resolveStatus === "function") {
      return history.resolveStatus(day, ((sourceState || state).days || {})[day.id], todayId());
    }
    var legacy = dayStatus(day, sourceState);
    if (legacy === "done" || legacy === "partial") return "completed";
    if (!(day.exercises || []).length) return "rest";
    return day.id >= todayId() ? "planned" : "unknown";
  }

  function historyStatusMark(status) {
    return ({ completed: "\u2713", reconstructed: "R", missed: "!", unknown: "?", planned: "\u2022", rest: "\u2013" })[status] || "";
  }

  function totalSetCountForSource(day, sourceState) {
    return (day.exercises || []).reduce(function (sum, ex, exIndex) {
      var sourceDay = ((sourceState.days || {})[day.id] || {});
      var extra = (sourceDay.extraSets || {})[String(exIndex)] || 0;
      var target = (sourceDay.adaptiveTargets || {})[String(exIndex)];
      var plannedCount = (ex.sets || []).length;
      if (target && Number(target.sets) > 0) plannedCount = Math.min(plannedCount, Number(target.sets));
      return sum + plannedCount + numberOr(extra, 0);
    }, 0);
  }

  function completedVolume(day) {
    var ds = state.days[day.id] || { completed: {} };
    var volume = 0;
    Object.keys(ds.completed || {}).forEach(function (key) {
      var entry = ds.completed[key];
      if (entry) volume += numberOr(entry.weight, 0) * numberOr(entry.reps, 0);
    });
    return volume;
  }

  function workoutElapsed(dayId) {
    var ds = dayState(dayId);
    var before = numberOr(ds.elapsedBeforeStart, 0);
    if (ds.startedAt) {
      var end = ds.finishedAt || runtime.now;
      return before + Math.max(0, (end - ds.startedAt) / 1000);
    }
    return before;
  }

  function isWorkoutRunning(dayId) {
    var ds = dayState(dayId);
    return !!(ds.startedAt && !ds.finishedAt);
  }

  function applyTheme(choice) {
    var selected = choice || state.settings.theme || "system";
    var resolved = selected === "system"
      ? (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : selected;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeChoice = selected;
    // Update theme-color meta so the Android system status bar adapts.
    var meta = document.getElementById("theme-color-active");
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#161616" : "#f2f2f3");
    syncNativeSystemBars(resolved);
    try { localStorage.setItem(THEME_KEY, selected); } catch (err) {}
  }

  function applyVisualStyle(style) {
    var allowed = { classic: true, expressive: true, neural: true };
    var selected = allowed[style] ? style : "classic";
    document.documentElement.dataset.visualStyle = selected;
    if (state && state.settings) state.settings.visualStyle = selected;
  }

  function syncNativeSystemBars(resolved) {
    try {
      if (window.LiftAndroid && typeof window.LiftAndroid.setSystemBars === "function") {
        window.LiftAndroid.setSystemBars(resolved === "dark" ? "dark" : "light");
      }
    } catch (err) {}
  }

  function tagLabel(tag) {
    tag = normalizeTag(tag);
    var labels = {
      load: "&uarr; load",
      jump: "&uarr; jump",
      sets: "&uarr; sets",
      "pr-target": "PR target",
      "pr-attempt": "PR attempt",
      "new-bracket": "New bracket"
    };
    return labels[tag] || escapeHtml(tag || "");
  }

  function phaseName(phase) {
    phase = normalizePhase(phase);
    return ({ consolidate: "Consolidate", load: "Load", loadplus: "Load+", deload: "Deload", test: "Test", reentry: "Reentry" })[phase] || phase || "Plan";
  }

  function weekNoticeHeading(phase) {
    var normalized = normalizePhase(phase);
    if (normalized === "reentry") return "Reentry note";
    if (normalized === "deload") return "Deload notice";
    if (normalized === "test") return "Test week note";
    return "Week note";
  }

  function neuralPhase(phase, day) {
    var normalized = normalizePhase(phase);
    var type = String(day && day.type || "").toLowerCase();
    if (normalized === "test") return "test";
    if (normalized === "deload" || type === "rest") return "deload";
    if (normalized === "reentry") return "reentry";
    if (normalized === "load" || normalized === "loadplus") return "load";
    if (normalized === "consolidate") return "consolidate";
    return "train";
  }

  function neuralExerciseTone(ex, complete, caveat) {
    var tag = normalizeTag(ex && ex.tag);
    if (tag.indexOf("pr") >= 0 || tag === "new-bracket") return "test";
    if (caveat) return "warning";
    if (complete) return "complete";
    if (ex && ex.primary) return "primary";
    return "train";
  }

  function normalizePhase(phase) {
    var value = String(phase || "").toLowerCase().replace(/\s+/g, "");
    if (value === "load+") return "loadplus";
    if (value === "consolidation") return "consolidate";
    return value;
  }

  function normalizeTag(tag) {
    var value = String(tag || "").toLowerCase().replace(/\s+/g, "-");
    if (value === "pr") return "pr-target";
    return value;
  }

  function adaptiveSuggestion(day, ex, exIndex) {
    var mod = feature("progression");
    if (!mod || typeof mod.forExercise !== "function") return null;
    try { return mod.forExercise(makeCtx(), day, ex, exIndex); } catch (err) { return null; }
  }

  function adaptiveTarget(day, ex, exIndex) {
    var stored = (((state.days || {})[day.id] || {}).adaptiveTargets || {})[String(exIndex)];
    return stored || adaptiveSuggestion(day, ex, exIndex);
  }

  function adaptiveSet(day, ex, exIndex, set, setIndex) {
    var suggestion = adaptiveTarget(day, ex, exIndex);
    if (!suggestion || suggestion.action === "deload" || suggestion.action === "baseline") return plannedSet(set);
    var first = plannedSet((ex.sets || [])[0] || set);
    var current = plannedSet(set);
    var assisted = feature("progression") && feature("progression").isAssisted(ex);
    var weightOffset = current.weight - first.weight;
    var repsOffset = current.reps - first.reps;
    return {
      weight: Math.max(0, suggestion.weight + (assisted ? 0 : weightOffset)),
      reps: Math.max(1, suggestion.reps + repsOffset),
      adaptive: true,
      reason: suggestion.reason,
      action: suggestion.action,
      setIndex: setIndex
    };
  }

  function renderCompanionSnapshot(day, week) {
    var nutrition = feature("nutrition");
    var body = feature("body");
    var cardio = feature("cardio");
    var persistence = feature("persistence");
    var protein = nutrition && nutrition.totalProtein ? nutrition.totalProtein(state, todayId()) : 0;
    var proteinTarget = Number(state.profile && state.profile.proteinTargetG || 130);
    var bodySnap = body && body.snapshot ? body.snapshot(state, todayId()) : {};
    var cardioEntries = cardio && cardio.allEntries ? cardio.allEntries(state).filter(function (entry) { return entry.date === todayId() && !entry.skipped; }) : [];
    var health = persistence && persistence.backupHealth ? persistence.backupHealth(state) : { status: "overdue" };
    var firstExercise = (day.exercises || [])[0];
    var cue = firstExercise ? adaptiveTarget(day, firstExercise, 0) : null;
    var selectedDayState = (state.days || {})[day.id] || {};
    var recoveryText = firstExercise ? (selectedDayState.readiness == null ? "Check readiness" : "Readiness " + selectedDayState.readiness + "/10") : "Full rest planned";
    var recoverySheet = firstExercise ? "readiness" : "notes";
    var lastText = firstExercise ? lastSessionHint(firstExercise.name, day.id) : "Recovery day";
    if (!lastText) lastText = "No verified prior set";
    var bodyText = bodySnap.average7Kg == null ? "Add body weight" : bodySnap.average7Kg.toFixed(1) + " kg avg" + (bodySnap.waistChangeCm != null ? " - waist " + (bodySnap.waistChangeCm <= 0 ? "down " : "up ") + Math.abs(bodySnap.waistChangeCm).toFixed(1) + " cm" : "");
    var backupText = health.status === "protected" ? "Protected" : health.status === "needs-backup" ? "Needs backup" : "Backup overdue";
    return '<section class="companion-card"><div class="coach-cue"><span>Coach cue</span><strong>' + escapeHtml(cue ? cue.reason : (day.type === "rest" ? "Recover today. The next hard session benefits from it." : "Beat reps, not form.")) + '</strong></div>' +
      '<div class="companion-lines"><button data-action="open-sheet" data-sheet="progress"><span>Last time</span><strong>' + escapeHtml(lastText) + '</strong></button>' +
      '<button data-action="open-sheet" data-sheet="' + recoverySheet + '"><span>Recovery</span><strong>' + escapeHtml(recoveryText) + '</strong></button>' +
      '<button data-action="open-sheet" data-sheet="measurements"><span>Body trend</span><strong>' + escapeHtml(bodyText) + '</strong></button>' +
      '<button data-action="open-sheet" data-sheet="nutrition"><span>Protein</span><strong>' + protein + ' / ' + proteinTarget + ' g</strong></button>' +
      '<button data-action="open-sheet" data-sheet="cardio"><span>Cardio</span><strong>' + (cardioEntries.length ? cardioEntries.reduce(function (sum, entry) { return sum + Number(entry.distanceKm || 0); }, 0).toFixed(1) + ' km logged' : '1 km planned') + '</strong></button>' +
      '<button data-action="open-sheet" data-sheet="backup"><span>Backup</span><strong data-health="' + health.status + '">' + backupText + '</strong></button></div></section>';
  }

  function render() {
    if (!PLAN || !Array.isArray(PLAN.weeks) || !PLAN.weeks.length) {
      app.textContent = "";
      var emptyPlanDiv = document.createElement("div");
      emptyPlanDiv.className = "app-empty";
      emptyPlanDiv.textContent = "Plan data is missing. Confirm that data.js loads before app.js.";
      app.appendChild(emptyPlanDiv);
      return;
    }
    runtime.now = Date.now();
    var week = getWeek(state.activeWeekId) || PLAN.weeks[0];
    var day = getDay(state.activeDayId) || (week.days || [])[0];
    if (!day) {
      app.textContent = "";
      var emptyDayDiv = document.createElement("div");
      emptyDayDiv.className = "app-empty";
      emptyDayDiv.textContent = "No workout days found in the plan.";
      app.appendChild(emptyDayDiv);
      return;
    }
    state.activeWeekId = week.id;
    state.activeDayId = day.id;
    var total = totalSetCount(day);
    var completed = completedSetCount(day, state);
    var percent = total ? Math.round((completed / total) * 100) : 0;
    var volume = completedVolume(day);
    var ds = dayState(day.id);
    var currentTodayId = todayId();
    var html = "";

    html += '<header class="topbar">';
    html += '<div class="topbar-row">';
    html += '<button class="hamburger-btn" data-action="open-drawer" aria-label="Open menu">' + icon("menu") + "</button>";
    html += '<div><div class="eyebrow">' + escapeHtml("Week " + week.num + " - " + week.dateRange) + '</div><div class="title">' + escapeHtml(PLAN.meta && PLAN.meta.athlete ? PLAN.meta.athlete + "'s Lift" : "Lift") + "</div></div>";
    html += '<div class="top-actions">';
    html += '<button class="chip-btn" data-action="today">' + icon("today") + "<span>Today</span></button>";
    html += '<button class="icon-btn" data-action="cycle-theme" aria-label="Toggle theme">' + icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon") + "</button>";
    html += "</div></div></header>";

    html += '<nav class="week-strip" aria-label="Weeks">';
    PLAN.weeks.forEach(function (w) {
      html += '<button class="week-tab" data-action="select-week" data-week="' + escapeHtml(w.id) + '" data-phase="' + escapeHtml(normalizePhase(w.phase)) + '" data-active="' + String(w.id === week.id) + '">';
      html += '<div class="week-num">Week ' + escapeHtml(w.num) + "</div>";
      html += '<div class="week-range">' + escapeHtml(w.dateRange || "") + "</div>";
      html += "</button>";
    });
    html += "</nav>";

    html += '<div class="phase-row"><span class="phase-badge" data-phase="' + escapeHtml(normalizePhase(week.phase)) + '">' + escapeHtml(phaseName(week.phase)) + '</span><span>' + escapeHtml(week.sub || "") + "</span></div>";

    html += '<nav class="day-strip" aria-label="Days">';
    (week.days || []).forEach(function (d) {
      var integrityStatus = historyStatus(d, state);
      html += '<button class="day-pill" data-action="select-day" data-day="' + escapeHtml(d.id) + '" data-active="' + String(d.id === day.id) + '" data-today="' + String(d.id === currentTodayId) + '" data-status="' + integrityStatus + '" aria-label="' + escapeHtml((d.dow || "") + " " + (d.dom || "") + ", " + integrityStatus) + '">';
      html += '<div class="dow">' + escapeHtml(d.dow || "") + '</div><div class="dom">' + escapeHtml(d.dom || "") + '</div><span class="status-dot" aria-hidden="true">' + historyStatusMark(integrityStatus) + '</span>';
      html += "</button>";
    });
    html += "</nav>";

    var recap = feature("recap");
    if (recap && typeof recap.shouldShowWeeklyRecap === "function" && recap.shouldShowWeeklyRecap(makeCtx())) {
      html += recap.renderWeeklyRecapCard(makeCtx());
    }

    var nxPhase = neuralPhase(week.phase, day);
    html += '<section class="hero" data-type="' + escapeHtml(day.type || "legs") + '" data-nx-phase="' + escapeHtml(nxPhase) + '">';
    html += '<div class="hero-kicker">' + escapeHtml((day.month || "") + " " + (day.dom || "")) + "</div>";
    html += '<div class="hero-title">' + escapeHtml(day.title || "Workout") + "</div>";
    html += '<div class="hero-sub">' + escapeHtml(day.subtitle || (total ? "Training day" : "Recovery day")) + "</div>";
    if (total) {
      html += '<div class="hero-meta">';
      html += '<div class="hero-stat nx-metric"><div class="v">' + completed + "/" + total + '</div><div class="l">Sets</div></div>';
      html += '<div class="hero-stat nx-metric"><div class="v">' + cleanNumber(kgToDisplay(volume), 0) + '</div><div class="l">' + escapeHtml(unitLabel()) + ' volume</div></div>';
      html += '<div class="hero-stat"><div class="v" data-elapsed="' + escapeHtml(day.id) + '">' + formatDuration(workoutElapsed(day.id)) + '</div><div class="l">' + (ds.finishedAt ? "Done" : isWorkoutRunning(day.id) ? "Running" : "Time") + "</div></div>";
      html += "</div>";
      html += '<div class="hero-progress"><span style="width:' + clamp(percent, 0, 100) + '%"></span></div>';
      html += '<div class="hero-actions">';
      html += '<button class="hero-btn primary" data-action="' + (isWorkoutRunning(day.id) ? "finish-workout" : "start-workout") + '">' + icon(isWorkoutRunning(day.id) ? "stop" : "play") + "<span>" + (isWorkoutRunning(day.id) ? "Finish" : "Start workout") + "</span></button>";
      html += '<button class="hero-btn" data-action="open-sheet" data-sheet="notes">' + icon("note") + "<span>Notes</span></button>";
      html += '<button class="hero-btn" data-action="open-sheet" data-sheet="copy">' + icon("copy") + "<span>Copy log</span></button>";
      html += '<button class="hero-btn" data-action="open-sheet" data-sheet="progress">' + icon("chart") + "<span>Progress</span></button>";
      html += '<button class="hero-btn" data-action="open-history" data-date="' + escapeHtml(day.id) + '">' + icon("today") + '<span>History status</span></button>';
      html += "</div>";
    } else {
      html += '<div class="hero-actions">';
      html += '<button class="hero-btn primary" data-action="open-sheet" data-sheet="notes">' + icon("note") + "<span>Notes</span></button>";
      html += '<button class="hero-btn" data-action="open-sheet" data-sheet="overview">' + icon("chart") + "<span>Plan overview</span></button>";
      html += "</div>";
    }
    html += "</section>";

    html += renderCompanionSnapshot(day, week);

    var reentry = feature("reentry");
    if (reentry && typeof reentry.shouldShowBanner === "function" && reentry.shouldShowBanner(makeCtx())) {
      html += reentry.renderBanner(makeCtx());
    }

    html += '<main class="content">';
    if (week.notice) html += '<section class="notice" data-phase="' + escapeHtml(normalizePhase(week.phase)) + '"><strong>' + escapeHtml(weekNoticeHeading(week.phase)) + '</strong><p>' + richText(week.notice) + "</p></section>";
    if (ds.readiness != null && total) {
      var low = Number(ds.readiness) < 7;
      html += '<section class="notice ' + (low ? "readiness-warn" : "") + '"><strong>Readiness ' + escapeHtml(ds.readiness) + '/10</strong><p>' + (low ? "Caveat notes are highlighted for this workout." : "Readiness logged for this workout.") + "</p></section>";
    }
    if (day.warmup) html += '<section class="warmup"><strong>Warm-up</strong><p>' + richText(day.warmup) + "</p></section>";
    if (total) {
      html += '<div class="section-head"><div><div class="section-title">Workout</div><div class="section-sub">' + (day.exercises || []).length + ' exercises - ' + percent + '% complete</div></div><div class="workout-head-actions">';
      html += '<button class="action-btn compact" data-action="open-sheet" data-sheet="quickadd">' + icon("plus") + ' Exercise</button>';
      if (runtime.lastLog) html += '<button class="link-btn" data-action="undo-last">Undo last</button>';
      html += '<button class="link-btn" data-action="reset-day">Reset day</button></div></div>';
      html += '<section class="exercise-grid">';
      (day.exercises || []).forEach(function (ex, exIndex) {
        html += renderExercise(day, ex, exIndex);
      });
      html += "</section>";
      if (day.footer) html += '<p class="day-footer">' + richText(day.footer) + "</p>";
    } else {
      html += '<section class="rest-panel"><h2>' + escapeHtml(day.title || "Rest") + '</h2><p>' + richText(day.footer || day.note || day.subtitle || "Recovery day.") + "</p></section>";
    }
    html += "</main>";
    html += renderRestFab();

    app.innerHTML = html;
    alignActiveNavigation();
    syncRestFabLayout();
    renderSheet();
    renderSummaryOverlay();
    renderBottomNav();
    renderFab();
    renderNavDrawer();
    refreshTimers();
  }

  function alignActiveStrip(strip) {
    if (!strip) return;
    var active = strip.querySelector('[data-active="true"]');
    if (!active) return;
    var maxScroll = Math.max(0, numberOr(strip.scrollWidth, 0) - numberOr(strip.clientWidth, 0));
    var centered = numberOr(active.offsetLeft, 0) - numberOr(strip.offsetLeft, 0) -
      (numberOr(strip.clientWidth, 0) - numberOr(active.offsetWidth, 0)) / 2;
    strip.scrollLeft = clamp(centered, 0, maxScroll);
  }

  function alignActiveNavigation() {
    var schedule = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : function (callback) { setTimeout(callback, 0); };
    schedule(function () {
      alignActiveStrip(app.querySelector(".week-strip"));
      alignActiveStrip(app.querySelector(".day-strip"));
    });
  }

  function syncRestFabLayout() {
    var restFab = app.querySelector(".rest-fab");
    app.dataset.hasRestFab = String(!!restFab);
    var offset = restFab ? (restFab.offsetHeight + 22) + "px" : "0px";
    app.style.setProperty("--rest-fab-h", offset);
    document.body.style.setProperty("--rest-fab-offset", offset);
    document.body.dataset.hasRestFab = String(!!restFab);
  }

  function renderBottomNav() {
    var nav = document.getElementById("bottom-nav");
    if (!nav) return;
    var tab = runtime.activeTab || "today";
    var modalOpen = !!(runtime.sheet && runtime.sheetMode !== "page");
    nav.dataset.hidden = String(modalOpen);
    nav.setAttribute("aria-hidden", String(modalOpen));
    nav.querySelectorAll(".bottom-nav-btn").forEach(function (btn) {
      var active = btn.dataset.nav === tab;
      btn.dataset.active = String(active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
      btn.tabIndex = modalOpen ? -1 : 0;
    });
  }

  function renderFab() {
    var fab = document.getElementById("fab");
    if (!fab) return;
    if ((runtime.activeTab || "today") === "today") {
      fab.dataset.hidden = "true";
      return;
    }
    var day = getDay(state.activeDayId);
    if (!day) { fab.dataset.hidden = "true"; return; }
    var hasWork = (day.exercises || []).length > 0;
    if (!hasWork) {
      fab.dataset.hidden = "true";
      return;
    }
    fab.dataset.hidden = "false";
    var running = isWorkoutRunning(day.id);
    fab.dataset.running = String(running);
    var label = running ? "Finish workout" : (dayState(day.id).startedAt ? "Resume" : "Start workout");
    var iconKey = running ? "stop" : "play";
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      (iconKey === "stop" ? '<rect x="6" y="6" width="12" height="12" rx="2"/>' : '<polygon points="6 4 20 12 6 20 6 4"/>') +
      '</svg><span class="fab-label">' + escapeHtml(label) + '</span>';
    fab.setAttribute("aria-label", label);
    fab.dataset.action = running ? "finish-workout" : "start-workout";
  }

  function renderNavDrawer() {
    var drawer = document.getElementById("nav-drawer");
    var backdrop = document.getElementById("drawer-backdrop");
    if (!drawer || !backdrop) return;
    drawer.dataset.open = String(!!runtime.drawerOpen);
    backdrop.dataset.open = String(!!runtime.drawerOpen);

    var version = window.LIFT_APP_VERSION || APP_VERSION;
    var streaksMod = feature("streaks");
    var streak = streaksMod && typeof streaksMod.streakCount === "function"
      ? streaksMod.streakCount(makeCtx())
      : trainingStreak();
    var html = '';
    html += '<div class="nav-drawer-head"><div class="nav-drawer-brand">' +
      '<div class="nav-drawer-mark">L</div>' +
      '<div class="nav-drawer-meta"><strong>Lift</strong><span>' + streak + ' day streak &middot; v' + escapeHtml(version) + '</span></div>' +
      '</div></div>';
    html += '<div class="nav-drawer-body">';

    function navItem(sheetName, label, iconKey) {
      return '<button class="nav-item" data-action="drawer-open-sheet" data-sheet="' + sheetName + '">' +
        icon(iconKey) + '<span>' + escapeHtml(label) + '</span></button>';
    }

    html += '<div class="nav-section-head">Train</div>';
    html += navItem("library", "Workout library", "bag");
    html += navItem("marketplace", "Templates marketplace", "market");
    html += navItem("quickadd", "Quick-add exercise", "plus");
    html += navItem("cardio", "1 km cardio", "shoe");
    html += navItem("plate", "Plate calculator", "plate");
    html += navItem("readiness", "Readiness check-in", "heart");

    html += '<div class="nav-section-head">Track</div>';
    html += navItem("notes", "Workout notes", "note");
    html += navItem("bodyweight", "Body weight", "shoe");
    html += navItem("measurements", "Body measurements", "ruler");
    html += navItem("nutrition", "Protein & supplements", "heart");
    html += navItem("steps", "Steps", "shoe");
    html += navItem("goals", "Goals", "target");

    html += '<div class="nav-section-head">Trends</div>';
    html += navItem("rings", "Activity rings", "rings");
    html += navItem("streaks", "Streaks & weekly", "today");
    html += navItem("volume", "Muscle workload", "chart");
    html += navItem("strength", "1RM estimator", "chart");
    html += navItem("prs", "Personal records", "badge");
    html += navItem("calendar", "Calendar month view", "today");
    html += navItem("heatmap", "Training heatmap", "grid");
    html += navItem("badges", "Achievements", "badge");
    html += navItem("journal", "Activity journal", "book");
    html += navItem("progress", "Progress charts", "chart");

    html += '<div class="nav-section-head">Data</div>';
    html += navItem("overview", "Plan overview", "today");
    html += navItem("copy", "Export log", "copy");
    html += navItem("healthkit", "Health & Fit export", "heart");
    html += navItem("backup", "Backups", "upload");
    html += navItem("program", "Next training block", "refresh");
    html += navItem("settings", "Settings", "gear");

    html += '</div>';
    html += '<div class="nav-drawer-foot"><span>Lift v' + escapeHtml(version) + '</span>' +
      '<button class="icon-btn" data-action="close-drawer" aria-label="Close menu">' + icon("close") + '</button></div>';
    drawer.innerHTML = html;
  }

  function renderSummaryOverlay() {
    if (!summaryOverlay) return;
    if (!runtime.summaryDayId) {
      summaryOverlay.dataset.open = "false";
      summaryOverlay.innerHTML = "";
      document.body.classList.remove("summary-open");
      return;
    }
    document.body.classList.add("summary-open");
    if (runtime.cycleReview) {
      var recap = feature("recap");
      if (recap && typeof recap.renderCycleReview === "function") {
        summaryOverlay.innerHTML = recap.renderCycleReview(makeCtx());
        summaryOverlay.dataset.open = "true";
        return;
      }
    }
    var mod = feature("summary");
    if (!mod || typeof mod.renderOverlay !== "function") {
      summaryOverlay.dataset.open = "false";
      summaryOverlay.innerHTML = "";
      document.body.classList.remove("summary-open");
      return;
    }
    summaryOverlay.innerHTML = mod.renderOverlay(makeCtx(), runtime.summaryDayId);
    summaryOverlay.dataset.open = "true";
  }

  function shouldShowCopySet1(day, exIndex, sets) {
    if (!sets || sets.length < 2) return false;
    var ds = dayState(day.id);
    var s1 = getCurrentSetValue(day, exIndex, 0);
    for (var si = 1; si < sets.length; si += 1) {
      var key = exIndex + "." + si;
      if (isCompletedSet(ds.completed[key])) continue;
      var cur = getCurrentSetValue(day, exIndex, si);
      var differs = Math.abs(cur.weight - s1.weight) > 1e-6 || cur.reps !== s1.reps;
      var draft = ds.drafts[key];
      var hasMatchingDraft = !!(draft && Math.abs(numberOr(draft.weight, -1) - s1.weight) <= 1e-6 && numberOr(draft.reps, -1) === s1.reps);
      if (differs || !hasMatchingDraft) return true;
    }
    return false;
  }

  function renderExercise(day, ex, exIndex) {
    var ds = dayState(day.id);
    var sets = exerciseSets(day, exIndex);
    var complete = sets.length > 0 && sets.every(function (_, si) { return isCompletedSet(ds.completed[exIndex + "." + si]); });
    var caveat = isCaveatNote(ex.note) && Number(ds.readiness || 10) < 7;
    var tone = neuralExerciseTone(ex, complete, caveat);
    var suggestion = adaptiveTarget(day, ex, exIndex);
    var flags = ds.exerciseFlags[String(exIndex)] || {};
    var html = '<article class="ex-card" data-complete="' + String(complete) + '" data-caveat="' + String(caveat) + '" data-nx-tone="' + escapeHtml(tone) + '">';
    html += '<div class="ex-head"><div class="ex-num">' + (exIndex + 1) + '</div><div>';
    html += '<div class="ex-topline"><div><div class="ex-name">' + escapeHtml(ex.name || "Exercise") + '</div><div class="ex-target">' + escapeHtml(ex.target || "") + '</div></div></div>';
    html += '<div class="ex-tags">';
    if (ex.primary) html += '<span class="tag primary-tag">Primary</span>';
    if (ex.tag) html += '<span class="tag" data-tag="' + escapeHtml(normalizeTag(ex.tag)) + '">' + tagLabel(ex.tag) + '</span>';
    html += "</div>";
    var hint = lastSessionHint(ex.name, day.id);
    if (hint) html += '<div class="last-hint">' + escapeHtml(hint) + "</div>";
    if (suggestion) html += '<div class="adaptive-cue" data-action-kind="' + escapeHtml(suggestion.action) + '">' + escapeHtml(suggestion.reason) + '</div>';
    html += '<div class="weight-semantics">' + escapeHtml(weightModeLabel(ex)) + '</div>';
    var reentryMod = feature("reentry");
    if (reentryMod && typeof reentryMod.dumbbellPerHandText === "function") {
      var currentDbWeight = sets.length ? getCurrentSetValue(day, exIndex, 0).weight : (suggestion ? suggestion.weight : 0);
      var dbHint = reentryMod.dumbbellPerHandText(ex, currentDbWeight, makeCtx());
      if (dbHint) html += '<div class="db-hint">' + escapeHtml(dbHint) + '</div>';
    }
    html += "</div></div>";
    html += '<div class="ex-actions">';
    html += '<button class="tool-btn" data-action="did-planned" data-ex="' + exIndex + '">' + icon("check") + "Did as planned</button>";
    if (shouldShowCopySet1(day, exIndex, sets)) {
      html += '<button class="tool-btn set-carry-btn" data-action="copy-set1" data-ex="' + exIndex + '">Match S1</button>';
    }
    html += '<button class="tool-btn" data-action="add-set" data-ex="' + exIndex + '">' + icon("plus") + "Set</button>";
    html += '<button class="tool-btn form-link" data-action="form-video" data-name="' + escapeHtml(ex.name) + '"><svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M10 16.5l6-4.5-6-4.5v9zm12-4.5c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z"/></svg>Form</button>';
    html += '<button class="tool-btn" data-action="exercise-flag" data-ex="' + exIndex + '" data-flag="formIssue" data-active="' + String(!!flags.formIssue) + '">Form issue</button>';
    html += '<button class="tool-btn danger" data-action="exercise-flag" data-ex="' + exIndex + '" data-flag="pain" data-active="' + String(!!flags.pain) + '">Pain</button>';
    if (numberOr(ds.extraSets[String(exIndex)], 0) > 0) html += '<button class="tool-btn danger" data-action="remove-set" data-ex="' + exIndex + '">' + icon("minus") + "Remove set</button>";
    if (ex.custom) html += '<button class="tool-btn danger" data-action="remove-custom-exercise" data-ex="' + exIndex + '">' + icon("trash") + 'Remove exercise</button>';
    html += "</div>";
    html += '<div class="sets">';
    sets.forEach(function (set, setIndex) {
      html += renderSetRow(day, ex, exIndex, set, setIndex);
    });
    html += "</div>";
    if (ex.note) html += '<p class="ex-note" data-caveat="' + String(caveat) + '">' + richText(ex.note) + "</p>";
    html += "</article>";
    return html;
  }

  function renderSetRow(day, ex, exIndex, set, setIndex) {
    var key = exIndex + "." + setIndex;
    var ds = dayState(day.id);
    var completedEntry = ds.completed[key];
    var done = isCompletedSet(completedEntry) ? completedEntry : null;
    var draft = ds.drafts[key] || (!done && completedEntry) || {};
    var adaptive = adaptiveSet(day, ex, exIndex, set, setIndex);
    var weight = done && done.weight != null ? done.weight : draft.weight != null ? draft.weight : adaptive.weight;
    var reps = done && done.reps != null ? done.reps : draft.reps != null ? draft.reps : adaptive.reps;
    var rir = done && done.rir != null ? done.rir : draft.rir != null ? draft.rir : "";
    var html = '<div class="set-row" data-done="' + String(!!done) + '" data-pr="' + String(!!(done && done.pr)) + '">';
    html += '<div class="set-label">S' + (setIndex + 1) + (done && done.pr ? '<span class="pr-pill">PR</span>' : "") + "</div>";
    html += '<div class="number-control">';
    html += '<button class="set-btn" data-action="set-step" data-ex="' + exIndex + '" data-set="' + setIndex + '" data-field="weight" data-delta="-1" aria-label="Decrease weight">' + icon("minus") + "</button>";
    html += '<div class="set-input-wrap"><input class="set-input" inputmode="decimal" data-action="set-input" data-ex="' + exIndex + '" data-set="' + setIndex + '" data-field="weight" value="' + escapeHtml(formatWeight(weight)) + '"><button class="unit-label plate-mini" data-action="plate" data-ex="' + exIndex + '" data-set="' + setIndex + '">' + escapeHtml(unitLabel()) + "</button></div>";
    html += '<button class="set-btn" data-action="set-step" data-ex="' + exIndex + '" data-set="' + setIndex + '" data-field="weight" data-delta="1" aria-label="Increase weight">' + icon("plus") + "</button>";
    html += "</div>";
    html += '<div class="number-control">';
    html += '<button class="set-btn" data-action="set-step" data-ex="' + exIndex + '" data-set="' + setIndex + '" data-field="reps" data-delta="-1" aria-label="Decrease reps">' + icon("minus") + "</button>";
    html += '<div class="set-input-wrap"><input class="set-input" inputmode="numeric" data-action="set-input" data-ex="' + exIndex + '" data-set="' + setIndex + '" data-field="reps" value="' + escapeHtml(reps) + '"><span class="unit-label">reps</span></div>';
    html += '<button class="set-btn" data-action="set-step" data-ex="' + exIndex + '" data-set="' + setIndex + '" data-field="reps" data-delta="1" aria-label="Increase reps">' + icon("plus") + "</button>";
    html += "</div>";
    html += '<button class="check-btn" data-action="toggle-set" data-ex="' + exIndex + '" data-set="' + setIndex + '" aria-label="Toggle set complete">' + icon("check") + "</button>";
    html += '<label class="rir-control"><span>RIR</span><select data-action="set-rir" data-ex="' + exIndex + '" data-set="' + setIndex + '" aria-label="Reps in reserve for set ' + (setIndex + 1) + '"><option value=""' + (rir === "" ? ' selected' : '') + '>-</option>' + [0,1,2,3,4].map(function (value) { return '<option value="' + value + '"' + (rir !== "" && rir != null && Number(rir) === value ? ' selected' : '') + '>' + value + '</option>'; }).join('') + '</select></label>';
    html += "</div>";
    return html;
  }

  function weightModeLabel(exercise) {
    var mode = exercise && exercise.weightMode;
    if (mode === "per_hand") return "Weight is per hand";
    if (mode === "per_side") return "Weight is per side";
    if (mode === "bodyweight") return "Bodyweight movement; load is optional added weight";
    if (mode === "total" && /\b(db|dumbbell)\b/i.test(exercise && exercise.name || "")) return "Dumbbell weight is total (both hands)";
    return "Weight is total machine / implement load";
  }

  function tagSetExercise(entry, exercise) {
    if (!entry || !exercise) return entry;
    entry.exerciseName = exercise.name || null;
    if (exercise.id) entry.exerciseId = exercise.id;
    return entry;
  }

  function renderRestFab() {
    var remaining = restRemaining();
    var duration = Math.max(1, numberOr(rest.duration, state.settings.defaultRest));
    var showCompleted = numberOr(rest.completedAt, 0) > 0;
    var isVisible = !!(rest.running || remaining < duration || showCompleted);
    if (!isVisible) return "";
    var isActive = !!rest.running;
    var progress = rest.running ? clamp(remaining / duration, 0, 1) : 0;
    var circumference = 2 * Math.PI * 22;
    var offset = circumference * (1 - progress);
    var html = '<aside class="rest-fab" data-active="' + String(isActive) + '">';
    html += '<div class="rest-main">';
    html += '<div class="rest-ring"><svg viewBox="0 0 52 52"><circle class="track" cx="26" cy="26" r="22"></circle><circle class="bar" cx="26" cy="26" r="22" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"></circle></svg></div>';
    html += '<div><div class="rest-small">Rest timer</div><div class="rest-time" data-rest-time>' + formatDuration(remaining) + "</div></div>";
    html += '<div class="rest-actions">';
    html += '<button class="icon-btn" data-action="rest-adjust" data-delta="-15" aria-label="Subtract 15 seconds">' + icon("minus") + "</button>";
    html += '<button class="icon-btn primary" data-action="rest-toggle" aria-label="Play pause rest timer">' + icon(rest.running ? "pause" : "play") + "</button>";
    html += '<button class="icon-btn" data-action="rest-adjust" data-delta="15" aria-label="Add 15 seconds">' + icon("plus") + "</button>";
    html += '<button class="icon-btn rest-dismiss-btn" data-action="rest-dismiss" aria-label="Dismiss rest timer">' + icon("close") + "</button>";
    html += "</div></div>";
    html += '<div class="rest-presets">';
    REST_PRESETS.concat([state.settings.defaultRest]).filter(function (value, index, arr) { return arr.indexOf(value) === index; }).forEach(function (seconds) {
      html += '<button class="preset" data-action="rest-preset" data-sec="' + seconds + '">' + formatDuration(seconds) + "</button>";
    });
    html += "</div></aside>";
    return html;
  }

  function renderSheet() {
    if (!runtime.sheet) {
      sheet.dataset.open = "false";
      sheet.setAttribute("aria-hidden", "true");
      sheet.removeAttribute("aria-labelledby");
      sheet.removeAttribute("aria-modal");
      sheet.setAttribute("role", "dialog");
      sheet.dataset.type = "";
      sheet.dataset.mode = "";
      sheetBackdrop.dataset.open = "false";
      sheetBackdrop.dataset.mode = "";
      sheet.innerHTML = "";
      document.body.classList.remove("sheet-open");
      document.body.classList.remove("sheet-mode-page");
      document.body.classList.remove("sheet-mode-modal");
      return;
    }
    document.body.classList.add("sheet-open");
    sheetBackdrop.dataset.open = "true";
    sheet.dataset.open = "true";
    sheet.setAttribute("aria-hidden", "false");
    sheet.setAttribute("aria-labelledby", "sheet-title");
    sheet.setAttribute("tabindex", "-1");
    sheet.dataset.type = runtime.sheet;
    var mode = runtime.sheetMode === "page" ? "page" : "modal";
    sheet.dataset.mode = mode;
    sheetBackdrop.dataset.mode = mode;
    sheet.setAttribute("role", mode === "page" ? "region" : "dialog");
    if (mode === "page") sheet.removeAttribute("aria-modal");
    else sheet.setAttribute("aria-modal", "true");
    document.body.classList.toggle("sheet-mode-page", mode === "page");
    document.body.classList.toggle("sheet-mode-modal", mode !== "page");
    var title = sheetTitle(runtime.sheet);
    var headHtml;
    if (mode === "page") {
      headHtml = '<div class="sheet-head">' +
        '<button class="sheet-back" data-action="close-sheet" aria-label="Back">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<div class="sheet-title" id="sheet-title">' + escapeHtml(title) + '</div>' +
        '<span aria-hidden="true"></span>' +
        '</div>';
    } else {
      headHtml = '<div class="sheet-grabber" aria-hidden="true"></div>' +
        '<div class="sheet-head">' +
        '<div class="sheet-title" id="sheet-title">' + escapeHtml(title) + '</div>' +
        '<button class="icon-btn" data-action="close-sheet" aria-label="Close sheet">' + icon("close") + '</button>' +
        '</div>';
    }
    sheet.innerHTML = headHtml + '<div class="sheet-body">' + sheetBody(runtime.sheet) + "</div>";
  }

  function sheetTitle(type) {
    return {
      menu: "Menu",
      copy: "Copy and Export",
      settings: "Settings",
      notes: "Workout Notes",
      readiness: "Readiness",
      progress: "Progress",
      plate: "Plate Calculator",
      overview: "Plan Overview",
      bodyweight: "Body Weight",
      rings: "Activity Rings",
      prs: "Personal Records",
      heatmap: "Training Heatmap",
      badges: "Achievements",
      journal: "Activity Journal",
      library: "Workout Library",
      goals: "Goals",
      steps: "Steps",
      backup: "Backups",
      measurements: "Body Measurements",
      calendar: "Calendar",
      marketplace: "Templates Marketplace",
      healthkit: "Health & Fit Export",
      strength: "1RM & Strength",
      streaks: "Streaks & Weekly",
      quickadd: "Quick Add Exercise",
      cardio: "Post-workout Cardio",
      nutrition: "Protein & Supplements",
      history: "History Integrity",
      volume: "Muscle Workload",
      program: "Rolling Program"
    }[type] || "Sheet";
  }

  function sheetBody(type) {
    if (type === "menu") return menuSheet();
    if (type === "copy") return copySheet();
    if (type === "settings") return settingsSheet();
    if (type === "notes") return notesSheet();
    if (type === "readiness") return readinessSheet();
    if (type === "progress") return progressSheet();
    if (type === "plate") return plateSheet();
    if (type === "overview") return overviewSheet();
    if (type === "bodyweight") return bodyweightSheet();
    if (type === "rings") return featureSheet("rings", "renderRings");
    if (type === "prs") return featureSheet("records", "renderRecords", runtime.recordsSort);
    if (type === "heatmap") return featureSheet("heatmap", "renderHeatmap");
    if (type === "badges") return featureSheet("achievements", "renderBadges");
    if (type === "journal") return featureSheet("journal", "renderJournal");
    if (type === "library") return featureSheet("library", "renderLibrary");
    if (type === "steps") return featureSheet("steps", "renderSteps");
    if (type === "backup") return featureSheet("cloud", "renderBackup");
    if (type === "goals") return goalsSheet();
    if (type === "measurements") return featureSheet("measurements", "renderMeasurements");
    if (type === "calendar") return featureSheet("calendar", "renderCalendar");
    if (type === "marketplace") return featureSheet("marketplace", "renderMarketplace");
    if (type === "healthkit") return featureSheet("healthkit", "renderHealthExport");
    if (type === "strength") return featureSheet("strength", "renderStrength");
    if (type === "streaks") return featureSheet("streaks", "renderStreaks");
    if (type === "quickadd") return featureSheet("quickadd", "renderQuickAdd");
    if (type === "cardio") return featureSheet("cardio", "renderCardio");
    if (type === "nutrition") return featureSheet("nutrition", "renderNutrition");
    if (type === "history") return featureSheet("history", "renderHistoryEditor", runtime.historyDate || state.activeDayId);
    if (type === "volume") return featureSheet("volume", "renderVolume");
    if (type === "program") return featureSheet("program", "renderProgram");
    return "";
  }

  function featureSheet(featureName, methodName, arg) {
    var mod = feature(featureName);
    if (!mod || typeof mod[methodName] !== "function") {
      return '<div class="overview-card"><strong>Feature unavailable</strong><p>This feature module did not load.</p></div>';
    }
    return mod[methodName](makeCtx(), arg);
  }

  function menuSheet() {
    return '<div class="sheet-grid">' +
      menuSection("Train", [
        menuCard("rings", "Rings", "Train, Volume, Move"),
        menuCard("library", "Library", "Travel, mobility, custom"),
        menuCard("goals", "Goals", "Targets for the rings")
      ]) +
      menuSection("Track", [
        menuCard("notes", "Notes", "Current workout notes"),
        menuCard("bodyweight", "Body weight", "Log and sparkline"),
        menuCard("steps", "Steps", "Sensor or manual entry")
      ]) +
      menuSection("Trends", [
        menuCard("prs", "PRs", "Records and 1RM"),
        menuCard("progress", "Progress", "Charts, adherence, streak"),
        menuCard("heatmap", "Heatmap", "Training calendar"),
        menuCard("badges", "Badges", "Achievements"),
        menuCard("journal", "Journal", "Recent activity feed")
      ]) +
      menuSection("Data", [
        menuCard("overview", "Plan overview", "Baselines and cycle map"),
        menuCard("copy", "Export log", "Day, week, or full cycle"),
        menuCard("backup", "Backup", "Download or cloud export"),
        menuCard("settings", "Settings", "Units, theme, rest")
      ]) +
      "</div>";
  }

  function menuSection(label, cards) {
    return '<div><div class="menu-section">' + escapeHtml(label) + '</div><div class="menu-grid">' + cards.join("") + "</div></div>";
  }

  function menuCard(sheetName, label, sub) {
    return '<button class="menu-card" data-action="open-sheet" data-sheet="' + sheetName + '">' +
      menuIcon(sheetName) +
      '<span class="menu-copy"><span class="menu-title">' + escapeHtml(label) + "</span><span>" + escapeHtml(sub) + "</span></span></button>";
  }

  function menuIcon(sheetName) {
    var icons = {
      rings: "rings",
      library: "bag",
      goals: "target",
      notes: "note",
      bodyweight: "plate",
      steps: "shoe",
      prs: "chart",
      progress: "chart",
      heatmap: "grid",
      badges: "badge",
      journal: "book",
      overview: "chart",
      copy: "copy",
      backup: "upload",
      settings: "gear"
    };
    var tone = icons[sheetName] ? sheetName : "settings";
    return '<span class="menu-icon" data-tone="' + tone + '">' + icon(icons[sheetName] || "more") + "</span>";
  }

  function copySheet() {
    var log = buildLog(runtime.copyScope || "day");
    return '<div class="sheet-grid">' +
      '<div class="segmented">' +
      segmentButton("day", "Day", runtime.copyScope) +
      segmentButton("week", "Week", runtime.copyScope) +
      segmentButton("cycle", "Cycle", runtime.copyScope) +
      "</div>" +
      '<div class="log-box">' + escapeHtml(log) + "</div>" +
      '<div class="sheet-actions">' +
      '<button class="action-btn" data-action="copy-log">' + icon("copy") + "Copy</button>" +
      '<button class="action-btn secondary" data-action="share-log">' + icon("share") + "Share</button>" +
      '<button class="action-btn secondary" data-action="share-image">' + icon("download") + "Day image</button>" +
      "</div></div>";
  }

  function segmentButton(value, label, active) {
    return '<button data-action="copy-scope" data-scope="' + value + '" data-active="' + String(active === value) + '">' + label + "</button>";
  }

  function settingsSheet() {
    var s = state.settings;
    var voiceSupported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    return '<div class="settings-page">' +
      settingsHero() +
      settingsGroup("Display", [
        settingChoiceGroup("theme", "Theme", "Match Android, force light, or force dark.", s.theme, [["system", "System"], ["light", "Light"], ["dark", "Dark"]], "sun"),
        settingChoiceGroup("visualStyle", "Visual style", "Keep today's UI stable or opt into expressive motion and surfaces.", s.visualStyle || "classic", [["classic", "Calm"], ["expressive", "Expressive"], ["neural", "Neural"]], "rings"),
        settingChoiceGroup("units", "Units", "Use the units you log with most often.", s.units, [["kg", "kg"], ["lb", "lb"]], "plate")
      ]) +
      settingsGroup("Workout defaults", [
        settingNumberRow("defaultRest", "Default rest", "Seconds used by timer presets and auto-rest.", s.defaultRest, 15, 600, 15, "sec", "today"),
        settingNumberRow("weightStep", "Weight step", "Increment used by set controls.", s.weightStep, 0.5, 50, 0.5, unitLabel(), "plus"),
        settingNumberRow("barWeight", "Bar weight", "Default bar or sled estimate for plate math.", kgToDisplay(s.barWeight), 0, 100, 0.5, unitLabel(), "plate")
      ]) +
      settingsGroup("Feedback", [
        settingSwitch("haptics", "Haptics", nativeHapticAvailable() ? "Uses Android native haptic feedback when installed." : "Uses browser vibration when available.", !!s.haptics, "rings"),
        settingSwitch("sound", "Sound", "Short timer and completion cues.", !!s.sound, "bell"),
        settingSwitch("autoStartRest", "Auto-start rest", "Start the rest timer when a set is checked off.", s.autoStartRest !== false, "play"),
        settingSwitch("voiceRestCue", "Voice rest cue", voiceSupported ? "Speak when rest finishes." : "Not supported in this browser.", !!s.voiceRestCue, "mic", !voiceSupported)
      ]) +
      settingsGroup("Android integration", androidIntegrationRows()) +
      '<div class="settings-actions">' +
      '<button class="action-btn" data-action="export-data">' + icon("download") + "Export</button>" +
      '<button class="action-btn secondary" data-action="import-data">' + icon("upload") + "Import</button>" +
      '<button class="action-btn secondary" data-action="check-updates">' + icon("refresh") + "Check update</button>" +
      '<button class="action-btn danger" data-action="reset-all">' + icon("trash") + "Reset</button>" +
      "</div>" +
      '<p class="settings-footnote">Local-first storage. Export before clearing browser data or changing devices.</p>' +
      "</div>";
  }

  function settingsHero() {
    var native = !!window.LIFT_IS_NATIVE;
    return '<section class="settings-hero">' +
      '<div><div class="settings-kicker">Lift settings</div><h2>Android-ready controls</h2><p>Material 3 Expressive surfaces, native status bars, haptics, live notifications, and workout defaults in one place.</p></div>' +
      '<div class="settings-hero-mark"><span>v' + escapeHtml(APP_VERSION) + '</span><strong>' + (native ? "Native" : "PWA") + "</strong></div>" +
      "</section>";
  }

  function settingsGroup(title, rows) {
    return '<section class="settings-group"><div class="settings-group-head">' + escapeHtml(title) + "</div>" + rows.join("") + "</section>";
  }

  function settingIcon(iconKey, tone) {
    return '<span class="settings-icon" data-tone="' + escapeHtml(tone || iconKey || "neutral") + '">' + icon(iconKey || "gear") + "</span>";
  }

  function settingChoiceGroup(name, label, desc, value, options, iconKey) {
    var buttons = options.map(function (opt) {
      var active = String(value) === String(opt[0]);
      return '<button type="button" data-action="setting-choice" data-setting="' + escapeHtml(name) + '" data-value="' + escapeHtml(opt[0]) + '" data-active="' + String(active) + '">' + escapeHtml(opt[1]) + "</button>";
    }).join("");
    return '<div class="settings-row">' + settingIcon(iconKey, name) +
      '<span class="settings-copy"><strong>' + escapeHtml(label) + "</strong><span>" + escapeHtml(desc) + "</span></span>" +
      '<span class="settings-segment" role="group" aria-label="' + escapeHtml(label) + '">' + buttons + "</span></div>";
  }

  function settingNumberRow(name, label, desc, value, min, max, step, suffix, iconKey) {
    return '<div class="settings-row">' + settingIcon(iconKey, name) +
      '<span class="settings-copy"><strong>' + escapeHtml(label) + "</strong><span>" + escapeHtml(desc) + "</span></span>" +
      '<label class="settings-number"><input id="setting-' + escapeHtml(name) + '" data-action="setting" data-setting="' + escapeHtml(name) + '" type="number" min="' + min + '" max="' + max + '" step="' + step + '" value="' + escapeHtml(cleanNumber(value, 2)) + '"><small>' + escapeHtml(suffix || "") + "</small></label></div>";
  }

  function settingSwitch(name, label, desc, enabled, iconKey, disabled) {
    return '<button class="settings-row settings-row-button" type="button" data-action="setting-toggle" data-setting="' + escapeHtml(name) + '" data-value="' + (enabled ? "false" : "true") + '" data-disabled="' + String(!!disabled) + '"' + (disabled ? " disabled" : "") + ">" + settingIcon(iconKey, name) +
      '<span class="settings-copy"><strong>' + escapeHtml(label) + "</strong><span>" + escapeHtml(desc) + "</span></span>" +
      '<span class="switch-control" data-active="' + String(!!enabled) + '" aria-hidden="true"><span></span></span></button>';
  }

  function settingsStatusRow(label, desc, status, iconKey, tone) {
    return '<div class="settings-row">' + settingIcon(iconKey, tone) +
      '<span class="settings-copy"><strong>' + escapeHtml(label) + "</strong><span>" + escapeHtml(desc) + "</span></span>" +
      '<span class="settings-status" data-tone="' + escapeHtml(tone || "neutral") + '">' + escapeHtml(status) + "</span></div>";
  }

  function nativeHapticAvailable() {
    return !!(window.LIFT_IS_NATIVE && window.LiftAndroid && typeof window.LiftAndroid.haptic === "function");
  }

  function nativeAndroidInfo() {
    try {
      if (window.LIFT_IS_NATIVE && window.LiftAndroid && typeof window.LiftAndroid.getAndroidInfo === "function") {
        return JSON.parse(window.LiftAndroid.getAndroidInfo() || "{}");
      }
    } catch (err) {}
    return {};
  }

  function androidIntegrationRows() {
    var info = nativeAndroidInfo();
    var native = !!window.LIFT_IS_NATIVE;
    var notificationStatus = notificationStatusText();
    return [
      settingsStatusRow("Native shell", native ? ((info.manufacturer || "Android") + " " + (info.model || "device")) : "Install the APK for bridge features.", native ? "On" : "PWA", "gear", native ? "success" : "neutral"),
      settingsStatusRow("System bars", "Light screens use dark status/navigation icons; dark mode flips them.", "Synced", "sun", "success"),
      settingSwitch("workoutNotifications", "Live workout notification", notificationStatus, !!state.settings.workoutNotifications, "bell"),
      settingsStatusRow("Home widget", "Workout widget updates through the Android bridge in the native app.", native ? "Ready" : "APK only", "grid", native ? "success" : "neutral"),
      settingsStatusRow("Native export", "Backup and workout images use Android share/save targets when installed.", canUseNative("shareJsonFile") || canUseNative("saveBackupFile") ? "Ready" : "Web", "upload", canUseNative("shareJsonFile") || canUseNative("saveBackupFile") ? "success" : "neutral")
    ];
  }

  function notificationStatusText() {
    var status = "Unavailable in this browser.";
    if ("Notification" in window) {
      if (Notification.permission === "granted") status = "Allowed. Lift will keep one live workout notification active while you train.";
      else if (Notification.permission === "denied") status = "Blocked. Re-enable notifications from Chrome site settings for this app.";
      else status = state.settings.notifSkipped ? "Off. Turn this on to ask again next time." : "Ask on the next workout start.";
    }
    return status;
  }

  function goalsSheet() {
    var g = Object.assign({}, DEFAULT_GOALS, state.goals || {});
    return '<div class="sheet-grid">' +
      '<div class="overview-card"><strong>Goal system</strong><p>These goals feed the Train, Volume, and Move rings.</p></div>' +
      fieldNumber("goal-weeklySessions", "Weekly sessions", g.weeklySessions, 1, 14, 1) +
      fieldNumber("goal-weeklyVolumeKg", "Weekly volume (" + unitLabel() + ")", kgToDisplay(g.weeklyVolumeKg), 500, 100000, 250) +
      fieldNumber("goal-dailySteps", "Daily steps", g.dailySteps, 1000, 50000, 500) +
      fieldNumber("goal-monthlyVolumeKg", "Monthly volume (" + unitLabel() + ")", kgToDisplay(g.monthlyVolumeKg), 1000, 500000, 1000) +
      '<div class="sheet-actions"><button class="action-btn" data-action="open-sheet" data-sheet="rings">' + icon("chart") + "View rings</button></div>" +
      "</div>";
  }

  function fieldNumber(name, label, value, min, max, step) {
    return '<div class="field-block"><label for="setting-' + name + '">' + escapeHtml(label) + '</label><input id="setting-' + name + '" data-action="setting" data-setting="' + name + '" type="number" min="' + min + '" max="' + max + '" step="' + step + '" value="' + escapeHtml(cleanNumber(value, 2)) + '"></div>';
  }

  function notesSheet() {
    var day = getDay(state.activeDayId);
    var ds = dayState(day.id);
    return '<div class="sheet-grid"><div class="field-block"><label for="notes-field">' + escapeHtml(day.title || "Workout") + '</label><textarea id="notes-field" data-action="notes-input" placeholder="Log soreness, form cues, equipment substitutions, or anything worth remembering.">' + escapeHtml(ds.notes || "") + '</textarea></div></div>';
  }

  function readinessSheet() {
    var value = runtime.readinessValue || 8;
    return '<div class="sheet-grid">' +
      '<p class="section-sub">Rate today before logging. Scores under 7 highlight exercises with readiness caveats from the plan.</p>' +
      '<div class="range-row"><input type="range" min="1" max="10" step="1" value="' + value + '" data-action="readiness-input"><strong id="readiness-value">' + value + "/10</strong></div>" +
      '<div class="sheet-actions"><button class="action-btn" data-action="save-readiness">' + icon("check") + "Save and start</button></div>" +
      "</div>";
  }

  function progressSheet() {
    var names = exerciseNames();
    if (!runtime.progressExercise || names.indexOf(runtime.progressExercise) < 0) runtime.progressExercise = names[0] || "";
    var html = '<div class="sheet-grid">';
    html += '<div class="overview-card"><strong>Cycle</strong><p>' + cycleAdherence() + "% planned sets completed - " + trainingStreak() + " day streak</p></div>";
    html += '<div class="field-block"><label for="progress-ex">Exercise</label><select id="progress-ex" data-action="progress-exercise">';
    names.forEach(function (name) {
      html += '<option value="' + escapeHtml(name) + '"' + (name === runtime.progressExercise ? " selected" : "") + ">" + escapeHtml(name) + "</option>";
    });
    html += "</select></div>";
    html += renderProgressChart(runtime.progressExercise);
    var records = feature("records");
    if (records && typeof records.renderOneRmChart === "function") {
      html += records.renderOneRmChart(makeCtx(), runtime.progressExercise);
    }
    html += "</div>";
    return html;
  }

  function plateResultText() {
    var p = runtime.plate || { exerciseName: "Lift", targetKg: 0, barKg: state.settings.barWeight };
    var targetDisplay = kgToDisplay(p.targetKg);
    var barDisplay = kgToDisplay(p.barKg == null ? state.settings.barWeight : p.barKg);
    var db = isDbLift(p.exerciseName);
    return db ? "Per hand: " + cleanNumber(targetDisplay / 2, 1) + " " + unitLabel() : plateBreakdown(displayToKg(targetDisplay), displayToKg(barDisplay));
  }

  function plateSheet() {
    var p = runtime.plate || { exerciseName: "Lift", targetKg: 0, barKg: state.settings.barWeight };
    var targetDisplay = kgToDisplay(p.targetKg);
    var barDisplay = kgToDisplay(p.barKg == null ? state.settings.barWeight : p.barKg);
    var db = isDbLift(p.exerciseName);
    return '<div class="sheet-grid">' +
      '<div class="field-block"><label>Exercise</label><input value="' + escapeHtml(p.exerciseName) + '" readonly></div>' +
      '<div class="field-block"><label for="plate-target">Target total (' + unitLabel() + ')</label><input id="plate-target" type="number" step="0.5" data-action="plate-input" data-field="target" value="' + escapeHtml(cleanNumber(targetDisplay, 1)) + '"></div>' +
      (db ? "" : '<div class="field-block"><label for="plate-bar">Bar / sled estimate (' + unitLabel() + ')</label><input id="plate-bar" type="number" step="0.5" data-action="plate-input" data-field="bar" value="' + escapeHtml(cleanNumber(barDisplay, 1)) + '"></div>') +
      '<div class="overview-card" data-plate-result><strong>Breakdown</strong><p>' + escapeHtml(plateResultText()) + "</p></div>" +
      '<p class="section-sub">For dumbbell lifts, plan weights are treated as total weight unless the note says otherwise.</p>' +
      "</div>";
  }

  function overviewSheet() {
    var meta = PLAN.meta || {};
    var html = '<div class="sheet-grid">';
    html += '<div class="overview-card"><strong>' + escapeHtml(meta.title || "Progressive Overload") + '</strong><p>' + escapeHtml(meta.dateRange || "") + "</p></div>";
    html += '<div class="baseline-grid">';
    (meta.baselines || []).forEach(function (b) {
      html += '<div class="baseline-card"><div class="label">' + escapeHtml(b.label) + '</div><div class="value">' + escapeHtml(formatWeight(b.value)) + '<span class="unit">' + escapeHtml(b.unit || unitLabel()) + "</span></div></div>";
    });
    html += "</div>";
    html += '<div class="calendar-grid">';
    (PLAN.weeks || []).forEach(function (w) {
      html += '<button class="calendar-week" data-action="select-week" data-week="' + escapeHtml(w.id) + '" data-phase="' + escapeHtml(normalizePhase(w.phase)) + '"><strong>Week ' + escapeHtml(w.num) + '</strong><span>' + escapeHtml(w.dateRange || "") + "<br>" + escapeHtml(phaseName(w.phase)) + "</span></button>";
    });
    html += "</div></div>";
    return html;
  }

  function bodyweightSheet() {
    var today = todayId();
    var rows = state.bodyweight.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var html = '<div class="sheet-grid">' +
      '<div class="field-block"><label for="bw-date">Date</label><input id="bw-date" type="date" data-bw-date value="' + today + '"></div>' +
      '<div class="field-block"><label for="bw-value">Body weight (' + unitLabel() + ')</label><input id="bw-value" type="number" step="0.1" data-bw-value></div>' +
      '<div class="sheet-actions"><button class="action-btn" data-action="add-bodyweight">' + icon("plus") + "Log body weight</button></div>" +
      bodyweightSparkline(rows) +
      '<table class="mini-table"><thead><tr><th>Date</th><th>Weight</th><th></th></tr></thead><tbody>';
    rows.slice().reverse().forEach(function (r, index) {
      html += '<tr><td>' + escapeHtml(r.date) + '</td><td>' + escapeHtml(formatWeight(r.kg)) + " " + escapeHtml(unitLabel()) + '</td><td><button class="link-btn" data-action="delete-bodyweight" data-date="' + escapeHtml(r.date) + '">Delete</button></td></tr>';
    });
    html += "</tbody></table></div>";
    return html;
  }

  function openSheet(type, options, opts) {
    if (!runtime.sheet && document.activeElement instanceof HTMLElement) runtime.focusBeforeSheet = document.activeElement;
    runtime.sheet = type;
    runtime.sheetMode = (opts && opts.mode) || "modal";
    if (type === "history") runtime.historyDate = typeof options === "string" ? options : options && options.date || state.activeDayId;
    if (type === "readiness") {
      var ds = dayState(state.activeDayId);
      runtime.readinessValue = ds.readiness || 8;
    }
    if (type === "plate" && options) {
      runtime.plate = options;
    }
    renderSheet();
    renderBottomNav();
    renderFab();
    setTimeout(function () {
      var first = sheet.querySelector("[data-action='close-sheet'], .sheet-back, button, input, select, textarea");
      (first || sheet).focus();
    }, 0);
  }

  function closeSheet() {
    var returnFocus = runtime.focusBeforeSheet;
    runtime.sheet = null;
    runtime.sheetMode = "modal";
    runtime.pendingAction = null;
    runtime.activeTab = "today";
    runtime.focusBeforeSheet = null;
    renderSheet();
    renderBottomNav();
    renderFab();
    if (returnFocus && document.contains(returnFocus)) setTimeout(function () { returnFocus.focus(); }, 0);
  }

  function isCaveatNote(note) {
    var n = String(note || "").toLowerCase();
    return /\b(if|drop|confirm|clean|irritation|shoulder|available|attempt|readiness|fatigue|ache|pain)\b/.test(n);
  }

  var SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function shortDateLabel(dayId) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayId || ""));
    if (!m) return String(dayId || "");
    return (SHORT_MONTHS[Number(m[2]) - 1] || m[2]) + " " + Number(m[3]);
  }

  function lastSessionHint(name, dayId) {
    var prior = allDays().filter(function (entry) { return entry.day.id < dayId; }).sort(function (a, b) { return b.day.id.localeCompare(a.day.id); });
    for (var i = 0; i < prior.length; i += 1) {
      var day = prior[i].day;
      var week = prior[i].week;
      var exIndex = (day.exercises || []).findIndex(function (ex) { return ex.name === name; });
      if (exIndex < 0) continue;
      var ds = state.days[day.id] || {};
      var completed = ds.completed || {};
      var values = Object.keys(completed).filter(function (key) {
        return key.split(".")[0] === String(exIndex) && isCompletedSet(completed[key]);
      }).sort(function (a, b) {
        return Number(a.split(".")[1]) - Number(b.split(".")[1]);
      }).map(function (key) { return completed[key]; });
      if (!values.length) continue;
      var weights = values.map(function (v) { return formatWeight(v.weight); });
      var reps = values.map(function (v) { return v.reps; });
      var sameWeight = weights.every(function (w) { return w === weights[0]; });
      var sameReps = reps.every(function (r) { return r === reps[0]; });
      var phase = normalizePhase(week && week.phase);
      var phaseTag = phase === "deload" ? " Deload" : phase === "reentry" ? " Reentry" : "";
      var metaParts = [];
      if (week && week.num != null) metaParts.push("Wk " + week.num + phaseTag);
      else if (phaseTag) metaParts.push(phaseTag.trim());
      var dateLabel = shortDateLabel(day.id);
      if (dateLabel) metaParts.push(dateLabel);
      return "Last: " + (sameWeight ? weights[0] + " " + unitLabel() : weights.join("/")) + " x " + (sameReps ? reps[0] : reps.join("/")) + " x" + values.length + (metaParts.length ? " (" + metaParts.join(" \u00b7 ") + ")" : "");
    }
    return "";
  }

  function requireWorkoutReady(action) {
    var day = getDay(state.activeDayId);
    if (!day || !(day.exercises || []).length) return true;
    var ds = dayState(day.id);
    if (!ds.startedAt && ds.readiness == null) {
      runtime.pendingAction = action || null;
      openSheet("readiness");
      return false;
    }
    if (!ds.startedAt || ds.finishedAt) startWorkout(false);
    return true;
  }

  function freezeAdaptiveTargets(day, ds) {
    if (!day || !ds) return;
    ds.adaptiveTargets = ds.adaptiveTargets || {};
    (day.exercises || []).forEach(function (exercise, exIndex) {
      var suggestion = adaptiveSuggestion(day, exercise, exIndex);
      if (!suggestion) {
        delete ds.adaptiveTargets[String(exIndex)];
        return;
      }
      ds.adaptiveTargets[String(exIndex)] = {
        action: suggestion.action,
        weight: suggestion.weight,
        reps: suggestion.reps,
        sets: suggestion.sets,
        reason: suggestion.reason,
        frozenAt: Date.now()
      };
    });
  }

  function startWorkout(showToast) {
    var ds = dayState(state.activeDayId);
    if (ds.startedAt && !ds.finishedAt) return;
    if (ds.finishedAt) {
      ds.elapsedBeforeStart = workoutElapsed(state.activeDayId);
    }
    ds.startedAt = Date.now();
    ds.finishedAt = null;
    ds.status = "planned";
    ds.source = "active-workout";
    var activeDay = getDay(state.activeDayId);
    freezeAdaptiveTargets(activeDay, ds);
    if (!rest.running) {
      rest.completedAt = 0;
      saveRest();
    }
    saveState();
    haptic("workoutStart");
    requestWakeLock();
    showWorkoutNotification();
    if (showToast !== false) toast("Workout started.");
  }

  function finishWorkout() {
    var ds = dayState(state.activeDayId);
    if (!ds.startedAt) ds.startedAt = Date.now();
    ds.finishedAt = Date.now();
    var finishedDay = getDay(state.activeDayId);
    var verifiedSets = completedSetCount(finishedDay, state);
    if (verifiedSets > 0) {
      ds.status = "completed";
      ds.source = "verified-log";
      ds.trained = true;
    }
    var summary = feature("summary");
    if (verifiedSets > 0 && summary && typeof summary.caloriesForDay === "function") {
      state.calories[state.activeDayId] = { workoutKcal: summary.caloriesForDay(makeCtx(), state.activeDayId) };
    }
    rest = idleRest();
    saveRest();
    saveState();
    releaseWakeLock();
    clearWorkoutNotification();
    haptic("workoutFinish");
    toast("Workout finished.");
    if (verifiedSets > 0) {
      runtime.summaryDayId = state.activeDayId;
      if (!state.cycleReviewSeen && isCycleComplete()) {
        runtime.cycleReview = true;
        state.cycleReviewSeen = true;
        saveState();
      }
    }
    render();
    if (runtime.pendingReload) {
      runtime.pendingReload = false;
      toast("Applying app update now…");
      setTimeout(function () { location.reload(); }, 1400);
    }
  }

  function isCycleComplete() {
    return allDays().filter(function (entry) { return (entry.day.exercises || []).length; }).every(function (entry) {
      return completedSetCount(entry.day, state) >= totalSetCountForSource(entry.day, state);
    });
  }

  function executePendingAction() {
    var pending = runtime.pendingAction;
    runtime.pendingAction = null;
    if (!pending) return;
    if (pending.type === "toggle-set") toggleSet(pending.exIndex, pending.setIndex);
    if (pending.type === "did-planned") didAsPlanned(pending.exIndex);
  }

  function getCurrentSetValue(day, exIndex, setIndex) {
    var ds = dayState(day.id);
    var key = exIndex + "." + setIndex;
    var ex = (day.exercises || [])[exIndex] || {};
    var rawPlan = exerciseSets(day, exIndex)[setIndex] || { reps: 0, weight: 0 };
    var plan = adaptiveSet(day, ex, exIndex, rawPlan, setIndex);
    var entry = ds.completed[key] || ds.drafts[key] || {};
    return {
      weight: entry.weight != null ? numberOr(entry.weight, plan.weight) : plan.weight,
      reps: entry.reps != null ? numberOr(entry.reps, plan.reps) : plan.reps,
      rir: entry.rir != null && entry.rir !== "" ? numberOr(entry.rir, null) : null
    };
  }

  function findNextPendingSet(day) {
    if (!day) return null;
    var ds = dayState(day.id);
    var exercises = day.exercises || [];
    for (var exIndex = 0; exIndex < exercises.length; exIndex += 1) {
      var sets = exerciseSets(day, exIndex);
      for (var setIndex = 0; setIndex < sets.length; setIndex += 1) {
        var key = exIndex + "." + setIndex;
        if (!isCompletedSet(ds.completed[key])) {
          var value = getCurrentSetValue(day, exIndex, setIndex);
          return {
            ex: exercises[exIndex],
            exIndex: exIndex,
            setIndex: setIndex,
            totalSets: sets.length,
            value: value
          };
        }
      }
    }
    return null;
  }

  function buildNotifSnapshot() {
    var day = getDay(state.activeDayId);
    if (!day || !isWorkoutRunning(day.id)) {
      return { phase: "idle", dayId: state.activeDayId, signature: "idle:" + (state.activeDayId || "") };
    }

    var next = findNextPendingSet(day);
    var totalExercises = (day.exercises || []).length;
    var allSetsComplete = !next && totalExercises > 0;
    var phase = allSetsComplete ? "complete" : "set-up-next";
    var remaining = restRemaining();
    if (!allSetsComplete && rest.running && remaining > 0) phase = "resting";
    else if (!allSetsComplete && numberOr(rest.completedAt, 0) > 0 && next) phase = "rest-done";

    var value = next ? next.value : { weight: 0, reps: 0 };
    var repsText = value.reps > 0 ? String(value.reps) : "failure";
    var setText = next
      ? next.ex.name + " - " + formatWeight(value.weight) + " " + unitLabel() + " x " + repsText
      : "Workout complete";
    var signature = [
      phase,
      day.id,
      next ? next.exIndex : "done",
      next ? next.setIndex : "done",
      phase === "resting" ? remaining : numberOr(rest.completedAt, 0)
    ].join(":");

    var currentExercise = next ? next.exIndex + 1 : totalExercises;
    var elapsedSec = workoutElapsed(day.id);

    return {
      phase: phase,
      dayId: day.id,
      dayTitle: day.title || "Workout",
      exName: next ? next.ex.name : "",
      weight: value.weight,
      weightText: formatWeight(value.weight),
      reps: value.reps,
      repsText: repsText,
      setIndex: next ? next.setIndex + 1 : 0,
      totalSets: next ? next.totalSets : 0,
      currentExercise: currentExercise,
      totalExercises: totalExercises,
      elapsedMin: Math.floor(elapsedSec / 60),
      startedAt: dayState(day.id).startedAt || 0,
      pendingExIndex: next ? next.exIndex : null,
      pendingSetIndex: next ? next.setIndex : null,
      restRemainingSec: remaining,
      restLabel: formatDuration(remaining),
      unitLabel: unitLabel(),
      setText: setText,
      signature: signature
    };
  }

  function notifyNative(snap) {
    try {
      if (canNotifyNative()) {
        window.LiftAndroid.onWorkoutState(JSON.stringify(snap));
      }
    } catch (e) {}
  }

  function canNotifyNative() {
    return !!(
      window.LIFT_IS_NATIVE &&
      window.LiftAndroid &&
      typeof window.LiftAndroid.onWorkoutState === "function"
    );
  }

  function canSaveNativeImage() {
    return !!(
      window.LIFT_IS_NATIVE &&
      window.LiftAndroid &&
      typeof window.LiftAndroid.saveImageFile === "function"
    );
  }

  function canUseNative(method) {
    return !!(
      window.LIFT_IS_NATIVE &&
      window.LiftAndroid &&
      typeof window.LiftAndroid[method] === "function"
    );
  }

  function nativeShareText(title, text) {
    try {
      return canUseNative("shareText") && window.LiftAndroid.shareText(title || "Lift", text || "");
    } catch (e) {
      return false;
    }
  }

  function nativeShareJson(filename, json, title) {
    try {
      return canUseNative("shareJsonFile") && window.LiftAndroid.shareJsonFile(filename, json, title || "Lift backup");
    } catch (e) {
      return false;
    }
  }

  function nativeShareImage(filename, dataUrl, title) {
    try {
      return canUseNative("shareImageFile") && window.LiftAndroid.shareImageFile(filename, dataUrl, title || "Lift image");
    } catch (e) {
      return false;
    }
  }

  function nativeHaptic(pattern) {
    try {
      if (!canUseNative("haptic")) return false;
      var payload = Array.isArray(pattern) ? pattern : [pattern || 18];
      return !!window.LiftAndroid.haptic(JSON.stringify(payload));
    } catch (e) {
      return false;
    }
  }

  function clearNative() {
    try {
      if (window.LiftAndroid && typeof window.LiftAndroid.clearWorkout === "function") {
        window.LiftAndroid.clearWorkout();
      }
    } catch (e) {}
  }

  function showWorkoutNotification() {
    if (state.settings.workoutNotifications === false) return;
    var snap = buildNotifSnapshot();
    runtime.lastNotifSig = snap.signature;
    runtime.lastNotifSnapshot = snap;
    if (canNotifyNative()) {
      notifyNative(snap);
      return;
    }
    var mod = feature("notifications");
    if (!mod || typeof mod.ensurePermission !== "function" || typeof mod.show !== "function") return;
    var ctx = makeCtx();
    mod.ensurePermission(ctx).then(function (permission) {
      if (permission !== "granted") return;
      mod.show(snap);
    });
  }

  function updateWorkoutNotification(force) {
    if (state.settings.workoutNotifications === false) return;
    var snap = buildNotifSnapshot();
    runtime.lastNotifSnapshot = snap;
    if (snap.phase === "idle") {
      clearWorkoutNotification();
      return;
    }
    if (!force && snap.signature === runtime.lastNotifSig) return;
    runtime.lastNotifSig = snap.signature;
    if (canNotifyNative()) {
      notifyNative(snap);
      return;
    }
    var mod = feature("notifications");
    if (!mod || typeof mod.update !== "function") return;
    mod.update(snap);
  }

  function clearWorkoutNotification() {
    var mod = feature("notifications");
    runtime.lastNotifSig = "";
    runtime.lastNotifSnapshot = null;
    if (mod && typeof mod.clear === "function") mod.clear();
    clearNative();
  }

  function handleNotifAction(action) {
    action = action || "open";
    if (action === "open") return;
    if (action === "finish") {
      finishWorkout();
      return;
    }
    if (action === "minus-15") {
      adjustRest(-15);
      updateWorkoutNotification(true);
      return;
    }
    if (action === "plus-15") {
      adjustRest(15);
      updateWorkoutNotification(true);
      return;
    }
    if (action === "skip") {
      markRestComplete({ notify: false });
      toast("Rest skipped.");
      updateWorkoutNotification(true);
      return;
    }
    if (action === "logged") {
      var snap = buildNotifSnapshot();
      if (snap.pendingExIndex != null && snap.pendingSetIndex != null) {
        toggleSet(snap.pendingExIndex, snap.pendingSetIndex);
      }
    }
  }

  function updateSetValue(exIndex, setIndex, field, rawValue, isDisplayValue) {
    var day = getDay(state.activeDayId);
    var ds = dayState(day.id);
    var key = exIndex + "." + setIndex;
    var exercise = (day.exercises || [])[exIndex];
    var value = field === "weight" && isDisplayValue ? displayToKg(rawValue) : numberOr(rawValue, 0);
    if (field === "reps") value = Math.max(0, Math.round(value));
    if (field === "weight") value = Math.max(0, value);
    var bucket = ds.completed[key] || ds.drafts[key] || getCurrentSetValue(day, exIndex, setIndex);
    tagSetExercise(bucket, exercise);
    bucket[field] = value;
    if (ds.completed[key] && field === "reps" && value <= 0) {
      delete bucket.ts;
      delete bucket.pr;
      delete ds.completed[key];
      ds.drafts[key] = bucket;
    } else if (ds.completed[key]) {
      var recordMod = feature("records");
      if (exercise && recordMod && typeof recordMod.evaluateSet === "function") {
        var evaluation = recordMod.evaluateSet(makeCtx(), exercise, bucket, day.id, key);
        bucket.pr = !!evaluation.isPr;
        bucket.recordType = evaluation.type;
        bucket.recordTypes = evaluation.types;
      }
      ds.completed[key] = bucket;
    } else {
      ds.drafts[key] = bucket;
    }
    saveState();
  }

  function stepSetValue(exIndex, setIndex, field, direction) {
    var day = getDay(state.activeDayId);
    if (!day) return;
    var current = getCurrentSetValue(day, exIndex, setIndex);
    if (field === "reps") {
      updateSetValue(exIndex, setIndex, field, current.reps + direction, false);
    } else {
      var exercise = (day.exercises || [])[exIndex];
      var progression = feature("progression");
      var fallbackStep = numberOr(state.settings.weightStep, 2.5);
      var step = state.settings.units === "kg" && progression && typeof progression.incrementFor === "function"
        ? progression.incrementFor(exercise, fallbackStep)
        : fallbackStep;
      var display = kgToDisplay(current.weight) + direction * step;
      if (state.settings.units === "kg") display = Math.round(display * 100) / 100;
      updateSetValue(exIndex, setIndex, field, display, true);
    }
    haptic("tap");
    render();
  }

  function copySet1ToRemaining(exIndex) {
    var day = getDay(state.activeDayId);
    if (!day) return;
    var ex = (day.exercises || [])[exIndex];
    if (!ex) return;
    var sets = exerciseSets(day, exIndex);
    if (sets.length < 2) return;
    var ds = dayState(day.id);
    var s1 = getCurrentSetValue(day, exIndex, 0);
    var copied = 0;
    for (var si = 1; si < sets.length; si += 1) {
      var key = exIndex + "." + si;
      if (isCompletedSet(ds.completed[key])) continue;
      if (ds.completed[key] && !isCompletedSet(ds.completed[key])) {
        delete ds.completed[key];
      }
      var prevDraft = ds.drafts[key] && typeof ds.drafts[key] === "object" ? ds.drafts[key] : {};
      var nextDraft = Object.assign({}, prevDraft, { weight: s1.weight, reps: s1.reps });
      tagSetExercise(nextDraft, ex);
      ds.drafts[key] = nextDraft;
      copied += 1;
    }
    if (!copied) return;
    saveState("copy-set1");
    haptic("select");
    toast("Copied Set 1 target to remaining sets.");
    render();
  }

  function toggleSet(exIndex, setIndex) {
    if (!requireWorkoutReady({ type: "toggle-set", exIndex: exIndex, setIndex: setIndex })) return;
    var day = getDay(state.activeDayId);
    var ex = day.exercises[exIndex];
    var ds = dayState(day.id);
    var key = exIndex + "." + setIndex;
    if (ds.completed[key] && !isCompletedSet(ds.completed[key])) {
      ds.drafts[key] = { reps: numberOr(ds.completed[key].reps, 0), weight: numberOr(ds.completed[key].weight, 0) };
      delete ds.completed[key];
    }
    if (isCompletedSet(ds.completed[key])) {
      runtime.lastLog = { dayId: day.id, key: key, previous: Object.assign({}, ds.completed[key]), action: "restore" };
      delete ds.completed[key];
      haptic("warning");
      saveState();
      render();
      updateWorkoutNotification(true);
      return;
    }
    var value = getCurrentSetValue(day, exIndex, setIndex);
    if (numberOr(value.reps, 0) <= 0) {
      toast("Enter at least 1 rep before completing the set.");
      saveState();
      render();
      return;
    }
    runtime.lastLog = { dayId: day.id, key: key, previous: ds.completed[key] ? Object.assign({}, ds.completed[key]) : null, action: "remove" };
    var recordMod = feature("records");
    var evaluation = recordMod && typeof recordMod.evaluateSet === "function"
      ? recordMod.evaluateSet(makeCtx(), ex, value, day.id, key)
      : { type: "baseline", types: ["baseline"], isPr: false };
    var pr = !!evaluation.isPr;
    ds.completed[key] = tagSetExercise({ reps: value.reps, weight: value.weight, rir: value.rir, ts: Date.now(), pr: pr, recordType: evaluation.type, recordTypes: evaluation.types }, ex);
    delete ds.drafts[key];
    if (pr) {
      state.prs[ex.name] = { weight: value.weight, reps: value.reps, date: day.id };
      toast((recordMod && recordMod.recordLabel ? recordMod.recordLabel(evaluation.type) : "PR") + ": " + ex.name + " at " + formatWeight(value.weight) + " " + unitLabel() + ".");
    } else if (evaluation.type === "baseline") {
      toast("Baseline saved for " + ex.name + ".");
    }
    haptic(pr ? "pr" : "completeSet");
    if (state.settings.autoStartRest !== false) {
      startRest(numberOr(ex.defaultRest, state.settings.defaultRest), ex.name);
    }
    saveState();
    render();
    updateWorkoutNotification(true);
    requestAnimationFrame(function() {
      var checkBtn = document.querySelector('[data-action="toggle-set"][data-ex="' + exIndex + '"][data-set="' + setIndex + '"]');
      if (checkBtn) {
        checkBtn.classList.add('just-checked');
        checkBtn.addEventListener('animationend', function() { checkBtn.classList.remove('just-checked'); }, { once: true });
      }
    });
  }

  function didAsPlanned(exIndex) {
    if (!requireWorkoutReady({ type: "did-planned", exIndex: exIndex })) return;
    var day = getDay(state.activeDayId);
    var ex = day && day.exercises && day.exercises[exIndex];
    if (!day || !ex) return;
    var ds = dayState(day.id);
    var sets = exerciseSets(day, exIndex);
    var pending = [];
    sets.forEach(function (set, setIndex) {
      var key = exIndex + "." + setIndex;
      if (isCompletedSet(ds.completed[key])) return;
      pending.push({ set: set, setIndex: setIndex, key: key, target: adaptiveSet(day, ex, exIndex, set, setIndex) });
    });
    if (!pending.length) {
      toast("All sets already logged.");
      return;
    }
    if (pending.some(function (item) { return numberOr(item.target.reps, 0) <= 0; })) {
      toast("Enter reps for failure sets individually.");
      return;
    }
    var prCount = 0;
    var prTargets = [];
    sets.forEach(function (set, setIndex) {
      var key = exIndex + "." + setIndex;
      if (isCompletedSet(ds.completed[key])) return;
      var target = adaptiveSet(day, ex, exIndex, set, setIndex);
      var draft = ds.drafts[key] || {};
      if (draft.rir === "") draft = Object.assign({}, draft, { rir: null });
      var recordMod = feature("records");
      var evaluation = recordMod && typeof recordMod.evaluateSet === "function"
        ? recordMod.evaluateSet(makeCtx(), ex, target, day.id, key)
        : { type: "baseline", types: ["baseline"], isPr: false };
      var pr = !!evaluation.isPr;
      if (pr) {
        prCount += 1;
        prTargets.push(target);
      }
      ds.completed[key] = tagSetExercise({ reps: target.reps, weight: target.weight, rir: draft.rir == null ? null : clamp(Math.round(numberOr(draft.rir, 2)), 0, 4), ts: Date.now(), pr: pr, recordType: evaluation.type, recordTypes: evaluation.types }, ex);
      delete ds.drafts[key];
    });
    if (prCount) {
      var assisted = (feature("records") && typeof feature("records").isAssisted === "function" && feature("records").isAssisted(ex)) ||
        (feature("progression") && typeof feature("progression").isAssisted === "function" && feature("progression").isAssisted(ex)) ||
        !!(ex && ex.loadDirection === "lower") || /\bassisted\b/i.test(ex && ex.name || "");
      var prWeights = prTargets.map(function (item) { return item.weight; });
      var top = assisted ? Math.min.apply(null, prWeights) : Math.max.apply(null, prWeights);
      var matching = prTargets.find(function (item) { return item.weight === top; }) || prTargets[0];
      state.prs[ex.name] = { weight: top, reps: matching ? matching.reps : 0, date: day.id };
      toast("PR logged for " + ex.name + ".");
    } else {
      toast("Exercise completed as planned.");
    }
    haptic(prCount ? "pr" : "completeSet");
    if (state.settings.autoStartRest !== false) {
      startRest(numberOr(ex.defaultRest, state.settings.defaultRest), ex.name);
    }
    saveState();
    render();
    updateWorkoutNotification(true);
  }

  function setRir(exIndex, setIndex, rawValue) {
    var day = getDay(state.activeDayId);
    var ds = dayState(day.id);
    var key = exIndex + "." + setIndex;
    var bucket = ds.completed[key] || ds.drafts[key] || getCurrentSetValue(day, exIndex, setIndex);
    tagSetExercise(bucket, (day.exercises || [])[exIndex]);
    if (rawValue === "" || rawValue == null) delete bucket.rir;
    else bucket.rir = clamp(Math.round(numberOr(rawValue, 2)), 0, 4);
    if (ds.completed[key]) ds.completed[key] = bucket;
    else ds.drafts[key] = bucket;
    saveState("effort-log");
  }

  function toggleExerciseFlag(exIndex, flag) {
    var ds = dayState(state.activeDayId);
    var key = String(exIndex);
    ds.exerciseFlags[key] = ds.exerciseFlags[key] || {};
    ds.exerciseFlags[key][flag] = !ds.exerciseFlags[key][flag];
    if (flag === "pain" && ds.exerciseFlags[key][flag]) toast("Pain flagged. Do not push through sharp or worsening pain.");
    saveState("exercise-flag");
    render();
  }

  function undoLastLog() {
    var undo = runtime.lastLog;
    if (!undo || !state.days[undo.dayId]) return;
    var completed = state.days[undo.dayId].completed = state.days[undo.dayId].completed || {};
    if (undo.action === "restore" && undo.previous) completed[undo.key] = undo.previous;
    else if (undo.previous) completed[undo.key] = undo.previous;
    else delete completed[undo.key];
    runtime.lastLog = null;
    saveState("undo-set");
    toast("Last set change undone.");
    render();
  }

  function addSet(exIndex) {
    var ds = dayState(state.activeDayId);
    var key = String(exIndex);
    ds.extraSets[key] = numberOr(ds.extraSets[key], 0) + 1;
    saveState();
    render();
    updateWorkoutNotification(true);
  }

  function removeSet(exIndex) {
    var day = getDay(state.activeDayId);
    if (!day) return;
    var ds = dayState(day.id);
    var key = String(exIndex);
    var count = numberOr(ds.extraSets[key], 0);
    if (count <= 0) return;
    var removeIndex = exerciseSets(day, exIndex).length - 1;
    if (removeIndex >= 0) {
      var removedKey = exIndex + "." + removeIndex;
      delete ds.completed[removedKey];
      delete ds.drafts[removedKey];
      if (runtime.lastLog && runtime.lastLog.dayId === day.id && runtime.lastLog.key === removedKey) {
        runtime.lastLog = null;
      }
    }
    ds.extraSets[key] = count - 1;
    if (ds.extraSets[key] <= 0) delete ds.extraSets[key];
    saveState();
    render();
    updateWorkoutNotification(true);
  }

  function startRest(seconds, label) {
    var duration = Math.max(1, numberOr(seconds, state.settings.defaultRest));
    rest = { duration: duration, endsAt: Date.now() + duration * 1000, pausedRemaining: duration, running: true, label: label || "Rest", completedAt: 0 };
    saveRest();
  }

  function restRemaining() {
    if (rest.running) return Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000));
    return Math.max(0, Math.ceil(numberOr(rest.pausedRemaining, state.settings.defaultRest)));
  }

  function adjustRest(delta) {
    var remaining = Math.max(0, restRemaining() + delta);
    rest.duration = Math.max(numberOr(rest.duration, state.settings.defaultRest), remaining);
    if (rest.running) rest.endsAt = Date.now() + remaining * 1000;
    else rest.pausedRemaining = remaining;
    if (remaining > 0) rest.completedAt = 0;
    saveRest();
    haptic("select");
    render();
    updateWorkoutNotification(true);
  }

  function toggleRest() {
    var remaining = restRemaining();
    if (rest.running) {
      rest.running = false;
      rest.pausedRemaining = remaining;
      rest.endsAt = 0;
    } else {
      var start = remaining || numberOr(state.settings.defaultRest, 90);
      rest.duration = Math.max(numberOr(rest.duration, start), start);
      rest.pausedRemaining = start;
      rest.endsAt = Date.now() + start * 1000;
      rest.running = true;
      rest.completedAt = 0;
    }
    saveRest();
    haptic("restStart");
    render();
    updateWorkoutNotification(true);
  }

  function presetRest(seconds) {
    startRest(Math.max(1, numberOr(seconds, state.settings.defaultRest)), "Rest");
  }

  function completeRestIfNeeded() {
    if (!rest.running || restRemaining() > 0) return;
    markRestComplete({ notify: true });
  }

  function markRestComplete(options) {
    options = options || {};
    rest.running = false;
    rest.pausedRemaining = 0;
    rest.endsAt = 0;
    rest.completedAt = Date.now();
    saveRest();
    if (options.notify !== false) notifyRestDone();
    render();
    updateWorkoutNotification(true);
  }

  function notifyRestDone() {
    haptic("restDone");
    if (state.settings.sound) beep();
    var voice = feature("voice");
    if (voice && typeof voice.speakRestDone === "function") {
      voice.speakRestDone(makeCtx());
    }
    toast("Rest complete.");
  }

  function beep() {
    try {
      var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!audioCtx || audioCtx.state === "closed") audioCtx = new AudioContextCtor();
      if (audioCtx.state === "suspended" && typeof audioCtx.resume === "function") {
        var resumed = audioCtx.resume();
        if (resumed && typeof resumed.catch === "function") resumed.catch(function () {});
      }
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.28);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (err) {}
  }

  async function requestWakeLock() {
    try {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      if (wakeLock) return;
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", function () { wakeLock = null; });
    } catch (err) {
      wakeLock = null;
    }
  }

  async function releaseWakeLock() {
    try {
      if (wakeLock) await wakeLock.release();
    } catch (err) {}
    wakeLock = null;
  }

  function refreshTimers() {
    runtime.now = Date.now();
    document.querySelectorAll("[data-elapsed]").forEach(function (node) {
      node.textContent = formatDuration(workoutElapsed(node.dataset.elapsed));
    });
    var remaining = restRemaining();
    var restNode = document.querySelector("[data-rest-time]");
    if (restNode) restNode.textContent = formatDuration(remaining);
    var bar = document.querySelector(".rest-ring .bar");
    if (bar) {
      var duration = Math.max(1, numberOr(rest.duration, state.settings.defaultRest));
      var circumference = 2 * Math.PI * 22;
      var progress = rest.running ? clamp(remaining / duration, 0, 1) : 0;
      bar.setAttribute("stroke-dashoffset", String(circumference * (1 - progress)));
    }
    var fab = document.querySelector(".rest-fab");
    if (fab) {
      var nextActive = String(!!rest.running);
      if (fab.dataset.active !== nextActive) {
        fab.dataset.active = nextActive;
        syncRestFabLayout();
      } else {
        fab.dataset.active = nextActive;
      }
    }
    updateWorkoutNotification(false);
  }

  function buildLog(scope) {
    var entries = [];
    if (scope === "day") {
      var day = getDay(state.activeDayId);
      if (!day) return "No active day selected.";
      entries = [{ week: weekForDayId(day.id) || getWeek(state.activeWeekId), day: day }];
    } else if (scope === "week") {
      var week = getWeek(state.activeWeekId);
      if (!week) return "No active week selected.";
      entries = (week.days || []).map(function (day) { return { week: week, day: day }; });
    } else {
      entries = allDays();
    }
    var lines = [];
    lines.push("Lift - " + ((PLAN.meta || {}).title || "Progressive Overload"));
    lines.push("Scope: " + scope);
    lines.push("");
    entries.forEach(function (entry) {
      var day = entry && entry.day;
      if (!day) return;
      var ds = state.days[day.id] || {};
      var total = totalSetCountForSource(day, state);
      var completed = completedSetCount(day, state);
      var integrity = historyStatus(day, state);
      var weekNum = entry.week ? entry.week.num : "";
      lines.push("Week " + weekNum + " - " + day.id + " - " + (day.title || "Day"));
      lines.push("  History: " + (feature("history") && feature("history").statusLabel ? feature("history").statusLabel(integrity) : integrity));
      if (integrity === "reconstructed" && !completed) {
        lines.push("  Trained session reconstructed by the user; weights, reps, volume, calories, and PRs are unavailable.");
        if (ds.workoutType) lines.push("  Remembered workout: " + ds.workoutType);
        if (ds.notes) lines.push("  Notes: " + ds.notes);
      } else if (!total) {
        lines.push("  Rest: " + (day.footer || day.note || day.subtitle || ""));
      } else {
        lines.push("  Sets: " + completed + "/" + total + " | Volume: " + cleanNumber(kgToDisplay(completedVolume(day)), 0) + " " + unitLabel() + " | Time: " + formatDuration(workoutElapsed(day.id)));
        if (ds.readiness != null) lines.push("  Readiness: " + ds.readiness + "/10");
        (day.exercises || []).forEach(function (ex, exIndex) {
          var setLines = exerciseSets(day, exIndex).map(function (set, setIndex) {
            var key = exIndex + "." + setIndex;
            var logged = ((ds.completed || {})[key]);
            var done = isCompletedSet(logged) ? logged : null;
            var v = done || set;
            return (done ? "[x] " : "[ ] ") + formatWeight(v.weight) + " " + unitLabel() + " x " + v.reps + (done && done.pr ? " PR" : "");
          });
          lines.push("  " + ex.name + ": " + setLines.join(", "));
        });
        if (ds.notes) lines.push("  Notes: " + ds.notes);
      }
      lines.push("");
    });
    return lines.join("\n").trim();
  }

  function copyText(text) {
    if (navigator.clipboard && location.protocol !== "file:") {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error("Clipboard unavailable"));
  }

  function exportData() {
    var cloud = feature("cloud");
    if (cloud && typeof cloud.downloadBackup === "function") return cloud.downloadBackup(makeCtx());
    var payload = JSON.stringify(state, null, 2);
    var filename = "lift-backup-" + todayId() + ".json";
    if (nativeShareJson(filename, payload, "Lift backup")) {
      toast("Opening Android share sheet.");
      return;
    }
    if (window.LIFT_IS_NATIVE && window.LiftAndroid && typeof window.LiftAndroid.saveBackupFile === "function") {
      try {
        window.LiftAndroid.saveBackupFile(filename, payload);
        return;
      } catch (err) {}
    }
    var blob = new Blob([payload], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function importData() {
    if (runtime.importBusy) return;
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      runtime.importBusy = true;
      reader.onload = async function () {
        try {
          var stateMod = feature("state");
          var result = stateMod && typeof stateMod.parseBackupText === "function"
            ? stateMod.parseBackupText(String(reader.result || ""))
            : { valid: false, errors: ["The state migration module is unavailable."] };
          if (!result.valid) throw new Error((result.errors || ["Invalid Lift backup."]).join(" "));
          annotateCustomExerciseIndexes(state);
          annotateCustomExerciseIndexes(result.state);
          var merge = confirm("Merge imported data with current data? Press Cancel to replace current data.");
          var persistence = feature("persistence");
          if (persistence && typeof persistence.forceSnapshot === "function") await persistence.forceSnapshot(state, "pre-restore");
          state = merge && typeof stateMod.mergeStates === "function"
            ? stateMod.mergeStates(state, result.state)
            : stateMod.migrateState(result.state);
          state.backup = Object.assign({}, state.backup || {}, {
            lastRestoreAt: Date.now(),
            lastRestoreMode: merge ? "merge" : "replace"
          });
          state = normalizeState(state);
          var selection = chooseInitialSelection(state);
          state.activeWeekId = selection.weekId;
          state.activeDayId = selection.dayId;
          saveState("restore-" + (merge ? "merge" : "replace"));
          applyTheme(state.settings.theme);
          applyVisualStyle(state.settings.visualStyle);
          toast(merge ? "Backup merged safely." : "Backup restored.");
          render();
        } catch (err) {
          toast("Import failed: " + err.message);
        } finally {
          runtime.importBusy = false;
        }
      };
      reader.onerror = function () {
        runtime.importBusy = false;
        toast("Import failed: the file could not be read.");
      };
      reader.readAsText(file);
    });
    input.click();
  }

  async function rollbackSnapshot() {
    var persistence = feature("persistence");
    if (!persistence || typeof persistence.latestValidSnapshot !== "function") {
      toast("No rollback storage is available in this browser.");
      return;
    }
    if (!confirm("Roll back to the prior valid local snapshot? A safety snapshot of the current state will be made first.")) return;
    try {
      await persistence.forceSnapshot(state, "pre-restore");
      var snapshot = await persistence.latestValidSnapshot(true);
      if (!snapshot || !snapshot.state) throw new Error("No earlier valid snapshot was found.");
      state = normalizeState(snapshot.state);
      state.backup = Object.assign({}, state.backup || {}, { lastRestoreAt: Date.now(), lastRestoreMode: "rollback" });
      var selection = chooseInitialSelection(state);
      state.activeWeekId = selection.weekId;
      state.activeDayId = selection.dayId;
      saveState("rollback");
      applyTheme(state.settings.theme);
      applyVisualStyle(state.settings.visualStyle);
      toast("Rolled back to " + new Date(snapshot.record.createdAt).toLocaleString() + ".");
      render();
    } catch (err) {
      toast("Rollback failed: " + err.message);
    }
  }

  function mergeMeasurements(a, b) {
    var map = {};
    a.concat(b).forEach(function (row) {
      if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ""))) return;
      var date = String(row.date);
      var prior = map[date] || { date: date };
      var merged = Object.assign({}, prior, row, { date: date });
      var notes = Object.assign({}, prior.notes || {}, row.notes || {});
      if (Object.keys(notes).length) merged.notes = notes;
      else delete merged.notes;
      map[date] = merged;
    });
    return Object.keys(map).sort().map(function (date) { return map[date]; });
  }

  function mergeDateIds(a, b) {
    var seen = {};
    a.concat(b).forEach(function (date) {
      var id = String(date || "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(id)) seen[id] = true;
    });
    return Object.keys(seen).sort();
  }

  async function resetAll() {
    if (!confirm("Reset all Lift data, rollback snapshots, and the Android recovery mirror? Export first if you need a backup.")) return;
    var persistence = feature("persistence");
    if (persistence && typeof persistence.clearAll === "function") {
      try { await persistence.clearAll(); } catch (clearErr) { toast("A recovery copy is open in another Lift tab; close it to finish clearing snapshots."); }
    }
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem(V2_STORE_KEY);
      localStorage.removeItem(V1_STORE_KEY);
      localStorage.removeItem(REST_KEY);
      localStorage.removeItem(THEME_KEY);
      localStorage.removeItem(V1_THEME_KEY);
    } catch (err) {}
    runtime.recoveredFrom = null;
    runtime.recoveryCandidateAt = 0;
    runtime.snapshotRecoveryNeeded = false;
    runtime.primaryStateValid = false;
    runtime.lastLog = null;
    state = normalizeState({ v: 4, schemaVersion: 4, settings: {}, days: {}, bodyweight: [], measurements: [], prs: {} });
    var selection = chooseInitialSelection(state);
    state.activeWeekId = selection.weekId;
    state.activeDayId = selection.dayId;
    rest = idleRest();
    saveRest();
    clearWorkoutNotification();
    releaseWakeLock();
    applyTheme(state.settings.theme);
    applyVisualStyle(state.settings.visualStyle);
    saveState("reset-all");
    toast("All Lift data and recovery copies were reset.");
    render();
  }

  function exerciseNames() {
    var map = {};
    allDays().forEach(function (entry) {
      (entry.day.exercises || []).forEach(function (ex) { map[ex.name] = true; });
    });
    return Object.keys(map).sort();
  }

  function plannedSeries(name) {
    var rows = [];
    allDays().forEach(function (entry) {
      (entry.day.exercises || []).forEach(function (ex) {
        if (ex.name !== name) return;
        var plannedTop = Math.max.apply(null, (ex.sets || []).map(function (s) { return plannedSet(s).weight; }));
        var actualTop = 0;
        var exIndex = entry.day.exercises.indexOf(ex);
        var completed = ((state.days[entry.day.id] || {}).completed || {});
        Object.keys(completed).forEach(function (key) {
          if (key.split(".")[0] === String(exIndex)) actualTop = Math.max(actualTop, numberOr(completed[key].weight, 0));
        });
        rows.push({ date: entry.day.id, week: entry.week.num, planned: plannedTop, actual: actualTop });
      });
    });
    return rows;
  }

  function renderProgressChart(name) {
    var rows = plannedSeries(name);
    if (!rows.length) return '<div class="overview-card"><strong>No exercise selected</strong><p>Log workouts to build a chart.</p></div>';
    var values = rows.map(function (r) { return kgToDisplay(r.actual || r.planned); });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    if (min === max) { min = Math.max(0, min - 5); max += 5; }
    var points = values.map(function (v, i) {
      var x = rows.length === 1 ? 160 : 24 + (i * (272 / (rows.length - 1)));
      var y = 150 - ((v - min) / (max - min)) * 110;
      return [x, y];
    });
    var polyline = points.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
    var html = '<div class="chart"><svg viewBox="0 0 320 190" role="img" aria-label="Progress chart">';
    html += '<path d="M24 150H300M24 40V150" stroke="currentColor" opacity=".18" fill="none"/>';
    html += '<polyline points="' + polyline + '" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
    points.forEach(function (p) { html += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5" fill="currentColor"/>'; });
    html += '<text x="24" y="24" fill="currentColor" opacity=".68" font-size="12">' + escapeHtml(name || "Exercise") + "</text>";
    html += "</svg></div>";
    html += '<table class="mini-table"><thead><tr><th>Date</th><th>Planned</th><th>Logged</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + escapeHtml(r.date) + '</td><td>' + escapeHtml(formatWeight(r.planned)) + " " + escapeHtml(unitLabel()) + '</td><td>' + (r.actual ? escapeHtml(formatWeight(r.actual)) + " " + escapeHtml(unitLabel()) : "-") + "</td></tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function cycleAdherence() {
    var history = feature("history");
    if (history && typeof history.adherence === "function") {
      var reliable = history.adherence(makeCtx(), todayId());
      return reliable.adherencePct == null ? 0 : reliable.adherencePct;
    }
    var total = 0;
    var done = 0;
    var today = todayId();
    allDays().forEach(function (entry) {
      if (entry.day.id > today) return;
      (entry.day.exercises || []).forEach(function (ex, exIndex) {
        total += (ex.sets || []).length;
        var completed = ((state.days[entry.day.id] || {}).completed || {});
        for (var i = 0; i < (ex.sets || []).length; i += 1) {
          if (isCompletedSet(completed[exIndex + "." + i])) done += 1;
        }
      });
    });
    return total ? Math.round((done / total) * 100) : 0;
  }

  function trainingStreak() {
    var history = feature("history");
    if (history && typeof history.streakMetrics === "function") {
      return history.streakMetrics(makeCtx(), todayId()).current;
    }
    var today = todayId();
    var days = allDays().filter(function (entry) {
      return (entry.day.exercises || []).length && entry.day.id <= today;
    }).sort(function (a, b) { return b.day.id.localeCompare(a.day.id); });
    var count = 0;
    for (var i = 0; i < days.length; i += 1) {
      if (dayStatus(days[i].day, state) !== "done") {
        // Today's session not being finished yet should not reset the streak.
        if (days[i].day.id === today && count === 0) continue;
        break;
      }
      count += 1;
    }
    return count;
  }

  function bodyweightSparkline(rows) {
    if (!rows.length) return '<div class="overview-card"><strong>No body-weight logs</strong><p>Add a value to start the sparkline.</p></div>';
    var values = rows.map(function (r) { return kgToDisplay(r.kg); });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    if (min === max) { min -= 1; max += 1; }
    var points = values.map(function (v, i) {
      var x = rows.length === 1 ? 160 : 18 + i * (284 / (rows.length - 1));
      var y = 150 - ((v - min) / (max - min)) * 110;
      return x + "," + y;
    }).join(" ");
    return '<div class="chart"><svg viewBox="0 0 320 190"><polyline points="' + points + '" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><text x="18" y="24" fill="currentColor" opacity=".68" font-size="12">Body weight</text></svg></div>';
  }

  function isDbLift(name) {
    return /\b(db|dumbbell)\b/i.test(name || "");
  }

  function plateBreakdown(targetKg, barKg) {
    var side = (targetKg - barKg) / 2;
    if (side <= 0) return "Target is at or below the bar estimate.";
    var plates = state.settings.plates || DEFAULT_SETTINGS.plates;
    var result = [];
    var remaining = side;
    plates.forEach(function (plate) {
      var count = Math.floor((remaining + 0.001) / plate);
      if (count > 0) {
        result.push(count + " x " + formatWeight(plate) + " " + unitLabel());
        remaining -= count * plate;
      }
    });
    return "Per side: " + (result.join(", ") || "no plates") + (remaining > 0.05 ? " plus " + cleanNumber(kgToDisplay(remaining), 1) + " " + unitLabel() + " unresolved" : "");
  }

  function addBodyweight() {
    var dateInput = sheet.querySelector("[data-bw-date]");
    var valueInput = sheet.querySelector("[data-bw-value]");
    var date = dateInput && dateInput.value;
    var raw = valueInput && valueInput.value;
    if (!date || !raw) return toast("Enter a date and body weight.");
    var kg = displayToKg(raw);
    state.bodyweight = (state.bodyweight || []).filter(function (row) { return row.date !== date; });
    state.bodyweight.push({ date: date, kg: kg });
    state.bodyweight.sort(function (a, b) { return a.date.localeCompare(b.date); });
    saveState();
    toast("Body weight logged.");
    renderSheet();
  }

  function deleteBodyweight(date) {
    state.bodyweight = (state.bodyweight || []).filter(function (row) { return row.date !== date; });
    saveState();
    renderSheet();
  }

  async function downloadDayImage(options) {
    options = options || {};
    var day = getDay(state.activeDayId);
    var canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1500;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = document.documentElement.dataset.theme === "dark" ? "#111114" : "#f4f4f7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e63b5d";
    roundedRect(ctx, 70, 70, 1060, 260, 42);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 64px system-ui, sans-serif";
    ctx.fillText(day.title || "Workout", 120, 170);
    ctx.font = "500 34px system-ui, sans-serif";
    ctx.fillText(day.id + " - " + completedSetCount(day, state) + "/" + totalSetCount(day) + " sets", 120, 230);
    ctx.fillStyle = document.documentElement.dataset.theme === "dark" ? "#f5f5f7" : "#101014";
    ctx.font = "700 36px system-ui, sans-serif";
    var y = 400;
    (day.exercises || []).forEach(function (ex, exIndex) {
      ctx.fillText(ex.name, 90, y);
      y += 46;
      ctx.font = "500 28px system-ui, sans-serif";
      var ds = dayState(day.id);
      var sets = exerciseSets(day, exIndex).map(function (set, setIndex) {
        var logged = ds.completed[exIndex + "." + setIndex];
        var done = isCompletedSet(logged) ? logged : null;
        var v = done || set;
        return (done ? "done " : "open ") + formatWeight(v.weight) + " " + unitLabel() + " x " + v.reps;
      }).join("   ");
      wrapCanvasText(ctx, sets, 90, y, 1020, 36);
      y += 78;
      ctx.font = "700 36px system-ui, sans-serif";
    });
    var imageName = "lift-" + day.id + ".png";
    var dataUrl = canvas.toDataURL("image/png");
    if (options.share && nativeShareImage(imageName, dataUrl, "Lift " + day.id)) {
      toast("Opening Android share sheet.");
      return;
    }
    if (!options.share && canSaveNativeImage()) {
      try {
        window.LiftAndroid.saveImageFile(imageName, dataUrl);
        return;
      } catch (err) {}
    }
    canvas.toBlob(async function (blob) {
      if (!blob) return;
      var file = new File([blob], imageName, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        try { await navigator.share({ files: [file], title: "Lift " + day.id }); return; } catch (err) {}
      }
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    }, "image/png");
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = String(text).split(" ");
    var line = "";
    for (var i = 0; i < words.length; i += 1) {
      var testLine = line + words[i] + " ";
      if (ctx.measureText(testLine).width > maxWidth && i > 0) {
        ctx.fillText(line, x, y);
        line = words[i] + " ";
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  function toast(message) {
    var node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    toastRoot.appendChild(node);
    setTimeout(function () {
      node.style.opacity = "0";
      node.style.transform = "translateY(8px)";
      node.style.transition = "opacity .18s ease, transform .18s ease";
      setTimeout(function () { node.remove(); }, 220);
    }, 2800);
  }

  function goToday() {
    var selection = chooseInitialSelection(state);
    state.activeWeekId = selection.weekId;
    state.activeDayId = selection.dayId;
    saveState();
    closeSheet();
    render();
  }

  function handleClick(event) {
    var btn = event.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;
    if (action !== "set-input") event.preventDefault();
    if (action === "select-week") {
      var week = getWeek(btn.dataset.week);
      if (!week) return;
      state.activeWeekId = week.id;
      if (!(week.days || []).some(function (d) { return d.id === state.activeDayId; })) {
        var open = firstIncompleteDay(week, state) || week.days[0];
        state.activeDayId = open.id;
      }
      haptic(3);
      saveState();
      closeSheet();
      render();
    } else if (action === "select-day") {
      state.activeDayId = btn.dataset.day;
      state.activeWeekId = (weekForDayId(state.activeDayId) || getWeek(state.activeWeekId)).id;
      haptic(3);
      saveState();
      closeSheet();
      render();
    } else if (action === "today") {
      goToday();
    } else if (action === "cycle-theme") {
      var current = state.settings.theme === "dark" ? "light" : state.settings.theme === "light" ? "system" : "dark";
      state.settings.theme = current;
      applyTheme(current);
      haptic(3);
      saveState();
      render();
    } else if (action === "setting-choice" || action === "setting-toggle") {
      haptic(3);
      applySettingValue(btn.dataset.setting, btn.dataset.value);
    } else if (action === "open-history") {
      haptic(3);
      openSheet("history", { date: btn.dataset.date || state.activeDayId });
    } else if (action === "open-sheet") {
      haptic(3);
      openSheet(btn.dataset.sheet);
    } else if (action === "dismiss-recap") {
      state.weeklyRecapDismissedIso = btn.dataset.iso || isoWeekId(parseDateId(todayId()));
      saveState();
      render();
    } else if (action === "reentry-start") {
      haptic(3);
      var reentryDay = getDay(state.activeDayId);
      if (reentryDay && (reentryDay.exercises || []).length) {
        runtime.pendingAction = null;
        openSheet("readiness");
      } else {
        toast("Today is a planned rest day.");
      }
    } else if (action === "reentry-dismiss") {
      var dismissWeekId = btn.dataset.week || state.activeWeekId || (weekForDayId(state.activeDayId) || {}).id || null;
      state.reentryDismissedWeekId = dismissWeekId;
      saveState("reentry-dismiss");
      render();
    } else if (action === "dismiss-summary") {
      runtime.summaryDayId = null;
      runtime.cycleReview = false;
      renderSummaryOverlay();
    } else if (action === "close-sheet") {
      haptic(3);
      closeSheet();
    } else if (action === "start-workout") {
      requireWorkoutReady(null);
      render();
    } else if (action === "finish-workout") {
      finishWorkout();
    } else if (action === "reset-day") {
      if (confirm("Reset this day's logged sets, timer, readiness, and notes?")) {
        delete state.days[state.activeDayId];
        if (runtime.lastLog && runtime.lastLog.dayId === state.activeDayId) runtime.lastLog = null;
        saveState();
        render();
      }
    } else if (action === "toggle-set") {
      toggleSet(Number(btn.dataset.ex), Number(btn.dataset.set));
    } else if (action === "undo-last") {
      undoLastLog();
    } else if (action === "exercise-flag") {
      toggleExerciseFlag(Number(btn.dataset.ex), btn.dataset.flag);
    } else if (action === "remove-custom-exercise") {
      var quickRemove = feature("quickadd");
      if (quickRemove && typeof quickRemove.remove === "function" && confirm("Remove this custom exercise and its logged sets from today?")) {
        if (quickRemove.remove(makeCtx(), state.activeDayId, Number(btn.dataset.ex))) {
          toast("Custom exercise removed.");
          render();
        }
      }
    } else if (action === "set-step") {
      stepSetValue(Number(btn.dataset.ex), Number(btn.dataset.set), btn.dataset.field, Number(btn.dataset.delta));
    } else if (action === "copy-set1") {
      copySet1ToRemaining(Number(btn.dataset.ex));
    } else if (action === "did-planned") {
      didAsPlanned(Number(btn.dataset.ex));
    } else if (action === "add-set") {
      haptic([8, 30, 8]);
      addSet(Number(btn.dataset.ex));
    } else if (action === "remove-set") {
      haptic(5);
      removeSet(Number(btn.dataset.ex));
    } else if (action === "plate") {
      var day = getDay(state.activeDayId);
      var exIndex = Number(btn.dataset.ex);
      var setIndex = Number(btn.dataset.set || 0);
      var ex = day.exercises[exIndex];
      var current = getCurrentSetValue(day, exIndex, setIndex);
      openSheet("plate", { exerciseName: ex.name, targetKg: current.weight, barKg: state.settings.barWeight });
    } else if (action === "rest-adjust") {
      adjustRest(Number(btn.dataset.delta));
    } else if (action === "rest-toggle") {
      toggleRest();
    } else if (action === "rest-preset") {
      presetRest(Number(btn.dataset.sec));
    } else if (action === "rest-dismiss") {
      rest = idleRest();
      saveRest();
      haptic(3);
      updateWorkoutNotification(true);
      render();
    } else if (action === "copy-scope") {
      runtime.copyScope = btn.dataset.scope;
      renderSheet();
    } else if (action === "copy-log") {
      var copyLogText = buildLog(runtime.copyScope || "day");
      copyText(copyLogText).then(function () { toast("Log copied."); }).catch(function () {
        if (nativeShareText("Lift log", copyLogText)) toast("Clipboard blocked. Opening Android share sheet.");
        else toast("Clipboard blocked. Long-press the log text to copy.");
      });
    } else if (action === "share-log") {
      var text = buildLog(runtime.copyScope || "day");
      if (nativeShareText("Lift log", text)) toast("Opening Android share sheet.");
      else if (navigator.share) navigator.share({ title: "Lift log", text: text }).catch(function () {});
      else copyText(text).then(function () { toast("Share unavailable. Log copied instead."); }).catch(function () { toast("Share unavailable. Long-press the log text to copy."); });
    } else if (action === "share-image") {
      downloadDayImage({ share: true });
    } else if (action === "summary-share") {
      downloadDayImage({ share: true });
    } else if (action === "summary-review") {
      runtime.summaryDayId = null;
      runtime.cycleReview = false;
      openSheet("journal");
      renderSummaryOverlay();
    } else if (action === "save-readiness") {
      var readinessDay = getDay(state.activeDayId);
      if (readinessDay) {
        var input = sheet.querySelector("[data-action='readiness-input']");
        var readinessDs = dayState(readinessDay.id);
        readinessDs.readiness = Number(input ? input.value : runtime.readinessValue || 8);
        var wasRunning = !!(readinessDs.startedAt && !readinessDs.finishedAt);
        startWorkout(false);
        if (wasRunning && completedSetCount(readinessDay, state) === 0) {
          freezeAdaptiveTargets(readinessDay, readinessDs);
        }
      }
      saveState();
      closeSheet();
      executePendingAction();
      render();
    } else if (action === "export-data") {
      exportData();
    } else if (action === "import-data") {
      importData();
    } else if (action === "reset-all") {
      resetAll();
    } else if (action === "add-bodyweight") {
      addBodyweight();
    } else if (action === "delete-bodyweight") {
      deleteBodyweight(btn.dataset.date);
    } else if (action === "records-sort") {
      runtime.recordsSort = btn.dataset.sort || "recency";
      renderSheet();
    } else if (action === "heatmap-day") {
      if (btn.dataset.day && getDay(btn.dataset.day)) {
        state.activeDayId = btn.dataset.day;
        state.activeWeekId = (weekForDayId(btn.dataset.day) || getWeek(state.activeWeekId)).id;
        saveState();
        closeSheet();
        render();
      }
    } else if (action === "steps-enable") {
      var steps = feature("steps");
      if (steps && typeof steps.startSensor === "function") steps.startSensor(makeCtx());
    } else if (action === "steps-stop") {
      var stopSteps = feature("steps");
      if (stopSteps && typeof stopSteps.stopSensor === "function") stopSteps.stopSensor(makeCtx());
    } else if (action === "steps-manual") {
      var stepsMod = feature("steps");
      var dateNode = sheet.querySelector("[data-steps-date]");
      var countNode = sheet.querySelector("[data-steps-count]");
      if (stepsMod && typeof stepsMod.addManual === "function" && dateNode && countNode) {
        stepsMod.addManual(makeCtx(), dateNode.value, Number(countNode.value));
        saveState();
        toast("Steps saved.");
        renderSheet();
      }
    } else if (action === "backup-download") {
      var cloud = feature("cloud");
      if (cloud && typeof cloud.downloadBackup === "function") cloud.downloadBackup(makeCtx());
    } else if (action === "backup-share") {
      var shareCloud = feature("cloud");
      if (shareCloud && typeof shareCloud.shareBackup === "function") {
        shareCloud.shareBackup(makeCtx()).catch(function (err) {
          if (err && err.name !== "AbortError") toast("Share failed.");
        });
      }
    } else if (action === "backup-restore") {
      importData();
    } else if (action === "backup-rollback") {
      rollbackSnapshot();
    } else if (action === "check-updates") {
      checkForUpdates();
    } else if (action === "library-add") {
      var library = feature("library");
      var nameNode = sheet.querySelector("[data-library-name]");
      if (library && typeof library.addCustomWorkout === "function" && nameNode && nameNode.value.trim()) {
        library.addCustomWorkout(makeCtx(), { name: nameNode.value.trim(), exercises: [] });
        saveState();
        toast("Custom workout saved.");
        renderSheet();
      }
    } else if (action === "library-start") {
      var lib = feature("library");
      var tplId = btn.dataset.id;
      var tpl = lib && typeof lib.instantiateWorkout === "function" ? lib.instantiateWorkout(makeCtx(), tplId) : null;
      var tplLabel = tpl ? (tpl.name || tpl.title || "this template") : "this template";
      if (lib && typeof lib.applyTemplateToDay === "function" && confirm("Add exercises from \"" + tplLabel + "\" to " + (state.activeDayId || "today") + "?")) {
        var applied = lib.applyTemplateToDay(makeCtx(), tplId);
        if (applied && applied.added && applied.added.length) {
          toast("Added " + applied.added.length + " exercises from " + tplLabel + ".");
          closeSheet();
          render();
        } else {
          toast("Could not apply template to the active day.");
        }
      }
    } else if (action === "open-drawer") {
      haptic(3);
      runtime.drawerOpen = true;
      renderNavDrawer();
    } else if (action === "close-drawer") {
      haptic(3);
      runtime.drawerOpen = false;
      renderNavDrawer();
    } else if (action === "drawer-open-sheet") {
      haptic(3);
      runtime.drawerOpen = false;
      renderNavDrawer();
      openSheet(btn.dataset.sheet, null, { mode: "page" });
    } else if (action === "fab-tap") {
      // Resolved at render time to start-workout or finish-workout.
    } else if (action === "nav-tab") {
      haptic(3);
      var tab = btn.dataset.nav || "today";
      runtime.activeTab = tab;
      renderBottomNav();
      if (tab === "today") {
        if (runtime.sheet) closeSheet();
        goToday();
      } else if (tab === "plan") {
        openSheet("calendar", null, { mode: "page" });
      } else if (tab === "progress") {
        openSheet("streaks", null, { mode: "page" });
      } else if (tab === "body") {
        openSheet("measurements", null, { mode: "page" });
      } else if (tab === "library") {
        openSheet("library", null, { mode: "page" });
      }
    } else if (action === "cal-prev" || action === "cal-next") {
      var year = runtime.calYear, month = runtime.calMonth;
      if (year == null || month == null) {
        var today = (todayId() || localDateId(new Date())).split("-");
        year = +today[0]; month = +today[1] - 1;
      }
      month += action === "cal-next" ? 1 : -1;
      if (month < 0) { month = 11; year -= 1; }
      if (month > 11) { month = 0; year += 1; }
      runtime.calYear = year;
      runtime.calMonth = month;
      renderSheet();
    } else if (action === "cal-today") {
      runtime.calYear = null;
      runtime.calMonth = null;
      renderSheet();
    } else if (action === "cal-day") {
      var iso = btn.dataset.iso;
      if (iso && getDay(iso)) {
        state.activeDayId = iso;
        state.activeWeekId = (weekForDayId(iso) || getWeek(state.activeWeekId)).id;
        runtime.activeTab = "today";
        saveState();
        if (btn.dataset.status === "unknown" || btn.dataset.status === "missed") {
          openSheet("history", { date: iso });
          render();
        } else {
          closeSheet();
          render();
        }
      }
    } else if (action === "market-filter") {
      runtime.marketFilter = btn.dataset.vibe || "all";
      runtime.marketSelected = null;
      renderSheet();
    } else if (action === "market-open") {
      runtime.marketSelected = btn.dataset.id;
      renderSheet();
    } else if (action === "market-close") {
      runtime.marketSelected = null;
      renderSheet();
    } else if (action === "market-import") {
      var market = feature("marketplace");
      if (market && typeof market.importTemplate === "function") {
        market.importTemplate(makeCtx(), btn.dataset.id);
        renderSheet();
      }
    } else if (action === "qa-preset") {
      haptic(3);
      runtime.quickAddDraft = runtime.quickAddDraft || {};
      runtime.quickAddDraft.name = btn.dataset.name;
      runtime.quickAddDraft.sets = Number(btn.dataset.sets) || 3;
      runtime.quickAddDraft.reps = btn.dataset.reps || 8;
      runtime.quickAddDraft.restSec = Number(btn.dataset.rest) || 60;
      runtime.quickAddDraft.weight = runtime.quickAddDraft.weight || 0;
      var quickPresetMod = feature("quickadd");
      var quickPreset = quickPresetMod && (quickPresetMod.PRESETS || []).find(function (item) { return item.name === btn.dataset.name; });
      if (quickPreset) {
        runtime.quickAddDraft.weightMode = quickPreset.weightMode;
        runtime.quickAddDraft.muscleGroup = Object.keys(quickPreset.muscleGroups || {})[0] || "";
      }
      renderSheet();
    } else if (action === "qa-commit") {
      var qa = feature("quickadd");
      if (qa && typeof qa.commit === "function" && qa.commit(makeCtx())) {
        haptic(5);
        closeSheet();
        render();
      }
    } else if (action === "measure-add") {
      var fieldKey = btn.dataset.field;
      var valInput = sheet.querySelector('[data-m-field="' + fieldKey + '"]');
      var noteInput = sheet.querySelector('[data-m-note="' + fieldKey + '"]');
      var dateInput = sheet.querySelector('[data-m-date]');
      var meas = feature("measurements");
      if (meas && typeof meas.addEntry === "function" && valInput) {
        if (meas.addEntry(
          makeCtx(),
          fieldKey,
          valInput.value,
          dateInput && dateInput.value,
          noteInput && noteInput.value
        )) {
          renderSheet();
        }
      }
    } else if (action === "photo-checkin") {
      var photoMeasurements = feature("measurements");
      if (photoMeasurements && typeof photoMeasurements.recordPhotoCheckin === "function" &&
          photoMeasurements.recordPhotoCheckin(makeCtx(), btn.dataset.date)) {
        renderSheet();
      }
    } else if (action === "measure-delete") {
      var meas2 = feature("measurements");
      if (meas2 && typeof meas2.deleteEntry === "function") {
        meas2.deleteEntry(makeCtx(), btn.dataset.date, btn.dataset.field);
        renderSheet();
      }
    } else if (action === "profile-save") {
      var profileHeight = sheet.querySelector("[data-profile-height]");
      var profileGoal = sheet.querySelector("[data-profile-goal]");
      var profileStatement = sheet.querySelector("[data-profile-statement]");
      state.profile = state.profile || {};
      state.profile.heightCm = clamp(numberOr(profileHeight && profileHeight.value, 167), 80, 250);
      state.profile.goalMode = profileGoal && profileGoal.value || "recomposition";
      state.profile.goalStatement = String(profileStatement && profileStatement.value || "").trim() || "Smaller waist + visible abs while preserving muscle";
      saveState("profile-goals");
      toast("Goal settings saved.");
      renderSheet();
    } else if (action === "history-reconstruct") {
      var historyMod = feature("history");
      var historyType = sheet.querySelector("[data-history-type]");
      var historyNotes = sheet.querySelector("[data-history-notes]");
      if (historyMod && typeof historyMod.markReconstructed === "function") {
        historyMod.markReconstructed(state, btn.dataset.date, historyType && historyType.value, historyNotes && historyNotes.value);
        saveState("history-reconstructed");
        toast("Session marked as trained without inventing set details.");
        render();
      }
    } else if (action === "history-mark") {
      var historyStatusMod = feature("history");
      var statusNotes = sheet.querySelector("[data-history-notes]");
      if (historyStatusMod && typeof historyStatusMod.markStatus === "function") {
        historyStatusMod.markStatus(state, btn.dataset.date, btn.dataset.status, statusNotes && statusNotes.value);
        saveState("history-status");
        toast("History status updated.");
        render();
      }
    } else if (action === "cardio-log-1k") {
      var cardioMod = feature("cardio");
      try {
        var distanceNode = sheet.querySelector("[data-cardio-distance]");
        var minutesNode = sheet.querySelector("[data-cardio-min]");
        var secondsNode = sheet.querySelector("[data-cardio-sec]");
        cardioMod.addEntry(state, state.activeDayId || todayId(), {
          distanceKm: Number(distanceNode && distanceNode.value),
          durationSec: Number(minutesNode && minutesNode.value) * 60 + Number(secondsNode && secondsNode.value),
          environment: (sheet.querySelector("[data-cardio-environment]") || {}).value,
          rpe: (sheet.querySelector("[data-cardio-rpe]") || {}).value,
          heartRate: (sheet.querySelector("[data-cardio-hr]") || {}).value,
          notes: (sheet.querySelector("[data-cardio-notes]") || {}).value
        });
        saveState("cardio-log");
        toast("Cardio logged.");
        renderSheet();
      } catch (cardioErr) {
        toast("Cardio not saved: " + cardioErr.message);
      }
    } else if (action === "cardio-skip") {
      var cardioSkip = feature("cardio");
      if (cardioSkip && typeof cardioSkip.addEntry === "function") {
        var skipReasonNode = sheet.querySelector("[data-cardio-skip-reason]");
        var skipNotesNode = sheet.querySelector("[data-cardio-notes]");
        cardioSkip.addEntry(state, state.activeDayId || todayId(), { skipped: true, skipReason: skipReasonNode && skipReasonNode.value || "Recovery", notes: skipNotesNode && skipNotesNode.value });
        saveState("cardio-skip");
        toast("Recovery skip logged without penalty.");
        renderSheet();
      }
    } else if (action === "cardio-delete") {
      var cardioDel = feature("cardio");
      if (cardioDel && typeof cardioDel.deleteEntry === "function" && cardioDel.deleteEntry(state, btn.dataset.date, btn.dataset.id)) {
        saveState("cardio-delete");
        toast("Cardio entry deleted.");
        render();
      }
    } else if (action === "protein-preset") {
      var nutritionPreset = feature("nutrition");
      var food = nutritionPreset && nutritionPreset.foodById(btn.dataset.food);
      if (food) {
        var quickMeal = sheet.querySelector("[data-protein-quick-meal]");
        var selectedMeal = (quickMeal && quickMeal.value) || runtime.quickMeal || "breakfast";
        runtime.quickMeal = selectedMeal;
        nutritionPreset.addFood(state, todayId(), food, { meal: selectedMeal });
        saveState("protein-log");
        toast(food.name + " added.");
        renderSheet();
      }
    } else if (action === "protein-custom") {
      var nutritionCustom = feature("nutrition");
      var proteinName = sheet.querySelector("[data-protein-name]");
      var proteinGrams = sheet.querySelector("[data-protein-grams]");
      var proteinMeal = sheet.querySelector("[data-protein-meal]");
      try {
        nutritionCustom.addFood(state, todayId(), { id: "custom", name: String(proteinName && proteinName.value || "").trim(), proteinG: Number(proteinGrams && proteinGrams.value), serving: "1 serving" }, { meal: proteinMeal && proteinMeal.value });
        saveState("protein-log");
        toast("Protein entry added.");
        renderSheet();
      } catch (proteinErr) {
        toast("Protein not saved: " + proteinErr.message);
      }
    } else if (action === "protein-delete") {
      var nutritionDelete = feature("nutrition");
      var nutritionDay = nutritionDelete && nutritionDelete.dayBucket(state, todayId());
      if (nutritionDay) {
        nutritionDay.entries = nutritionDay.entries.filter(function (entry) { return entry.id !== btn.dataset.id; });
        saveState("protein-delete");
        renderSheet();
      }
    } else if (action === "supplement-toggle") {
      var nutritionSupplement = feature("nutrition");
      if (nutritionSupplement) {
        nutritionSupplement.setSupplement(state, todayId(), btn.dataset.supplement, btn.dataset.value === "true");
        saveState("supplement-log");
        renderSheet();
      }
    } else if (action === "program-next-block") {
      var programNext = feature("program");
      if (programNext && typeof programNext.appendBlock === "function") {
        programNext.appendBlock(state, PLAN);
        saveState("program-extension");
        toast("Another four-week block is ready.");
        render();
        renderSheet();
      }
    } else if (action === "health-export") {
      var hk = feature("healthkit");
      if (hk && typeof hk.exportTarget === "function") hk.exportTarget(makeCtx(), btn.dataset.target);
    } else if (action === "form-video") {
      var forms = feature("forms");
      if (forms && typeof forms.openForFormVideo === "function") forms.openForFormVideo(makeCtx(), btn.dataset.name);
    } else if (action === "rm-save") {
      var strengthMod = feature("strength");
      var calc = runtime.strengthCalc || {};
      var wNode = sheet.querySelector("#rm-w");
      var rNode = sheet.querySelector("#rm-r");
      var weightDisplay = wNode ? wNode.value : (calc.weight != null ? calc.weight : kgToDisplay(80));
      var repsVal = Math.max(0, Math.round(numberOr(rNode ? rNode.value : (calc.reps != null ? calc.reps : 5), 0)));
      var weightKg = displayToKg(weightDisplay);
      if (!(weightKg > 0) || !(repsVal > 0)) {
        toast("Enter a valid weight and reps first.");
      } else {
        var estKg = strengthMod && typeof strengthMod.average === "function"
          ? strengthMod.average(weightKg, repsVal)
          : weightKg * (1 + repsVal / 30);
        state.strengthEstimates = Array.isArray(state.strengthEstimates) ? state.strengthEstimates : [];
        state.strengthEstimates.push({
          weightKg: weightKg,
          reps: repsVal,
          estimated1rmKg: estKg,
          date: todayId(),
          ts: Date.now()
        });
        saveState("strength-estimate");
        toast("1RM estimate saved.");
        renderSheet();
      }
    } else if (action === "voice-test") {
      var v = feature("voice");
      if (v && typeof v.testVoice === "function") v.testVoice(makeCtx());
    }
  }

  function handleInput(event) {
    var target = event.target;
    var action = target.dataset.action;
    if (action === "set-input") {
      updateSetValue(Number(target.dataset.ex), Number(target.dataset.set), target.dataset.field, target.value, target.dataset.field === "weight");
    } else if (action === "notes-input") {
      dayState(state.activeDayId).notes = target.value;
      saveState();
    } else if (action === "readiness-input") {
      runtime.readinessValue = Number(target.value);
      var out = document.getElementById("readiness-value");
      if (out) out.textContent = target.value + "/10";
    } else if (action === "plate-input") {
      runtime.plate = runtime.plate || { exerciseName: "Lift", targetKg: 0, barKg: state.settings.barWeight };
      if (target.dataset.field === "target") runtime.plate.targetKg = displayToKg(target.value);
      if (target.dataset.field === "bar") runtime.plate.barKg = displayToKg(target.value);
      var plateCard = sheet.querySelector("[data-plate-result]");
      if (plateCard) {
        var platePara = plateCard.querySelector("p");
        if (platePara) platePara.textContent = plateResultText();
      }
    } else if (action === "qa-input") {
      runtime.quickAddDraft = runtime.quickAddDraft || {};
      runtime.quickAddDraft[target.dataset.field] = target.value;
    } else if (action === "rm-input") {
      runtime.strengthCalc = runtime.strengthCalc || { weight: null, reps: 5 };
      runtime.strengthCalc[target.dataset.field] = target.value;
      var rmOutput = sheet.querySelector("[data-rm-output]");
      var strengthOut = feature("strength");
      if (rmOutput && strengthOut && typeof strengthOut.renderOutput === "function") {
        rmOutput.innerHTML = strengthOut.renderOutput(makeCtx());
      }
    } else if (action === "steps-live") {
      var steps = feature("steps");
      if (steps && typeof steps.addManual === "function") {
        steps.addManual(makeCtx(), target.dataset.date || todayId(), Number(target.value));
        saveState();
      }
    }
  }

  function handleChange(event) {
    var target = event.target;
    var action = target.dataset.action;
    if (action === "setting") {
      applySettingValue(target.dataset.setting, target.value);
    } else if (action === "progress-exercise") {
      runtime.progressExercise = target.value;
      renderSheet();
    } else if (action === "set-rir") {
      setRir(Number(target.dataset.ex), Number(target.dataset.set), target.value);
      render();
    } else if (action === "supplement-whey") {
      var nutrition = feature("nutrition");
      if (nutrition && typeof nutrition.setSupplement === "function") {
        nutrition.setSupplement(state, todayId(), "wheyServings", target.value);
        saveState("supplement-log");
        renderSheet();
      }
    } else if (action === "supplement-creatine-dose") {
      var nutritionDose = feature("nutrition");
      if (nutritionDose && typeof nutritionDose.setCreatineDose === "function") {
        nutritionDose.setCreatineDose(state, target.value);
        saveState("supplement-preference");
        renderSheet();
      }
    } else if (action === "protein-quick-meal" || target.hasAttribute("data-protein-quick-meal")) {
      runtime.quickMeal = target.value || "breakfast";
    } else if (action === "qa-input") {
      runtime.quickAddDraft = runtime.quickAddDraft || {};
      runtime.quickAddDraft[target.dataset.field] = target.value;
    }
  }

  function handleKeydown(event) {
    if (!runtime.sheet) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== "Tab" || runtime.sheetMode === "page") return;
    var focusable = Array.from(sheet.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (node) {
      return node.offsetParent !== null || node === document.activeElement;
    });
    if (!focusable.length) {
      event.preventDefault();
      sheet.focus();
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function applySettingValue(key, value) {
    if (!key) return;
    if (key === "defaultRest") state.settings.defaultRest = clamp(numberOr(value, 90), 15, 600);
    else if (key === "weightStep") state.settings.weightStep = Math.max(0.5, numberOr(value, 2.5));
    else if (key === "barWeight") state.settings.barWeight = displayToKg(value);
    else if (key === "haptics" || key === "sound") state.settings[key] = value === "true";
    else if (key === "autoStartRest" || key === "voiceRestCue") {
      if (key === "voiceRestCue" && value === "true" && !(typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window)) {
        state.settings[key] = false;
      } else {
        state.settings[key] = value === "true";
        if (key === "voiceRestCue" && value === "true") {
          var voice = feature("voice");
          if (voice && typeof voice.testVoice === "function") voice.testVoice(makeCtx());
        }
      }
    } else if (key === "workoutNotifications") {
      state.settings.workoutNotifications = value === "true";
      state.settings.notifSkipped = value !== "true";
      saveState();
      if (value === "true") {
        if ("Notification" in window && Notification.permission === "denied") {
          toast("Notifications are blocked. Re-enable them in Chrome site settings.");
        } else {
          var notifications = feature("notifications");
          if (notifications && typeof notifications.ensurePermission === "function") {
            notifications.ensurePermission(makeCtx()).then(function (permission) {
              if (permission === "granted" && isWorkoutRunning(state.activeDayId)) updateWorkoutNotification(true);
              renderSheet();
            });
          }
        }
      } else {
        clearWorkoutNotification();
      }
      render();
      return;
    } else if (key === "goal-weeklySessions") state.goals.weeklySessions = clamp(numberOr(value, DEFAULT_GOALS.weeklySessions), 1, 14);
    else if (key === "goal-weeklyVolumeKg") state.goals.weeklyVolumeKg = displayToKg(value);
    else if (key === "goal-dailySteps") state.goals.dailySteps = clamp(numberOr(value, DEFAULT_GOALS.dailySteps), 100, 100000);
    else if (key === "goal-monthlyVolumeKg") state.goals.monthlyVolumeKg = displayToKg(value);
    else state.settings[key] = value;
    if (key === "theme") applyTheme(state.settings.theme);
    if (key === "visualStyle") applyVisualStyle(state.settings.visualStyle);
    saveState();
    render();
  }

  function checkForUpdates() {
    if (!navigator.onLine) {
      toast("You are offline. Connect to check for updates.");
      return;
    }
    toast("Checking for updates…");
    fetch("./version.json", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var online = data && data.version;
        if (online && online !== APP_VERSION) {
          toast("Update available (v" + online + "). Applying…");
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then(function (reg) {
              reg.update().catch(function () {});
            });
          }
        } else {
          toast("Already on the latest version (v" + APP_VERSION + ").");
        }
      })
      .catch(function () {
        toast("Update check failed. Are you online?");
      });
  }

  // True only when a service worker already controlled the page at load time.
  // On the very first visit the new worker claims the page (controllerchange +
  // LIFT_SW_UPDATED both fire), but that is an install, not an update.
  var swHadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  var swUpdateHandled = false;

  function applyPendingReload() {
    if (!swHadController || swUpdateHandled || runtime.pendingReload) return;
    swUpdateHandled = true;
    var day = getDay(state.activeDayId);
    if (day && isWorkoutRunning(day.id)) {
      runtime.pendingReload = true;
      toast("App update ready — will reload after your workout.");
    } else {
      toast("App update ready — reloading…");
      setTimeout(function () { location.reload(); }, 1400);
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!location.protocol.startsWith("http")) {
      console.info("Service worker skipped outside http/https.");
      return;
    }
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then(function (registration) {
      console.info("Lift service worker registered.");
      registration.update().catch(function () {});
    }).catch(function (err) {
      console.warn("Lift service worker registration failed.", err);
    });
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      applyPendingReload();
    });
  }

  function bindNotificationActionMessages() {
    // Route actions coming from the native Android wrapper
    window.addEventListener("liftNativeAction", function (event) {
      var action = event && event.detail;
      if (action) handleNotifAction(String(action));
    });
    window.__liftNativeActionReady = true;
    (window.__liftPendingNativeActions || []).splice(0).forEach(function (action) {
      if (action) handleNotifAction(String(action));
    });
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("message", function (event) {
      if (!event.data) return;
      if (event.data.type === "LIFT_NOTIF_ACTION") {
        handleNotifAction(event.data.action);
      } else if (event.data.type === "LIFT_SW_UPDATED") {
        applyPendingReload();
      }
    });
    window.addEventListener("liftHandleColdAction", function () {
      handleColdNotificationAction();
    });
  }

  function handleColdNotificationAction() {
    try {
      var params = new URLSearchParams(location.search);
      var action = params.get("notifAction");
      if (!action) return;
      params.delete("notifAction");
      var nextSearch = params.toString();
      var nextUrl = location.pathname + (nextSearch ? "?" + nextSearch : "") + location.hash;
      history.replaceState(null, "", nextUrl);
      if (/^(finish|minus-15|plus-15|skip|logged|open)$/.test(action)) {
        handleNotifAction(action);
      }
    } catch (err) {}
  }

  function handleLaunchParams() {
    try {
      var params = new URLSearchParams(location.search);
      var shortcut = params.get("shortcut");
      if (!shortcut) return;
      params.delete("shortcut");
      var nextSearch = params.toString();
      var nextUrl = location.pathname + (nextSearch ? "?" + nextSearch : "") + location.hash;
      history.replaceState(null, "", nextUrl);

      if (shortcut === "today" || shortcut === "start-workout") {
        goToday();
        if (shortcut === "start-workout") {
          startWorkout(false);
          render();
        }
        return;
      }

      var sheetByShortcut = {
        records: "prs",
        library: "library",
        backup: "backup"
      };
      if (sheetByShortcut[shortcut]) openSheet(sheetByShortcut[shortcut]);
    } catch (err) {}
  }

  async function init() {
    await recoverDurableSnapshot();
    applyTheme(state.settings.theme);
    applyVisualStyle(state.settings.visualStyle);
    saveState();
    var persistence = feature("persistence");
    if (persistence && typeof persistence.forceSnapshot === "function") {
      await persistence.forceSnapshot(state, "startup").catch(function () {});
    }
    render();
    if (runtime.recoveredFrom) toast("Recovered Lift data from " + runtime.recoveredFrom + ".");
    registerServiceWorker();
    bindNotificationActionMessages();
    handleColdNotificationAction();
    handleLaunchParams();
    setInterval(function () {
      completeRestIfNeeded();
      refreshTimers();
    }, 1000);
    document.addEventListener("click", handleClick);
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);
    document.addEventListener("keydown", handleKeydown);
    sheetBackdrop.addEventListener("click", closeSheet);
    var drawerBackdrop = document.getElementById("drawer-backdrop");
    if (drawerBackdrop) {
      drawerBackdrop.addEventListener("click", function () {
        runtime.drawerOpen = false;
        renderNavDrawer();
      });
    }
    // Swipe from left edge to open the drawer.
    var edgeSwipe = null;
    document.addEventListener("touchstart", function (e) {
      if (runtime.drawerOpen) return;
      var t = e.touches && e.touches[0];
      if (!t) return;
      if (t.clientX > 18) return;
      edgeSwipe = { startX: t.clientX, startY: t.clientY };
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (!edgeSwipe) return;
      var t = e.touches && e.touches[0];
      if (!t) return;
      var dx = t.clientX - edgeSwipe.startX;
      var dy = Math.abs(t.clientY - edgeSwipe.startY);
      if (dx > 60 && dx > dy * 1.5) {
        runtime.drawerOpen = true;
        renderNavDrawer();
        edgeSwipe = null;
      }
    }, { passive: true });
    document.addEventListener("touchend", function () { edgeSwipe = null; }, { passive: true });
    if (summaryOverlay) {
      summaryOverlay.addEventListener("click", function (event) {
        if (event.target === summaryOverlay) {
          runtime.summaryDayId = null;
          runtime.cycleReview = false;
          renderSummaryOverlay();
        }
      });
    }
    var sheetDragState = null;
    sheet.addEventListener("pointerdown", function(e) {
      if (!e.target.closest(".sheet-grabber")) return;
      sheetDragState = { startY: e.clientY };
      sheet.setPointerCapture(e.pointerId);
      sheet.style.transition = "none";
    });
    sheet.addEventListener("pointermove", function(e) {
      if (!sheetDragState) return;
      var dy = e.clientY - sheetDragState.startY;
      if (dy > 0) sheet.style.transform = "translate(-50%, " + dy + "px)";
    });
    sheet.addEventListener("pointerup", function(e) {
      if (!sheetDragState) return;
      var dy = e.clientY - sheetDragState.startY;
      sheetDragState = null;
      sheet.style.transition = "";
      sheet.style.transform = "";
      if (dy > 80) closeSheet();
    });
    sheet.addEventListener("pointercancel", function() {
      sheetDragState = null;
      sheet.style.transition = "";
      sheet.style.transform = "";
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && isWorkoutRunning(state.activeDayId)) requestWakeLock();
      if (document.visibilityState !== "visible") releaseWakeLock();
    });
    if (window.matchMedia) {
      var media = matchMedia("(prefers-color-scheme: dark)");
      if (media.addEventListener) media.addEventListener("change", function () {
        if (state.settings.theme === "system") {
          applyTheme("system");
          render();
        }
      });
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      clamp: clamp,
      completedSetCount: completedSetCount,
      dayStatus: dayStatus,
      alignActiveStrip: alignActiveStrip,
      escapeHtml: escapeHtml,
      formatDuration: formatDuration,
      isCompletedSet: isCompletedSet,
      mergeDateIds: mergeDateIds,
      mergeMeasurements: mergeMeasurements,
      normalizeState: normalizeState,
      chooseRecoveryCandidate: chooseRecoveryCandidate,
      stateUpdatedAt: stateUpdatedAt,
      getDay: getDay,
      numberOr: numberOr,
      pad2: pad2,
      lastSessionHint: lastSessionHint,
      stepSetValue: stepSetValue,
      copySet1ToRemaining: copySet1ToRemaining,
      render: render,
      renderRestFab: renderRestFab,
      handleClick: handleClick,
      startRest: startRest,
      openSheet: openSheet,
      getState: function () { return state; },
      getRest: function () { return rest; },
      getRuntime: function () { return runtime; }
    };
  } else {
    init().catch(function () {
      app.innerHTML = '<div class="app-empty">Lift could not finish starting. Reload the app or restore a backup.</div>';
    });
  }
})();
