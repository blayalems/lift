(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var STATUSES = ["completed", "planned", "rest", "missed", "unknown", "reconstructed"];

  function validCompletedSet(dayState) {
    var completed = dayState && dayState.completed || {};
    return Object.keys(completed).some(function (key) {
      return Number((completed[key] || {}).reps) > 0;
    });
  }

  function resolveStatus(day, dayState, todayId) {
    var ds = dayState && typeof dayState === "object" ? dayState : null;
    var explicit = ds && ds.status;
    if (validCompletedSet(ds)) return "completed";
    if (explicit === "reconstructed" && ds.trained !== false) return "reconstructed";
    if (explicit === "missed") return "missed";
    if (explicit === "unknown") return "unknown";
    if (explicit === "rest") return "rest";
    if (explicit === "completed") return ds && ds.trained === true ? "reconstructed" : "unknown";
    if (!day || !(day.exercises || []).length) return "rest";
    if (explicit === "planned") return !todayId || day.id >= todayId ? "planned" : "unknown";
    if (!todayId || day.id >= todayId) return "planned";
    // An unlogged past prescription is not evidence that training did not occur.
    return "unknown";
  }

  function isTrainedStatus(status) {
    return status === "completed" || status === "reconstructed";
  }

  function markReconstructed(state, date, workoutType, notes) {
    state.days = state.days || {};
    var ds = state.days[date] = state.days[date] || {};
    ds.status = "reconstructed";
    ds.source = "user-reconstructed";
    ds.trained = true;
    ds.reconstructedAt = Date.now();
    ds.workoutType = String(workoutType || "").trim() || null;
    ds.notes = String(notes || "").trim();
    // Do not add a completed-set bucket or inferred performance. Existing
    // verified sets, if any, remain untouched and take precedence in status.
    state.history = state.history || {};
    state.history.reconstructedCount = Object.keys(state.days).filter(function (id) {
      return state.days[id] && state.days[id].status === "reconstructed" && state.days[id].trained !== false;
    }).length;
    return ds;
  }

  function markStatus(state, date, status, notes) {
    if (STATUSES.indexOf(status) < 0) throw new Error("Unsupported history status");
    if (status === "reconstructed") return markReconstructed(state, date, null, notes);
    state.days = state.days || {};
    var ds = state.days[date] = state.days[date] || {};
    if (status === "completed" && !validCompletedSet(ds)) return markReconstructed(state, date, null, notes);
    ds.status = status;
    ds.source = "user-marked";
    ds.trained = status === "completed";
    if (notes != null) ds.notes = String(notes).trim();
    return ds;
  }

  function adherence(ctx, asOf) {
    var today = asOf || (ctx.todayId && ctx.todayId()) || "9999-12-31";
    var result = { completed: 0, reconstructed: 0, missed: 0, unknown: 0, rest: 0, planned: 0, reliable: 0, adherencePct: null };
    (ctx.allDays ? ctx.allDays() : []).forEach(function (entry) {
      if (!entry || !entry.day || entry.day.id > today) return;
      var status = resolveStatus(entry.day, (ctx.state.days || {})[entry.day.id], today);
      result[status] += 1;
      if (status === "completed" || status === "reconstructed" || status === "missed") result.reliable += 1;
    });
    if (result.reliable) result.adherencePct = Math.round(((result.completed + result.reconstructed) / result.reliable) * 100);
    return result;
  }

  function dateDistanceDays(fromId, toId) {
    var a = new Date(String(fromId) + "T00:00:00Z");
    var b = new Date(String(toId) + "T00:00:00Z");
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
    return Math.round((b - a) / 86400000);
  }

  function streakMetrics(ctx, asOf) {
    var today = asOf || (ctx.todayId && ctx.todayId()) || "9999-12-31";
    var entries = (ctx.allDays ? ctx.allDays() : []).filter(function (entry) {
      return entry && entry.day && entry.day.id <= today && (entry.day.exercises || []).length;
    }).sort(function (a, b) { return b.day.id.localeCompare(a.day.id); });
    var combined = 0;
    var reconstructed = 0;
    var started = false;
    var anchorDate = today !== "9999-12-31" ? today : (entries[0] ? entries[0].day.id : null);
    for (var i = 0; i < entries.length; i += 1) {
      var entryId = entries[i].day.id;
      var status = resolveStatus(entries[i].day, (ctx.state.days || {})[entryId], today);
      if (entryId === today && status === "planned" && !started) continue;
      if (anchorDate && dateDistanceDays(entryId, anchorDate) > 14) break;
      if (status === "unknown") continue;
      if (status === "missed" || status === "planned") break;
      if (isTrainedStatus(status)) {
        started = true;
        combined += 1;
        anchorDate = entryId;
        if (status === "reconstructed") reconstructed += 1;
      }
    }

    var ascending = entries.slice().reverse();
    var verifiedRun = 0;
    var longestVerified = 0;
    ascending.forEach(function (entry) {
      var status = resolveStatus(entry.day, (ctx.state.days || {})[entry.day.id], today);
      if (status === "completed") {
        verifiedRun += 1;
        longestVerified = Math.max(longestVerified, verifiedRun);
      } else {
        verifiedRun = 0;
      }
    });
    return { current: combined, reconstructedInCurrent: reconstructed, longestVerified: longestVerified };
  }

  function statusLabel(status) {
    return ({
      completed: "Verified workout",
      reconstructed: "Trained - details unavailable",
      planned: "Planned",
      rest: "Rest",
      missed: "Missed",
      unknown: "Unknown - no surviving data"
    })[status] || "Unknown";
  }

  function renderHistoryEditor(ctx, date) {
    var day = ctx.getDay && ctx.getDay(date);
    var ds = (ctx.state.days || {})[date] || {};
    var status = resolveStatus(day, ds, ctx.todayId());
    var workoutType = ds.workoutType || (day && day.title) || "";
    return '<div class="sheet-grid">' +
      '<div class="overview-card history-status" data-status="' + ctx.escapeHtml(status) + '"><strong>' + ctx.escapeHtml(date) + '</strong><p>' + ctx.escapeHtml(statusLabel(status)) + '. Unknown dates are excluded from adherence rather than treated as failures.</p></div>' +
      '<div class="field-block"><label for="history-type">Workout type / split remembered</label><input id="history-type" data-history-type value="' + ctx.escapeHtml(workoutType) + '" placeholder="Back + biceps"></div>' +
      '<div class="field-block"><label for="history-notes">Optional notes</label><textarea id="history-notes" data-history-notes placeholder="Trained after work; set details were lost">' + ctx.escapeHtml(ds.notes || "") + '</textarea></div>' +
      '<div class="sheet-actions"><button class="action-btn" data-action="history-reconstruct" data-date="' + ctx.escapeHtml(date) + '">I trained - details unavailable</button>' +
      '<button class="action-btn secondary" data-action="history-mark" data-status="unknown" data-date="' + ctx.escapeHtml(date) + '">Keep unknown</button>' +
      '<button class="action-btn secondary" data-action="history-mark" data-status="missed" data-date="' + ctx.escapeHtml(date) + '">Mark truly missed</button></div>' +
      '<p class="section-sub">Reconstructed sessions can support consistency metrics, but never create weights, reps, volume, calories, or PRs.</p></div>';
  }

  root.history = {
    STATUSES: STATUSES,
    resolveStatus: resolveStatus,
    isTrainedStatus: isTrainedStatus,
    markReconstructed: markReconstructed,
    markStatus: markStatus,
    adherence: adherence,
    streakMetrics: streakMetrics,
    statusLabel: statusLabel,
    renderHistoryEditor: renderHistoryEditor
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.history;
})();
