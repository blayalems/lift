(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function ensureGoals(ctx) {
    ctx.state.goals = Object.assign({}, ctx.defaultGoals || {}, ctx.state.goals || {});
    return ctx.state.goals;
  }

  function weekBounds(dateId) {
    var d = new Date(dateId + "T00:00:00");
    var day = (d.getDay() + 6) % 7;
    var start = new Date(d);
    start.setDate(d.getDate() - day);
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: start, end: end };
  }

  function inBounds(id, bounds) {
    var d = new Date(id + "T00:00:00");
    return d >= bounds.start && d <= bounds.end;
  }

  function metrics(ctx, dateId) {
    var goals = ensureGoals(ctx);
    var bounds = weekBounds(dateId || ctx.todayId());
    var sessions = 0;
    var volume = 0;
    var points = 0;
    ctx.allDays().forEach(function (entry) {
      if (!inBounds(entry.day.id, bounds)) return;
      var ds = ctx.state.days[entry.day.id] || {};
      if (ds.finishedAt && ctx.completedSetCount(entry.day, ctx.state) > 0) sessions += 1;
      volume += ctx.completedVolume(entry.day);
      if (root.summary && root.summary.liftPointsForDay) points += root.summary.liftPointsForDay(ctx, entry.day.id);
    });
    var steps = ((ctx.state.steps || {})[dateId || ctx.todayId()] || {}).count || 0;
    return {
      train: { value: sessions, goal: goals.weeklySessions, pct: pct(sessions, goals.weeklySessions) },
      volume: { value: volume, goal: goals.weeklyVolumeKg, pct: pct(volume, goals.weeklyVolumeKg) },
      move: { value: steps, goal: goals.dailySteps, pct: pct(steps, goals.dailySteps) },
      points: points
    };
  }

  function pct(value, goal) {
    return goal ? Math.min(1, Math.max(0, value / goal)) : 0;
  }

  function renderRings(ctx) {
    var m = metrics(ctx, ctx.todayId());
    var html = '<div class="sheet-grid">';
    html += '<div class="ring-row">';
    html += ring(ctx, "Train", m.train.pct, m.train.value + "/" + m.train.goal + " sessions", "#e63b5d");
    html += ring(ctx, "Volume", m.volume.pct, ctx.cleanNumber(ctx.kgToDisplay(m.volume.value), 0) + "/" + ctx.cleanNumber(ctx.kgToDisplay(m.volume.goal), 0) + " " + ctx.unitLabel(), "#1b9a9a");
    html += ring(ctx, "Move", m.move.pct, m.move.value + "/" + m.move.goal + " steps", "#2fa862");
    html += '</div>';
    html += '<div class="metric-grid">';
    html += metric("Lift Points", String(m.points));
    html += metric("Cycle adherence", ctx.cycleAdherence() + "%");
    html += metric("Training streak", ctx.trainingStreak() + " days");
    html += metric("Today", ctx.todayId());
    html += '</div>';
    html += '<div class="sheet-actions"><button class="action-btn secondary" data-action="open-sheet" data-sheet="goals">' + ctx.icon("gear") + 'Edit goals</button><button class="action-btn secondary" data-action="open-sheet" data-sheet="steps">' + ctx.icon("today") + 'Steps</button></div>';
    html += '</div>';
    return html;
  }

  function ring(ctx, label, percent, sub, color) {
    var c = 2 * Math.PI * 42;
    var off = c * (1 - percent);
    return '<div class="ring-card"><svg viewBox="0 0 108 108"><circle cx="54" cy="54" r="42" stroke="currentColor" stroke-width="13" opacity=".14" fill="none"/><circle cx="54" cy="54" r="42" stroke="' + color + '" stroke-width="13" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" fill="none"/></svg><div class="ring-label">' + ctx.escapeHtml(label) + ' ' + Math.round(percent * 100) + '%</div><div class="ring-sub">' + ctx.escapeHtml(sub) + '</div></div>';
  }

  function metric(label, value) {
    return '<div class="metric-card"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
  }

  root.rings = {
    ensureGoals: ensureGoals,
    metrics: metrics,
    renderRings: renderRings
  };
})();
