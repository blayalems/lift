// Streaks + weekly target ring.
// Reads completed days from state and surfaces:
//   - current training streak (consecutive days with any completed set)
//   - weekly progress vs goals.weeklySessions
//   - completed weekly sets and reps for the plan's priority muscle groups
//   - last 12 weeks adherence sparkline.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var FOCUS_AREAS = [
    { key: "upperChest", label: "Upper chest" },
    { key: "back", label: "Lats / back" },
    { key: "sideDelts", label: "Side delts" },
    { key: "rearDelts", label: "Rear delts" },
    { key: "arms", label: "Arms" }
  ];

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

  function currentDateId(ctx) {
    if (ctx && typeof ctx.todayId === "function") return ctx.todayId();
    if (ctx && typeof ctx.localDateId === "function") return ctx.localDateId(new Date());
    return new Date().toISOString().slice(0, 10);
  }

  function hasValidCompletedSet(ds) {
    var completed = (ds && ds.completed) || {};
    return Object.keys(completed).some(function (key) {
      return Number((completed[key] || {}).reps) > 0;
    });
  }

  function activityDaysSet(ctx) {
    var set = {};
    var days = (ctx.allDays && ctx.allDays()) || [];
    days.forEach(function (entry) {
      var ds = (ctx.state.days && ctx.state.days[entry.day.id]) || {};
      var history = root.history;
      var status = history && history.resolveStatus
        ? history.resolveStatus(entry.day, ds, currentDateId(ctx))
        : (hasValidCompletedSet(ds) ? "completed" : "unknown");
      if (status === "completed" || status === "reconstructed") set[entry.day.id] = true;
    });
    return set;
  }

  function finishedSessionDaysSet(ctx) {
    var set = {};
    var days = (ctx.allDays && ctx.allDays()) || [];
    days.forEach(function (entry) {
      var ds = (ctx.state.days && ctx.state.days[entry.day.id]) || {};
      var history = root.history;
      var status = history && history.resolveStatus
        ? history.resolveStatus(entry.day, ds, currentDateId(ctx))
        : (ds.finishedAt && hasValidCompletedSet(ds) ? "completed" : "unknown");
      if (status === "completed" || status === "reconstructed") set[entry.day.id] = true;
    });
    return set;
  }

  function streakCount(ctx) {
    if (root.history && typeof root.history.streakMetrics === "function") {
      return root.history.streakMetrics(ctx, currentDateId(ctx)).current;
    }
    var completed = activityDaysSet(ctx);
    var today = currentDateId(ctx);
    var planned = ((ctx.allDays && ctx.allDays()) || []).filter(function (entry) {
      return entry && entry.day && entry.day.id <= today && (entry.day.exercises || []).length > 0;
    }).sort(function (a, b) {
      return b.day.id.localeCompare(a.day.id);
    });
    var count = 0;
    // Walk backward through prescribed workouts, not raw calendar days.
    for (var i = 0; i < planned.length; i += 1) {
      var id = planned[i].day.id;
      // Today's workout is not missed while the athlete still has the day to start it.
      if (id === today && !completed[id]) continue;
      if (!completed[id]) break;
      count += 1;
    }
    return count;
  }

  function weekProgress(ctx) {
    var goal = (ctx.state.goals && ctx.state.goals.weeklySessions) || 6;
    var completed = finishedSessionDaysSet(ctx);
    var today = currentDateId(ctx);
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
    var completed = finishedSessionDaysSet(ctx);
    var today = currentDateId(ctx);
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

  function normalizeExerciseName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function classifyExerciseName(name) {
    var normalized = normalizeExerciseName(name);
    var matches = [];
    if (/\bupper chest\b/.test(normalized) || (/\bincline\b/.test(normalized) && /\b(?:press|fly|flye)s?\b/.test(normalized))) {
      matches.push("upperChest");
    }
    if (/\b(?:lat|lats|row|rows|pulldown|pulldowns|pull up|pull ups|chin up|chin ups)\b/.test(normalized)) {
      matches.push("back");
    }
    if (/\b(?:lateral raise|lateral raises|side delt|side delts)\b/.test(normalized)) {
      matches.push("sideDelts");
    }
    if (/\b(?:rear delt|rear delts|face pull|face pulls|reverse pec deck|reverse fly|reverse flye|reverse flies)\b/.test(normalized)) {
      matches.push("rearDelts");
    }
    var isLegCurl = /\b(?:leg|hamstring|hamstrings|lying leg|seated leg) curls?\b/.test(normalized);
    if (/\b(?:bicep|biceps|tricep|triceps|pushdown|pushdowns|dip|dips|skull crusher|skull crushers)\b/.test(normalized) ||
        (/\bcurls?\b/.test(normalized) && !isLegCurl) ||
        /\btriceps? extensions?\b/.test(normalized)) {
      matches.push("arms");
    }
    return matches;
  }

  function emptyFocusMetrics() {
    var metrics = {};
    FOCUS_AREAS.forEach(function (area) {
      metrics[area.key] = { key: area.key, label: area.label, sets: 0, reps: 0 };
    });
    return metrics;
  }

  function weeklyFocus(ctx) {
    var metrics = emptyFocusMetrics();
    var today = currentDateId(ctx);
    var start = isoStartOfWeek(today);
    var end = isoDateAddDays(start, 6);
    var days = (ctx.allDays && ctx.allDays()) || [];

    days.forEach(function (entry) {
      if (!entry || !entry.day || entry.day.id < start || entry.day.id > end) return;
      var ds = (ctx.state.days && ctx.state.days[entry.day.id]) || {};
      var completed = ds.completed || {};
      (entry.day.exercises || []).forEach(function (exercise, exIndex) {
        var areas = classifyExerciseName(exercise.name);
        if (!areas.length) return;
        Object.keys(completed).forEach(function (key) {
          if (key.split(".")[0] !== String(exIndex)) return;
          var reps = Number((completed[key] || {}).reps);
          if (!(reps > 0)) return;
          areas.forEach(function (area) {
            metrics[area].sets += 1;
            metrics[area].reps += reps;
          });
        });
      });
    });

    return metrics;
  }

  function renderWeeklyFocus(ctx) {
    var metrics = weeklyFocus(ctx);
    var html = '<div class="overview-card"><strong>This week\'s focus</strong>' +
      '<p>Valid completed working sets by priority area. Multi-target exercises can contribute to more than one area.</p>' +
      '<div class="metric-grid">';
    FOCUS_AREAS.forEach(function (area) {
      var metric = metrics[area.key];
      html += '<div class="metric-card"><div class="label">' + area.label + '</div>' +
        '<div class="value">' + metric.sets + ' set' + (metric.sets === 1 ? '' : 's') + '</div>' +
        '<div class="ring-sub">' + metric.reps + ' reps</div></div>';
    });
    html += '</div></div>';
    return html;
  }

  function renderStreakCard(ctx) {
    var streak = streakCount(ctx);
    var wp = weekProgress(ctx);
    var historyMetrics = root.history && root.history.streakMetrics
      ? root.history.streakMetrics(ctx, currentDateId(ctx))
      : { reconstructedInCurrent: 0, longestVerified: streak };
    var activeWeeks = weeklyHistory(ctx, 52).filter(function (row) { return row.sessions > 0; }).length;
    var c = 2 * Math.PI * 50; // r=50
    var dashOffset = c * (1 - wp.ratio);

    var html = '<div class="streak-ring-card">' +
      '<div class="streak-ring">' +
      '<svg viewBox="0 0 110 110"><circle class="track" cx="55" cy="55" r="50"/>' +
      '<circle class="bar" cx="55" cy="55" r="50" stroke-dasharray="' + c + '" stroke-dashoffset="' + dashOffset + '"/></svg>' +
      '<div class="label-num">' + wp.count + '<span style="font-size:14px;font-variation-settings:\'wght\' 600;color:var(--md-on-surface-variant);margin-left:2px">/' + wp.goal + '</span></div>' +
      '</div>' +
      '<div class="streak-meta">' +
      '<strong>' + streak + ' session streak</strong>' +
      '<p>' + wp.count + ' of ' + wp.goal + ' weekly sessions logged. ' +
      (wp.ratio >= 1 ? "Weekly target reached; recovery still counts." : (wp.goal - wp.count) + " planned session" + (wp.goal - wp.count === 1 ? "" : "s") + " remain if recovery is good.") +
      '</p><p class="section-sub">Active training weeks: ' + activeWeeks + ' &middot; longest verified: ' + historyMetrics.longestVerified + ' &middot; reconstructed in current: ' + historyMetrics.reconstructedInCurrent + '</p>' +
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
    html += renderWeeklyFocus(ctx);
    if (root.volume && typeof root.volume.renderVolume === "function") html += root.volume.renderVolume(ctx);

    // Last 12 weeks bar chart.
    var hist = weeklyHistory(ctx, 12);
    var max = Math.max.apply(null, hist.map(function (h) { return h.sessions; }).concat([1]));
    html += '<div class="overview-card"><strong>Last 12 weeks</strong>' +
      '<div style="display:flex;align-items:flex-end;gap:6px;height:120px;margin-top:14px;padding:0 4px">';
    hist.forEach(function (h) {
      var pct = (h.sessions / max) * 100;
      html += '<div style="flex:1;display:flex;flex-direction:column;gap:4px;align-items:center;height:100%">' +
        '<div style="width:100%;flex:1;min-height:0;display:flex;align-items:flex-end">' +
        '<div style="width:100%;height:' + pct + '%;background:linear-gradient(180deg,var(--md-primary),var(--md-secondary));border-radius:6px;min-height:4px" title="' + h.sessions + ' sessions"></div>' +
        '</div>' +
        '<small style="font-size:9px;color:var(--md-on-surface-variant)">' + h.weekStart.slice(5).replace("-", "/") + '</small>' +
        '</div>';
    });
    html += '</div></div>';

    html += '<div class="overview-card"><strong>Streak rules</strong>' +
      '<p>Verified workouts and explicitly reconstructed trained days count. Rest days are skipped, unknown data-loss gaps are not treated as failures, and only a day marked truly missed breaks the reliable chain.</p></div>';
    html += '</div>';
    return html;
  }

  root.streaks = {
    classifyExerciseName: classifyExerciseName,
    streakCount: streakCount,
    weekProgress: weekProgress,
    weeklyHistory: weeklyHistory,
    weeklyFocus: weeklyFocus,
    renderWeeklyFocus: renderWeeklyFocus,
    renderStreakCard: renderStreakCard,
    renderStreaks: renderStreaks
  };
})();
