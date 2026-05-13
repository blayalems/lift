(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function isoWeekId(date) {
    var d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    var week1 = new Date(d.getFullYear(), 0, 4);
    var week = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return d.getFullYear() + "-W" + String(week).padStart(2, "0");
  }

  function currentIso(ctx) {
    return ctx.isoWeekId(new Date(ctx.todayId() + "T00:00:00"));
  }

  function lastWeekRecap(ctx) {
    var today = new Date(ctx.todayId() + "T00:00:00");
    var day = (today.getDay() + 6) % 7;
    var start = new Date(today);
    start.setDate(today.getDate() - day - 7);
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    var sessions = 0, volume = 0, prs = 0;
    ctx.allDays().forEach(function (entry) {
      var d = new Date(entry.day.id + "T00:00:00");
      if (d < start || d > end) return;
      var ds = ctx.state.days[entry.day.id] || {};
      if (ds.finishedAt && ctx.completedSetCount(entry.day, ctx.state) > 0) sessions += 1;
      volume += ctx.completedVolume(entry.day);
      Object.keys(ds.completed || {}).forEach(function (key) { if ((ds.completed[key] || {}).pr) prs += 1; });
    });
    return { sessions: sessions, volume: volume, prs: prs, streak: ctx.trainingStreak(), iso: currentIso(ctx) };
  }

  function shouldShowWeeklyRecap(ctx) {
    var today = new Date(ctx.todayId() + "T00:00:00");
    if (today.getDay() !== 1) return false;
    if (ctx.state.weeklyRecapDismissedIso === currentIso(ctx)) return false;
    var recap = lastWeekRecap(ctx);
    return recap.sessions > 0 || recap.volume > 0 || recap.prs > 0;
  }

  function renderWeeklyRecapCard(ctx) {
    var r = lastWeekRecap(ctx);
    return '<section class="recap-card"><div class="recap-title">Last week recap</div><div class="recap-text">' + r.sessions + ' sessions - ' + ctx.cleanNumber(ctx.kgToDisplay(r.volume), 0) + ' ' + ctx.unitLabel() + ' moved - ' + r.prs + ' PRs - ' + r.streak + '-day streak</div><div class="recap-actions"><button class="action-btn secondary" data-action="open-sheet" data-sheet="journal">Journal</button><button class="action-btn secondary" data-action="dismiss-recap" data-iso="' + r.iso + '">Dismiss</button></div></section>';
  }

  function renderCycleReview(ctx) {
    var sessions = 0, volume = 0, prs = 0;
    var phases = {};
    ctx.allDays().forEach(function (entry) {
      var ds = ctx.state.days[entry.day.id] || {};
      if (ds.finishedAt && ctx.completedSetCount(entry.day, ctx.state) > 0) {
        sessions += 1;
        phases[ctx.normalizePhase(entry.week.phase)] = (phases[ctx.normalizePhase(entry.week.phase)] || 0) + 1;
      }
      volume += ctx.completedVolume(entry.day);
      Object.keys(ds.completed || {}).forEach(function (key) { if ((ds.completed[key] || {}).pr) prs += 1; });
    });
    return '<div class="summary-panel"><button class="icon-btn summary-close" data-action="dismiss-summary" aria-label="Close review">' + ctx.icon("close") + '</button><div class="summary-hero"><div class="eyebrow">Cycle review</div><h2>May-June Cycle</h2><p>' + sessions + ' sessions completed</p></div><div class="sheet-grid" style="margin-top:14px"><div class="metric-grid"><div class="metric-card"><div class="label">Volume</div><div class="value">' + ctx.cleanNumber(ctx.kgToDisplay(volume), 0) + '</div></div><div class="metric-card"><div class="label">PRs</div><div class="value">' + prs + '</div></div><div class="metric-card"><div class="label">Streak</div><div class="value">' + ctx.trainingStreak() + '</div></div><div class="metric-card"><div class="label">Adherence</div><div class="value">' + ctx.cycleAdherence() + '%</div></div></div><div class="overview-card"><strong>Sessions per phase</strong><p>' + ctx.escapeHtml(JSON.stringify(phases)) + '</p></div></div></div>';
  }

  root.recap = {
    isoWeekId: isoWeekId,
    lastWeekRecap: lastWeekRecap,
    shouldShowWeeklyRecap: shouldShowWeeklyRecap,
    renderWeeklyRecapCard: renderWeeklyRecapCard,
    renderCycleReview: renderCycleReview
  };
})();
