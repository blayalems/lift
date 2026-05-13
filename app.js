(function () {
  "use strict";

  var PLAN = window.LIFT_PLAN;
  var app = document.getElementById("app");
  var toastRoot = document.getElementById("toast-root");
  var sheet = document.getElementById("sheet");
  var sheetBackdrop = document.getElementById("sheet-backdrop");
  var summaryOverlay = document.getElementById("summary-overlay");

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
    haptics: true,
    sound: true,
    barWeight: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25]
  };
  var DEFAULT_GOALS = {
    weeklySessions: 5,
    weeklyVolumeKg: 10000,
    dailySteps: 7000,
    monthlyVolumeKg: 40000
  };
  var REST_PRESETS = [60, 90, 120, 180];
  var MONTHS = {
    Jan: 0, January: 0,
    Feb: 1, February: 1,
    Mar: 2, March: 2,
    Apr: 3, April: 3,
    May: 4,
    Jun: 5, June: 5,
    Jul: 6, July: 6,
    Aug: 7, August: 7,
    Sep: 8, Sept: 8, September: 8,
    Oct: 9, October: 9,
    Nov: 10, November: 10,
    Dec: 11, December: 11
  };

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
    recordsSort: "recency"
  };

  var state = loadState();
  var rest = loadRest();
  var wakeLock = null;
  var renderQueued = false;

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
    if (state && state.settings && state.settings.haptics && navigator.vibrate) {
      navigator.vibrate(pattern || 18);
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
      shoe: '<path d="M4 14c2.2 1.8 5.3 3 9.2 3H20c.6 0 1-.4 1-1v-1.4c0-.6-.4-1-1-1h-3.6c-1.7 0-3.2-.7-4.4-1.8L9.5 9.5 7.4 12 5 10.4 4 14Z"/><path d="M8 13h4M11 11l1.5-1.5"/>'
    };
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.more) + "</svg>";
  }

  function loadState() {
    var loaded = null;
    try {
      loaded = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    } catch (err) {
      loaded = null;
    }
    if (!loaded) {
      try {
        loaded = JSON.parse(localStorage.getItem(V2_STORE_KEY) || "null");
      } catch (err1) {
        loaded = null;
      }
    }
    if (!loaded) {
      loaded = { v: 3, settings: {}, days: {}, bodyweight: [], prs: {}, activeWeekId: null, activeDayId: null };
      migrateV1(loaded);
    }
    loaded = migrateToV3(loaded);
    loaded.settings = Object.assign({}, DEFAULT_SETTINGS, loaded.settings || {});
    loaded.days = loaded.days || {};
    loaded.bodyweight = Array.isArray(loaded.bodyweight) ? loaded.bodyweight : [];
    loaded.prs = loaded.prs || {};
    loaded.achievements = loaded.achievements || {};
    loaded.goals = Object.assign({}, DEFAULT_GOALS, loaded.goals || {});
    loaded.steps = loaded.steps || {};
    loaded.calories = loaded.calories || {};
    loaded.restingHr = Array.isArray(loaded.restingHr) ? loaded.restingHr : [];
    loaded.customWorkouts = Array.isArray(loaded.customWorkouts) ? loaded.customWorkouts : [];
    loaded.cloudSync = Object.assign({ provider: null, lastBackupAt: null, autoWeekly: false }, loaded.cloudSync || {});
    loaded.weeklyRecapDismissedIso = loaded.weeklyRecapDismissedIso || null;
    loaded.cycleReviewSeen = !!loaded.cycleReviewSeen;
    var selection = chooseInitialSelection(loaded);
    loaded.activeWeekId = selection.weekId;
    loaded.activeDayId = selection.dayId;
    try {
      var theme = localStorage.getItem(THEME_KEY);
      if (theme && !loaded.settings.theme) loaded.settings.theme = theme;
    } catch (err2) {}
    return loaded;
  }

  function migrateToV3(loaded) {
    if (!loaded || typeof loaded !== "object") loaded = {};
    if (loaded.v !== 3) loaded = Object.assign({}, loaded, { v: 3 });
    return loaded;
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

  function saveState() {
    state = migrateToV3(state);
    runAchievementEvaluation();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      localStorage.setItem(THEME_KEY, state.settings.theme || "system");
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
    return { duration: DEFAULT_SETTINGS.defaultRest, endsAt: 0, pausedRemaining: DEFAULT_SETTINGS.defaultRest, running: false, label: "Rest" };
  }

  function allDays() {
    if (!PLAN || !Array.isArray(PLAN.weeks)) return [];
    var days = [];
    PLAN.weeks.forEach(function (week) {
      (week.days || []).forEach(function (day) {
        days.push({ week: week, day: day });
      });
    });
    return days;
  }

  function getWeek(id) {
    return (PLAN.weeks || []).find(function (week) { return week.id === id; }) || (PLAN.weeks || [])[0];
  }

  function getDay(id) {
    var found = allDays().find(function (entry) { return entry.day.id === id; });
    return found ? found.day : null;
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
      dayState: dayState,
      totalSetCount: totalSetCount,
      totalSetCountForSource: totalSetCountForSource,
      completedSetCount: completedSetCount,
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
      openSheet: openSheet,
      closeSheet: closeSheet,
      downloadDayImage: downloadDayImage,
      exportData: exportData,
      importData: importData,
      saveState: saveState,
      cycleAdherence: cycleAdherence,
      trainingStreak: trainingStreak,
      dayStatus: dayStatus,
      localDateId: localDateId,
      todayId: todayId,
      normalizePhase: normalizePhase,
      isoWeekId: isoWeekId,
      defaultGoals: DEFAULT_GOALS
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
    var found = allDays().find(function (entry) { return entry.day.id === dayId; });
    return found ? found.week : null;
  }

  function parseWeekBounds(week) {
    var range = String(week.dateRange || "").replace(/\u2013|\u2014/g, "-");
    var m = range.match(/([A-Za-z]+)\s*(\d{1,2})\s*-\s*(?:([A-Za-z]+)\s*)?(\d{1,2})/);
    if (m && MONTHS[m[1]] != null) {
      var endMonth = m[3] || m[1];
      if (MONTHS[endMonth] != null) {
        return {
          start: new Date(2026, MONTHS[m[1]], Number(m[2])),
          end: new Date(2026, MONTHS[endMonth], Number(m[4]))
        };
      }
    }
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
    state.days[dayId] = state.days[dayId] || { completed: {}, extraSets: {}, drafts: {} };
    state.days[dayId].completed = state.days[dayId].completed || {};
    state.days[dayId].extraSets = state.days[dayId].extraSets || {};
    state.days[dayId].drafts = state.days[dayId].drafts || {};
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
    var extraCount = numberOr(dayState(day.id).extraSets[String(exIndex)], 0);
    var last = base[base.length - 1] || { reps: 0, weight: 0 };
    for (var i = 0; i < extraCount; i += 1) {
      base.push({ reps: last.reps, weight: last.weight, extra: true });
    }
    return base;
  }

  function plannedSetCount(day) {
    return (day.exercises || []).reduce(function (sum, ex) {
      return sum + ((ex.sets || []).length);
    }, 0);
  }

  function totalSetCount(day) {
    return (day.exercises || []).reduce(function (sum, ex, exIndex) {
      return sum + exerciseSets(day, exIndex).length;
    }, 0);
  }

  function completedSetCount(day, sourceState) {
    var ds = (sourceState || state).days[day.id] || {};
    var completed = ds.completed || {};
    return Object.keys(completed).filter(function (key) { return completed[key]; }).length;
  }

  function dayStatus(day, sourceState) {
    var total = totalSetCountForSource(day, sourceState || state);
    if (!total) return ((sourceState || state).days[day.id] || {}).finishedAt ? "done" : "rest";
    var completed = completedSetCount(day, sourceState || state);
    if (completed >= total) return "done";
    if (completed > 0) return "partial";
    return "rest";
  }

  function totalSetCountForSource(day, sourceState) {
    return (day.exercises || []).reduce(function (sum, ex, exIndex) {
      var extra = (((sourceState.days || {})[day.id] || {}).extraSets || {})[String(exIndex)] || 0;
      return sum + (ex.sets || []).length + numberOr(extra, 0);
    }, 0);
  }

  function completedVolume(day) {
    var ds = dayState(day.id);
    var volume = 0;
    Object.keys(ds.completed).forEach(function (key) {
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
    try { localStorage.setItem(THEME_KEY, selected); } catch (err) {}
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
    return ({ consolidate: "Consolidate", load: "Load", loadplus: "Load+", deload: "Deload", test: "Test" })[phase] || phase || "Plan";
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

  function render() {
    if (!PLAN || !Array.isArray(PLAN.weeks) || !PLAN.weeks.length) {
      app.innerHTML = '<div class="app-empty">Plan data is missing. Confirm that data.js loads before app.js.</div>';
      return;
    }
    runtime.now = Date.now();
    var week = getWeek(state.activeWeekId) || PLAN.weeks[0];
    var day = getDay(state.activeDayId) || (week.days || [])[0];
    if (!day) {
      app.innerHTML = '<div class="app-empty">No workout days found in the plan.</div>';
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
    html += '<div><div class="eyebrow">' + escapeHtml("Week " + week.num + " - " + week.dateRange) + '</div><div class="title">' + escapeHtml(PLAN.meta && PLAN.meta.athlete ? PLAN.meta.athlete + "'s Lift" : "Lift") + "</div></div>";
    html += '<div class="top-actions">';
    html += '<button class="chip-btn" data-action="today">' + icon("today") + "<span>Today</span></button>";
    html += '<button class="icon-btn" data-action="cycle-theme" aria-label="Toggle theme">' + icon(document.documentElement.dataset.theme === "dark" ? "sun" : "moon") + "</button>";
    html += '<button class="icon-btn" data-action="open-sheet" data-sheet="menu" aria-label="Open menu">' + icon("more") + "</button>";
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
      html += '<button class="day-pill" data-action="select-day" data-day="' + escapeHtml(d.id) + '" data-active="' + String(d.id === day.id) + '" data-today="' + String(d.id === currentTodayId) + '" data-status="' + dayStatus(d, state) + '">';
      html += '<div class="dow">' + escapeHtml(d.dow || "") + '</div><div class="dom">' + escapeHtml(d.dom || "") + '</div><span class="status-dot"></span>';
      html += "</button>";
    });
    html += "</nav>";

    var recap = feature("recap");
    if (recap && typeof recap.shouldShowWeeklyRecap === "function" && recap.shouldShowWeeklyRecap(makeCtx())) {
      html += recap.renderWeeklyRecapCard(makeCtx());
    }

    html += '<section class="hero" data-type="' + escapeHtml(day.type || "legs") + '">';
    html += '<div class="hero-kicker">' + escapeHtml((day.month || "") + " " + (day.dom || "")) + "</div>";
    html += '<div class="hero-title">' + escapeHtml(day.title || "Workout") + "</div>";
    html += '<div class="hero-sub">' + escapeHtml(day.subtitle || (total ? "Training day" : "Recovery day")) + "</div>";
    if (total) {
      html += '<div class="hero-meta">';
      html += '<div class="hero-stat"><div class="v">' + completed + "/" + total + '</div><div class="l">Sets</div></div>';
      html += '<div class="hero-stat"><div class="v">' + cleanNumber(kgToDisplay(volume), 0) + '</div><div class="l">' + escapeHtml(unitLabel()) + ' volume</div></div>';
      html += '<div class="hero-stat"><div class="v" data-elapsed="' + escapeHtml(day.id) + '">' + formatDuration(workoutElapsed(day.id)) + '</div><div class="l">' + (ds.finishedAt ? "Done" : isWorkoutRunning(day.id) ? "Running" : "Time") + "</div></div>";
      html += "</div>";
      html += '<div class="hero-progress"><span style="width:' + clamp(percent, 0, 100) + '%"></span></div>';
      html += '<div class="hero-actions">';
      html += '<button class="hero-btn primary" data-action="' + (isWorkoutRunning(day.id) ? "finish-workout" : "start-workout") + '">' + icon(isWorkoutRunning(day.id) ? "stop" : "play") + "<span>" + (isWorkoutRunning(day.id) ? "Finish" : "Start workout") + "</span></button>";
      html += '<button class="hero-btn" data-action="open-sheet" data-sheet="notes">' + icon("note") + "<span>Notes</span></button>";
      html += '<button class="hero-btn" data-action="open-sheet" data-sheet="copy">' + icon("copy") + "<span>Copy log</span></button>";
      html += '<button class="hero-btn" data-action="open-sheet" data-sheet="progress">' + icon("chart") + "<span>Progress</span></button>";
      html += "</div>";
    } else {
      html += '<div class="hero-actions">';
      html += '<button class="hero-btn primary" data-action="open-sheet" data-sheet="notes">' + icon("note") + "<span>Notes</span></button>";
      html += '<button class="hero-btn" data-action="open-sheet" data-sheet="overview">' + icon("chart") + "<span>Plan overview</span></button>";
      html += "</div>";
    }
    html += "</section>";

    html += '<main class="content">';
    if (week.notice) html += '<section class="notice"><strong>Deload notice</strong><p>' + richText(week.notice) + "</p></section>";
    if (ds.readiness != null && total) {
      var low = Number(ds.readiness) < 7;
      html += '<section class="notice ' + (low ? "readiness-warn" : "") + '"><strong>Readiness ' + escapeHtml(ds.readiness) + '/10</strong><p>' + (low ? "Caveat notes are highlighted for this workout." : "Readiness logged for this workout.") + "</p></section>";
    }
    if (day.warmup) html += '<section class="warmup"><strong>Warm-up</strong><p>' + richText(day.warmup) + "</p></section>";
    if (total) {
      html += '<div class="section-head"><div><div class="section-title">Workout</div><div class="section-sub">' + (day.exercises || []).length + " exercises - " + percent + "% complete</div></div>";
      html += '<button class="link-btn" data-action="reset-day">Reset day</button></div>';
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
    renderSheet();
    renderSummaryOverlay();
    refreshTimers();
  }

  function renderSummaryOverlay() {
    if (!summaryOverlay) return;
    if (!runtime.summaryDayId) {
      summaryOverlay.dataset.open = "false";
      summaryOverlay.innerHTML = "";
      return;
    }
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
      return;
    }
    summaryOverlay.innerHTML = mod.renderOverlay(makeCtx(), runtime.summaryDayId);
    summaryOverlay.dataset.open = "true";
  }

  function renderExercise(day, ex, exIndex) {
    var ds = dayState(day.id);
    var sets = exerciseSets(day, exIndex);
    var complete = sets.length > 0 && sets.every(function (_, si) { return !!ds.completed[exIndex + "." + si]; });
    var caveat = isCaveatNote(ex.note) && Number(ds.readiness || 10) < 7;
    var html = '<article class="ex-card" data-complete="' + String(complete) + '" data-caveat="' + String(caveat) + '">';
    html += '<div class="ex-head"><div class="ex-num">' + (exIndex + 1) + '</div><div>';
    html += '<div class="ex-topline"><div><div class="ex-name">' + escapeHtml(ex.name || "Exercise") + '</div><div class="ex-target">' + escapeHtml(ex.target || "") + '</div></div></div>';
    html += '<div class="ex-tags">';
    if (ex.primary) html += '<span class="tag primary-tag">Primary</span>';
    if (ex.tag) html += '<span class="tag" data-tag="' + escapeHtml(normalizeTag(ex.tag)) + '">' + tagLabel(ex.tag) + '</span>';
    html += "</div>";
    var hint = lastSessionHint(ex.name, day.id);
    if (hint) html += '<div class="last-hint">' + escapeHtml(hint) + "</div>";
    html += "</div></div>";
    html += '<div class="ex-actions">';
    html += '<button class="tool-btn" data-action="did-planned" data-ex="' + exIndex + '">' + icon("check") + "Did as planned</button>";
    html += '<button class="tool-btn" data-action="add-set" data-ex="' + exIndex + '">' + icon("plus") + "Set</button>";
    if (numberOr(ds.extraSets[String(exIndex)], 0) > 0) html += '<button class="tool-btn danger" data-action="remove-set" data-ex="' + exIndex + '">' + icon("minus") + "Remove set</button>";
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
    var done = ds.completed[key];
    var draft = ds.drafts[key] || {};
    var weight = done && done.weight != null ? done.weight : draft.weight != null ? draft.weight : set.weight;
    var reps = done && done.reps != null ? done.reps : draft.reps != null ? draft.reps : set.reps;
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
    html += "</div>";
    return html;
  }

  function renderRestFab() {
    var remaining = restRemaining();
    var duration = Math.max(1, numberOr(rest.duration, state.settings.defaultRest));
    var progress = rest.running ? clamp(remaining / duration, 0, 1) : 0;
    var circumference = 2 * Math.PI * 22;
    var offset = circumference * (1 - progress);
    var html = '<aside class="rest-fab" data-active="' + String(rest.running || remaining < duration) + '">';
    html += '<div class="rest-main">';
    html += '<div class="rest-ring"><svg viewBox="0 0 52 52"><circle class="track" cx="26" cy="26" r="22"></circle><circle class="bar" cx="26" cy="26" r="22" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"></circle></svg></div>';
    html += '<div><div class="rest-small">' + escapeHtml(rest.label || "Rest") + '</div><div class="rest-time" data-rest-time>' + formatDuration(remaining) + "</div></div>";
    html += '<div class="rest-actions">';
    html += '<button class="icon-btn" data-action="rest-adjust" data-delta="-15" aria-label="Subtract 15 seconds">' + icon("minus") + "</button>";
    html += '<button class="icon-btn primary" data-action="rest-toggle" aria-label="Play pause rest timer">' + icon(rest.running ? "pause" : "play") + "</button>";
    html += '<button class="icon-btn" data-action="rest-adjust" data-delta="15" aria-label="Add 15 seconds">' + icon("plus") + "</button>";
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
      sheet.dataset.type = "";
      sheetBackdrop.dataset.open = "false";
      sheet.innerHTML = "";
      document.body.classList.remove("sheet-open");
      return;
    }
    document.body.classList.add("sheet-open");
    sheetBackdrop.dataset.open = "true";
    sheet.dataset.open = "true";
    sheet.dataset.type = runtime.sheet;
    var title = sheetTitle(runtime.sheet);
    sheet.innerHTML = '<div class="sheet-grabber" aria-hidden="true"></div><div class="sheet-head"><div class="sheet-title">' + escapeHtml(title) + '</div><button class="icon-btn" data-action="close-sheet" aria-label="Close sheet">' + icon("close") + '</button></div><div class="sheet-body">' + sheetBody(runtime.sheet) + "</div>";
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
      backup: "Backups"
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
    return '<div class="sheet-grid">' +
      fieldSelect("units", "Units", s.units, [["kg", "Kilograms"], ["lb", "Pounds"]]) +
      fieldSelect("theme", "Theme", s.theme, [["system", "System"], ["light", "Light"], ["dark", "Dark"]]) +
      fieldNumber("defaultRest", "Default rest seconds", s.defaultRest, 15, 600, 15) +
      fieldNumber("weightStep", "Weight step", s.weightStep, 0.5, 50, 0.5) +
      fieldNumber("barWeight", "Bar weight (" + unitLabel() + ")", kgToDisplay(s.barWeight), 0, 100, 0.5) +
      fieldSelect("haptics", "Haptics", s.haptics ? "true" : "false", [["true", "On"], ["false", "Off"]]) +
      fieldSelect("sound", "Sound", s.sound ? "true" : "false", [["true", "On"], ["false", "Off"]]) +
      '<div class="sheet-actions">' +
      '<button class="action-btn" data-action="export-data">' + icon("download") + "Export data</button>" +
      '<button class="action-btn secondary" data-action="import-data">' + icon("upload") + "Import data</button>" +
      '<button class="action-btn danger" data-action="reset-all">' + icon("trash") + "Reset all</button>" +
      "</div>" +
      '<p class="section-sub">Data stays in this browser. Export regularly, especially on iOS where storage can be evicted.</p>' +
      "</div>";
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

  function fieldSelect(name, label, value, options) {
    var html = '<div class="field-block"><label for="setting-' + name + '">' + escapeHtml(label) + '</label><select id="setting-' + name + '" data-action="setting" data-setting="' + name + '">';
    options.forEach(function (opt) {
      html += '<option value="' + escapeHtml(opt[0]) + '"' + (String(value) === String(opt[0]) ? " selected" : "") + ">" + escapeHtml(opt[1]) + "</option>";
    });
    return html + "</select></div>";
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

  function plateSheet() {
    var p = runtime.plate || { exerciseName: "Lift", targetKg: 0, barKg: state.settings.barWeight };
    var targetDisplay = kgToDisplay(p.targetKg);
    var barDisplay = kgToDisplay(p.barKg == null ? state.settings.barWeight : p.barKg);
    var db = isDbLift(p.exerciseName);
    var result = db ? "Per hand: " + cleanNumber(targetDisplay / 2, 1) + " " + unitLabel() : plateBreakdown(displayToKg(targetDisplay), displayToKg(barDisplay));
    return '<div class="sheet-grid">' +
      '<div class="field-block"><label>Exercise</label><input value="' + escapeHtml(p.exerciseName) + '" readonly></div>' +
      '<div class="field-block"><label for="plate-target">Target total (' + unitLabel() + ')</label><input id="plate-target" type="number" step="0.5" data-action="plate-input" data-field="target" value="' + escapeHtml(cleanNumber(targetDisplay, 1)) + '"></div>' +
      (db ? "" : '<div class="field-block"><label for="plate-bar">Bar / sled estimate (' + unitLabel() + ')</label><input id="plate-bar" type="number" step="0.5" data-action="plate-input" data-field="bar" value="' + escapeHtml(cleanNumber(barDisplay, 1)) + '"></div>') +
      '<div class="overview-card"><strong>Breakdown</strong><p>' + escapeHtml(result) + "</p></div>" +
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

  function openSheet(type, options) {
    runtime.sheet = type;
    if (type === "readiness") {
      var ds = dayState(state.activeDayId);
      runtime.readinessValue = ds.readiness || 8;
    }
    if (type === "plate" && options) {
      runtime.plate = options;
    }
    renderSheet();
  }

  function closeSheet() {
    runtime.sheet = null;
    runtime.pendingAction = null;
    renderSheet();
  }

  function isCaveatNote(note) {
    var n = String(note || "").toLowerCase();
    return /\b(if|drop|confirm|clean|irritation|shoulder|available|attempt|readiness|fatigue|ache|pain)\b/.test(n);
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
        return key.split(".")[0] === String(exIndex);
      }).map(function (key) { return completed[key]; });
      if (!values.length) continue;
      var weights = values.map(function (v) { return formatWeight(v.weight); });
      var reps = values.map(function (v) { return v.reps; });
      var sameWeight = weights.every(function (w) { return w === weights[0]; });
      var sameReps = reps.every(function (r) { return r === reps[0]; });
      return "Last: " + (sameWeight ? weights[0] + " " + unitLabel() : weights.join("/")) + " x " + (sameReps ? reps[0] : reps.join("/")) + " x" + values.length + " (Wk " + week.num + ")";
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

  function startWorkout(showToast) {
    var ds = dayState(state.activeDayId);
    if (ds.startedAt && !ds.finishedAt) return;
    if (ds.finishedAt) {
      ds.elapsedBeforeStart = workoutElapsed(state.activeDayId);
    }
    ds.startedAt = Date.now();
    ds.finishedAt = null;
    saveState();
    haptic([12, 60, 12]);
    requestWakeLock();
    if (showToast !== false) toast("Workout started.");
  }

  function finishWorkout() {
    var ds = dayState(state.activeDayId);
    if (!ds.startedAt) ds.startedAt = Date.now();
    ds.finishedAt = Date.now();
    var summary = feature("summary");
    if (summary && typeof summary.caloriesForDay === "function") {
      state.calories[state.activeDayId] = { workoutKcal: summary.caloriesForDay(makeCtx(), state.activeDayId) };
    }
    saveState();
    releaseWakeLock();
    haptic([40, 80, 40]);
    toast("Workout finished.");
    if (completedSetCount(getDay(state.activeDayId), state) > 0) {
      runtime.summaryDayId = state.activeDayId;
      if (!state.cycleReviewSeen && isCycleComplete()) {
        runtime.cycleReview = true;
        state.cycleReviewSeen = true;
        saveState();
      }
    }
    render();
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
    var plan = exerciseSets(day, exIndex)[setIndex] || { reps: 0, weight: 0 };
    var entry = ds.completed[key] || ds.drafts[key] || {};
    return {
      weight: entry.weight != null ? numberOr(entry.weight, plan.weight) : plan.weight,
      reps: entry.reps != null ? numberOr(entry.reps, plan.reps) : plan.reps
    };
  }

  function updateSetValue(exIndex, setIndex, field, rawValue, isDisplayValue) {
    var day = getDay(state.activeDayId);
    var ds = dayState(day.id);
    var key = exIndex + "." + setIndex;
    var value = field === "weight" && isDisplayValue ? displayToKg(rawValue) : numberOr(rawValue, 0);
    if (field === "reps") value = Math.max(0, Math.round(value));
    if (field === "weight") value = Math.max(0, value);
    var bucket = ds.completed[key] || ds.drafts[key] || getCurrentSetValue(day, exIndex, setIndex);
    bucket[field] = value;
    if (ds.completed[key]) ds.completed[key] = bucket;
    else ds.drafts[key] = bucket;
    saveState();
  }

  function stepSetValue(exIndex, setIndex, field, direction) {
    var day = getDay(state.activeDayId);
    var current = getCurrentSetValue(day, exIndex, setIndex);
    if (field === "reps") {
      updateSetValue(exIndex, setIndex, field, current.reps + direction, false);
    } else {
      var display = kgToDisplay(current.weight) + direction * numberOr(state.settings.weightStep, 2.5);
      updateSetValue(exIndex, setIndex, field, display, true);
    }
    haptic(3);
    render();
  }

  function toggleSet(exIndex, setIndex) {
    if (!requireWorkoutReady({ type: "toggle-set", exIndex: exIndex, setIndex: setIndex })) return;
    var day = getDay(state.activeDayId);
    var ex = day.exercises[exIndex];
    var ds = dayState(day.id);
    var key = exIndex + "." + setIndex;
    if (ds.completed[key]) {
      delete ds.completed[key];
      haptic(5);
      saveState();
      render();
      return;
    }
    var value = getCurrentSetValue(day, exIndex, setIndex);
    var prior = maxLoggedWeight(ex.name, day.id, key);
    var pr = value.weight > prior && value.weight > 0;
    ds.completed[key] = { reps: value.reps, weight: value.weight, ts: Date.now(), pr: pr };
    delete ds.drafts[key];
    if (pr) {
      state.prs[ex.name] = { weight: value.weight, reps: value.reps, date: day.id };
      toast("PR: " + ex.name + " at " + formatWeight(value.weight) + " " + unitLabel() + ".");
    }
    haptic(pr ? [10, 50, 20] : 8);
    startRest(numberOr(ex.defaultRest, state.settings.defaultRest), ex.name);
    saveState();
    render();
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
    var ex = day.exercises[exIndex];
    var ds = dayState(day.id);
    var sets = exerciseSets(day, exIndex);
    var prCount = 0;
    sets.forEach(function (set, setIndex) {
      var key = exIndex + "." + setIndex;
      var prior = maxLoggedWeight(ex.name, day.id, key);
      var pr = set.weight > prior && set.weight > 0;
      if (pr) prCount += 1;
      ds.completed[key] = { reps: set.reps, weight: set.weight, ts: Date.now(), pr: pr };
      delete ds.drafts[key];
    });
    if (prCount) {
      var top = Math.max.apply(null, sets.map(function (s) { return s.weight; }));
      state.prs[ex.name] = { weight: top, reps: sets[0] ? sets[0].reps : 0, date: day.id };
      toast("PR logged for " + ex.name + ".");
    } else {
      toast("Exercise completed as planned.");
    }
    haptic(prCount ? [10, 50, 20] : [8, 30, 8]);
    startRest(numberOr(ex.defaultRest, state.settings.defaultRest), ex.name);
    saveState();
    render();
  }

  function addSet(exIndex) {
    var ds = dayState(state.activeDayId);
    var key = String(exIndex);
    ds.extraSets[key] = numberOr(ds.extraSets[key], 0) + 1;
    saveState();
    render();
  }

  function removeSet(exIndex) {
    var day = getDay(state.activeDayId);
    var ds = dayState(day.id);
    var key = String(exIndex);
    var count = numberOr(ds.extraSets[key], 0);
    if (count <= 0) return;
    var removeIndex = (day.exercises[exIndex].sets || []).length + count - 1;
    delete ds.completed[exIndex + "." + removeIndex];
    delete ds.drafts[exIndex + "." + removeIndex];
    ds.extraSets[key] = count - 1;
    if (ds.extraSets[key] <= 0) delete ds.extraSets[key];
    saveState();
    render();
  }

  function baselineForExercise(name) {
    var baselines = ((PLAN.meta || {}).baselines || []);
    var lower = String(name || "").toLowerCase();
    var best = baselines.find(function (b) {
      var label = String(b.label || "").toLowerCase();
      if (lower.indexOf("incline db") >= 0 && label.indexOf("incline db") >= 0) return true;
      if (lower.indexOf("leg press") >= 0 && label.indexOf("leg press") >= 0) return true;
      if (lower.indexOf("chest press") >= 0 && label.indexOf("machine chest") >= 0) return true;
      if (lower.indexOf("cable row") >= 0 && label.indexOf("cable row") >= 0) return true;
      return false;
    });
    return best ? numberOr(best.value, 0) : 0;
  }

  function maxLoggedWeight(name, dayId, excludeKey) {
    var max = baselineForExercise(name);
    allDays().forEach(function (entry) {
      if (entry.day.id > dayId) return;
      (entry.day.exercises || []).forEach(function (ex, exIndex) {
        if (ex.name !== name) return;
        var completed = ((state.days[entry.day.id] || {}).completed || {});
        Object.keys(completed).forEach(function (key) {
          if (entry.day.id === dayId && key === excludeKey) return;
          if (key.split(".")[0] !== String(exIndex)) return;
          max = Math.max(max, numberOr(completed[key].weight, 0));
        });
      });
    });
    return max;
  }

  function startRest(seconds, label) {
    var duration = Math.max(1, numberOr(seconds, state.settings.defaultRest));
    rest = { duration: duration, endsAt: Date.now() + duration * 1000, pausedRemaining: duration, running: true, label: label || "Rest" };
    saveRest();
    maybeRequestNotificationPermission();
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
    saveRest();
    render();
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
    }
    saveRest();
    render();
  }

  function presetRest(seconds) {
    rest = { duration: seconds, pausedRemaining: seconds, endsAt: 0, running: false, label: "Rest" };
    saveRest();
    render();
  }

  function completeRestIfNeeded() {
    if (!rest.running || restRemaining() > 0) return;
    rest.running = false;
    rest.pausedRemaining = 0;
    rest.endsAt = 0;
    saveRest();
    notifyRestDone();
    render();
  }

  function notifyRestDone() {
    if (state.settings.haptics && navigator.vibrate) navigator.vibrate([160, 80, 160]);
    if (state.settings.sound) beep();
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification("Rest complete", { body: "Next set is ready.", icon: "./icons/icon-192.png" }); } catch (err) {}
    }
    toast("Rest complete.");
  }

  function maybeRequestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
    if (Notification.permission === "default") {
      try { Notification.requestPermission(); } catch (err) {}
    }
  }

  function beep() {
    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      var ctx = new AudioContext();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
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
    if (fab) fab.dataset.active = String(rest.running || remaining < numberOr(rest.duration, state.settings.defaultRest));
  }

  function buildLog(scope) {
    var entries = [];
    if (scope === "day") {
      var day = getDay(state.activeDayId);
      entries = [{ week: getWeek(state.activeWeekId), day: day }];
    } else if (scope === "week") {
      var week = getWeek(state.activeWeekId);
      entries = (week.days || []).map(function (day) { return { week: week, day: day }; });
    } else {
      entries = allDays();
    }
    var lines = [];
    lines.push("Lift - " + ((PLAN.meta || {}).title || "Progressive Overload"));
    lines.push("Scope: " + scope);
    lines.push("");
    entries.forEach(function (entry) {
      var day = entry.day;
      var ds = state.days[day.id] || {};
      var total = totalSetCountForSource(day, state);
      var completed = completedSetCount(day, state);
      lines.push("Week " + entry.week.num + " - " + day.id + " - " + (day.title || "Day"));
      if (!total) {
        lines.push("  Rest: " + (day.footer || day.note || day.subtitle || ""));
      } else {
        lines.push("  Sets: " + completed + "/" + total + " | Volume: " + cleanNumber(kgToDisplay(completedVolume(day)), 0) + " " + unitLabel() + " | Time: " + formatDuration(workoutElapsed(day.id)));
        if (ds.readiness != null) lines.push("  Readiness: " + ds.readiness + "/10");
        (day.exercises || []).forEach(function (ex, exIndex) {
          var setLines = exerciseSets(day, exIndex).map(function (set, setIndex) {
            var key = exIndex + "." + setIndex;
            var done = ((ds.completed || {})[key]);
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
    var payload = JSON.stringify(state, null, 2);
    var blob = new Blob([payload], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "lift-backup-" + todayId() + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function importData() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var imported = JSON.parse(String(reader.result || "{}"));
          if (!imported || imported.v !== 2) throw new Error("Expected lift.v2 backup");
          var merge = confirm("Merge imported data with current data? Press Cancel to replace current data.");
          if (merge) {
            state.days = Object.assign({}, state.days || {}, imported.days || {});
            state.bodyweight = mergeBodyweight(state.bodyweight || [], imported.bodyweight || []);
            state.prs = Object.assign({}, state.prs || {}, imported.prs || {});
            state.settings = Object.assign({}, state.settings, imported.settings || {});
          } else {
            state = Object.assign({ v: 2 }, imported);
            state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
          }
          var selection = chooseInitialSelection(state);
          state.activeWeekId = selection.weekId;
          state.activeDayId = selection.dayId;
          saveState();
          applyTheme(state.settings.theme);
          toast("Import complete.");
          render();
        } catch (err) {
          toast("Import failed: " + err.message);
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function mergeBodyweight(a, b) {
    var map = {};
    a.concat(b).forEach(function (row) {
      if (row && row.date) map[row.date] = { date: row.date, kg: numberOr(row.kg, 0) };
    });
    return Object.keys(map).sort().map(function (date) { return map[date]; });
  }

  function resetAll() {
    if (!confirm("Reset all Lift data in this browser? Export first if you need a backup.")) return;
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem(REST_KEY);
    } catch (err) {}
    state = loadState();
    rest = idleRest();
    applyTheme(state.settings.theme);
    toast("All local data reset.");
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
    var total = 0;
    var done = 0;
    allDays().forEach(function (entry) {
      (entry.day.exercises || []).forEach(function (ex, exIndex) {
        total += (ex.sets || []).length;
        var completed = ((state.days[entry.day.id] || {}).completed || {});
        for (var i = 0; i < (ex.sets || []).length; i += 1) {
          if (completed[exIndex + "." + i]) done += 1;
        }
      });
    });
    return total ? Math.round((done / total) * 100) : 0;
  }

  function trainingStreak() {
    var today = todayId();
    var days = allDays().filter(function (entry) {
      return (entry.day.exercises || []).length && entry.day.id <= today;
    }).sort(function (a, b) { return b.day.id.localeCompare(a.day.id); });
    var count = 0;
    for (var i = 0; i < days.length; i += 1) {
      if (dayStatus(days[i].day, state) !== "done") break;
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

  async function downloadDayImage() {
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
        var done = ds.completed[exIndex + "." + setIndex];
        var v = done || set;
        return (done ? "done " : "open ") + formatWeight(v.weight) + " " + unitLabel() + " x " + v.reps;
      }).join("   ");
      wrapCanvasText(ctx, sets, 90, y, 1020, 36);
      y += 78;
      ctx.font = "700 36px system-ui, sans-serif";
    });
    canvas.toBlob(async function (blob) {
      if (!blob) return;
      var file = new File([blob], "lift-" + day.id + ".png", { type: "image/png" });
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

  function haptic(pattern) {
    if (state.settings.haptics && navigator.vibrate) navigator.vibrate(pattern);
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

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      render();
    });
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
      saveState();
      closeSheet();
      render();
    } else if (action === "select-day") {
      state.activeDayId = btn.dataset.day;
      state.activeWeekId = (weekForDayId(state.activeDayId) || getWeek(state.activeWeekId)).id;
      saveState();
      closeSheet();
      render();
    } else if (action === "today") {
      var selection = chooseInitialSelection(state);
      state.activeWeekId = selection.weekId;
      state.activeDayId = selection.dayId;
      saveState();
      render();
    } else if (action === "cycle-theme") {
      var current = state.settings.theme === "dark" ? "light" : state.settings.theme === "light" ? "system" : "dark";
      state.settings.theme = current;
      applyTheme(current);
      saveState();
      render();
    } else if (action === "open-sheet") {
      openSheet(btn.dataset.sheet);
    } else if (action === "dismiss-recap") {
      state.weeklyRecapDismissedIso = btn.dataset.iso || isoWeekId(parseDateId(todayId()));
      saveState();
      render();
    } else if (action === "dismiss-summary") {
      runtime.summaryDayId = null;
      runtime.cycleReview = false;
      renderSummaryOverlay();
    } else if (action === "close-sheet") {
      closeSheet();
    } else if (action === "start-workout") {
      requireWorkoutReady(null);
      render();
    } else if (action === "finish-workout") {
      finishWorkout();
    } else if (action === "reset-day") {
      if (confirm("Reset this day's logged sets, timer, readiness, and notes?")) {
        delete state.days[state.activeDayId];
        saveState();
        render();
      }
    } else if (action === "toggle-set") {
      toggleSet(Number(btn.dataset.ex), Number(btn.dataset.set));
    } else if (action === "set-step") {
      stepSetValue(Number(btn.dataset.ex), Number(btn.dataset.set), btn.dataset.field, Number(btn.dataset.delta));
    } else if (action === "did-planned") {
      didAsPlanned(Number(btn.dataset.ex));
    } else if (action === "add-set") {
      addSet(Number(btn.dataset.ex));
    } else if (action === "remove-set") {
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
    } else if (action === "copy-scope") {
      runtime.copyScope = btn.dataset.scope;
      renderSheet();
    } else if (action === "copy-log") {
      copyText(buildLog(runtime.copyScope || "day")).then(function () { toast("Log copied."); }).catch(function () { toast("Clipboard blocked. Long-press the log text to copy."); });
    } else if (action === "share-log") {
      var text = buildLog(runtime.copyScope || "day");
      if (navigator.share) navigator.share({ title: "Lift log", text: text }).catch(function () {});
      else copyText(text).then(function () { toast("Share unavailable. Log copied instead."); }).catch(function () { toast("Share unavailable. Long-press the log text to copy."); });
    } else if (action === "share-image") {
      downloadDayImage();
    } else if (action === "summary-share") {
      downloadDayImage();
    } else if (action === "summary-review") {
      runtime.summaryDayId = null;
      runtime.cycleReview = false;
      openSheet("journal");
      renderSummaryOverlay();
    } else if (action === "save-readiness") {
      var input = sheet.querySelector("[data-action='readiness-input']");
      dayState(state.activeDayId).readiness = Number(input ? input.value : runtime.readinessValue || 8);
      startWorkout(false);
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
      if (shareCloud && typeof shareCloud.shareBackup === "function") shareCloud.shareBackup(makeCtx());
    } else if (action === "backup-restore") {
      importData();
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
      toast("Library workouts are saved templates. Copy them into the plan manually for now.");
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
      renderSheet();
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
      var key = target.dataset.setting;
      var value = target.value;
      if (key === "defaultRest") state.settings.defaultRest = clamp(numberOr(value, 90), 15, 600);
      else if (key === "weightStep") state.settings.weightStep = Math.max(0.5, numberOr(value, 2.5));
      else if (key === "barWeight") state.settings.barWeight = displayToKg(value);
      else if (key === "haptics" || key === "sound") state.settings[key] = value === "true";
      else if (key === "goal-weeklySessions") state.goals.weeklySessions = clamp(numberOr(value, DEFAULT_GOALS.weeklySessions), 1, 14);
      else if (key === "goal-weeklyVolumeKg") state.goals.weeklyVolumeKg = displayToKg(value);
      else if (key === "goal-dailySteps") state.goals.dailySteps = clamp(numberOr(value, DEFAULT_GOALS.dailySteps), 100, 100000);
      else if (key === "goal-monthlyVolumeKg") state.goals.monthlyVolumeKg = displayToKg(value);
      else state.settings[key] = value;
      if (key === "theme") applyTheme(state.settings.theme);
      saveState();
      render();
    } else if (action === "progress-exercise") {
      runtime.progressExercise = target.value;
      renderSheet();
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!location.protocol.startsWith("http")) {
      console.info("Service worker skipped outside http/https.");
      return;
    }
    navigator.serviceWorker.register("./sw.js").then(function () {
      console.info("Lift service worker registered.");
    }).catch(function (err) {
      console.warn("Lift service worker registration failed.", err);
    });
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      toast("Offline app updated. Reload when convenient.");
    });
  }

  function init() {
    applyTheme(state.settings.theme);
    saveState();
    render();
    registerServiceWorker();
    setInterval(function () {
      completeRestIfNeeded();
      refreshTimers();
    }, 1000);
    document.addEventListener("click", handleClick);
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);
    sheetBackdrop.addEventListener("click", closeSheet);
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

  init();
})();
