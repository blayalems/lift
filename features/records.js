(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function epley(weight, reps) {
    return Number(weight || 0) * (1 + Number(reps || 0) / 30);
  }

  function scanRecords(ctx) {
    var map = {};
    ctx.allDays().forEach(function (entry) {
      var day = entry.day;
      var completed = ((ctx.state.days[day.id] || {}).completed || {});
      (day.exercises || []).forEach(function (ex, exIndex) {
        Object.keys(completed).forEach(function (key) {
          if (key.split(".")[0] !== String(exIndex)) return;
          var set = completed[key] || {};
          var weight = Number(set.weight || 0);
          var reps = Number(set.reps || 0);
          var oneRm = epley(weight, reps);
          var current = map[ex.name];
          if (!current || weight > current.weight || (weight === current.weight && oneRm > current.est1rm)) {
            map[ex.name] = { name: ex.name, weight: weight, reps: reps, est1rm: oneRm, date: day.id, ts: set.ts || 0, pr: !!set.pr };
          }
        });
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function renderRecords(ctx, sortMode) {
    var rows = scanRecords(ctx);
    sortMode = sortMode || "recency";
    rows.sort(function (a, b) {
      if (sortMode === "weight") return b.weight - a.weight;
      if (sortMode === "margin") return b.est1rm - a.est1rm;
      return String(b.date).localeCompare(String(a.date));
    });
    var html = '<div class="sheet-grid">';
    html += '<div class="segmented"><button data-action="records-sort" data-sort="recency" data-active="' + String(sortMode === "recency") + '">Recent</button><button data-action="records-sort" data-sort="weight" data-active="' + String(sortMode === "weight") + '">Weight</button><button data-action="records-sort" data-sort="margin" data-active="' + String(sortMode === "margin") + '">1RM</button></div>';
    if (!rows.length) return html + '<div class="overview-card"><strong>No records yet</strong><p>Complete sets to build a PR dashboard.</p></div></div>';
    html += '<table class="mini-table"><thead><tr><th>Exercise</th><th>Top set</th><th>Est. 1RM</th><th>Date</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + ctx.escapeHtml(r.name) + '</td><td>' + ctx.escapeHtml(ctx.formatWeight(r.weight)) + ' ' + ctx.escapeHtml(ctx.unitLabel()) + ' x ' + ctx.escapeHtml(r.reps) + '</td><td>' + ctx.escapeHtml(ctx.formatWeight(r.est1rm)) + '</td><td>' + ctx.escapeHtml(r.date) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderOneRmChart(ctx, exerciseName) {
    if (!exerciseName) return "";
    var rows = [];
    ctx.allDays().forEach(function (entry) {
      var day = entry.day;
      var completed = ((ctx.state.days[day.id] || {}).completed || {});
      (day.exercises || []).forEach(function (ex, exIndex) {
        if (ex.name !== exerciseName) return;
        var best = 0;
        Object.keys(completed).forEach(function (key) {
          if (key.split(".")[0] !== String(exIndex)) return;
          var set = completed[key] || {};
          best = Math.max(best, epley(set.weight, set.reps));
        });
        if (best) rows.push({ date: day.id, value: best });
      });
    });
    if (!rows.length) return '<div class="overview-card"><strong>Estimated 1RM</strong><p>Log this exercise to plot strength score.</p></div>';
    var vals = rows.map(function (r) { return ctx.kgToDisplay(r.value); });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    if (min === max) { min -= 5; max += 5; }
    var points = vals.map(function (v, i) {
      var x = rows.length === 1 ? 160 : 24 + i * (272 / (rows.length - 1));
      var y = 150 - ((v - min) / (max - min)) * 110;
      return x + "," + y;
    }).join(" ");
    return '<div class="overview-card"><strong>Strength Score</strong><p>Epley estimated 1RM trend.</p></div><div class="chart"><svg viewBox="0 0 320 190"><path d="M24 150H300M24 40V150" stroke="currentColor" opacity=".18" fill="none"/><polyline points="' + points + '" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><text x="24" y="24" fill="currentColor" opacity=".68" font-size="12">Estimated 1RM</text></svg></div>';
  }

  root.records = {
    epley: epley,
    scanRecords: scanRecords,
    renderRecords: renderRecords,
    renderOneRmChart: renderOneRmChart
  };
})();
