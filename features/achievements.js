(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  var DEFINITIONS = [
    ["first-session", "First Session", "Finish your first logged workout."],
    ["first-pr", "First PR", "Log a personal record."],
    ["all-entering-baselines-exceeded", "Baselines Cleared", "Exceed every entering baseline."],
    ["week-1-complete", "Week 1 Complete", "Complete every Week 1 training day."],
    ["streak-7", "7-Day Streak", "Complete seven planned training days in sequence."],
    ["streak-14", "14-Day Streak", "Complete fourteen planned training days in sequence."],
    ["streak-30", "30-Day Streak", "Complete thirty planned training days in sequence."],
    ["sets-100", "100 Sets", "Log 100 completed sets."],
    ["sets-500", "500 Sets", "Log 500 completed sets."],
    ["sets-1000", "1000 Sets", "Log 1000 completed sets."],
    ["deload-completed", "Deload Complete", "Finish every planned deload training day."],
    ["cycle-complete", "Cycle Complete", "Complete the full May-June cycle."],
    ["leg-press-80", "80 kg Leg Press", "Log a Machine Leg Press set at 80 kg or more."],
    ["incline-db-30", "30 kg Incline DB", "Log an Incline DB Press set at 30 kg total or more."]
  ];

  function evaluate(ctx) {
    var state = ctx.state;
    state.achievements = state.achievements || {};
    var stats = scan(ctx);
    var unlocked = [];
    unlockIf(ctx, unlocked, "first-session", stats.finishedSessions > 0, stats.firstFinishedDay);
    unlockIf(ctx, unlocked, "first-pr", stats.prCount > 0, stats.firstPrDay, stats.firstPr);
    unlockIf(ctx, unlocked, "all-entering-baselines-exceeded", baselinesExceeded(ctx, stats), stats.latestDay);
    unlockIf(ctx, unlocked, "week-1-complete", weekComplete(ctx, 1), stats.latestDay);
    unlockIf(ctx, unlocked, "streak-7", stats.streak >= 7, stats.latestDay, { streak: stats.streak });
    unlockIf(ctx, unlocked, "streak-14", stats.streak >= 14, stats.latestDay, { streak: stats.streak });
    unlockIf(ctx, unlocked, "streak-30", stats.streak >= 30, stats.latestDay, { streak: stats.streak });
    unlockIf(ctx, unlocked, "sets-100", stats.completedSets >= 100, stats.latestDay, { sets: stats.completedSets });
    unlockIf(ctx, unlocked, "sets-500", stats.completedSets >= 500, stats.latestDay, { sets: stats.completedSets });
    unlockIf(ctx, unlocked, "sets-1000", stats.completedSets >= 1000, stats.latestDay, { sets: stats.completedSets });
    unlockIf(ctx, unlocked, "deload-completed", phaseComplete(ctx, "deload"), stats.latestDay);
    unlockIf(ctx, unlocked, "cycle-complete", cycleComplete(ctx), stats.latestDay);
    unlockIf(ctx, unlocked, "leg-press-80", stats.maxLegPress >= 80, stats.latestDay, { weight: stats.maxLegPress });
    unlockIf(ctx, unlocked, "incline-db-30", stats.maxInclineDb >= 30, stats.latestDay, { weight: stats.maxInclineDb });
    return unlocked;
  }

  function scan(ctx) {
    var stats = {
      completedSets: 0,
      finishedSessions: 0,
      prCount: 0,
      firstPr: null,
      firstPrDay: null,
      firstFinishedDay: null,
      latestDay: null,
      maxLegPress: 0,
      maxInclineDb: 0,
      byBaseline: {},
      streak: ctx.trainingStreak()
    };
    ctx.allDays().forEach(function (entry) {
      var day = entry.day;
      var ds = ctx.state.days[day.id] || {};
      var completed = ds.completed || {};
      var keys = Object.keys(completed);
      if (keys.length) stats.latestDay = day.id;
      if (ds.finishedAt && keys.length) {
        stats.finishedSessions += 1;
        if (!stats.firstFinishedDay) stats.firstFinishedDay = day.id;
      }
      (day.exercises || []).forEach(function (ex, exIndex) {
        keys.forEach(function (key) {
          if (key.split(".")[0] !== String(exIndex)) return;
          var set = completed[key] || {};
          var weight = Number(set.weight || 0);
          stats.completedSets += 1;
          if (set.pr) {
            stats.prCount += 1;
            if (!stats.firstPr) {
              stats.firstPr = { ex: ex.name, weight: weight };
              stats.firstPrDay = day.id;
            }
          }
          if (/machine leg press/i.test(ex.name)) stats.maxLegPress = Math.max(stats.maxLegPress, weight);
          if (/incline db press/i.test(ex.name)) stats.maxInclineDb = Math.max(stats.maxInclineDb, weight);
          updateBaselineStats(ctx, stats, ex.name, weight);
        });
      });
    });
    return stats;
  }

  function updateBaselineStats(ctx, stats, name, weight) {
    var lower = String(name || "").toLowerCase();
    (ctx.plan.meta.baselines || []).forEach(function (b) {
      var label = String(b.label || "").toLowerCase();
      var match = (lower.indexOf("incline db") >= 0 && label.indexOf("incline db") >= 0) ||
        (lower.indexOf("leg press") >= 0 && label.indexOf("leg press") >= 0) ||
        (lower.indexOf("chest press") >= 0 && label.indexOf("machine chest") >= 0) ||
        (lower.indexOf("cable row") >= 0 && label.indexOf("cable row") >= 0);
      if (match) stats.byBaseline[b.label] = Math.max(stats.byBaseline[b.label] || 0, weight);
    });
  }

  function baselinesExceeded(ctx, stats) {
    var baselines = ctx.plan.meta.baselines || [];
    if (!baselines.length) return false;
    return baselines.every(function (b) {
      return (stats.byBaseline[b.label] || 0) > Number(b.value || 0);
    });
  }

  function weekComplete(ctx, num) {
    var week = (ctx.plan.weeks || []).find(function (w) { return Number(w.num) === num; });
    if (!week) return false;
    return (week.days || []).filter(hasExercises).every(function (day) {
      return ctx.dayStatus ? ctx.dayStatus(day, ctx.state) === "done" : ctx.completedSetCount(day, ctx.state) >= ctx.totalSetCountForSource(day, ctx.state);
    });
  }

  function phaseComplete(ctx, phase) {
    return ctx.allDays().filter(function (entry) {
      return ctx.normalizePhase(entry.week.phase) === phase && hasExercises(entry.day);
    }).every(function (entry) {
      return ctx.completedSetCount(entry.day, ctx.state) >= ctx.totalSetCountForSource(entry.day, ctx.state);
    });
  }

  function cycleComplete(ctx) {
    return ctx.allDays().filter(function (entry) { return hasExercises(entry.day); }).every(function (entry) {
      return ctx.completedSetCount(entry.day, ctx.state) >= ctx.totalSetCountForSource(entry.day, ctx.state);
    });
  }

  function hasExercises(day) {
    return (day.exercises || []).length > 0;
  }

  function unlockIf(ctx, unlocked, id, condition, dayId, value) {
    if (!condition || ctx.state.achievements[id]) return;
    var def = definition(id);
    ctx.state.achievements[id] = { unlocked: Date.now(), dayId: dayId || ctx.todayId(), value: value || null };
    unlocked.push({ id: id, title: def.title, desc: def.desc });
  }

  function definition(id) {
    var row = DEFINITIONS.find(function (d) { return d[0] === id; }) || [id, id, ""];
    return { id: row[0], title: row[1], desc: row[2] };
  }

  function renderBadges(ctx) {
    evaluate(ctx);
    var html = '<div class="badge-grid">';
    DEFINITIONS.forEach(function (row) {
      var item = ctx.state.achievements[row[0]];
      html += '<div class="badge-card" data-unlocked="' + String(!!item) + '">';
      html += '<div class="badge-mark">' + (item ? ctx.icon("check") : "") + '</div>';
      html += '<div><div class="badge-title">' + ctx.escapeHtml(row[1]) + '</div><div class="badge-desc">' + ctx.escapeHtml(row[2]) + '</div>';
      if (item) html += '<div class="journal-meta">Unlocked ' + ctx.escapeHtml(item.dayId || "") + '</div>';
      html += '</div></div>';
    });
    html += "</div>";
    return html;
  }

  root.achievements = {
    definitions: DEFINITIONS,
    evaluate: evaluate,
    renderBadges: renderBadges
  };
})();
