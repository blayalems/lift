// Offline deterministic AI Coach, multi-signal athlete diagnostics,
// intent/entity parser, autoregulation actions, and Material 3 Expressive views.
(function () {
  "use strict";

  var root = typeof window !== "undefined"
    ? (window.LIFT_FEATURES = window.LIFT_FEATURES || {})
    : {};

  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var TONES = ["analytical", "stoic", "hype"];
  var MAX_MESSAGES = 30;
  var MAX_CHECKINS = 30;

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function num(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundStep(value, step) {
    if (!(step > 0)) return Math.round(value * 100) / 100;
    return Math.round((Math.round(value / step) * step) * 100) / 100;
  }

  function formatClean(value, decimals) {
    var n = Number(value);
    if (!Number.isFinite(n)) return "0";
    var d = decimals == null ? 1 : decimals;
    return String(Number(n.toFixed(d)));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function esc(ctx, value) {
    return ctx && typeof ctx.escapeHtml === "function" ? ctx.escapeHtml(value) : escapeHtml(value);
  }

  function isValidDateId(id) {
    var match = DATE_RE.exec(String(id || ""));
    if (!match) return false;
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function utcMs(id) {
    var match = DATE_RE.exec(String(id || ""));
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function dateAdd(dateId, days) {
    if (!isValidDateId(dateId)) return dateId;
    var dt = new Date(utcMs(dateId));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  function dateDiffDays(fromId, toId) {
    if (!isValidDateId(fromId) || !isValidDateId(toId)) return null;
    return Math.round((utcMs(toId) - utcMs(fromId)) / 86400000);
  }

  function localTodayId() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function resolveRefDate(ctx, referenceDate) {
    if (isValidDateId(referenceDate)) return referenceDate;
    if (ctx && typeof ctx.todayId === "function") {
      var t = ctx.todayId();
      if (isValidDateId(t)) return t;
    }
    var activeId = ctx && ctx.state && ctx.state.activeDayId;
    if (isValidDateId(activeId)) return activeId;
    return localTodayId();
  }

  function normalizeName(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function normalizePhase(ctx, phase) {
    if (ctx && typeof ctx.normalizePhase === "function") return ctx.normalizePhase(phase);
    var value = String(phase || "").toLowerCase().replace(/\s+/g, "");
    if (value === "load+") return "loadplus";
    if (value === "consolidation") return "consolidate";
    return value;
  }

  function isAssisted(ex) {
    return !!(ex && ex.loadDirection === "lower") || /\bassisted\b/i.test(String(ex && ex.name || ex || ""));
  }

  function isCompound(ex) {
    if (!ex) return false;
    var name = String(ex.name || "");
    if (ex.primary === true) return true;
    if (/\b(curl|curls|pushdown|pushdowns|lateral raise|lateral raises|rear delt|pec fly|fly|flye|calf|abdominal|knee raise|back extension|leg curl|leg curls)\b/i.test(name)) {
      return false;
    }
    return /\b(leg press|squat|squats|romanian deadlift|rdl|deadlift|press|pulldown|row|lunge|lunges|dip|dips|chin up|pull up|hip thrust)\b/i.test(name);
  }

  function incrementFor(ctx, ex) {
    var prog = (ctx && ctx.progression) || root.progression;
    var fallback = ctx && ctx.state && ctx.state.settings ? num(ctx.state.settings.weightStep, 2.5) : 2.5;
    if (prog && typeof prog.incrementFor === "function") return prog.incrementFor(ex, fallback);
    if (num(ex && ex.incrementKg, 0) > 0) return num(ex.incrementKg, fallback);
    var n = normalizeName(ex && ex.name);
    if (/lateral raise|rear delt|curl/.test(n)) return 1;
    if (/dumbbell|\bdb\b/.test(n)) return 2;
    return fallback;
  }

  function repRangeFor(ctx, ex) {
    var prog = (ctx && ctx.progression) || root.progression;
    var sets = (ex && ex.sets) || [];
    if (prog && typeof prog.repRangeFor === "function") return prog.repRangeFor(ex, sets);
    if (ex && Array.isArray(ex.repRange) && ex.repRange.length >= 2) {
      return { min: num(ex.repRange[0], 8), max: num(ex.repRange[1], 12) };
    }
    var reps = sets.map(function (s) { return num(s && s.reps, 0); }).filter(function (v) { return v > 0; });
    var top = reps.length ? Math.max.apply(null, reps) : 10;
    return { min: Math.max(1, top - 2), max: Math.max(1, top) };
  }

  function epley(weight, reps) {
    var w = num(weight, 0);
    var r = num(reps, 0);
    if (w <= 0 || r <= 0) return 0;
    if (r === 1) return w;
    return w * (1 + r / 30);
  }

  function unitLabel(ctx) {
    return (ctx && typeof ctx.unitLabel === "function" && ctx.unitLabel()) ||
      (ctx && ctx.state && ctx.state.settings && ctx.state.settings.units === "lb" ? "lb" : "kg");
  }

  function formatWeightDisplay(ctx, kg) {
    var val = ctx && typeof ctx.kgToDisplay === "function" ? num(ctx.kgToDisplay(kg), kg) : num(kg, 0);
    return formatClean(val, 1) + " " + unitLabel(ctx);
  }

  function hasVerifiedReps(dayState) {
    var completed = dayState && dayState.completed;
    if (!isObject(completed)) return false;
    return Object.keys(completed).some(function (key) {
      return num(completed[key] && completed[key].reps, 0) > 0;
    });
  }

  function isTrainedSession(dayState) {
    if (!isObject(dayState)) return false;
    if (hasVerifiedReps(dayState)) return true;
    return dayState.status === "reconstructed" && dayState.trained !== false;
  }

  function mergedDayExercises(day, ds) {
    var base = Array.isArray(day && day.exercises) ? day.exercises : [];
    var custom = Array.isArray(ds && ds.customExercises) ? ds.customExercises : [];
    if (!custom.length) return base;
    if (base.some(function (ex) { return ex && ex.custom; })) return base;
    return base.concat(custom);
  }

  function collectAllEntries(ctx) {
    var raw = (ctx && typeof ctx.allDays === "function" ? ctx.allDays() : []) || [];
    var stateDays = (ctx && ctx.state && ctx.state.days) || {};
    return raw.filter(function (entry) {
      return entry && entry.day && isValidDateId(entry.day.id);
    }).map(function (entry) {
      var ds = stateDays[entry.day.id] || {};
      var exercises = mergedDayExercises(entry.day, ds);
      var day = exercises === entry.day.exercises ? entry.day : Object.assign({}, entry.day, { exercises: exercises });
      return { week: entry.week || null, day: day };
    }).sort(function (a, b) {
      return a.day.id.localeCompare(b.day.id);
    });
  }

  function resolveActiveDay(ctx, refDate, entries) {
    var activeId = ctx && ctx.state && ctx.state.activeDayId;
    if (ctx && typeof ctx.getDay === "function" && activeId) {
      var direct = ctx.getDay(activeId);
      if (direct) return direct;
    }
    var byActive = activeId ? entries.find(function (e) { return e.day.id === activeId; }) : null;
    if (byActive) return byActive.day;
    var byRef = entries.find(function (e) { return e.day.id === refDate; });
    if (byRef) return byRef.day;
    return null;
  }

  function resolveActiveWeek(ctx, dayId, entries) {
    var state = (ctx && ctx.state) || {};
    if (dayId && ctx && typeof ctx.weekForDayId === "function") {
      var w = ctx.weekForDayId(dayId);
      if (w) return w;
    }
    if (dayId) {
      var found = entries.find(function (e) { return e.day.id === dayId && e.week; });
      if (found) return found.week;
    }
    if (ctx && typeof ctx.getWeek === "function" && state.activeWeekId) {
      return ctx.getWeek(state.activeWeekId);
    }
    return null;
  }

  function ensureCoachMemory(state) {
    var base = {
      tone: "analytical",
      messages: [],
      checkins: [],
      lastBriefDate: null
    };
    if (!isObject(state)) return base;
    var raw = isObject(state.coachMemory) ? state.coachMemory : {};
    var tone = TONES.indexOf(raw.tone) >= 0 ? raw.tone : "analytical";
    var messages = Array.isArray(raw.messages)
      ? raw.messages.filter(function (msg) {
        return isObject(msg) && (msg.role === "user" || msg.role === "coach") && typeof msg.text === "string" && msg.text.length > 0;
      }).map(function (msg) {
        var next = {
          id: String(msg.id || ("m-" + (msg.ts || Date.now()))),
          role: msg.role,
          text: msg.text,
          ts: num(msg.ts, Date.now())
        };
        if (msg.actionType) next.actionType = String(msg.actionType);
        if (msg.actionLabel) next.actionLabel = String(msg.actionLabel);
        if (isObject(msg.actionPayload)) next.actionPayload = Object.assign({}, msg.actionPayload);
        return next;
      }).slice(-MAX_MESSAGES)
      : [];
    var checkins = Array.isArray(raw.checkins)
      ? raw.checkins.filter(isObject).slice(-MAX_CHECKINS)
      : [];
    var lastBriefDate = isValidDateId(raw.lastBriefDate) ? raw.lastBriefDate : null;
    var target = isObject(state.coachMemory) ? state.coachMemory : (state.coachMemory = {});
    target.tone = tone;
    target.messages = messages;
    target.checkins = checkins;
    target.lastBriefDate = lastBriefDate;
    return target;
  }

  function buildExerciseSessions(ctx, entries, cutoffDate) {
    var stateDays = (ctx && ctx.state && ctx.state.days) || {};
    var byName = {};
    entries.forEach(function (entry) {
      if (cutoffDate && entry.day.id > cutoffDate) return;
      var ds = stateDays[entry.day.id] || {};
      if (ds.status === "reconstructed" && !hasVerifiedReps(ds)) return;
      var phase = normalizePhase(ctx, entry.week && entry.week.phase);
      (entry.day.exercises || []).forEach(function (ex, exIndex) {
        if (!ex || !ex.name) return;
        var sets = Object.keys(ds.completed || {}).filter(function (key) {
          return key.split(".")[0] === String(exIndex) && num(ds.completed[key] && ds.completed[key].reps, 0) > 0;
        }).sort(function (a, b) {
          return Number(a.split(".")[1]) - Number(b.split(".")[1]);
        }).map(function (key) {
          return ds.completed[key];
        });
        if (!sets.length) return;
        var assisted = isAssisted(ex);
        var weights = sets.map(function (s) { return num(s.weight, 0); });
        var maxWeight = assisted ? Math.min.apply(null, weights) : Math.max.apply(null, weights);
        var repsAtMax = sets.filter(function (s) { return Math.abs(num(s.weight, 0) - maxWeight) < 0.01; })
          .map(function (s) { return num(s.reps, 0); });
        var topRepsAtMax = repsAtMax.length ? Math.max.apply(null, repsAtMax) : Math.max.apply(null, sets.map(function (s) { return num(s.reps, 0); }));
        var totalReps = sets.reduce(function (sum, s) { return sum + num(s.reps, 0); }, 0);
        var bestE1RM = assisted ? 0 : Math.max.apply(null, sets.map(function (s) { return epley(s.weight, s.reps); }));
        var hasPr = sets.some(function (s) { return s.pr === true && s.recordType !== "baseline"; });
        var hasAnyPrFlag = sets.some(function (s) { return s.pr === true; });
        var norm = normalizeName(ex.name);
        if (!byName[norm]) byName[norm] = { name: ex.name, exercise: ex, sessions: [] };
        byName[norm].name = ex.name;
        byName[norm].exercise = ex;
        byName[norm].sessions.push({
          date: entry.day.id,
          phase: phase,
          sets: sets,
          maxWeight: maxWeight,
          topRepsAtMax: topRepsAtMax,
          totalReps: totalReps,
          bestE1RM: bestE1RM,
          hasPr: hasPr,
          hasAnyPrFlag: hasAnyPrFlag,
          assisted: assisted
        });
      });
    });
    return byName;
  }

  function detectPlateausAndSurges(ctx, byName, refDate, daysSinceLast) {
    var plateaus = [];
    var surges = [];
    Object.keys(byName).forEach(function (norm) {
      var bucket = byName[norm];
      var all = bucket.sessions;
      var nonLight = all.filter(function (s) {
        return s.phase !== "deload" && s.phase !== "reentry";
      });
      var series = nonLight.length >= 3 ? nonLight : all;
      var isPlateau = false;
      if (series.length >= 3) {
        var s0 = series[series.length - 3];
        var s1 = series[series.length - 2];
        var s2 = series[series.length - 1];
        var sameMax = Math.abs(s0.maxWeight - s1.maxWeight) < 0.01 && Math.abs(s1.maxWeight - s2.maxWeight) < 0.01;
        var noRepGain = s2.topRepsAtMax <= s0.topRepsAtMax &&
          s2.topRepsAtMax <= s1.topRepsAtMax &&
          s2.totalReps <= Math.max(s0.totalReps, s1.totalReps) &&
          !(s2.totalReps > s1.totalReps && s1.totalReps >= s0.totalReps);
        if (sameMax && noRepGain) {
          isPlateau = true;
          var streak = 3;
          for (var i = series.length - 4; i >= 0; i -= 1) {
            if (Math.abs(series[i].maxWeight - s2.maxWeight) < 0.01 && series[i].topRepsAtMax >= s2.topRepsAtMax) {
              streak += 1;
            } else {
              break;
            }
          }
          plateaus.push({
            name: bucket.name,
            weight: s2.maxWeight,
            reps: s2.topRepsAtMax,
            sessions: streak,
            lastDate: s2.date,
            incrementKg: incrementFor(ctx, bucket.exercise),
            assisted: bucket.exercise ? isAssisted(bucket.exercise) : s2.assisted
          });
        }
      }

      if (!isPlateau && all.length) {
        var latest = all[all.length - 1];
        var prev = all.length >= 2 ? all[all.length - 2] : null;
        var ageDays = dateDiffDays(latest.date, refDate);
        var activeRecently = (ageDays != null && ageDays <= 21) || (daysSinceLast != null && daysSinceLast < 21);
        if (activeRecently && latest.phase !== "deload" && latest.phase !== "reentry") {
          var weightUp = prev && (
            latest.assisted
              ? latest.maxWeight < prev.maxWeight - 0.01
              : latest.maxWeight > prev.maxWeight + 0.01
          );
          var e1rmUp = prev && !latest.assisted && latest.bestE1RM > prev.bestE1RM + 0.5 && latest.hasAnyPrFlag;
          if (weightUp || latest.hasPr || e1rmUp) {
            surges.push({
              name: bucket.name,
              weight: latest.maxWeight,
              prevWeight: prev ? prev.maxWeight : null,
              reps: latest.topRepsAtMax,
              e1rm: Math.round(latest.bestE1RM * 10) / 10,
              lastDate: latest.date,
              reason: weightUp
                ? "Load up from " + formatClean(prev.maxWeight, 1) + " to " + formatClean(latest.maxWeight, 1) + " kg"
                : "Recent PR logged"
            });
          }
        }
      }
    });
    return { plateaus: plateaus, surges: surges };
  }

  function analyzeNutrition(state, refDate) {
    var profile = (state && state.profile) || {};
    var target = Math.max(20, num(profile.proteinTargetG, 130));
    var rangeMin = Math.max(20, Math.min(target, num(profile.proteinRangeMinG, Math.round(target * 0.9))));
    var nutrition = (state && state.nutrition) || {};

    function dayProtein(dateId) {
      if (root.nutrition && typeof root.nutrition.totalProtein === "function") {
        return root.nutrition.totalProtein(state, dateId);
      }
      var bucket = nutrition[dateId];
      var entries = bucket && Array.isArray(bucket.entries) ? bucket.entries : [];
      return Math.round(entries.reduce(function (sum, entry) {
        return sum + Math.max(0, num(entry && entry.proteinG, 0));
      }, 0) * 10) / 10;
    }

    var todayG = dayProtein(refDate);
    var start14 = dateAdd(refDate, -13);
    var pastLogged = 0;
    var pastHits = 0;
    Object.keys(nutrition).forEach(function (dateId) {
      if (!isValidDateId(dateId) || dateId < start14 || dateId >= refDate) return;
      var bucket = nutrition[dateId];
      var hasEntries = bucket && Array.isArray(bucket.entries) && bucket.entries.length > 0;
      if (!hasEntries) return;
      pastLogged += 1;
      if (dayProtein(dateId) >= rangeMin) pastHits += 1;
    });

    var todayBucket = nutrition[refDate];
    var hasTodayEntries = !!(todayBucket && Array.isArray(todayBucket.entries) && todayBucket.entries.length > 0);
    var loggedDays = pastLogged;
    var hitDays = pastHits;
    if (hasTodayEntries && (pastLogged === 0 || todayG >= rangeMin)) {
      loggedDays += 1;
      if (todayG >= rangeMin) hitDays += 1;
    }

    return {
      proteinTodayG: todayG,
      proteinTargetG: target,
      proteinRangeMinG: rangeMin,
      proteinRemainingG: Math.max(0, Math.round((target - todayG) * 10) / 10),
      proteinHitRate: loggedDays > 0 ? Math.round((hitDays / loggedDays) * 100) : 0,
      hasProteinLogs: loggedDays > 0
    };
  }

  function analyzeBody(state, refDate) {
    var profile = (state && state.profile) || {};
    var heightCm = num(profile.heightCm, 167);
    var weights = (Array.isArray(state && state.bodyweight) ? state.bodyweight : [])
      .filter(function (r) { return isObject(r) && isValidDateId(r.date) && num(r.kg, 0) > 0 && r.date <= refDate; })
      .slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var latestW = weights.length ? num(weights[weights.length - 1].kg, null) : null;
    var avg7Start = dateAdd(refDate, -6);
    var prev7Start = dateAdd(refDate, -13);
    var prev7End = dateAdd(refDate, -7);
    var w7 = weights.filter(function (r) { return r.date >= avg7Start; });
    var wPrev = weights.filter(function (r) { return r.date >= prev7Start && r.date <= prev7End; });
    var avg7 = w7.length ? w7.reduce(function (s, r) { return s + num(r.kg, 0); }, 0) / w7.length : null;
    var prevAvg = wPrev.length ? wPrev.reduce(function (s, r) { return s + num(r.kg, 0); }, 0) / wPrev.length : null;
    var weeklyDelta = avg7 != null && prevAvg != null ? Math.round((avg7 - prevAvg) * 100) / 100 : null;

    var waists = (Array.isArray(state && state.measurements) ? state.measurements : [])
      .filter(function (r) { return isObject(r) && isValidDateId(r.date) && num(r.waist, 0) > 0 && r.date <= refDate; })
      .slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var latestWaist = waists.length ? num(waists[waists.length - 1].waist, null) : null;
    var cutoff28 = dateAdd(refDate, -28);
    var baselineWaistRow = waists.filter(function (r) { return r.date >= cutoff28; })[0] || waists[0] || null;
    var waistDelta = latestWaist != null && baselineWaistRow && baselineWaistRow.date !== waists[waists.length - 1].date
      ? Math.round((latestWaist - num(baselineWaistRow.waist, latestWaist)) * 100) / 100
      : null;

    return {
      bodyWeightLatestKg: latestW,
      bodyWeight7dAvgKg: avg7 != null ? Math.round(avg7 * 10) / 10 : null,
      bodyWeightWeeklyDeltaKg: weeklyDelta,
      waistLatestCm: latestWaist,
      waistDeltaCm: waistDelta,
      waistToHeight: latestWaist && heightCm > 0 ? Math.round((latestWaist / heightCm) * 100) / 100 : null
    };
  }

  function computeGapDays(ctx, refDate, entries) {
    var stateDays = (ctx && ctx.state && ctx.state.days) || {};
    if (isTrainedSession(stateDays[refDate])) {
      return { daysSinceLast: 0, lastWorkoutDate: refDate };
    }
    var reentryMod = (ctx && ctx.reentry) || root.reentry;
    if (reentryMod && typeof reentryMod.daysSinceLastWorkout === "function") {
      var gap = reentryMod.daysSinceLastWorkout(ctx, refDate);
      if (gap && Number.isFinite(gap.days)) {
        return { daysSinceLast: Math.max(0, gap.days), lastWorkoutDate: gap.lastDate || null };
      }
    }
    var seen = {};
    var lastDate = null;
    entries.forEach(function (e) { seen[e.day.id] = true; });
    var allDates = entries.map(function (e) { return e.day.id; }).concat(
      Object.keys(stateDays).filter(function (id) { return !seen[id] && isValidDateId(id); })
    );
    allDates.forEach(function (id) {
      if (id >= refDate) return;
      if (isTrainedSession(stateDays[id]) && (!lastDate || id > lastDate)) lastDate = id;
    });
    if (!lastDate) return { daysSinceLast: null, lastWorkoutDate: null };
    return {
      daysSinceLast: Math.max(0, dateDiffDays(lastDate, refDate)),
      lastWorkoutDate: lastDate
    };
  }

  function resolveReadiness(stateDays, activeDay, refDate) {
    if (activeDay && isObject(stateDays[activeDay.id]) && stateDays[activeDay.id].readiness != null) {
      var direct = Number(stateDays[activeDay.id].readiness);
      if (Number.isFinite(direct)) return clamp(direct, 1, 10);
    }
    if (isObject(stateDays[refDate]) && stateDays[refDate].readiness != null) {
      var refVal = Number(stateDays[refDate].readiness);
      if (Number.isFinite(refVal)) return clamp(refVal, 1, 10);
    }
    var dates = Object.keys(stateDays).filter(function (id) {
      return isValidDateId(id) && id <= refDate && stateDays[id] && stateDays[id].readiness != null;
    }).sort();
    if (!dates.length) return null;
    var latest = Number(stateDays[dates[dates.length - 1]].readiness);
    return Number.isFinite(latest) ? clamp(latest, 1, 10) : null;
  }

  function analyzeAthlete(ctx, referenceDate) {
    var state = (ctx && ctx.state) || {};
    var stateDays = isObject(state.days) ? state.days : {};
    var refDate = resolveRefDate(ctx, referenceDate);
    var entries = collectAllEntries(ctx);
    var activeDay = resolveActiveDay(ctx, refDate, entries);
    var activeWeek = resolveActiveWeek(ctx, activeDay ? activeDay.id : refDate, entries);
    var phase = normalizePhase(ctx, activeWeek && activeWeek.phase);

    var gapInfo = computeGapDays(ctx, refDate, entries);
    var daysSinceLast = gapInfo.daysSinceLast;
    var lastWorkoutDate = gapInfo.lastWorkoutDate;
    var readinessScore = resolveReadiness(stateDays, activeDay, refDate);

    // 7-day and 14-day adherence + missed streak
    var start14 = dateAdd(refDate, -13);
    var start7 = dateAdd(refDate, -6);
    var training14 = entries.filter(function (e) {
      if (e.day.id < start14 || e.day.id > refDate) return false;
      if (!(e.day.exercises || []).length) return false;
      var ds = stateDays[e.day.id] || {};
      if (e.day.id === refDate && !isTrainedSession(ds) && ds.status !== "missed") return false;
      return true;
    });
    var trained14 = 0;
    var missed14 = 0;
    var trained7 = 0;
    var planned7 = 0;
    training14.forEach(function (e) {
      var ds = stateDays[e.day.id] || {};
      var trained = isTrainedSession(ds);
      var in7 = e.day.id >= start7;
      if (in7) planned7 += 1;
      if (trained) {
        trained14 += 1;
        if (in7) trained7 += 1;
      } else if (ds.status === "missed" || (daysSinceLast != null && e.day.id > (lastWorkoutDate || ""))) {
        missed14 += 1;
      }
    });

    var hasTrainingHistory = daysSinceLast != null || missed14 > 0 || trained14 > 0;
    var adherence14d = training14.length > 0
      ? Math.round((trained14 / training14.length) * 100)
      : (isTrainedSession(stateDays[refDate]) ? 100 : (daysSinceLast != null && daysSinceLast >= 14 ? 0 : 0));
    var adherence7d = planned7 > 0
      ? Math.round((trained7 / planned7) * 100)
      : (isTrainedSession(stateDays[refDate]) ? 100 : (daysSinceLast != null && daysSinceLast >= 7 ? 0 : adherence14d));

    // Walk backward through past training days (< refDate) for consecutive missed/unlogged sessions.
    // Training today breaks any missed streak; unknown data-loss placeholders and extended-layoff
    // historical gaps (>= 14d without activity) never fabricate an active missed streak.
    var missedStreak = 0;
    if (!isTrainedSession(stateDays[refDate])) {
      var pastTraining = entries.filter(function (e) {
        return e.day.id < refDate && (e.day.exercises || []).length > 0;
      }).sort(function (a, b) { return b.day.id.localeCompare(a.day.id); });
      var extendedLayoff = daysSinceLast != null && daysSinceLast >= 14;
      for (var i = 0; i < pastTraining.length; i += 1) {
        var id = pastTraining[i].day.id;
        if (lastWorkoutDate && id <= lastWorkoutDate) break;
        var ds = stateDays[id] || {};
        if (isTrainedSession(ds) || ds.status === "unknown") break;
        if (ds.status === "missed") {
          missedStreak += 1;
        } else if (hasTrainingHistory && !extendedLayoff && lastWorkoutDate && id > lastWorkoutDate) {
          missedStreak += 1;
        } else {
          break;
        }
      }
    }

    var nutrition = analyzeNutrition(state, refDate);
    var body = analyzeBody(state, refDate);
    var byName = buildExerciseSessions(ctx, entries, refDate);
    var liftSignals = detectPlateausAndSurges(ctx, byName, refDate, daysSinceLast);

    // Hiatus risk 0-100
    var risk = 0;
    if (daysSinceLast == null) {
      risk += phase === "reentry" ? 10 : 0;
    } else if (daysSinceLast >= 30) {
      risk += 55;
    } else if (daysSinceLast >= 14) {
      risk += 42;
    } else if (daysSinceLast >= 7) {
      risk += 36;
    } else if (daysSinceLast >= 5) {
      risk += 30;
    } else if (daysSinceLast >= 3) {
      risk += 22;
    } else if (daysSinceLast === 2) {
      risk += 12;
    }

    if (hasTrainingHistory) {
      risk += ((100 - adherence7d) * 0.15) + ((100 - adherence14d) * 0.10);
    }
    if (missedStreak >= 3) risk += 20;
    else if (missedStreak === 2) risk += 12;
    else if (missedStreak === 1) risk += 6;

    if (nutrition.hasProteinLogs) {
      if (nutrition.proteinHitRate < 50) risk += 10;
      else if (nutrition.proteinHitRate < 75) risk += 5;
    }
    if (readinessScore != null && readinessScore <= 4) risk += 5;
    else if (readinessScore != null && readinessScore <= 5) risk += 3;

    var hiatusRisk = Math.round(clamp(risk, 0, 100));
    var hiatusTier = hiatusRisk >= 75 ? "critical"
      : hiatusRisk >= 50 ? "elevated"
      : hiatusRisk >= 25 ? "moderate"
      : "low";

    var momentumLabel = (daysSinceLast != null && daysSinceLast >= 14) || phase === "reentry"
      ? "Reentry Ramp"
      : hiatusRisk >= 60 ? "Rebuild Rhythm"
      : phase === "deload" ? "Active Recovery"
      : liftSignals.surges.length > 0 && adherence14d >= 75 ? "Surging"
      : adherence14d >= 80 && hiatusRisk < 25 ? "Locked In"
      : hasTrainingHistory ? "Building"
      : "Fresh Start";

    // Express availability on active day
    var activeDs = activeDay ? (stateDays[activeDay.id] || {}) : {};
    var activeExercises = activeDay && Array.isArray(activeDay.exercises) ? activeDay.exercises : [];
    var expressAvailable = false;
    if (activeExercises.length > 0 && !activeDs.finishedAt) {
      expressAvailable = activeExercises.some(function (ex, idx) {
        var cap = isCompound(ex) ? 2 : 1;
        var plannedLen = (ex.sets || []).length;
        var doneCount = Object.keys(activeDs.completed || {}).filter(function (k) {
          return k.split(".")[0] === String(idx) && num(activeDs.completed[k] && activeDs.completed[k].reps, 0) > 0;
        }).length;
        return plannedLen > cap && doneCount < plannedLen;
      });
    }

    var primaryEx = activeExercises.find(function (e) { return e && e.primary; }) || activeExercises[0] || null;
    var topRecommendation;
    if (readinessScore != null && readinessScore <= 5 && activeExercises.length) {
      topRecommendation = "Readiness is " + readinessScore + "/10: trim 1 set and drop uncompleted loads ~10% today.";
    } else if (phase === "reentry" || (daysSinceLast != null && daysSinceLast >= 14)) {
      topRecommendation = "Rebuild movement grooves at ~70-75% working load and leave 3+ RIR before pushing heavier.";
    } else if (hiatusRisk >= 60 && activeExercises.length) {
      topRecommendation = "Protect consistency with 15-min Express Mode (2 compound sets, 1 crisp accessory set) today.";
    } else if (phase === "deload") {
      topRecommendation = "Deload week: keep sets at RPE 5-6 with 3+ RIR so strength rebounds next block.";
    } else if (liftSignals.plateaus.length > 0) {
      topRecommendation = "Plateau on " + liftSignals.plateaus[0].name + ": aim for +1 clean rep or a small increment jump.";
    } else if (nutrition.hasProteinLogs && nutrition.proteinRemainingG >= 30) {
      topRecommendation = "Close the remaining " + formatClean(nutrition.proteinRemainingG, 0) + " g protein toward your " + nutrition.proteinTargetG + " g target.";
    } else if (primaryEx) {
      topRecommendation = "Focus on clean reps with 1-2 RIR on " + primaryEx.name + " and track effort.";
    } else {
      topRecommendation = "Recovery day: hit " + nutrition.proteinTargetG + " g protein and rest up for your next session.";
    }

    return {
      referenceDate: refDate,
      phase: phase,
      readinessScore: readinessScore,
      daysSinceLast: daysSinceLast,
      lastWorkoutDate: lastWorkoutDate,
      hiatusRisk: hiatusRisk,
      hiatusTier: hiatusTier,
      momentumLabel: momentumLabel,
      adherence7d: adherence7d,
      adherence14d: adherence14d,
      missedStreak: missedStreak,
      proteinTodayG: nutrition.proteinTodayG,
      proteinTargetG: nutrition.proteinTargetG,
      proteinRemainingG: nutrition.proteinRemainingG,
      proteinHitRate: nutrition.proteinHitRate,
      hasProteinLogs: nutrition.hasProteinLogs,
      plateauLifts: liftSignals.plateaus,
      surgingLifts: liftSignals.surges,
      topRecommendation: topRecommendation,
      expressAvailable: expressAvailable,
      body: body
    };
  }

  function applyToneFlavor(tone, text) {
    if (tone === "stoic") return text;
    if (tone === "hype") return text;
    return text;
  }

  function getDailyBrief(ctx, day) {
    var state = (ctx && ctx.state) || {};
    var memory = ensureCoachMemory(state);
    var entries = collectAllEntries(ctx);
    var refDate = (day && isValidDateId(day.id)) ? day.id : resolveRefDate(ctx);
    var analysis = analyzeAthlete(ctx, refDate);
    var activeDay = day || resolveActiveDay(ctx, refDate, entries);
    var week = resolveActiveWeek(ctx, activeDay ? activeDay.id : refDate, entries);
    var phase = normalizePhase(ctx, week && week.phase) || analysis.phase;
    var exercises = activeDay && Array.isArray(activeDay.exercises) ? activeDay.exercises : [];
    var primary = exercises.find(function (e) { return e && e.primary; }) || exercises[0] || null;
    var primaryName = primary ? primary.name : "your main lift";

    if (!activeDay || !exercises.length) {
      var restSub = analysis.proteinRemainingG > 15
        ? "Hit your remaining " + formatClean(analysis.proteinRemainingG, 0) + " g protein today (" + formatClean(analysis.proteinTodayG, 0) + "/" + analysis.proteinTargetG + " g) and bank sleep."
        : "Protein and recovery fuel the next load jump. Keep steps easy and joints fresh.";
      return {
        headline: "Recovery day — absorb the training",
        subline: restSub,
        badge: "Recovery",
        tone: "calm",
        actionType: null,
        actionLabel: "",
        actionPayload: null
      };
    }

    if (analysis.readinessScore != null && analysis.readinessScore <= 5) {
      return {
        headline: "Low readiness (" + analysis.readinessScore + "/10) — autoregulate today",
        subline: "Drop uncompleted weights ~10% and trim 1 working set so bar speed and joints stay crisp.",
        badge: "Autoregulate",
        tone: "warning",
        actionType: "autoregulate-light",
        actionLabel: "Lighten session (-10%)",
        actionPayload: { dayId: activeDay.id }
      };
    }

    if (phase === "reentry" || (analysis.daysSinceLast != null && analysis.daysSinceLast >= 14)) {
      var gapTag = analysis.daysSinceLast != null && analysis.daysSinceLast >= 14
        ? "Welcome back (" + analysis.daysSinceLast + "d gap) — smooth reentry"
        : "Reentry ramp — leave 3+ RIR";
      var reentrySub = memory.tone === "hype"
        ? "First reps back win the week. Groove " + primaryName + " cleanly at 70-75% and leave 3+ in the tank."
        : memory.tone === "stoic"
          ? "Leave ego outside the gym. Rebuild motor grooves at 70-75% load with 3+ RIR."
          : "Grooves before load: ~70-75% weights and 3+ RIR restore capacity without 4-day DOMS.";
      return {
        headline: gapTag,
        subline: reentrySub,
        badge: "Reentry",
        tone: "reentry",
        actionType: analysis.expressAvailable ? "express-mode" : null,
        actionLabel: analysis.expressAvailable ? "15-min Express" : "",
        actionPayload: analysis.expressAvailable ? { dayId: activeDay.id } : null
      };
    }

    if (phase === "deload") {
      return {
        headline: "Deload week — shed fatigue at RPE 5-6",
        subline: "Keep reps snappy on " + primaryName + " with 3+ RIR so strength peaks next block.",
        badge: "Deload",
        tone: "calm",
        actionType: analysis.expressAvailable ? "express-mode" : null,
        actionLabel: analysis.expressAvailable ? "Express sets" : "",
        actionPayload: analysis.expressAvailable ? { dayId: activeDay.id } : null
      };
    }

    if (phase === "test") {
      return {
        headline: "Test week — earn clean PRs on " + primaryName,
        subline: "Rest 3 full minutes before top sets and end the set the moment technique slips.",
        badge: "Test Week",
        tone: "pr",
        actionType: "pr-push",
        actionLabel: "Set PR target",
        actionPayload: { dayId: activeDay.id, exerciseName: primaryName }
      };
    }

    if (analysis.hiatusRisk >= 60) {
      return {
        headline: "High hiatus risk (" + analysis.hiatusRisk + "/100) — win in 15 min",
        subline: "Shrink activation energy: run Express Mode (2 compound sets, 1 accessory set) to lock the habit.",
        badge: "Shield Risk",
        tone: "warning",
        actionType: "express-mode",
        actionLabel: "Switch to Express",
        actionPayload: { dayId: activeDay.id }
      };
    }

    if (analysis.plateauLifts.length > 0) {
      var matchingPlateau = analysis.plateauLifts.find(function (p) {
        return exercises.some(function (ex) { return normalizeName(ex.name) === normalizeName(p.name); });
      }) || analysis.plateauLifts[0];
      return {
        headline: "Plateau alert: " + matchingPlateau.name + " stalled at " + formatWeightDisplay(ctx, matchingPlateau.weight),
        subline: matchingPlateau.sessions + " sessions without rep/load movement. Target +1 clean rep or a micro-load step.",
        badge: "Breakthrough",
        tone: "accent",
        actionType: "pr-push",
        actionLabel: "Push +1 step",
        actionPayload: { dayId: activeDay.id, exerciseName: matchingPlateau.name }
      };
    }

    var loadHeadline = memory.tone === "hype"
      ? "Green light on " + primaryName + " — earn the next rep"
      : memory.tone === "stoic"
        ? "Execute " + (activeDay.title || "today's session") + " with disciplined 1-2 RIR"
        : "Load progression on track — target " + primaryName;
    return {
      headline: loadHeadline,
      subline: analysis.momentumLabel + " (" + analysis.adherence14d + "% 14d adherence). " +
        (analysis.proteinRemainingG > 20
          ? "Close " + formatClean(analysis.proteinRemainingG, 0) + " g protein today for recovery."
          : "Keep 1-2 RIR and log effort on your top sets."),
      badge: phase === "loadplus" ? "Load+" : (phase === "load" ? "Load" : "On Track"),
      tone: "primary",
      actionType: "pr-push",
      actionLabel: "Target +1 step",
      actionPayload: { dayId: activeDay.id, exerciseName: primaryName }
    };
  }

  var EXERCISE_ALIASES = [
    { pattern: /\b(high\s*\/?\s*wide\s*leg\s*press|wide\s*leg\s*press|high\s*leg\s*press)\b/i, name: "High/Wide Leg Press" },
    { pattern: /\b(leg\s*press)\b/i, name: "Machine Leg Press" },
    { pattern: /\b(incline\s*(?:db|dumbbell)?\s*curls?)\b/i, name: "Incline DB Curls" },
    { pattern: /\b(incline\s*(?:db|dumbbell)\s*(?:press)?|incline\s+press|incline\s+db)\b/i, name: "Incline DB Press" },
    { pattern: /\b(one[- ]?arm\s*(?:cable\s*)?pulldown)\b/i, name: "One-Arm Cable Pulldown" },
    { pattern: /\b(lat\s*pulldown|pulldown)\b/i, name: "Lat Pulldown" },
    { pattern: /\b(romanian\s*deadlift|db\s*rdl|rdl)\b/i, name: "DB Romanian Deadlift" },
    { pattern: /\b(smith\s*(?:machine\s*)?squats?|squats?)\b/i, name: "Smith Machine Squats" },
    { pattern: /\b(high\s*cable\s*row|face\s*pulls?)\b/i, name: "High Cable Row / Face Pull" },
    { pattern: /\b(seated\s*cable\s*row|cable\s*row)\b/i, name: "Seated Cable Row" },
    { pattern: /\b(lying\s*leg\s*curls?)\b/i, name: "Lying Leg Curls" },
    { pattern: /\b(seated\s*leg\s*curls?|leg\s*curls?|hamstring\s*curls?)\b/i, name: "Seated Leg Curls" },
    { pattern: /\b(calf\s*raises?|calves)\b/i, name: "Seated Calf Raises" },
    { pattern: /\b(abdominal\s*machine|ab\s*machine)\b/i, name: "Abdominal Machine" },
    { pattern: /\b(bicep\s*curls?|db\s*bicep\s*curls?|db\s*curls?)\b/i, name: "DB Bicep Curls" },
    { pattern: /\b(machine\s*chest\s*press|chest\s*press)\b/i, name: "Machine Chest Press" },
    { pattern: /\b(pec\s*fly|machine\s*pec\s*fly)\b/i, name: "Machine Pec Fly" },
    { pattern: /\b(assisted\s*dips?|dips?)\b/i, name: "Assisted Dips" },
    { pattern: /\b(cable\s*lateral\s*raises?|lateral\s*raises?|side\s*delts?)\b/i, name: "Cable Lateral Raises" },
    { pattern: /\b(rear\s*delt\s*fly|rear\s*delts?)\b/i, name: "Rear Delt Fly" },
    { pattern: /\b(tricep\s*pushdowns?|pushdowns?|triceps?)\b/i, name: "Tricep Pushdowns" },
    { pattern: /\b(walking\s*lunges?|lunges?)\b/i, name: "Walking Lunges" },
    { pattern: /\b(45\s*degree\s*back\s*extension|back\s*extension)\b/i, name: "45 Degree Back Extension" },
    { pattern: /\b(hanging\s*knee\s*raise|knee\s*raise)\b/i, name: "Hanging Knee Raise" }
  ];

  function findMentionedExercise(question, entries) {
    var q = String(question || "").trim();
    var qNorm = normalizeName(q);
    if (!qNorm) return null;

    var knownNames = {};
    entries.forEach(function (entry) {
      (entry.day.exercises || []).forEach(function (ex) {
        if (ex && ex.name) knownNames[normalizeName(ex.name)] = ex.name;
      });
    });

    // Exact or full normalized name inclusion first (longest match wins)
    var exactMatches = Object.keys(knownNames).filter(function (norm) {
      return norm.length >= 3 && qNorm.indexOf(norm) >= 0;
    }).sort(function (a, b) { return b.length - a.length; });
    if (exactMatches.length) return knownNames[exactMatches[0]];

    // Curated gym aliases
    for (var i = 0; i < EXERCISE_ALIASES.length; i += 1) {
      if (EXERCISE_ALIASES[i].pattern.test(q)) {
        var aliasTarget = EXERCISE_ALIASES[i].name;
        return knownNames[normalizeName(aliasTarget)] || aliasTarget;
      }
    }

    // Token overlap fallback for custom exercises
    var qTokens = qNorm.split(" ").filter(function (t) { return t.length >= 3; });
    var bestName = null;
    var bestScore = 0;
    Object.keys(knownNames).forEach(function (norm) {
      var tokens = norm.split(" ").filter(function (t) { return t.length >= 3; });
      if (!tokens.length) return;
      var hits = tokens.filter(function (t) { return qTokens.indexOf(t) >= 0; }).length;
      var ratio = hits / tokens.length;
      if (hits >= 2 && ratio > bestScore) {
        bestScore = ratio;
        bestName = knownNames[norm];
      }
    });
    return bestName;
  }

  function nextExerciseTargetText(ctx, exerciseName, latestSession, activeDay, entries, refDate) {
    var prog = (ctx && ctx.progression) || root.progression;
    var plannedToday = activeDay && Array.isArray(activeDay.exercises)
      ? activeDay.exercises.find(function (ex) { return normalizeName(ex.name) === normalizeName(exerciseName); })
      : null;
    var nextEntry = entries.find(function (entry) {
      return entry.day.id >= refDate && (entry.day.exercises || []).some(function (ex) {
        return normalizeName(ex.name) === normalizeName(exerciseName);
      });
    });
    var refEx = plannedToday || (nextEntry && nextEntry.day.exercises.find(function (ex) {
      return normalizeName(ex.name) === normalizeName(exerciseName);
    })) || { name: exerciseName, sets: latestSession ? latestSession.sets : [{ reps: 10, weight: 0 }] };

    if (prog && typeof prog.forExercise === "function" && activeDay && plannedToday) {
      var idx = activeDay.exercises.indexOf(plannedToday);
      var suggestion = prog.forExercise(ctx, activeDay, plannedToday, idx);
      if (suggestion) {
        return formatWeightDisplay(ctx, suggestion.weight) + " x " + suggestion.reps + " (" + suggestion.sets + " sets) — " + suggestion.reason;
      }
    }
    if (prog && typeof prog.suggest === "function" && latestSession) {
      var sug = prog.suggest({
        dayId: refDate,
        exercise: refEx,
        plannedSets: refEx.sets || [],
        history: [{ date: latestSession.date, sets: latestSession.sets }],
        incrementKg: incrementFor(ctx, refEx),
        repRange: repRangeFor(ctx, refEx)
      });
      if (sug) {
        return formatWeightDisplay(ctx, sug.weight) + " x " + sug.reps + " (" + sug.sets + " sets) — " + sug.reason;
      }
    }
    if (latestSession) {
      var inc = incrementFor(ctx, refEx);
      var assisted = isAssisted(refEx);
      var nextW = assisted ? Math.max(0, latestSession.maxWeight - inc) : latestSession.maxWeight + inc;
      return formatWeightDisplay(ctx, nextW) + " x " + latestSession.topRepsAtMax;
    }
    var planSet = (refEx.sets || [])[0];
    return planSet ? (formatWeightDisplay(ctx, planSet.weight) + " x " + planSet.reps) : "Follow plan baseline";
  }

  function tonePrefix(tone, category) {
    if (tone === "hype") {
      return ({
        exercise: "Locked in. ",
        soreness: "Smart adjustment, zero ego. ",
        express: "Time crunch? We still win today. ",
        plateau: "Time to break this ceiling. ",
        nutrition: "Fuel the rebuild. ",
        hiatus: "You opened the app — streak restarted right now. ",
        today: "Let's attack today cleanly. ",
        general: "Ready when you are. "
      })[category] || "";
    }
    if (tone === "stoic") {
      return ({
        exercise: "Objective log check: ",
        soreness: "Longevity over ego: ",
        express: "Do what the day permits: ",
        plateau: "Patience and precision break stalls: ",
        nutrition: "Control the fuel: ",
        hiatus: "Drop the guilt; execute one clean rep: ",
        today: "Focus on today's work: ",
        general: "Control the controllable: "
      })[category] || "";
    }
    return "";
  }

  function askCoach(ctx, question) {
    var state = (ctx && ctx.state) || {};
    var memory = ensureCoachMemory(state);
    var entries = collectAllEntries(ctx);
    var refDate = resolveRefDate(ctx);
    var activeDay = resolveActiveDay(ctx, refDate, entries);
    var activeWeek = resolveActiveWeek(ctx, activeDay ? activeDay.id : refDate, entries);
    var analysis = analyzeAthlete(ctx, refDate);
    var q = String(question || "").trim();

    if (!q) {
      var brief = getDailyBrief(ctx, activeDay);
      return {
        reply: brief.headline + ". " + brief.subline,
        suggestedAction: brief.actionType ? { type: brief.actionType, label: brief.actionLabel, payload: brief.actionPayload } : null,
        analysis: analysis
      };
    }

    var reply = "";
    var suggestedAction = null;

    // 1. Tone switch intent
    var toneMatch = /\b(hype|stoic|analytical)\b/i.exec(q);
    var wantsToneChange = toneMatch && /\b(tone|mode|switch|change|be more|sound|style|go)\b/i.test(q);
    if (wantsToneChange) {
      var nextTone = toneMatch[1].toLowerCase();
      memory.tone = nextTone;
      reply = nextTone === "hype"
        ? "Hype mode locked in. Short cues, high energy, clean execution."
        : nextTone === "stoic"
          ? "Stoic mode set. Calm discipline, zero drama, steady progression."
          : "Analytical mode active. Direct metrics, e1RM tracking, and evidence-based targets.";
      suggestedAction = { type: "set-tone", label: "Tone: " + nextTone, payload: { tone: nextTone } };
    } else {
      var mentionedExercise = findMentionedExercise(q, entries);
      var asksSoreness = /\b(sore|soreness|fatigue|fatigued|tired|exhausted|drained|beat up|low readiness|ache|achy|poor sleep|slept bad|weak today|heavy today|autoregulate|lighten)\b/i.test(q);
      var asksExpress = /\b(rush|rushed|busy|short|quick|express|15[- ]?min|10[- ]?min|20[- ]?min|no time|tight on time|in a hurry)\b/i.test(q);
      var asksPlateau = /\b(plateau|stalled|stall|stuck|not progressing|flatlined|same weight)\b/i.test(q);
      var asksNutrition = /\b(protein|eat|food|macro|macros|diet|calories|nutrition|body|weight|bw|waist|recomp|recomposition|abs|cut|fat|creatine|whey)\b/i.test(q);
      var asksHiatus = /\b(hiatus|motivat|missed|skip|skipped|guilt|guilty|come ?back|return|returning|layoff|fell off|break|consistent|consistency|habit|streak)\b/i.test(q);
      var asksToday = /\b(today|workout|plan|session|schedule|what should i do|what's next|whats next|brief)\b/i.test(q);

      if (mentionedExercise) {
        var byName = buildExerciseSessions(ctx, entries, refDate);
        var bucket = byName[normalizeName(mentionedExercise)];
        var sessions = bucket ? bucket.sessions : [];
        var latest = sessions.length ? sessions[sessions.length - 1] : null;
        var nextTarget = nextExerciseTargetText(ctx, mentionedExercise, latest, activeDay, entries, refDate);
        if (latest) {
          var repsStr = latest.sets.map(function (s) { return num(s.reps, 0); }).join("/");
          var weightStr = formatWeightDisplay(ctx, latest.maxWeight);
          var e1rmStr = latest.assisted ? "assisted movement" : (formatWeightDisplay(ctx, latest.bestE1RM) + " e1RM");
          var best = sessions.slice().sort(function (a, b) {
            if (a.assisted || b.assisted) return a.maxWeight - b.maxWeight;
            return b.bestE1RM - a.bestE1RM || b.maxWeight - a.maxWeight;
          })[0];
          var peakText = "";
          if (best && best.date !== latest.date && (latest.phase === "deload" || (!best.assisted && best.bestE1RM > latest.bestE1RM + 0.5) || (best.assisted && best.maxWeight < latest.maxWeight))) {
            var bestRepsStr = best.sets.map(function (s) { return num(s.reps, 0); }).join("/");
            var bestE1rmStr = best.assisted ? "" : (" (" + formatWeightDisplay(ctx, best.bestE1RM) + " e1RM)");
            peakText = " Peak verified: " + formatWeightDisplay(ctx, best.maxWeight) + " x " + bestRepsStr + bestE1rmStr + " on " + best.date + ".";
          }
          reply = tonePrefix(memory.tone, "exercise") +
            mentionedExercise + " last logged on " + latest.date + ": " +
            weightStr + " x " + repsStr + " (" + e1rmStr + ")." +
            peakText +
            " Next progression target: " + nextTarget;
        } else {
          reply = tonePrefix(memory.tone, "exercise") +
            "No verified working sets logged for " + mentionedExercise + " yet. " +
            "Next planned target: " + nextTarget;
        }
        var plateauMatch = analysis.plateauLifts.find(function (p) { return normalizeName(p.name) === normalizeName(mentionedExercise); });
        if (asksPlateau || plateauMatch) {
          reply += " Note: " + mentionedExercise + " shows a 3+ session flatline — aim for +1 clean rep at 1-2 RIR or a micro-load bump.";
        }
        if (asksSoreness && activeDay && (activeDay.exercises || []).length) {
          suggestedAction = { type: "autoregulate-light", label: "Lighten today (-10%)", payload: { dayId: activeDay.id } };
        } else if (activeDay && (activeDay.exercises || []).some(function (ex) { return normalizeName(ex.name) === normalizeName(mentionedExercise); })) {
          suggestedAction = { type: "pr-push", label: "Target next step", payload: { dayId: activeDay.id, exerciseName: mentionedExercise } };
        }
      } else if (asksSoreness) {
        reply = tonePrefix(memory.tone, "soreness") +
          (analysis.readinessScore != null ? "Readiness is " + analysis.readinessScore + "/10. " : "") +
          "Keep the groove alive without burying recovery: reduce uncompleted loads by ~10% (2.5 kg steps) and trim 1 working set per lift so every rep stays crisp.";
        if (activeDay && (activeDay.exercises || []).length) {
          suggestedAction = { type: "autoregulate-light", label: "Apply Light Autoregulation", payload: { dayId: activeDay.id } };
        }
      } else if (asksExpress) {
        reply = tonePrefix(memory.tone, "express") +
          "Switch to 15-minute Express Mode: compounds cap at 2 quality working sets and accessories drop to 1 crisp set, keeping mechanical tension high while leaving already-completed sets intact.";
        if (activeDay && (activeDay.exercises || []).length) {
          suggestedAction = { type: "express-mode", label: "Enable Express Mode", payload: { dayId: activeDay.id } };
        }
      } else if (asksPlateau) {
        if (analysis.plateauLifts.length) {
          var p = analysis.plateauLifts[0];
          reply = tonePrefix(memory.tone, "plateau") +
            p.name + " has been flat at " + formatWeightDisplay(ctx, p.weight) + " x " + p.reps + " across " + p.sessions + " sessions. " +
            "Use double progression: push +1 clean rep on your top sets or add +" + formatClean(p.incrementKg, 1) + " kg with 3 full minutes rest (and confirm protein is hitting " + analysis.proteinTargetG + " g).";
          if (activeDay && (activeDay.exercises || []).length) {
            suggestedAction = { type: "pr-push", label: "Target +1 step on " + p.name, payload: { dayId: activeDay.id, exerciseName: p.name } };
          }
        } else {
          reply = tonePrefix(memory.tone, "plateau") +
            "No 3-session stalls detected right now" +
            (analysis.surgingLifts.length ? " — " + analysis.surgingLifts[0].name + " is trending up (" + analysis.surgingLifts[0].reason + "). " : ". ") +
            "Stick to double progression: earn the top of your rep range at 1-2 RIR, then add the smallest load increment.";
        }
      } else if (asksNutrition) {
        var b = analysis.body;
        var bodyParts = [];
        if (b.bodyWeight7dAvgKg != null) {
          bodyParts.push("7-day weight avg " + formatClean(b.bodyWeight7dAvgKg, 1) + " kg" + (b.bodyWeightWeeklyDeltaKg != null ? " (" + (b.bodyWeightWeeklyDeltaKg >= 0 ? "+" : "") + formatClean(b.bodyWeightWeeklyDeltaKg, 2) + " kg/wk)" : ""));
        } else if (b.bodyWeightLatestKg != null) {
          bodyParts.push("latest weight " + formatClean(b.bodyWeightLatestKg, 1) + " kg");
        }
        if (b.waistLatestCm != null) {
          bodyParts.push("waist " + formatClean(b.waistLatestCm, 1) + " cm" + (b.waistDeltaCm != null ? " (" + (b.waistDeltaCm >= 0 ? "+" : "") + formatClean(b.waistDeltaCm, 1) + " cm / 4 wk)" : ""));
        }
        var bodySummary = bodyParts.length
          ? "Body trend: " + bodyParts.join(", ") + "."
          : "Log body weight and waist measurements to track your recomposition trend.";
        var proteinStatus = analysis.proteinRemainingG > 0
          ? formatClean(analysis.proteinRemainingG, 0) + " g remaining to hit your " + analysis.proteinTargetG + " g target (today: " + formatClean(analysis.proteinTodayG, 0) + " g)."
          : "Protein target hit today (" + formatClean(analysis.proteinTodayG, 0) + " / " + analysis.proteinTargetG + " g).";
        reply = tonePrefix(memory.tone, "nutrition") + proteinStatus + " " + bodySummary +
          (analysis.proteinRemainingG >= 20 ? " A scoop of whey (~24 g) or 100 g chicken breast (~31 g) closes the gap cleanly." : "");
        suggestedAction = {
          type: "open-sheet",
          label: /\b(waist|body|weight|bw|measure)\b/i.test(q) ? "Open Measurements" : "Open Protein Tracker",
          payload: { sheet: /\b(waist|body|weight|bw|measure)\b/i.test(q) ? "measurements" : "nutrition" }
        };
      } else if (asksHiatus) {
        var gapText = analysis.daysSinceLast != null ? analysis.daysSinceLast + " days since your last session" : "starting fresh";
        reply = tonePrefix(memory.tone, "hiatus") +
          "Zero guilt — " + gapText + " (Hiatus Risk: " + analysis.hiatusRisk + "/100, " + analysis.hiatusTier + "). " +
          "Never try to make up missed weeks. One minimum-effective-dose session today resets the habit chain and restarts momentum.";
        if (activeDay && (activeDay.exercises || []).length) {
          suggestedAction = { type: "express-mode", label: "Launch 15-Min Express", payload: { dayId: activeDay.id } };
        }
      } else if (asksToday) {
        if (activeDay && (activeDay.exercises || []).length) {
          var ds = (state.days || {})[activeDay.id] || {};
          var primary = activeDay.exercises.find(function (e) { return e && e.primary; }) || activeDay.exercises[0];
          var firstSet = (primary && primary.sets && primary.sets[0]) || { reps: 10, weight: 0 };
          var doneSets = Object.keys(ds.completed || {}).filter(function (k) { return num(ds.completed[k] && ds.completed[k].reps, 0) > 0; }).length;
          var plannedTotal = activeDay.exercises.reduce(function (sum, ex) { return sum + (ex.sets || []).length; }, 0);
          var dailyBrief = getDailyBrief(ctx, activeDay);
          reply = tonePrefix(memory.tone, "today") +
            (activeWeek ? activeWeek.title + " (" + activeWeek.phase + "): " : "") +
            activeDay.title + " — " + activeDay.exercises.length + " exercises (" + doneSets + "/" + plannedTotal + " sets done). " +
            "Anchor lift: " + primary.name + " at " + formatWeightDisplay(ctx, firstSet.weight) + " x " + firstSet.reps + ". " +
            dailyBrief.subline;
          if (dailyBrief.actionType) {
            suggestedAction = { type: dailyBrief.actionType, label: dailyBrief.actionLabel, payload: dailyBrief.actionPayload };
          }
        } else {
          reply = tonePrefix(memory.tone, "today") +
            "Today is a scheduled rest day. Hit " + analysis.proteinTargetG + " g protein (" + formatClean(analysis.proteinRemainingG, 0) + " g remaining) and sleep well.";
        }
      } else {
        reply = tonePrefix(memory.tone, "general") +
          "Momentum is " + analysis.momentumLabel + " (" + analysis.adherence14d + "% 14d adherence, Hiatus Risk " + analysis.hiatusRisk + "/100). " +
          analysis.topRecommendation + " Ask me about any lift (e.g. Leg Press or Incline DB), soreness, protein, or a 15-min Express plan.";
      }
    }

    var now = Date.now();
    memory = ensureCoachMemory(state);
    memory.messages.push({ id: "u-" + now, role: "user", text: q, ts: now });
    var coachMsg = { id: "c-" + (now + 1), role: "coach", text: reply, ts: now + 1 };
    if (suggestedAction) {
      coachMsg.actionType = suggestedAction.type;
      coachMsg.actionLabel = suggestedAction.label;
      if (suggestedAction.payload) coachMsg.actionPayload = suggestedAction.payload;
    }
    memory.messages.push(coachMsg);
    memory.messages = memory.messages.slice(-MAX_MESSAGES);

    if (ctx && typeof ctx.saveState === "function") ctx.saveState("coach-chat");

    return {
      reply: reply,
      suggestedAction: suggestedAction,
      analysis: analysis
    };
  }

  function ensureDayBucket(state, dayId) {
    state.days = isObject(state.days) ? state.days : {};
    if (!isObject(state.days[dayId])) {
      state.days[dayId] = { completed: {}, extraSets: {}, drafts: {}, exerciseFlags: {}, adaptiveTargets: {} };
    }
    var ds = state.days[dayId];
    ds.completed = isObject(ds.completed) ? ds.completed : {};
    ds.extraSets = isObject(ds.extraSets) ? ds.extraSets : {};
    ds.drafts = isObject(ds.drafts) ? ds.drafts : {};
    ds.exerciseFlags = isObject(ds.exerciseFlags) ? ds.exerciseFlags : {};
    ds.adaptiveTargets = isObject(ds.adaptiveTargets) ? ds.adaptiveTargets : {};
    return ds;
  }

  function completedSetIndicesForEx(ds, exIndex) {
    return Object.keys(ds.completed || {}).filter(function (key) {
      return key.split(".")[0] === String(exIndex) && num(ds.completed[key] && ds.completed[key].reps, 0) > 0;
    });
  }

  function currentExerciseBaseline(ctx, day, ds, ex, exIndex) {
    var existing = ds.adaptiveTargets && ds.adaptiveTargets[String(exIndex)];
    if (existing && num(existing.sets, 0) > 0) {
      return {
        weight: num(existing.weight, 0),
        reps: num(existing.reps, 8),
        sets: num(existing.sets, (ex.sets || []).length || 1)
      };
    }
    var prog = (ctx && ctx.progression) || root.progression;
    if (prog && typeof prog.forExercise === "function") {
      try {
        var sug = prog.forExercise(ctx, day, ex, exIndex);
        if (sug) return { weight: num(sug.weight, 0), reps: num(sug.reps, 8), sets: num(sug.sets, (ex.sets || []).length || 1) };
      } catch (err) {}
    }
    var first = (ex.sets || [])[0] || { reps: 8, weight: 0 };
    return {
      weight: num(first.weight, 0),
      reps: num(first.reps, 8),
      sets: (ex.sets || []).length || 1
    };
  }

  function applyCoachAction(ctx, actionType, payload) {
    var state = (ctx && ctx.state) || {};
    payload = payload || {};

    if (actionType === "set-tone") {
      var rawTone = typeof payload === "string" ? payload : payload.tone;
      var tone = TONES.indexOf(rawTone) >= 0 ? rawTone : "analytical";
      ensureCoachMemory(state).tone = tone;
      if (ctx && typeof ctx.saveState === "function") ctx.saveState("coach-tone");
      return { ok: true, actionType: "set-tone", tone: tone, message: "Coach tone set to " + tone + "." };
    }

    if (actionType === "open-sheet") {
      if (payload.sheet && ctx && typeof ctx.openSheet === "function") {
        ctx.openSheet(payload.sheet);
        return { ok: true, actionType: "open-sheet", sheet: payload.sheet };
      }
      return { ok: false, actionType: actionType, message: "Sheet handler unavailable." };
    }

    var entries = collectAllEntries(ctx);
    var refDate = resolveRefDate(ctx);
    var day = (payload.dayId && ctx && typeof ctx.getDay === "function" && ctx.getDay(payload.dayId)) ||
      (payload.dayId && (entries.find(function (e) { return e.day.id === payload.dayId; }) || {}).day) ||
      resolveActiveDay(ctx, refDate, entries);

    if (!day || !Array.isArray(day.exercises) || !day.exercises.length) {
      return { ok: false, actionType: actionType, message: "No active workout exercises to adjust." };
    }

    var ds = ensureDayBucket(state, day.id);

    if (actionType === "express-mode") {
      var modifiedExpress = 0;
      day.exercises.forEach(function (ex, exIndex) {
        var base = currentExerciseBaseline(ctx, day, ds, ex, exIndex);
        var plannedLen = (ex.sets || []).length || base.sets || 1;
        var doneCount = completedSetIndicesForEx(ds, exIndex).length;
        var currentSetCap = Math.min(plannedLen, base.sets || plannedLen);
        if (doneCount >= currentSetCap && doneCount > 0) return;
        var cap = isCompound(ex) ? 2 : 1;
        var nextSets = Math.min(plannedLen, Math.max(doneCount, cap));
        ds.adaptiveTargets[String(exIndex)] = {
          action: "express-mode",
          weight: base.weight,
          reps: base.reps,
          sets: nextSets,
          reason: isCompound(ex)
            ? "Express Mode: compound capped at " + nextSets + " working sets."
            : "Express Mode: accessory streamlined to " + nextSets + " crisp set.",
          frozenAt: Date.now()
        };
        modifiedExpress += 1;
      });
      if (ctx && typeof ctx.saveState === "function") ctx.saveState("coach-action");
      return {
        ok: true,
        actionType: "express-mode",
        dayId: day.id,
        modifiedCount: modifiedExpress,
        message: "Express Mode applied: compounds capped at 2 sets, accessories at 1 set."
      };
    }

    if (actionType === "autoregulate-light") {
      var modifiedLight = 0;
      day.exercises.forEach(function (ex, exIndex) {
        var existingTarget = ds.adaptiveTargets[String(exIndex)];
        if (existingTarget && (existingTarget._lightened || existingTarget.action === "reduced-volume")) {
          return;
        }
        var base = currentExerciseBaseline(ctx, day, ds, ex, exIndex);
        var plannedLen = (ex.sets || []).length || base.sets || 1;
        var currentSets = Math.min(plannedLen, base.sets || plannedLen);
        var doneCount = completedSetIndicesForEx(ds, exIndex).length;
        if (doneCount >= currentSets && currentSets > 0) return;
        var nextWeight = base.weight > 0 ? Math.max(0, roundStep(base.weight * 0.9, 2.5)) : 0;
        var nextSets = Math.max(1, doneCount, currentSets - 1);
        ds.adaptiveTargets[String(exIndex)] = {
          action: "reduced-volume",
          _lightened: true,
          weight: nextWeight,
          reps: base.reps,
          sets: nextSets,
          reason: "Coach autoregulation: ~10% lighter load and -1 working set.",
          frozenAt: Date.now()
        };
        modifiedLight += 1;
      });
      if (ctx && typeof ctx.saveState === "function") ctx.saveState("coach-action");
      return {
        ok: true,
        actionType: "autoregulate-light",
        dayId: day.id,
        modifiedCount: modifiedLight,
        message: "Light autoregulation applied (-10% load, -1 set on uncompleted lifts)."
      };
    }

    if (actionType === "pr-push") {
      var exIndex = -1;
      if (payload.exerciseName) {
        exIndex = day.exercises.findIndex(function (ex) {
          return normalizeName(ex.name) === normalizeName(payload.exerciseName);
        });
      }
      if (exIndex < 0) exIndex = day.exercises.findIndex(function (ex) { return ex && ex.primary; });
      if (exIndex < 0) exIndex = 0;
      var ex = day.exercises[exIndex];
      var base = currentExerciseBaseline(ctx, day, ds, ex, exIndex);
      var range = repRangeFor(ctx, ex);
      var inc = incrementFor(ctx, ex);
      var assisted = isAssisted(ex);
      var doneToday = completedSetIndicesForEx(ds, exIndex).map(function (k) { return ds.completed[k]; });
      var byName = buildExerciseSessions(ctx, entries, day.id);
      var priorBucket = byName[normalizeName(ex.name)];
      var priorSessions = priorBucket ? priorBucket.sessions.filter(function (s) { return s.date < day.id; }) : [];
      var lastPrior = priorSessions.length ? priorSessions[priorSessions.length - 1] : null;

      var topWeight = base.weight;
      var topReps = base.reps;
      if (doneToday.length) {
        var todayWeights = doneToday.map(function (s) { return num(s.weight, 0); });
        topWeight = assisted ? Math.min.apply(null, todayWeights) : Math.max.apply(null, todayWeights);
        topReps = Math.max.apply(null, doneToday.map(function (s) { return num(s.reps, 0); }));
      } else if (lastPrior) {
        topWeight = lastPrior.maxWeight;
        topReps = lastPrior.topRepsAtMax;
      }

      var nextWeight = topWeight;
      var nextReps = topReps;
      var mode = payload.mode;
      if (mode === "reps") {
        nextReps = topReps + 1;
      } else if (mode === "weight") {
        nextWeight = topWeight > 0 ? roundStep(assisted ? Math.max(0, topWeight - inc) : topWeight + inc, inc) : 0;
      } else if (doneToday.length > 0 && topReps < range.max) {
        nextReps = topReps + 1;
      } else if (topWeight > 0 && (topReps >= range.max || (!doneToday.length && !lastPrior))) {
        nextWeight = roundStep(assisted ? Math.max(0, topWeight - inc) : topWeight + inc, inc);
        nextReps = Math.max(range.min, Math.min(range.max, base.reps || range.min));
      } else {
        nextReps = topReps + 1;
      }

      var plannedLen = (ex.sets || []).length || base.sets || 1;
      var targetSets = Math.max(doneToday.length, Math.min(plannedLen, base.sets || plannedLen));
      ds.adaptiveTargets[String(exIndex)] = {
        action: "pr-push",
        weight: nextWeight,
        reps: nextReps,
        sets: targetSets,
        reason: "Coach PR push: target " + formatWeightDisplay(ctx, nextWeight) + " x " + nextReps + ".",
        frozenAt: Date.now()
      };
      if (ctx && typeof ctx.saveState === "function") ctx.saveState("coach-action");
      return {
        ok: true,
        actionType: "pr-push",
        dayId: day.id,
        exIndex: exIndex,
        target: ds.adaptiveTargets[String(exIndex)],
        message: "PR target updated on " + ex.name + ": " + formatWeightDisplay(ctx, nextWeight) + " x " + nextReps + "."
      };
    }

    return { ok: false, actionType: actionType, message: "Unknown coach action." };
  }

  function quickPrompts(ctx, day) {
    var entries = collectAllEntries(ctx);
    var refDate = (day && isValidDateId(day.id)) ? day.id : resolveRefDate(ctx);
    var analysis = analyzeAthlete(ctx, refDate);
    var activeDay = day || resolveActiveDay(ctx, refDate, entries);
    var exercises = activeDay && Array.isArray(activeDay.exercises) ? activeDay.exercises : [];
    var primary = exercises.find(function (e) { return e && e.primary; }) || exercises[0] || null;

    var prompts = [];
    if (primary) {
      prompts.push("How is my " + primary.name + " trending?");
    } else {
      prompts.push("What should I focus on next session?");
    }

    if (analysis.phase === "reentry" || (analysis.daysSinceLast != null && analysis.daysSinceLast >= 14)) {
      prompts.push("How should I pace this reentry week?");
    } else if (analysis.plateauLifts.length) {
      prompts.push("Break my " + analysis.plateauLifts[0].name + " plateau");
    } else if (analysis.readinessScore != null && analysis.readinessScore <= 5) {
      prompts.push("I feel fatigued — lighten today's session");
    } else {
      prompts.push("What is today's workout target?");
    }

    if (analysis.hiatusRisk >= 50) {
      prompts.push("I'm short on time — 15-min Express");
    } else {
      prompts.push("I feel sore — adjust today's load");
    }

    if (analysis.proteinRemainingG > 10) {
      prompts.push("Hit my last " + Math.round(analysis.proteinRemainingG) + "g protein today");
    } else {
      prompts.push("Check my protein and body trend");
    }

    return prompts.slice(0, 4);
  }

  function coachSvgIcon(name) {
    if (name === "send") {
      return '<svg class="coach-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
    }
    return '<svg class="coach-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M5 18l.9 2.1L8 21l-2.1.9L5 24l-.9-2.1L2 21l2.1-.9L5 18z"/></svg>';
  }

  function renderCoachStrip(ctx, day) {
    var brief = getDailyBrief(ctx, day);
    var actionBtn = brief.actionType
      ? '<button type="button" class="action-btn" data-action="coach-action" data-coach-action="' + esc(ctx, brief.actionType) + '" data-coach-payload="' + esc(ctx, JSON.stringify(brief.actionPayload || {})) + '">' + esc(ctx, brief.actionLabel) + '</button>'
      : '';
    return '<section class="coach-gadget" data-tone="' + esc(ctx, brief.tone) + '" aria-label="AI Coach brief">' +
      '<div class="coach-head">' +
        '<span class="coach-eyebrow">' + coachSvgIcon("spark") + '<span>AI Coach</span></span>' +
        '<span class="coach-badge" data-tone="' + esc(ctx, brief.tone) + '">' + esc(ctx, brief.badge) + '</span>' +
      '</div>' +
      '<div class="coach-brief">' +
        '<strong class="coach-headline">' + esc(ctx, brief.headline) + '</strong>' +
        '<p class="coach-subline">' + esc(ctx, brief.subline) + '</p>' +
      '</div>' +
      '<div class="coach-actions">' +
        actionBtn +
        '<button type="button" class="action-btn secondary" data-action="open-sheet" data-sheet="coach">Ask Coach</button>' +
      '</div>' +
    '</section>';
  }

  function renderInsightCard(ctx, label, value, sub, tone) {
    return '<div class="metric-card coach-insight-card" data-tone="' + esc(ctx, tone || "neutral") + '">' +
      '<div class="label">' + esc(ctx, label) + '</div>' +
      '<div class="value">' + esc(ctx, value) + '</div>' +
      '<div class="ring-sub">' + esc(ctx, sub) + '</div>' +
    '</div>';
  }

  function renderCoachSheet(ctx) {
    var state = (ctx && ctx.state) || {};
    var memory = ensureCoachMemory(state);
    var entries = collectAllEntries(ctx);
    var refDate = resolveRefDate(ctx);
    var activeDay = resolveActiveDay(ctx, refDate, entries);
    var analysis = analyzeAthlete(ctx, refDate);
    var prompts = quickPrompts(ctx, activeDay);

    var toneButtons = [
      { id: "analytical", label: "Analytical" },
      { id: "stoic", label: "Stoic" },
      { id: "hype", label: "Hype" }
    ].map(function (t) {
      return '<button type="button" data-action="coach-tone" data-tone="' + t.id + '" data-active="' + String(memory.tone === t.id) + '">' + t.label + '</button>';
    }).join("");

    var momentumSub = analysis.adherence14d + "% 14d adherence" + (analysis.daysSinceLast != null ? " · " + analysis.daysSinceLast + "d gap" : "");
    var riskSub = analysis.hiatusTier.toUpperCase() + (analysis.missedStreak > 0 ? " · " + analysis.missedStreak + " missed" : " · Chain safe");
    var liftValue = analysis.plateauLifts.length
      ? analysis.plateauLifts.length + " plateau" + (analysis.plateauLifts.length > 1 ? "s" : "")
      : analysis.surgingLifts.length
        ? analysis.surgingLifts.length + " surging"
        : "Steady";
    var liftSub = analysis.plateauLifts.length
      ? analysis.plateauLifts.slice(0, 2).map(function (p) { return p.name; }).join(", ")
      : analysis.surgingLifts.length
        ? analysis.surgingLifts.slice(0, 2).map(function (s) { return s.name; }).join(", ")
        : "No stalled lifts detected";
    var liftTone = analysis.plateauLifts.length ? "warning" : analysis.surgingLifts.length ? "success" : "neutral";
    var proteinValue = formatClean(analysis.proteinTodayG, 0) + " / " + formatClean(analysis.proteinTargetG, 0) + " g";
    var proteinSub = (analysis.readinessScore != null ? "Readiness " + analysis.readinessScore + "/10" : "Readiness unlogged") +
      (analysis.hasProteinLogs ? " · " + analysis.proteinHitRate + "% hit rate" : "");

    var chipsHtml = prompts.map(function (prompt) {
      return '<button type="button" class="coach-chip" data-action="coach-quick-ask" data-prompt="' + esc(ctx, prompt) + '">' + esc(ctx, prompt) + '</button>';
    }).join("");

    var chatMessages = memory.messages.length
      ? memory.messages.map(function (msg) {
        var actionHtml = (msg.role === "coach" && msg.actionType && msg.actionLabel)
          ? '<div class="coach-actions"><button type="button" class="action-btn secondary" data-action="coach-action" data-coach-action="' + esc(ctx, msg.actionType) + '" data-coach-payload="' + esc(ctx, JSON.stringify(msg.actionPayload || {})) + '">' + esc(ctx, msg.actionLabel) + '</button></div>'
          : '';
        return '<div class="coach-bubble" data-role="' + esc(ctx, msg.role) + '">' +
          '<span class="coach-bubble-role">' + (msg.role === "user" ? "You" : "AI Coach") + '</span>' +
          '<p class="coach-bubble-text">' + esc(ctx, msg.text) + '</p>' +
          actionHtml +
        '</div>';
      }).join("")
      : '<div class="coach-bubble" data-role="coach">' +
          '<span class="coach-bubble-role">AI Coach</span>' +
          '<p class="coach-bubble-text">' + esc(ctx, analysis.topRecommendation) + '</p>' +
        '</div>';

    return '<div class="sheet-grid coach-sheet">' +
      '<div class="segmented coach-tone-bar" role="group" aria-label="Coach tone">' + toneButtons + '</div>' +
      '<div class="coach-insight-grid">' +
        renderInsightCard(ctx, "Momentum", analysis.momentumLabel, momentumSub, analysis.hiatusRisk >= 60 ? "warning" : "primary") +
        renderInsightCard(ctx, "Hiatus Shield Risk", analysis.hiatusRisk + "/100", riskSub, analysis.hiatusTier === "critical" || analysis.hiatusTier === "elevated" ? "warning" : "success") +
        renderInsightCard(ctx, "Plateaus / Surges", liftValue, liftSub, liftTone) +
        renderInsightCard(ctx, "Protein & Recovery", proteinValue, proteinSub, analysis.readinessScore != null && analysis.readinessScore <= 5 ? "warning" : "neutral") +
      '</div>' +
      '<div class="coach-chips" aria-label="Quick prompts">' + chipsHtml + '</div>' +
      '<div class="coach-chat-log" aria-live="polite">' + chatMessages + '</div>' +
      '<div class="coach-compose">' +
        '<label class="sr-only" for="coach-question-input">Ask AI Coach</label>' +
        '<input id="coach-question-input" type="text" class="coach-input" data-coach-input placeholder="Ask about a lift, soreness, protein, or 15-min Express..." aria-label="Ask AI Coach">' +
        '<button type="button" class="action-btn coach-send-btn" data-action="coach-ask">' + coachSvgIcon("send") + '<span>Ask</span></button>' +
      '</div>' +
    '</div>';
  }

  root.coach = {
    TONES: TONES,
    ensureCoachMemory: ensureCoachMemory,
    analyzeAthlete: analyzeAthlete,
    getDailyBrief: getDailyBrief,
    askCoach: askCoach,
    applyCoachAction: applyCoachAction,
    quickPrompts: quickPrompts,
    renderCoachStrip: renderCoachStrip,
    renderCoachSheet: renderCoachSheet
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.coach;
})();
