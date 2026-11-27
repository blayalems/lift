(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function fallbackEscapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function esc(ctx, value) {
    return ctx && typeof ctx.escapeHtml === "function" ? ctx.escapeHtml(value) : fallbackEscapeHtml(value);
  }

  function sanitizeGoal(value, fallback) {
    if (value == null || value === "") return fallback;
    var n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, n);
  }

  function ensureGoals(ctx) {
    var defaults = (ctx && ctx.defaultGoals) || {};
    var raw = Object.assign({}, defaults, (ctx && ctx.state && ctx.state.goals) || {});
    var sanitized = {};
    Object.keys(raw).forEach(function (key) {
      sanitized[key] = sanitizeGoal(raw[key], defaults[key] != null ? Number(defaults[key]) : 0);
    });
    if (ctx && ctx.state) ctx.state.goals = sanitized;
    return sanitized;
  }

  function parseUtcDate(dateId) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateId || ""));
    if (!match) return null;
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }

  function formatUtcDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function weekBounds(dateId) {
    var d = parseUtcDate(dateId);
    if (!d) return null;
    var day = (d.getUTCDay() + 6) % 7;
    var start = new Date(d.getTime());
    start.setUTCDate(d.getUTCDate() - day);
    var end = new Date(start.getTime());
    end.setUTCDate(start.getUTCDate() + 6);
    return { start: formatUtcDate(start), end: formatUtcDate(end) };
  }

  function monthBounds(dateId) {
    var d = parseUtcDate(dateId);
    if (!d) return null;
    var y = d.getUTCFullYear();
    var m = d.getUTCMonth();
    return {
      start: formatUtcDate(new Date(Date.UTC(y, m, 1))),
      end: formatUtcDate(new Date(Date.UTC(y, m + 1, 0)))
    };
  }

  function inBounds(id, bounds) {
    if (!bounds || !id || !parseUtcDate(id)) return false;
    var dateStr = String(id);
    return dateStr >= bounds.start && dateStr <= bounds.end;
  }

  function metrics(ctx, dateId) {
    var goals = ensureGoals(ctx);
    var targetDate = dateId || (ctx && typeof ctx.todayId === "function" && ctx.todayId()) || "";
    var bounds = weekBounds(targetDate);
    var month = monthBounds(targetDate);
    var sessions = 0;
    var volume = 0;
    var monthlyVolume = 0;
    var points = 0;
    var stateDays = (ctx && ctx.state && ctx.state.days) || {};
    (ctx && typeof ctx.allDays === "function" ? ctx.allDays() : []).forEach(function (entry) {
      if (!entry || !entry.day || !entry.day.id) return;
      var dayVol = typeof ctx.completedVolume === "function" ? ctx.completedVolume(entry.day) : 0;
      if (inBounds(entry.day.id, month)) monthlyVolume += dayVol;
      if (!inBounds(entry.day.id, bounds)) return;
      var ds = stateDays[entry.day.id] || {};
      var setCount = typeof ctx.completedSetCount === "function" ? ctx.completedSetCount(entry.day, ctx.state) : 0;
      if (ds.finishedAt && setCount > 0) sessions += 1;
      volume += dayVol;
      if (root.summary && root.summary.liftPointsForDay && setCount > 0) {
        points += root.summary.liftPointsForDay(ctx, entry.day.id);
      }
    });
    var steps = Number((((ctx && ctx.state && ctx.state.steps) || {})[targetDate] || {}).count || 0) || 0;
    return {
      train: { value: sessions, goal: goals.weeklySessions, pct: pct(sessions, goals.weeklySessions) },
      volume: { value: volume, goal: goals.weeklyVolumeKg, pct: pct(volume, goals.weeklyVolumeKg) },
      monthlyVolume: { value: monthlyVolume, goal: goals.monthlyVolumeKg, pct: pct(monthlyVolume, goals.monthlyVolumeKg) },
      move: { value: steps, goal: goals.dailySteps, pct: pct(steps, goals.dailySteps) },
      points: points
    };
  }

  function pct(value, goal) {
    var v = Number(value);
    var g = Number(goal);
    return Number.isFinite(v) && Number.isFinite(g) && g > 0 ? Math.min(1, Math.max(0, v / g)) : 0;
  }

  function renderRings(ctx) {
    var targetDate = ctx && typeof ctx.todayId === "function" ? ctx.todayId() : "";
    var m = metrics(ctx, targetDate);
    var html = '<div class="sheet-grid">';
    html += '<div class="ring-row">';
    html += ring(ctx, "Train", m.train.pct, m.train.value + "/" + m.train.goal + " sessions", "#e63b5d");
    html += ring(ctx, "Volume", m.volume.pct, ctx.cleanNumber(ctx.kgToDisplay(m.volume.value), 0) + "/" + ctx.cleanNumber(ctx.kgToDisplay(m.volume.goal), 0) + " " + ctx.unitLabel(), "#1b9a9a");
    html += ring(ctx, "Move", m.move.pct, m.move.value + "/" + m.move.goal + " steps", "#2fa862");
    html += '</div>';
    html += '<div class="metric-grid">';
    html += metric(ctx, "Lift Points", String(m.points));
    html += metric(ctx, "Cycle adherence", ctx.cycleAdherence() + "%");
    html += metric(ctx, "Training streak", ctx.trainingStreak() + " days");
    html += metric(ctx, "Monthly volume", ctx.cleanNumber(ctx.kgToDisplay(m.monthlyVolume.value), 0) + "/" + ctx.cleanNumber(ctx.kgToDisplay(m.monthlyVolume.goal), 0) + " " + ctx.unitLabel() + " (" + Math.round(m.monthlyVolume.pct * 100) + "%)");
    html += '</div>';
    html += '<div class="sheet-actions"><button class="action-btn secondary" data-action="open-sheet" data-sheet="goals">' + ctx.icon("gear") + 'Edit goals</button><button class="action-btn secondary" data-action="open-sheet" data-sheet="steps">' + ctx.icon("today") + 'Steps</button></div>';
    html += '</div>';
    return html;
  }

  function ring(ctx, label, percent, sub, color) {
    var safePct = Number.isFinite(Number(percent)) ? Math.min(1, Math.max(0, Number(percent))) : 0;
    var c = 2 * Math.PI * 42;
    var off = c * (1 - safePct);
    return '<div class="ring-card"><svg viewBox="0 0 108 108"><circle cx="54" cy="54" r="42" stroke="currentColor" stroke-width="13" opacity=".14" fill="none"/><circle cx="54" cy="54" r="42" stroke="' + esc(ctx, color) + '" stroke-width="13" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" fill="none"/></svg><div class="ring-label">' + esc(ctx, label) + ' ' + Math.round(safePct * 100) + '%</div><div class="ring-sub">' + esc(ctx, sub) + '</div></div>';
  }

  function metric(ctx, label, value) {
    return '<div class="metric-card"><div class="label">' + esc(ctx, label) + '</div><div class="value">' + esc(ctx, value) + '</div></div>';
  }

  root.rings = {
    ensureGoals: ensureGoals,
    metrics: metrics,
    renderRings: renderRings
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.rings;
})();
