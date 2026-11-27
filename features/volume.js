(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var GROUPS = [
    "chest", "upperChest", "lats", "upperBack", "sideDelts", "rearDelts",
    "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "abs", "spinalErectors"
  ];
  var LABELS = {
    chest: "Chest", upperChest: "Upper chest", lats: "Lats", upperBack: "Upper / mid back",
    sideDelts: "Side delts", rearDelts: "Rear delts", biceps: "Biceps", triceps: "Triceps",
    quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves",
    abs: "Abs / core", spinalErectors: "Lower back"
  };
  var TARGETS = {
    chest: [6, 12], upperChest: [8, 12], lats: [8, 12], upperBack: [6, 12],
    sideDelts: [8, 14], rearDelts: [6, 12], biceps: [4, 10], triceps: [4, 10],
    quads: [8, 14], hamstrings: [6, 12], glutes: [6, 12], calves: [6, 12],
    abs: [6, 10], spinalErectors: [4, 8]
  };
  var PRIORITY = ["upperChest", "sideDelts", "lats", "abs", "spinalErectors"];

  function add(out, key, value) {
    out[key] = Math.max(out[key] || 0, Number(value) || 0);
  }

  function normalize(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function classifyExercise(exercise) {
    var out = {};
    if (exercise && exercise.muscleGroups && typeof exercise.muscleGroups === "object") {
      if (Array.isArray(exercise.muscleGroups)) {
        exercise.muscleGroups.forEach(function (key, index) { add(out, key, index === 0 ? 1 : 0.5); });
      } else {
        Object.keys(exercise.muscleGroups).forEach(function (key) { add(out, key, exercise.muscleGroups[key]); });
      }
      if (Object.keys(out).length) return out;
    }
    var name = normalize(exercise && exercise.name);
    if (/incline.*(?:press|fly)|low to high.*fly/.test(name)) { add(out, "upperChest", 1); add(out, "chest", 0.5); add(out, "triceps", 0.35); }
    else if (/chest press|bench press|pec fly|push up|\bdips?\b/.test(name)) { add(out, "chest", 1); add(out, "triceps", 0.5); }
    if (/lateral raise|side delt/.test(name)) add(out, "sideDelts", 1);
    if (/rear delt|face pull|reverse.*fly/.test(name)) { add(out, "rearDelts", 1); add(out, "upperBack", 0.5); }
    if (/pulldown|pull up|chin up/.test(name)) { add(out, "lats", 1); add(out, "biceps", 0.5); }
    if (/\brow\b|rows/.test(name) && !/upright/.test(name)) { add(out, "upperBack", 1); add(out, "lats", 0.5); add(out, "biceps", 0.35); }
    if (/bicep|biceps|incline.*curl|db.*curl/.test(name)) add(out, "biceps", 1);
    if (/tricep|triceps|pushdown|skull crusher/.test(name)) add(out, "triceps", 1);
    if (/squat|leg press|lunge|split squat/.test(name)) { add(out, "quads", 1); add(out, "glutes", 0.5); }
    if (/leg curl|hamstring curl/.test(name)) add(out, "hamstrings", 1);
    if (/romanian deadlift|\brdl\b/.test(name)) { add(out, "hamstrings", 1); add(out, "glutes", 0.75); add(out, "spinalErectors", 0.5); }
    if (/back extension|good morning|hip hinge/.test(name)) { add(out, "spinalErectors", 1); add(out, "glutes", 0.5); add(out, "hamstrings", 0.5); }
    if (/hip thrust|glute bridge/.test(name)) add(out, "glutes", 1);
    if (/calf raise/.test(name)) add(out, "calves", 1);
    if (/abdominal|cable crunch|hanging.*raise|leg raise|ab wheel|rollout|plank/.test(name)) add(out, "abs", 1);
    return out;
  }

  function isHardSet(set, exercise, phase) {
    if (!set || !(Number(set.reps) > 0) || set.warmup === true || set.hardSet === false) return false;
    if (set.rir != null && Number(set.rir) > 4) return false;
    if (exercise && exercise.warmup === true) return false;
    return true;
  }

  function stimulusFactor(exercise, phase) {
    var tag = String(exercise && exercise.tag || "").toLowerCase();
    if (String(phase || "").toLowerCase().indexOf("deload") >= 0) return 0.5;
    if (/technique|primer|reset|re entry/.test(tag)) return 0.5;
    return 1;
  }

  function emptyMetrics() {
    var out = {};
    GROUPS.forEach(function (group) { out[group] = 0; });
    return out;
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

  function dateAdd(dateId, days) {
    var date = parseUtcDate(dateId);
    if (!date) return "";
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function startOfWeek(dateId) {
    var date = parseUtcDate(dateId);
    if (!date) return "";
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  }

  function rangeMetrics(ctx, start, end) {
    var metrics = emptyMetrics();
    if (!start || !end) return metrics;
    var stateDays = (ctx && ctx.state && ctx.state.days) || {};
    (ctx && ctx.allDays ? ctx.allDays() : []).forEach(function (entry) {
      if (!entry || !entry.day || !entry.day.id || entry.day.id < start || entry.day.id > end) return;
      var ds = stateDays[entry.day.id] || {};
      if (ds.status === "reconstructed" && !Object.keys(ds.completed || {}).length) return;
      var phase = entry.week && entry.week.phase;
      (entry.day.exercises || []).forEach(function (exercise, exIndex) {
        var allocation = classifyExercise(exercise);
        var factor = stimulusFactor(exercise, phase);
        Object.keys(ds.completed || {}).forEach(function (key) {
          if (key.split(".")[0] !== String(exIndex)) return;
          var set = ds.completed[key];
          if (!isHardSet(set, exercise, phase)) return;
          Object.keys(allocation).forEach(function (group) {
            if (!Object.prototype.hasOwnProperty.call(metrics, group)) return;
            metrics[group] += allocation[group] * factor;
          });
        });
      });
    });
    GROUPS.forEach(function (group) { metrics[group] = Math.round(metrics[group] * 10) / 10; });
    return metrics;
  }

  function weeklyMetrics(ctx, referenceDate) {
    var today = referenceDate || (ctx && typeof ctx.todayId === "function" && ctx.todayId()) || "";
    var currentStart = startOfWeek(today);
    if (!currentStart) {
      return { current: emptyMetrics(), last: emptyMetrics(), average4: emptyMetrics(), weekStart: "" };
    }
    var current = rangeMetrics(ctx, currentStart, dateAdd(currentStart, 6));
    var lastStart = dateAdd(currentStart, -7);
    var last = rangeMetrics(ctx, lastStart, dateAdd(lastStart, 6));
    var four = emptyMetrics();
    for (var week = 0; week < 4; week += 1) {
      var start = dateAdd(currentStart, -7 * week);
      var row = rangeMetrics(ctx, start, dateAdd(start, 6));
      GROUPS.forEach(function (group) { four[group] += row[group] / 4; });
    }
    GROUPS.forEach(function (group) { four[group] = Math.round(four[group] * 10) / 10; });
    return { current: current, last: last, average4: four, weekStart: currentStart };
  }

  function volumeStatus(group, value) {
    var target = TARGETS[group] || [0, Infinity];
    if (value < target[0]) return "under";
    if (value > target[1]) return "high";
    return "on-target";
  }

  function renderVolume(ctx) {
    var metrics = weeklyMetrics(ctx, ctx.todayId());
    var ordered = PRIORITY.concat(GROUPS.filter(function (group) { return PRIORITY.indexOf(group) < 0; }));
    var html = '<div class="sheet-grid"><div class="overview-card"><strong>Effective hypertrophy workload</strong><p>Hard working-set equivalents, with secondary muscles counted fractionally and easy technique/deload work discounted. More is not automatically better.</p></div>';
    html += '<div class="volume-table"><div class="volume-row volume-head"><span>Muscle</span><span>This</span><span>Last</span><span>4-wk</span></div>';
    ordered.forEach(function (group) {
      var current = metrics.current[group];
      var status = volumeStatus(group, current);
      html += '<div class="volume-row" data-priority="' + String(PRIORITY.indexOf(group) >= 0) + '" data-volume-status="' + status + '"><span><strong>' + LABELS[group] + '</strong><small>' + status.replace("-", " ") + '</small></span><span>' + current + '</span><span>' + metrics.last[group] + '</span><span>' + metrics.average4[group] + '</span></div>';
    });
    html += '</div><p class="section-sub">Priority order: upper chest, side delts, lats, abs, then lower back. Direct arm volume stays intentionally modest.</p></div>';
    return html;
  }

  root.volume = {
    GROUPS: GROUPS,
    LABELS: LABELS,
    TARGETS: TARGETS,
    PRIORITY: PRIORITY,
    classifyExercise: classifyExercise,
    isHardSet: isHardSet,
    rangeMetrics: rangeMetrics,
    weeklyMetrics: weeklyMetrics,
    volumeStatus: volumeStatus,
    renderVolume: renderVolume
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.volume;
})();
