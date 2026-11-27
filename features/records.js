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

  function epley(weight, reps) {
    var w = Number(weight || 0);
    var r = Number(reps || 0);
    if (!(r > 0) || !Number.isFinite(w) || !Number.isFinite(r)) return 0;
    if (r === 1) return w;
    return w * (1 + r / 30);
  }

  function normalize(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function isAssisted(exercise) {
    return !!(exercise && exercise.loadDirection === "lower") || /\bassisted\b/i.test(exercise && exercise.name || exercise || "");
  }

  function performances(ctx, exerciseName, beforeDate, exclude) {
    var rows = [];
    var stateDays = (ctx && ctx.state && ctx.state.days) || {};
    (ctx && ctx.allDays ? ctx.allDays() : []).forEach(function (entry) {
      if (!entry || !entry.day || (beforeDate && entry.day.id > beforeDate)) return;
      var ds = stateDays[entry.day.id] || {};
      if (ds.status === "reconstructed" && !Object.keys(ds.completed || {}).length) return;
      (entry.day.exercises || []).forEach(function (exercise, exIndex) {
        if (!exercise || normalize(exercise.name) !== normalize(exerciseName)) return;
        Object.keys(ds.completed || {}).forEach(function (key) {
          if (key.split(".")[0] !== String(exIndex)) return;
          if (exclude && exclude.date === entry.day.id && exclude.key === key) return;
          var set = ds.completed[key] || {};
          if (!(Number(set.reps) > 0)) return;
          rows.push({ date: entry.day.id, key: key, exercise: exercise, set: set });
        });
      });
    });
    return rows;
  }

  function evaluateSet(ctx, exercise, set, dayId, key) {
    if (!exercise || !exercise.name || !set || !(Number(set.reps) > 0)) {
      return { type: "none", types: [], isPr: false, reason: "No completed reps" };
    }
    var prior = performances(ctx, exercise.name, dayId, { date: dayId, key: key });
    var assisted = isAssisted(exercise);
    var weight = Number(set.weight || 0);
    var reps = Number(set.reps || 0);
    if (!prior.length) {
      return { type: "baseline", types: ["baseline"], isPr: false, reason: "First verified Lift record" };
    }
    var priorWeights = prior.map(function (row) { return Number(row.set.weight || 0); });
    var bestWeight = assisted ? Math.min.apply(null, priorWeights) : Math.max.apply(null, priorWeights);
    var types = [];
    if ((assisted && weight < bestWeight) || (!assisted && weight > bestWeight)) types.push("weight");
    var sameLoadReps = prior.filter(function (row) { return Number(row.set.weight || 0) === weight; }).map(function (row) { return Number(row.set.reps || 0); });
    if (sameLoadReps.length && reps > Math.max.apply(null, sameLoadReps)) types.push("reps");
    if (!assisted) {
      var priorOneRm = Math.max.apply(null, prior.map(function (row) { return epley(row.set.weight, row.set.reps); }));
      if (epley(weight, reps) > priorOneRm + 0.01) types.push("estimated1rm");
      var priorVolume = Math.max.apply(null, prior.map(function (row) { return Number(row.set.weight || 0) * Number(row.set.reps || 0); }));
      if (weight * reps > priorVolume + 0.01) types.push("volume");
    }
    types = types.filter(function (type, index) { return types.indexOf(type) === index; });
    return {
      type: types[0] || "none",
      types: types,
      isPr: types.length > 0,
      reason: types.length ? types.map(recordLabel).join(", ") : "No prior record exceeded"
    };
  }

  function recordLabel(type) {
    return ({ baseline: "Baseline", weight: "Weight PR", reps: "Rep PR", estimated1rm: "Estimated 1RM PR", volume: "Volume PR", none: "Logged set" })[type] || type;
  }

  function scanRecords(ctx) {
    var map = {};
    var stateDays = (ctx && ctx.state && ctx.state.days) || {};
    (ctx && ctx.allDays ? ctx.allDays() : []).forEach(function (entry) {
      var day = entry && entry.day;
      if (!day || !day.id) return;
      var ds = stateDays[day.id] || {};
      if (ds.status === "reconstructed" && !Object.keys(ds.completed || {}).length) return;
      (day.exercises || []).forEach(function (exercise, exIndex) {
        if (!exercise || !exercise.name) return;
        Object.keys(ds.completed || {}).forEach(function (key) {
          if (key.split(".")[0] !== String(exIndex)) return;
          var set = ds.completed[key] || {};
          if (!(Number(set.reps) > 0)) return;
          var assisted = isAssisted(exercise);
          var score = assisted ? -Number(set.weight || 0) : epley(set.weight, set.reps);
          var current = map[exercise.name];
          if (!current || score > current.score || (score === current.score && Number(set.reps) > current.reps)) {
            map[exercise.name] = {
              name: exercise.name,
              weight: Number(set.weight || 0),
              reps: Number(set.reps || 0),
              est1rm: assisted ? null : epley(set.weight, set.reps),
              date: day.id,
              ts: set.ts || 0,
              score: score,
              assisted: assisted,
              recordType: set.recordType || (set.pr ? "weight" : "baseline"),
              recordTypes: set.recordTypes || []
            };
          }
        });
      });
    });
    return Object.keys(map).map(function (key) { return map[key]; });
  }

  function renderRecords(ctx, sortMode) {
    var rows = scanRecords(ctx);
    sortMode = sortMode || "recency";
    rows.sort(function (a, b) {
      if (sortMode === "weight") return b.weight - a.weight;
      if (sortMode === "margin") return Number(b.est1rm || 0) - Number(a.est1rm || 0);
      return String(b.date).localeCompare(String(a.date));
    });
    var html = '<div class="sheet-grid"><div class="overview-card"><strong>Verified records</strong><p>The first verified set is a baseline. Reconstructed sessions never create PRs, and less assistance counts as progress on assisted movements.</p></div>';
    html += '<div class="segmented"><button data-action="records-sort" data-sort="recency" data-active="' + String(sortMode === "recency") + '">Recent</button><button data-action="records-sort" data-sort="weight" data-active="' + String(sortMode === "weight") + '">Weight</button><button data-action="records-sort" data-sort="margin" data-active="' + String(sortMode === "margin") + '">1RM</button></div>';
    if (!rows.length) return html + '<div class="overview-card"><strong>No records yet</strong><p>Complete sets to establish verified baselines.</p></div></div>';
    html += '<table class="mini-table"><thead><tr><th>Exercise</th><th>Top set</th><th>Record</th><th>Date</th></tr></thead><tbody>';
    rows.forEach(function (row) {
      html += '<tr><td>' + esc(ctx, row.name) + '</td><td>' + esc(ctx, ctx.formatWeight(row.weight)) + ' ' + esc(ctx, ctx.unitLabel()) + (row.assisted ? ' assist' : '') + ' x ' + esc(ctx, row.reps) + '</td><td>' + esc(ctx, recordLabel(row.recordType)) + '</td><td>' + esc(ctx, row.date) + '</td></tr>';
    });
    return html + '</tbody></table></div>';
  }

  function renderOneRmChart(ctx, exerciseName) {
    if (!exerciseName) return "";
    var rows = performances(ctx, exerciseName).filter(function (row) { return !isAssisted(row.exercise); }).reduce(function (acc, row) {
      var found = acc.find(function (item) { return item.date === row.date; });
      var value = epley(row.set.weight, row.set.reps);
      if (found) found.value = Math.max(found.value, value);
      else acc.push({ date: row.date, value: value });
      return acc;
    }, []).sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
    if (!rows.length) return '<div class="overview-card"><strong>Estimated 1RM</strong><p>Log this exercise to plot a strength trend.</p></div>';
    var vals = rows.map(function (row) { return ctx.kgToDisplay(row.value); });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 5; max += 5; }
    var points = vals.map(function (value, index) {
      var x = rows.length === 1 ? 160 : 24 + index * (272 / (rows.length - 1));
      var y = 150 - ((value - min) / (max - min)) * 110;
      return x + "," + y;
    }).join(" ");
    return '<div class="overview-card"><strong>Strength Score</strong><p>Epley estimated 1RM trend.</p></div><div class="chart"><svg viewBox="0 0 320 190"><path d="M24 150H300M24 40V150" stroke="currentColor" opacity=".18" fill="none"/><polyline points="' + points + '" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
  }

  root.records = {
    epley: epley,
    isAssisted: isAssisted,
    performances: performances,
    evaluateSet: evaluateSet,
    recordLabel: recordLabel,
    scanRecords: scanRecords,
    renderRecords: renderRecords,
    renderOneRmChart: renderOneRmChart
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.records;
})();
