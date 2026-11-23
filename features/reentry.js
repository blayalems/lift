(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function isValidDateId(id) {
    var match = DATE_RE.exec(String(id || ""));
    if (!match) return false;
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function utcMs(id) {
    var match = DATE_RE.exec(String(id || ""));
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function localTodayId() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function hasVerifiedReps(dayState) {
    var completed = dayState && dayState.completed;
    if (!completed || typeof completed !== "object") return false;
    return Object.keys(completed).some(function (key) {
      return Number(completed[key] && completed[key].reps) > 0;
    });
  }

  function isTrainedSession(dayState) {
    if (!dayState || typeof dayState !== "object") return false;
    if (hasVerifiedReps(dayState)) return true;
    return dayState.status === "reconstructed" && dayState.trained !== false;
  }

  function daysSinceLastWorkout(ctx, referenceDate) {
    var ref = referenceDate || (ctx && typeof ctx.todayId === "function" && ctx.todayId()) || localTodayId();
    if (!isValidDateId(ref)) return null;
    var stateDays = (ctx && ctx.state && ctx.state.days) || {};
    var seen = {};
    var candidates = [];

    if (ctx && typeof ctx.allDays === "function") {
      (ctx.allDays() || []).forEach(function (entry) {
        var id = entry && entry.day && entry.day.id;
        if (id && !seen[id]) {
          seen[id] = true;
          candidates.push(id);
        }
      });
    }
    Object.keys(stateDays).forEach(function (id) {
      if (!seen[id]) {
        seen[id] = true;
        candidates.push(id);
      }
    });

    var lastDate = null;
    candidates.forEach(function (id) {
      if (!isValidDateId(id) || id >= ref) return;
      if (isTrainedSession(stateDays[id]) && (!lastDate || id > lastDate)) {
        lastDate = id;
      }
    });

    if (!lastDate) return null;
    var days = Math.round((utcMs(ref) - utcMs(lastDate)) / 86400000);
    return { days: days, lastDate: lastDate };
  }

  function resolveActiveWeek(ctx) {
    var state = (ctx && ctx.state) || {};
    var week = null;
    if (ctx && typeof ctx.getWeek === "function" && state.activeWeekId) {
      week = ctx.getWeek(state.activeWeekId);
    }
    if (!week && ctx && typeof ctx.weekForDayId === "function" && state.activeDayId) {
      week = ctx.weekForDayId(state.activeDayId);
    }
    if (!week && ctx && typeof ctx.allDays === "function" && state.activeDayId) {
      var match = (ctx.allDays() || []).find(function (entry) {
        return entry && entry.day && entry.day.id === state.activeDayId;
      });
      if (match) week = match.week || null;
    }
    return week;
  }

  function normalizePhaseValue(ctx, phase) {
    if (ctx && typeof ctx.normalizePhase === "function") return ctx.normalizePhase(phase);
    return String(phase || "").toLowerCase().replace(/\s+/g, "");
  }

  function shouldShowBanner(ctx) {
    if (!ctx || !ctx.state) return false;
    var week = resolveActiveWeek(ctx);
    var activeWeekId = ctx.state.activeWeekId || (week && week.id) || null;
    if (activeWeekId != null && ctx.state.reentryDismissedWeekId === activeWeekId) return false;
    var phase = week ? normalizePhaseValue(ctx, week.phase) : "";
    var refDate = ctx.state.activeDayId || (typeof ctx.todayId === "function" && ctx.todayId()) || localTodayId();
    var gap = daysSinceLastWorkout(ctx, refDate);
    return (!!(gap && gap.days >= 14) || phase === "reentry");
  }

  function renderBanner(ctx) {
    var esc = (ctx && typeof ctx.escapeHtml === "function") ? ctx.escapeHtml : escapeHtml;
    var state = (ctx && ctx.state) || {};
    var week = resolveActiveWeek(ctx);
    var activeWeekId = state.activeWeekId || (week && week.id) || "";
    var refDate = state.activeDayId || (ctx && typeof ctx.todayId === "function" && ctx.todayId()) || localTodayId();
    var gap = daysSinceLastWorkout(ctx, refDate);
    var heading = gap
      ? "Welcome back after " + gap.days + (gap.days === 1 ? " day" : " days")
      : "Reentry Week";
    var body = gap
      ? "Last logged workout: " + gap.lastDate + ". Keep 2-3 RIR and rebuild grooves cleanly before chasing peak loads."
      : "Keep 2-3 RIR and rebuild grooves cleanly before pushing heavier working loads.";

    return '<section class="reentry-banner" aria-label="Gym reentry">' +
      '<div class="reentry-title">' + esc(heading) + '</div>' +
      '<div class="reentry-text">' + esc(body) + '</div>' +
      '<div class="reentry-actions">' +
      '<button class="action-btn" data-action="reentry-start">Start reentry session</button>' +
      '<button class="action-btn secondary" data-action="open-sheet" data-sheet="measurements">Log weight / waist</button>' +
      '<button class="action-btn secondary" data-action="reentry-dismiss" data-week="' + esc(activeWeekId) + '">Dismiss</button>' +
      '</div>' +
      '</section>';
  }

  function formatWeightNum(value, unit) {
    var decimals = unit === "lb" ? 1 : 2;
    var rounded = Number(Number(value).toFixed(decimals));
    return String(rounded);
  }

  function dumbbellPerHandText(exercise, weightKg, ctx) {
    if (!exercise || exercise.weightMode !== "total") return "";
    if (!/\b(db|dumbbell)\b/i.test(String(exercise.name || ""))) return "";
    var kg = Number(weightKg);
    if (!Number.isFinite(kg) || kg <= 0) return "";
    var display = (ctx && typeof ctx.kgToDisplay === "function") ? Number(ctx.kgToDisplay(kg)) : kg;
    if (!Number.isFinite(display) || display <= 0) return "";
    var unit = (ctx && typeof ctx.unitLabel === "function" && ctx.unitLabel()) || "kg";
    return formatWeightNum(display, unit) + " " + unit + " total = " + formatWeightNum(display / 2, unit) + " " + unit + " per hand";
  }

  root.reentry = {
    daysSinceLastWorkout: daysSinceLastWorkout,
    shouldShowBanner: shouldShowBanner,
    renderBanner: renderBanner,
    dumbbellPerHandText: dumbbellPerHandText,
    formatWeightHint: dumbbellPerHandText
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.reentry;
})();
