(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeName(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function isAssisted(exercise) {
    return !!(exercise && exercise.loadDirection === "lower") || /\bassisted\b/i.test(exercise && exercise.name || "");
  }

  function incrementFor(exercise, fallback) {
    if (number(exercise && exercise.incrementKg, 0) > 0) return number(exercise.incrementKg, fallback || 2.5);
    var name = normalizeName(exercise && exercise.name);
    if (/lateral raise|rear delt|curl/.test(name)) return 1;
    if (/dumbbell|\bdb\b/.test(name)) return 2;
    return number(fallback, 2.5);
  }

  function repRangeFor(exercise, plannedSets) {
    if (exercise && Array.isArray(exercise.repRange) && exercise.repRange.length >= 2) {
      return { min: number(exercise.repRange[0], 8), max: number(exercise.repRange[1], 12) };
    }
    var reps = (plannedSets || []).map(function (set) { return number(set.reps, 0); }).filter(function (value) { return value > 0; });
    var target = reps.length ? Math.max.apply(null, reps) : 10;
    return { min: Math.max(1, target - 2), max: Math.max(1, target) };
  }

  function roundTo(value, increment) {
    if (!(increment > 0)) return value;
    return Math.round(value / increment) * increment;
  }

  function latestSession(history) {
    return (Array.isArray(history) ? history : []).filter(function (session) {
      return session && Array.isArray(session.sets) && session.sets.some(function (set) { return number(set.reps, 0) > 0; });
    }).sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    })[0] || null;
  }

  function formatReps(sets) {
    return sets.map(function (set) { return number(set.reps, 0); }).join("/");
  }

  function representativeWeight(sets, assisted) {
    var values = sets.map(function (set) { return number(set.weight, 0); }).filter(function (value) { return value >= 0; });
    if (!values.length) return 0;
    return assisted ? Math.min.apply(null, values) : Math.max.apply(null, values);
  }

  function suggest(input) {
    input = input || {};
    var exercise = input.exercise || {};
    var plannedSets = Array.isArray(input.plannedSets) ? input.plannedSets : [];
    var planWeight = plannedSets.length ? number(plannedSets[0].weight, 0) : 0;
    var range = input.repRange || repRangeFor(exercise, plannedSets);
    var increment = number(input.incrementKg, incrementFor(exercise, 2.5));
    var assisted = isAssisted(exercise);
    var last = latestSession(input.history);
    var plannedSetCount = plannedSets.length || 1;

    if (input.deload) {
      return {
        action: "deload",
        weight: planWeight,
        reps: range.min,
        sets: plannedSetCount,
        reason: "Use the planned deload: reduce fatigue and keep at least 3 RIR.",
        basedOn: last
      };
    }

    if (input.reentry === true) {
      return {
        action: "reentry",
        weight: planWeight,
        reps: plannedSets[0] ? number(plannedSets[0].reps, range.min) : range.min,
        sets: plannedSetCount,
        reason: "Reentry ramp: rebuild movement grooves with 2-3 RIR before pushing load.",
        basedOn: last
      };
    }

    var gapDays = input.dayId && last && last.date ? dateDistanceDays(last.date, input.dayId) : null;
    if (gapDays != null && Number.isFinite(gapDays) && gapDays >= 21) {
      return {
        action: "reentry",
        weight: planWeight,
        reps: plannedSets[0] ? number(plannedSets[0].reps, range.min) : range.min,
        sets: plannedSetCount,
        reason: "Returning after " + gapDays + " days off: start with the planned ramp load (" + planWeight + " kg) and keep 2-3 RIR.",
        basedOn: last
      };
    }

    if (!last) {
      return {
        action: "baseline",
        weight: planWeight,
        reps: plannedSets[0] ? number(plannedSets[0].reps, range.min) : range.min,
        sets: plannedSetCount,
        reason: "Use the plan as a baseline; no verified prior set is available.",
        basedOn: null
      };
    }

    var completed = last.sets.filter(function (set) { return number(set.reps, 0) > 0; });
    var lastWeight = representativeWeight(completed, assisted);
    var baseWeight = assisted ? (planWeight > 0 ? Math.min(planWeight, lastWeight) : lastWeight) : Math.max(planWeight, lastWeight);
    var missedMinimum = completed.filter(function (set) { return number(set.reps, 0) < range.min; }).length;
    var allTop = completed.length >= plannedSetCount && completed.every(function (set) { return number(set.reps, 0) >= range.max; });
    var lastWorking = completed[completed.length - 1] || {};
    var rir = lastWorking.rir == null ? (last.rir == null ? null : number(last.rir, null)) : number(lastWorking.rir, null);
    var pain = !!(last.pain || last.flags && last.flags.pain);
    var formIssue = !!(last.formIssue || last.flags && last.flags.formIssue);
    var repsText = formatReps(completed);

    if (pain) {
      return {
        action: "pain-hold",
        weight: lastWeight || planWeight,
        reps: range.min,
        sets: Math.max(1, plannedSetCount - 1),
        reason: "Do not progress load: pain was flagged last time; use a comfortable variation or stop if pain persists.",
        basedOn: last
      };
    }
    if (formIssue) {
      return {
        action: "form-hold",
        weight: lastWeight || planWeight,
        reps: range.min,
        sets: plannedSetCount,
        reason: "Hold the load and restore clean form before progressing.",
        basedOn: last
      };
    }
    if (input.recoveryHours != null && number(input.recoveryHours, 999) < 48) {
      return {
        action: "recovery-hold",
        weight: lastWeight || planWeight,
        reps: range.min,
        sets: Math.max(1, plannedSetCount - 1),
        reason: "Recovery safeguard: this muscle was trained less than 48 hours ago; hold load and trim one set.",
        basedOn: last
      };
    }
    if (input.recentVolumeHigh) {
      return {
        action: "volume-hold",
        weight: lastWeight || planWeight,
        reps: range.min,
        sets: Math.max(1, plannedSetCount - 1),
        reason: "Recent " + input.recentVolumeHigh + " workload is already high; hold load and avoid junk volume.",
        basedOn: last
      };
    }
    if (number(input.readiness, 10) <= 5) {
      return {
        action: "reduced-volume",
        weight: lastWeight || planWeight,
        reps: range.min,
        sets: Math.max(1, plannedSetCount - 1),
        reason: "Readiness is low: keep the last load and remove one working set.",
        basedOn: last
      };
    }
    if (missedMinimum >= 2) {
      var reduced = assisted ? lastWeight + increment : Math.max(0, lastWeight - increment);
      return {
        action: "reduce",
        weight: roundTo(reduced, increment),
        reps: range.min,
        sets: plannedSetCount,
        reason: "Reduce slightly: you reached " + repsText + " last time and missed the minimum on multiple sets.",
        basedOn: last
      };
    }
    if (allTop && rir != null && rir >= 1 && rir <= 2) {
      var progressed = assisted ? Math.max(0, baseWeight - increment) : baseWeight + increment;
      return {
        action: "increase",
        weight: roundTo(progressed, increment),
        reps: range.min,
        sets: plannedSetCount,
        reason: (assisted ? "Use less assistance at " : "Move to ") + roundTo(progressed, increment) + " kg: " + repsText + " completed with " + rir + " RIR.",
        basedOn: last
      };
    }
    if (allTop && rir === 0) {
      return {
        action: "hold",
        weight: baseWeight,
        reps: range.max,
        sets: plannedSetCount,
        reason: "Hold at " + baseWeight + " kg: the top reps were completed at 0 RIR.",
        basedOn: last
      };
    }
    if (missedMinimum > 0) {
      return {
        action: "hold",
        weight: lastWeight || planWeight,
        reps: range.min,
        sets: plannedSetCount,
        reason: "Stay at " + (lastWeight || planWeight) + " kg: you reached " + repsText + " last time.",
        basedOn: last
      };
    }

    var nextRep = Math.min(range.max, Math.max.apply(null, completed.map(function (set) { return number(set.reps, range.min); })) + 1);
    return {
      action: "add-rep",
      weight: baseWeight,
      reps: nextRep,
      sets: plannedSetCount,
      reason: "Keep " + baseWeight + " kg and target " + nextRep + " reps before adding load.",
      basedOn: last
    };
  }

  function historyForExercise(ctx, exerciseName, beforeDate) {
    var rows = [];
    (ctx.allDays ? ctx.allDays() : []).forEach(function (entry) {
      if (!entry || !entry.day || entry.day.id >= beforeDate) return;
      var ds = (ctx.state.days || {})[entry.day.id] || {};
      if (ds.status === "reconstructed" && !validSets(ds.completed)) return;
      (entry.day.exercises || []).forEach(function (exercise, exIndex) {
        if (normalizeName(exercise.name) !== normalizeName(exerciseName)) return;
        var sets = Object.keys(ds.completed || {}).filter(function (key) {
          return key.split(".")[0] === String(exIndex) && number(ds.completed[key] && ds.completed[key].reps, 0) > 0;
        }).sort(function (a, b) { return Number(a.split(".")[1]) - Number(b.split(".")[1]); }).map(function (key) {
          return ds.completed[key];
        });
        if (!sets.length) return;
        rows.push({
          date: entry.day.id,
          sets: sets,
          readiness: ds.readiness,
          flags: (ds.exerciseFlags || {})[String(exIndex)] || {}
        });
      });
    });
    return rows;
  }

  function validSets(completed) {
    return Object.keys(completed || {}).some(function (key) { return number(completed[key] && completed[key].reps, 0) > 0; });
  }

  function dateDistanceDays(from, to) {
    return Math.round((new Date(to + "T00:00:00Z") - new Date(from + "T00:00:00Z")) / 86400000);
  }

  function recoverySignals(ctx, exercise, dayId) {
    var volume = root.volume;
    var targetAllocation = volume && volume.classifyExercise ? volume.classifyExercise(exercise) : {};
    var targetMuscles = Object.keys(targetAllocation);
    var latestOverlap = null;
    (ctx.allDays ? ctx.allDays() : []).forEach(function (entry) {
      if (!entry || !entry.day || entry.day.id >= dayId || dateDistanceDays(entry.day.id, dayId) > 7) return;
      var ds = (ctx.state.days || {})[entry.day.id] || {};
      (entry.day.exercises || []).forEach(function (priorExercise, exIndex) {
        var sameExercise = normalizeName(priorExercise.name) === normalizeName(exercise.name);
        var priorAllocation = volume && volume.classifyExercise ? volume.classifyExercise(priorExercise) : {};
        var overlaps = sameExercise || targetMuscles.some(function (muscle) { return Number(priorAllocation[muscle] || 0) > 0; });
        if (!overlaps) return;
        var hasSets = Object.keys(ds.completed || {}).some(function (key) {
          return key.split(".")[0] === String(exIndex) && number(ds.completed[key] && ds.completed[key].reps, 0) > 0;
        });
        if (hasSets && (!latestOverlap || entry.day.id > latestOverlap)) latestOverlap = entry.day.id;
      });
    });

    var highGroup = null;
    if (volume && volume.rangeMetrics && volume.TARGETS && targetMuscles.length) {
      var end = new Date(dayId + "T00:00:00Z");
      end.setUTCDate(end.getUTCDate() - 1);
      var start = new Date(dayId + "T00:00:00Z");
      start.setUTCDate(start.getUTCDate() - 7);
      var metrics = volume.rangeMetrics(ctx, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
      highGroup = targetMuscles.find(function (muscle) {
        var target = volume.TARGETS[muscle];
        return target && Number(metrics[muscle] || 0) > target[1];
      }) || null;
    }
    return {
      recoveryHours: latestOverlap ? dateDistanceDays(latestOverlap, dayId) * 24 : null,
      recentVolumeHigh: highGroup && volume.LABELS && volume.LABELS[highGroup] || highGroup
    };
  }

  function resolveWeek(ctx, day) {
    if (ctx.weekForDayId && day && day.id) {
      var byId = ctx.weekForDayId(day.id);
      if (byId) return byId;
    }
    if (ctx.allDays && day && day.id) {
      var found = ctx.allDays().find(function (entry) {
        return entry && entry.day && entry.day.id === day.id && entry.week;
      });
      if (found && found.week) return found.week;
    }
    return ctx.getWeek && ctx.state ? ctx.getWeek(ctx.state.activeWeekId) : null;
  }

  function forExercise(ctx, day, exercise, exIndex) {
    var week = resolveWeek(ctx, day);
    var phase = String(week && week.phase || "").toLowerCase();
    var ds = (ctx.state && ctx.state.days || {})[day.id] || {};
    var recovery = recoverySignals(ctx, exercise, day.id);
    return suggest({
      dayId: day.id,
      exercise: exercise,
      plannedSets: exercise.sets || [],
      history: historyForExercise(ctx, exercise.name, day.id),
      readiness: ds.readiness,
      deload: phase.indexOf("deload") >= 0,
      reentry: phase.indexOf("reentry") >= 0,
      incrementKg: incrementFor(exercise, ctx.state && ctx.state.settings && ctx.state.settings.weightStep),
      recoveryHours: recovery.recoveryHours,
      recentVolumeHigh: recovery.recentVolumeHigh
    });
  }

  root.progression = {
    normalizeName: normalizeName,
    isAssisted: isAssisted,
    incrementFor: incrementFor,
    repRangeFor: repRangeFor,
    suggest: suggest,
    historyForExercise: historyForExercise,
    recoverySignals: recoverySignals,
    forExercise: forExercise
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.progression;
})();
