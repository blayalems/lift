(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function latestBodyweightKg(ctx) {
    var rows = (ctx.state.bodyweight || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    return rows.length ? Number(rows[0].kg || 70) : 70;
  }

  function caloriesForDay(ctx, dayId) {
    var hours = Math.max(0, ctx.workoutElapsed(dayId) / 3600);
    return Math.round(latestBodyweightKg(ctx) * 6 * hours);
  }

  function liftPointsForDay(ctx, dayId) {
    var day = ctx.getDay(dayId);
    if (!day) return 0;
    var ds = ctx.state.days[dayId] || {};
    var points = ctx.completedSetCount(day, ctx.state);
    Object.keys(ds.completed || {}).forEach(function (key) {
      if ((ds.completed[key] || {}).pr) points += 1;
    });
    if (ds.finishedAt) points += 5;
    return points;
  }

  function buildSummary(ctx, dayId) {
    var day = ctx.getDay(dayId);
    var ds = ctx.state.days[dayId] || {};
    var completed = ds.completed || {};
    var prs = [];
    var best = null;
    (day.exercises || []).forEach(function (ex, exIndex) {
      Object.keys(completed).forEach(function (key) {
        if (key.split(".")[0] !== String(exIndex)) return;
        var set = completed[key] || {};
        var score = Number(set.weight || 0) * Math.max(1, Number(set.reps || 0));
        if (!best || score > best.score) best = { name: ex.name, weight: set.weight, reps: set.reps, score: score };
        if (set.pr) prs.push({ name: ex.name, weight: set.weight, reps: set.reps });
      });
    });
    return {
      day: day,
      volume: ctx.completedVolume(day),
      done: ctx.completedSetCount(day, ctx.state),
      planned: ctx.totalSetCountForSource(day, ctx.state),
      duration: ctx.workoutElapsed(dayId),
      prs: prs,
      best: best,
      kcal: caloriesForDay(ctx, dayId),
      points: liftPointsForDay(ctx, dayId),
      streak: ctx.trainingStreak()
    };
  }

  function renderOverlay(ctx, dayId) {
    var s = buildSummary(ctx, dayId);
    var best = s.best ? ctx.escapeHtml(s.best.name + " - " + ctx.formatWeight(s.best.weight) + " " + ctx.unitLabel() + " x " + s.best.reps) : "No sets";
    var html = '<div class="summary-panel" role="dialog" aria-modal="true"><button class="icon-btn summary-close" data-action="dismiss-summary" aria-label="Close summary">' + ctx.icon("close") + '</button>';
    html += '<div class="summary-hero"><div class="eyebrow">Workout complete</div><h2>' + ctx.escapeHtml(s.day.title || "Workout") + '</h2><p>' + ctx.escapeHtml(s.day.id) + '</p></div>';
    html += '<div class="sheet-grid" style="margin-top:14px">';
    html += '<div class="metric-grid">';
    html += metric("Volume", ctx.cleanNumber(ctx.kgToDisplay(s.volume), 0) + " " + ctx.unitLabel());
    html += metric("Sets", s.done + "/" + s.planned);
    html += metric("Time", ctx.formatDuration(s.duration));
    html += metric("Calories", s.kcal + " kcal");
    html += metric("PRs", String(s.prs.length));
    html += metric("Lift Points", String(s.points));
    html += metric("Streak", s.streak + " days");
    html += metric("Best lift", best);
    html += '</div>';
    if (s.prs.length) {
      html += '<div class="overview-card"><strong>PRs unlocked</strong><p>' + ctx.escapeHtml(s.prs.map(function (p) { return p.name + " " + ctx.formatWeight(p.weight) + " x " + p.reps; }).join(" | ")) + '</p></div>';
    }
    html += '<div class="sheet-actions"><button class="action-btn" data-action="summary-share">' + ctx.icon("share") + 'Share image</button><button class="action-btn secondary" data-action="summary-review">Open journal</button></div>';
    html += '</div></div>';
    return html;
  }

  function metric(label, value) {
    return '<div class="metric-card"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
  }

  root.summary = {
    caloriesForDay: caloriesForDay,
    liftPointsForDay: liftPointsForDay,
    buildSummary: buildSummary,
    renderOverlay: renderOverlay
  };
})();
