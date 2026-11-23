(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var BLOCK_WEEKS = 4;
  var MAX_AUTO_BLOCKS = 12;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function dateAdd(dateId, days) {
    var date = new Date(dateId + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function labelParts(dateId) {
    var date = new Date(dateId + "T00:00:00Z");
    return {
      dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()],
      dom: date.getUTCDate(),
      month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()]
    };
  }

  function planEnd(plan) {
    var weeks = (plan && plan.weeks || []).filter(function (week) { return !week.generated; });
    var last = weeks[weeks.length - 1];
    var day = last && last.days && last.days[last.days.length - 1];
    return day && day.id || null;
  }

  function isLightPhase(week) {
    var phase = String(week && week.phase || "").toLowerCase();
    return phase.indexOf("deload") >= 0 || phase.indexOf("reentry") >= 0;
  }

  function templateWeek(plan) {
    var weeks = (plan && plan.weeks || []).filter(function (week) {
      return !week.generated && !isLightPhase(week) && (week.days || []).length === 7;
    });
    return weeks[weeks.length - 1] || (plan.weeks || []).filter(function (week) { return !week.generated; }).slice(-1)[0];
  }

  function actualByExercise(state, plan) {
    var normal = {};
    var fallback = {};
    (plan && plan.weeks || []).forEach(function (week) {
      var light = isLightPhase(week);
      (week.days || []).forEach(function (day) {
        var ds = (state && state.days || {})[day.id] || {};
        (day.exercises || []).forEach(function (exercise, exIndex) {
          var sets = Object.keys(ds.completed || {}).filter(function (key) {
            return key.split(".")[0] === String(exIndex) && Number((ds.completed[key] || {}).reps) > 0;
          }).map(function (key) { return ds.completed[key]; });
          if (!sets.length) return;
          var assisted = /assisted/i.test(exercise.name) || exercise.loadDirection === "lower";
          var weight = assisted
            ? Math.min.apply(null, sets.map(function (set) { return Number(set.weight || 0); }))
            : Math.max.apply(null, sets.map(function (set) { return Number(set.weight || 0); }));
          var entry = { date: day.id, weight: weight, sets: sets };
          if (!fallback[exercise.name] || day.id >= fallback[exercise.name].date) {
            fallback[exercise.name] = entry;
          }
          if (!light && (!normal[exercise.name] || day.id >= normal[exercise.name].date)) {
            normal[exercise.name] = entry;
          }
        });
      });
    });
    var map = {};
    Object.keys(fallback).forEach(function (name) {
      map[name] = normal[name] || fallback[name];
    });
    return map;
  }

  function roundHalf(value) { return Math.round(Number(value || 0) * 2) / 2; }

  function repBoundsFor(exercise, baseSets) {
    if (exercise && Array.isArray(exercise.repRange) && exercise.repRange.length >= 2) {
      var minVal = Number(exercise.repRange[0]);
      var maxVal = Number(exercise.repRange[1]);
      if (Number.isFinite(minVal) && Number.isFinite(maxVal) && minVal > 0 && maxVal >= minVal) {
        return { min: minVal, max: maxVal };
      }
    }
    var reps = (baseSets || []).map(function (set) { return Number(set && set.reps || 0); }).filter(function (v) { return v > 0; });
    var top = reps.length ? Math.max.apply(null, reps) : 10;
    return { min: Math.max(1, top - 2), max: Math.max(1, top) };
  }

  function adaptExercise(exercise, phaseIndex, actual) {
    var next = clone(exercise);
    var baseSets = Array.isArray(next.sets) ? next.sets : [];
    var baseWeight = actual && actual.weight != null ? Number(actual.weight) : (baseSets[0] ? Number(baseSets[0].weight || 0) : 0);
    var assisted = /assisted/i.test(next.name) || next.loadDirection === "lower";
    var bounds = repBoundsFor(next, baseSets);
    next.generated = true;
    next.source = "rolling-template";
    if (phaseIndex === 3) {
      var deloadSets = Math.max(1, Math.min(2, baseSets.length));
      var deloadWeight = assisted ? baseWeight + Number(next.incrementKg || 2.5) : roundHalf(baseWeight * 0.9);
      next.sets = baseSets.slice(0, deloadSets).map(function () {
        return { reps: bounds.min, weight: deloadWeight };
      });
      next.tag = "deload";
    } else {
      var targetReps = Math.min(bounds.max, Math.max(bounds.min, bounds.min + phaseIndex));
      next.sets = baseSets.map(function () {
        return { reps: targetReps, weight: baseWeight };
      });
      next.tag = phaseIndex === 0 ? "consolidate" : "adaptive reps";
    }
    var first = next.sets[0] || { weight: 0, reps: 0 };
    next.target = first.weight + " kg - " + next.sets.length + " x " + first.reps + " (adaptive baseline)";
    return next;
  }

  function generateBlock(state, plan, startDate, blockNumber) {
    var template = templateWeek(plan);
    if (!template) return [];
    var actual = actualByExercise(state, plan);
    var phases = ["Consolidate", "Load", "Load +", "Deload"];
    var subtitles = ["Own recent performance", "Add one clean rep", "Reach the top of the range", "Shed fatigue"];
    var weeks = [];
    var fixedWeekCount = (plan.weeks || []).filter(function (week) { return !week.generated; }).length;
    for (var weekIndex = 0; weekIndex < BLOCK_WEEKS; weekIndex += 1) {
      var weekStart = dateAdd(startDate, weekIndex * 7);
      var days = (template.days || []).map(function (templateDay, dayIndex) {
        var date = dateAdd(weekStart, dayIndex);
        var labels = labelParts(date);
        var day = clone(templateDay);
        day.id = date;
        day.dow = labels.dow;
        day.dom = labels.dom;
        day.month = labels.month;
        day.generated = true;
        day.source = "rolling-mesocycle";
        day.exercises = (templateDay.exercises || []).map(function (exercise) {
          return adaptExercise(exercise, weekIndex, actual[exercise.name]);
        });
        if (weekIndex === 3 && day.exercises.length) day.footer = "Deload: finish every set with at least 3 RIR; no PR attempts.";
        return day;
      });
      weeks.push({
        id: "rolling-b" + blockNumber + "-w" + (weekIndex + 1),
        num: fixedWeekCount + (blockNumber - 1) * BLOCK_WEEKS + weekIndex + 1,
        title: "Rolling Block " + blockNumber + " - " + phases[weekIndex],
        phase: phases[weekIndex],
        sub: subtitles[weekIndex],
        subtitle: subtitles[weekIndex],
        dateRange: weekStart + " to " + dateAdd(weekStart, 6),
        notice: "Generated from the last plan template and verified performance. The offline adaptive engine may adjust individual targets again when the session opens.",
        generated: true,
        days: days
      });
    }
    return weeks;
  }

  function ensureRollingPlan(state, plan, referenceDate) {
    var end = planEnd(plan);
    if (!end) return [];
    state.rollingPlan = state.rollingPlan && typeof state.rollingPlan === "object" ? state.rollingPlan : {};
    var valid = state.rollingPlan.sourcePlanEnd === end && Array.isArray(state.rollingPlan.weeks) && state.rollingPlan.weeks.length;
    if (!valid) {
      state.rollingPlan = {
        sourcePlanEnd: end,
        generatedAt: Date.now(),
        generatorVersion: 2,
        weeks: generateBlock(state, plan, dateAdd(end, 1), 1)
      };
    }
    if (referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(String(referenceDate))) {
      var maxWeeks = BLOCK_WEEKS * MAX_AUTO_BLOCKS;
      while (state.rollingPlan.weeks.length < maxWeeks) {
        var weeks = state.rollingPlan.weeks;
        var lastWeek = weeks[weeks.length - 1];
        var lastDay = lastWeek && lastWeek.days && lastWeek.days[lastWeek.days.length - 1];
        if (!lastDay || lastDay.id >= referenceDate) break;
        var blockNumber = Math.floor(weeks.length / BLOCK_WEEKS) + 1;
        var next = generateBlock(state, plan, dateAdd(lastDay.id, 1), blockNumber);
        if (!next.length) break;
        state.rollingPlan.weeks = weeks.concat(next);
        state.rollingPlan.generatedAt = Date.now();
      }
    }
    attachRollingPlan(state, plan);
    return state.rollingPlan.weeks;
  }

  function attachRollingPlan(state, plan) {
    var fixed = (plan.weeks || []).filter(function (week) { return !week.generated; });
    plan.weeks = fixed.concat(clone(state.rollingPlan && state.rollingPlan.weeks || []));
    return plan.weeks;
  }

  function appendBlock(state, plan) {
    ensureRollingPlan(state, plan);
    var weeks = state.rollingPlan.weeks || [];
    var lastWeek = weeks[weeks.length - 1];
    var lastDay = lastWeek && lastWeek.days && lastWeek.days[lastWeek.days.length - 1];
    var blockNumber = Math.floor(weeks.length / BLOCK_WEEKS) + 1;
    var next = generateBlock(state, plan, dateAdd(lastDay.id, 1), blockNumber);
    state.rollingPlan.weeks = weeks.concat(next);
    state.rollingPlan.generatedAt = Date.now();
    attachRollingPlan(state, plan);
    return next;
  }

  function renderProgram(ctx) {
    var rolling = ctx.state.rollingPlan || { weeks: [] };
    var weeks = rolling.weeks || [];
    var first = weeks[0];
    var last = weeks[weeks.length - 1];
    var startId = first && first.days && first.days[0] && first.days[0].id || '-';
    var endId = last && last.days && last.days.length && last.days[last.days.length - 1].id || '-';
    return '<div class="sheet-grid"><div class="overview-card"><strong>Rolling continuation block</strong><p>Lift generated a repeatable four-week mesocycle from recent performance: consolidate, add reps, reach the range top, then deload. Historical prescriptions remain unchanged.</p></div>' +
      '<div class="metric-grid"><div class="metric-card"><div class="label">Starts</div><div class="value">' + ctx.escapeHtml(startId) + '</div></div><div class="metric-card"><div class="label">Through</div><div class="value">' + ctx.escapeHtml(endId) + '</div></div><div class="metric-card"><div class="label">Source</div><div class="value">Actual + template</div></div></div>' +
      '<div class="overview-card"><strong>How it behaves</strong><p>Verified loads can override the template. Missed reps hold or reduce; clean top-range work with 1-2 RIR earns the next increment. Generated weeks are local-only until exported.</p><div class="sheet-actions"><button class="action-btn" data-action="program-next-block">Generate next 4 weeks</button></div></div></div>';
  }

  root.program = {
    BLOCK_WEEKS: BLOCK_WEEKS,
    dateAdd: dateAdd,
    planEnd: planEnd,
    actualByExercise: actualByExercise,
    generateBlock: generateBlock,
    ensureRollingPlan: ensureRollingPlan,
    attachRollingPlan: attachRollingPlan,
    appendBlock: appendBlock,
    renderProgram: renderProgram
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.program;
})();
