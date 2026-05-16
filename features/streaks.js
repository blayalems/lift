// Streaks + weekly target ring.
// Reads completed days from state and surfaces:
//   - current training streak (consecutive days with any completed set)
//   - weekly progress vs goals.weeklySessions
//   - last 12 weeks adherence sparkline.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function isoDateAddDays(iso, days) {
    var parts = iso.split("-");
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function isoStartOfWeek(iso) {
    var parts = iso.split("-");
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    var day = d.getUTCDay(); // 0=Sun
    var diff = (day + 6) % 7; // make Mon=0
    d.setUTCDate(d.getUTCDate() - diff);
    return d.toISOString().slice(0, 10);
  }

  function completedDaysSet(ctx) {
    var set = {};
    var days = (ctx.allDays && ctx.allDays()) || [];
    days.forEach(function (entry) {
      var ds = (ctx.state.days && ctx.state.days[entry.day.id]) || {};
      if (ds.finishedAt) set[entry.day.id] = true;
      else {
        // Partial: at least one completed set counts as activity for streaks.
        var hasAny = ds.completed && Object.keys(ds.completed).length > 0;
        if (hasAny) set[entry.day.id] = true;
      }
    });
    return set;
  }

  function streakCount(ctx) {
    var completed = completedDaysSet(ctx);
    var today = ctx.localDateId ? ctx.localDateId(new Date()) : new Date().toISOString().slice(0, 10);
    var cursor = today;
    var count = 0;
    // Walk backwards day-by-day. Allow up to 1 missed day before breaking streak
    // (rest day is fine — count as continuation, not increment).
    var allow = 1;
    for (var i = 0; i < 365; i += 1) {
      if (completed[cursor]) {
        count += 1;
        allow = 1;
      } else {
        if (allow > 0) { allow -= 1; }
        else break;
      }
      cursor = isoDateAddDays(cursor, -1);
    }
    return count;
  }

  function weekProgress(ctx) {
    var goal = (ctx.state.goals && ctx.state.goals.weeklySessions) || 5;
    var completed = completedDaysSet(ctx);
    var today = ctx.localDateId ? ctx.localDateId(new Date()) : new Date().toISOString().slice(0, 10);
    var start = isoStartOfWeek(today);
    var count = 0;
    for (var i = 0; i < 7; i += 1) {
      var id = isoDateAddDays(start, i);
      if (completed[id]) count += 1;
    }
    return { count: count, goal: goal, ratio: Math.min(1, count / Math.max(1, goal)) };
  }

  function weeklyHistory(ctx, weeks) {
    weeks = weeks || 12;
    var completed = completedDaysSet(ctx);
    var today = ctx.localDateId ? ctx.localDateId(new Date()) : new Date().toISOString().slice(0, 10);
    var start = isoStartOfWeek(today);
    var rows = [];
    for (var w = weeks - 1; w >= 0; w -= 1) {
      var weekStart = isoDateAddDays(start, -7 * w);
      var n = 0;
      for (var d = 0; d < 7; d += 1) {
        if (completed[isoDateAddDays(weekStart, d)]) n += 1;
      }
      rows.push({ weekStart: weekStart, sessions: n });
    }
    return rows;
  }

  function renderStreakCard(ctx) {
    var streak = streakCount(ctx);
    var wp = weekProgress(ctx);
    var c = 2 * Math.PI * 50; // r=50
    var dashOffset = c * (1 - wp.ratio);

    var html = '<div class="streak-ring-card">' +
      '<div class="streak-ring">' +
      '<svg viewBox="0 0 110 110"><circle class="track" cx="55" cy="55" r="50"/>' +
      '<circle class="bar" cx="55" cy="55" r="50" stroke-dasharray="' + c + '" stroke-dashoffset="' + dashOffset + '"/></svg>' +
      '<div class="label-num">' + wp.count + '<span style="font-size:14px;font-variation-settings:\'wght\' 600;color:var(--md-on-surface-variant);margin-left:2px">/' + wp.goal + '</span></div>' +
      '</div>' +
      '<div class="streak-meta">' +
      '<strong>' + streak + ' day streak</strong>' +
      '<p>' + wp.count + ' of ' + wp.goal + ' weekly sessions logged. ' +
      (wp.ratio >= 1 ? "Goal hit — keep the engine warm." : "Need " + (wp.goal - wp.count) + " more this week.") +
      '</p>' +
      '<div class="streak-flames">' +
      Array.from({ length: 7 }, function (_, i) {
        return '<span data-on="' + (i < streak ? "true" : "false") + '">' + (i < streak ? "&#128293;" : "&#128293;") + '</span>';
      }).join("") +
      '</div>' +
      '</div></div>';
    return html;
  }

  function renderStreaks(ctx) {
    var html = '<div class="sheet-grid">';
    html += renderStreakCard(ctx);

    // Last 12 weeks bar chart.
    var hist = weeklyHistory(ctx, 12);
    var max = Math.max.apply(null, hist.map(function (h) { return h.sessions; }).concat([1]));
    html += '<div class="overview-card"><strong>Last 12 weeks</strong>' +
      '<div style="display:flex;align-items:flex-end;gap:6px;height:120px;margin-top:14px;padding:0 4px">';
    hist.forEach(function (h) {
      var pct = (h.sessions / max) * 100;
      html += '<div style="flex:1;display:grid;gap:4px;justify-items:center">' +
        '<div style="width:100%;height:100%;display:flex;align-items:flex-end">' +
        '<div style="width:100%;height:' + pct + '%;background:linear-gradient(180deg,var(--md-primary),var(--md-secondary));border-radius:6px;min-height:4px"></div>' +
        '</div>' +
        '<small style="font-size:9px;color:var(--md-on-surface-variant)">' + h.weekStart.slice(5).replace("-", "/") + '</small>' +
        '</div>';
    });
    html += '</div></div>';

    html += '<div class="overview-card"><strong>Streak rules</strong>' +
      '<p>Any completed set counts toward the streak. One rest day is allowed without breaking continuity — two in a row resets the chain.</p></div>';
    html += '</div>';
    return html;
  }

  root.streaks = {
    streakCount: streakCount,
    weekProgress: weekProgress,
    renderStreakCard: renderStreakCard,
    renderStreaks: renderStreaks
  };
})();
