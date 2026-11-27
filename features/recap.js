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
    var sessions = 0, reconstructed = 0, volume = 0, prs = 0;
    ctx.allDays().forEach(function (entry) {
      var d = new Date(entry.day.id + "T00:00:00");
      if (d < start || d > end) return;
      var ds = ctx.state.days[entry.day.id] || {};
      var status = root.history && root.history.resolveStatus
        ? root.history.resolveStatus(entry.day, ds, ctx.todayId())
        : (ds.finishedAt && ctx.completedSetCount(entry.day, ctx.state) > 0 ? "completed" : "unknown");
      if (status === "completed" || status === "reconstructed") sessions += 1;
      if (status === "reconstructed") reconstructed += 1;
      volume += ctx.completedVolume(entry.day);
      Object.keys(ds.completed || {}).forEach(function (key) { if ((ds.completed[key] || {}).pr) prs += 1; });
    });
    var startId = ctx.localDateId ? ctx.localDateId(start) : start.toISOString().slice(0, 10);
    var endId = ctx.localDateId ? ctx.localDateId(end) : end.toISOString().slice(0, 10);
    var muscle = root.volume && root.volume.rangeMetrics ? root.volume.rangeMetrics(ctx, startId, endId) : {};
    var cardio = root.cardio && root.cardio.allEntries ? root.cardio.allEntries(ctx.state).filter(function (entry) {
      return entry.date >= startId && entry.date <= endId && !entry.skipped;
    }).reduce(function (sum, entry) { return sum + Number(entry.distanceKm || 0); }, 0) : 0;
    var protein = 0;
    if (root.nutrition && root.nutrition.totalProtein) {
      for (var offset = 0; offset < 7; offset += 1) {
        var date = new Date(start); date.setDate(start.getDate() + offset);
        protein += root.nutrition.totalProtein(ctx.state, ctx.localDateId ? ctx.localDateId(date) : date.toISOString().slice(0, 10));
      }
      protein /= 7;
    }
    var body = root.body && root.body.snapshot ? root.body.snapshot(ctx.state, endId) : {};
    var strength = root.body && root.body.strengthRetention ? root.body.strengthRetention(ctx, endId) : null;
    return { sessions: sessions, reconstructed: reconstructed, volume: volume, prs: prs, streak: ctx.trainingStreak(), iso: currentIso(ctx), muscle: muscle, cardioKm: Math.round(cardio * 10) / 10, averageProteinG: Math.round(protein), body: body, strength: strength, startId: startId, endId: endId };
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
    var priorities = nextPriorities(r, ctx);
    var bodyText = r.body.weeklyChangeKg == null ? 'weight trend unavailable' : 'weight ' + (r.body.weeklyChangeKg > 0 ? '+' : '') + r.body.weeklyChangeKg + ' kg/week';
    if (r.body.waistChangeCm != null) bodyText += ', waist ' + (r.body.waistChangeCm > 0 ? '+' : '') + r.body.waistChangeCm + ' cm';
    var strengthText = r.strength ? ' - key-lift strength ' + (r.strength.changePct > 0 ? '+' : '') + r.strength.changePct + '%' : '';
    return '<section class="recap-card"><div class="recap-title">Last week recap</div><div class="recap-text">' + r.sessions + ' sessions' + (r.reconstructed ? ' (' + r.reconstructed + ' reconstructed)' : '') + ' - upper chest ' + Number(r.muscle.upperChest || 0) + ' sets - side delts ' + Number(r.muscle.sideDelts || 0) + ' - abs ' + Number(r.muscle.abs || 0) + ' - lower back ' + Number(r.muscle.spinalErectors || 0) + ' - ' + r.cardioKm + ' km cardio - ' + r.averageProteinG + ' g/day protein - ' + bodyText + strengthText + '</div><p>' + ctx.escapeHtml(priorities.join(' ')) + '</p><div class="recap-actions"><button class="action-btn secondary" data-action="open-sheet" data-sheet="streaks">Full recap</button><button class="action-btn secondary" data-action="dismiss-recap" data-iso="' + r.iso + '">Dismiss</button></div></section>';
  }

  function nextPriorities(recap, ctx) {
    var out = [];
    if (Number(recap.muscle.upperChest || 0) < 8) out.push("Keep both upper-chest exposures next week.");
    if (Number(recap.muscle.sideDelts || 0) < 8) out.push("Keep side-delt work controlled across two or three sessions.");
    if (Number(recap.muscle.lats || 0) < 8) out.push("Complete both planned lat exposures before adding arm work.");
    if (Number(recap.muscle.abs || 0) < 6) out.push("Complete at least two direct ab sessions.");
    if (Number(recap.muscle.spinalErectors || 0) < 4) out.push("Keep two well-spaced lower-back exposures.");
    if (recap.averageProteinG < Number(ctx.state.profile && ctx.state.profile.proteinRangeMinG || 120)) out.push("Reach at least 120 g protein on five days.");
    if (!out.length) out.push("Keep loads conservative and add reps only with clean form and 1-2 RIR.");
    return out.slice(0, 3);
  }

  function phaseDisplayLabel(phase) {
    var labels = {
      reentry: "Reentry",
      consolidate: "Consolidate",
      load: "Load",
      loadplus: "Load+",
      deload: "Deload",
      test: "Test"
    };
    return labels[phase] || (phase ? phase.charAt(0).toUpperCase() + phase.slice(1) : "Plan");
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
    var cycleTitle = (ctx.plan && ctx.plan.meta && ctx.plan.meta.dateRange) || "Training Cycle";
    var phaseText = Object.keys(phases).map(function (key) {
      return phaseDisplayLabel(key) + ": " + phases[key];
    }).join(", ") || "None yet";
    return '<div class="summary-panel"><button class="icon-btn summary-close" data-action="dismiss-summary" aria-label="Close review">' + ctx.icon("close") + '</button><div class="summary-hero"><div class="eyebrow">Cycle review</div><h2>' + ctx.escapeHtml(cycleTitle) + '</h2><p>' + sessions + ' sessions completed</p></div><div class="sheet-grid summary-body-grid"><div class="metric-grid"><div class="metric-card"><div class="label">Volume</div><div class="value">' + ctx.cleanNumber(ctx.kgToDisplay(volume), 0) + '</div></div><div class="metric-card"><div class="label">PRs</div><div class="value">' + prs + '</div></div><div class="metric-card"><div class="label">Streak</div><div class="value">' + ctx.trainingStreak() + '</div></div><div class="metric-card"><div class="label">Adherence</div><div class="value">' + ctx.cycleAdherence() + '%</div></div></div><div class="overview-card"><strong>Sessions per phase</strong><p>' + ctx.escapeHtml(phaseText) + '</p></div></div></div>';
  }

  root.recap = {
    isoWeekId: isoWeekId,
    lastWeekRecap: lastWeekRecap,
    shouldShowWeeklyRecap: shouldShowWeeklyRecap,
    renderWeeklyRecapCard: renderWeeklyRecapCard,
    nextPriorities: nextPriorities,
    renderCycleReview: renderCycleReview
  };
})();
