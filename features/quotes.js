(function () {
  "use strict";

  var globalObj = typeof window !== "undefined" ? window : globalThis;
  var root = globalObj.LIFT_FEATURES = globalObj.LIFT_FEATURES || {};

  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var MAX_HISTORY = 48;

  var CONTEXT_LABELS = {
    start: "SESSION OPENER",
    grind: "WORK SET FOCUS",
    rest: "REST FOCUS",
    pr: "PR MOMENTUM",
    reentry: "REENTRY GROOVE",
    final_stretch: "FINAL STRETCH",
    low_readiness: "CONTROLLED DAY"
  };

  var TONE_LABELS = {
    grit: "Grit",
    stoic: "Stoic",
    science: "Science",
    hype: "Hype"
  };

  var QUOTES = [
    // --- start (12: 3 grit, 3 stoic, 3 science, 3 hype) ---
    { id: "q-start-01", text: "Show up on the ordinary days; those build the baseline you rely on.", author: "Training Principle", category: "start", tone: "grit" },
    { id: "q-start-02", text: "Win the warm-up set and the rest of the session falls into line.", author: "Iron Discipline", category: "start", tone: "grit" },
    { id: "q-start-03", text: "Discipline starts the first rep before motivation finishes waking up.", author: "Strength Craft", category: "start", tone: "grit" },
    { id: "q-start-04", text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius", category: "start", tone: "stoic" },
    { id: "q-start-05", text: "We suffer more often in imagination than in reality.", author: "Seneca", category: "start", tone: "stoic" },
    { id: "q-start-06", text: "Calm hands, steady breath, clear targets. Take the first set cleanly.", author: "Stoic Maxim", category: "start", tone: "stoic" },
    { id: "q-start-07", text: "Warm-up sets prime neural recruitment and groove your bar path before load.", author: "Hypertrophy Rule", category: "start", tone: "science" },
    { id: "q-start-08", text: "Motor patterns sharpen when your opening reps stay crisp and unhurried.", author: "Strength Craft", category: "start", tone: "science" },
    { id: "q-start-09", text: "Track what actually moves today; clean data beats guesswork every block.", author: "Progression Log", category: "start", tone: "science" },
    { id: "q-start-10", text: "Plates loaded, plan locked—set the tone on Set 1.", author: "Iron Discipline", category: "start", tone: "hype" },
    { id: "q-start-11", text: "Every strong block begins with one decisive opening set.", author: "Strength Craft", category: "start", tone: "hype" },
    { id: "q-start-12", text: "Step up to the lift ready to earn every single rep on the sheet.", author: "Training Principle", category: "start", tone: "hype" },

    // --- grind (12: 3 grit, 3 stoic, 3 science, 3 hype) ---
    { id: "q-grind-01", text: "Hold the line when the bar slows down; those last honest reps do the work.", author: "Iron Discipline", category: "grind", tone: "grit" },
    { id: "q-grind-02", text: "Boring consistency across fifty sessions beats one heroic Tuesday.", author: "Consistency Rule", category: "grind", tone: "grit" },
    { id: "q-grind-03", text: "Keep tension where it belongs when fatigue tempts you to rush.", author: "Strength Craft", category: "grind", tone: "grit" },
    { id: "q-grind-04", text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca", category: "grind", tone: "stoic" },
    { id: "q-grind-05", text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius", category: "grind", tone: "stoic" },
    { id: "q-grind-06", text: "Do not flinch at resistance; meet the load with even breath and control.", author: "Stoic Maxim", category: "grind", tone: "stoic" },
    { id: "q-grind-07", text: "Mechanical tension near 1-2 RIR drives growth without sloppy momentum.", author: "Hypertrophy Rule", category: "grind", tone: "science" },
    { id: "q-grind-08", text: "Control the eccentric; tissue adaptation follows quality tension, not ego.", author: "Hypertrophy Rule", category: "grind", tone: "science" },
    { id: "q-grind-09", text: "Match your target RIR so today's work fuels tomorrow's progression.", author: "Progression Log", category: "grind", tone: "science" },
    { id: "q-grind-10", text: "When the set gets heavy, stay tight and drive straight through.", author: "Strength Craft", category: "grind", tone: "hype" },
    { id: "q-grind-11", text: "Own the sticky point—slow reps with clean form still move forward.", author: "Iron Discipline", category: "grind", tone: "hype" },
    { id: "q-grind-12", text: "Stack another clean working set onto the ledger and keep climbing.", author: "Training Principle", category: "grind", tone: "hype" },

    // --- rest (12: 3 grit, 3 stoic, 3 science, 3 hype) ---
    { id: "q-rest-01", text: "Use the clock with purpose—recover enough to make the next set count.", author: "Training Principle", category: "rest", tone: "grit" },
    { id: "q-rest-02", text: "Catch your breath, check your notes, and return to the bar composed.", author: "Iron Discipline", category: "rest", tone: "grit" },
    { id: "q-rest-03", text: "Rest is part of the set structure, not time off from the work.", author: "Strength Craft", category: "rest", tone: "grit" },
    { id: "q-rest-04", text: "No man is free who is not master of himself.", author: "Epictetus", category: "rest", tone: "stoic" },
    { id: "q-rest-05", text: "Quiet the mind between efforts; steadiness before the rep brings strength.", author: "Stoic Maxim", category: "rest", tone: "stoic" },
    { id: "q-rest-06", text: "Drop the rush. Return only when your focus is as clear as your grip.", author: "Stoic Maxim", category: "rest", tone: "stoic" },
    { id: "q-rest-07", text: "Full 90-180s rests restore ATP-PCr so mechanical tension stays high.", author: "Hypertrophy Rule", category: "rest", tone: "science" },
    { id: "q-rest-08", text: "Shortchanging rest trades real motor-unit output for empty fatigue.", author: "Hypertrophy Rule", category: "rest", tone: "science" },
    { id: "q-rest-09", text: "Steady nasal breathing lowers heart rate faster before your next work set.", author: "Recovery Rule", category: "rest", tone: "science" },
    { id: "q-rest-10", text: "Breathe in, reset your brace, and line up the next heavy set.", author: "Strength Craft", category: "rest", tone: "hype" },
    { id: "q-rest-11", text: "Recharge the tank—the best set of the session is still ahead.", author: "Training Principle", category: "rest", tone: "hype" },
    { id: "q-rest-12", text: "Watch the timer wind down, visualize the path, and strike cleanly.", author: "Iron Discipline", category: "rest", tone: "hype" },

    // --- pr (12: 3 grit, 3 stoic, 3 science, 3 hype) ---
    { id: "q-pr-01", text: "Records are simply receipts for months of unglamorous, repeatable work.", author: "Consistency Rule", category: "pr", tone: "grit" },
    { id: "q-pr-02", text: "Bank the milestone, then protect the technique that earned it.", author: "Strength Craft", category: "pr", tone: "grit" },
    { id: "q-pr-03", text: "You outworked your former ceiling—now turn that peak into your new normal.", author: "Iron Discipline", category: "pr", tone: "grit" },
    { id: "q-pr-04", text: "Acknowledge the milestone quietly, stay humble, and return to the craft.", author: "Stoic Maxim", category: "pr", tone: "stoic" },
    { id: "q-pr-05", text: "Nothing great is created suddenly, any more than a bunch of grapes or a fig.", author: "Epictetus", category: "pr", tone: "stoic" },
    { id: "q-pr-06", text: "Progress rewards patience; let clean execution remain your standard.", author: "Stoic Maxim", category: "pr", tone: "stoic" },
    { id: "q-pr-07", text: "A verified rep or load PR confirms your mesocycle stimulus is working.", author: "Progression Log", category: "pr", tone: "science" },
    { id: "q-pr-08", text: "New baseline locked—anchor this weight cleanly before chasing the next jump.", author: "Double Progression", category: "pr", tone: "science" },
    { id: "q-pr-09", text: "Higher estimated 1RM at steady form means true strength adaptation.", author: "Hypertrophy Rule", category: "pr", tone: "science" },
    { id: "q-pr-10", text: "New personal record on the board—every rep of patience just paid off.", author: "Iron Discipline", category: "pr", tone: "hype" },
    { id: "q-pr-11", text: "Ceiling raised. Keep that composure through the rest of the session.", author: "Strength Craft", category: "pr", tone: "hype" },
    { id: "q-pr-12", text: "Verified PR logged—remember how earned momentum feels.", author: "Training Principle", category: "pr", tone: "hype" },

    // --- reentry (12: 3 grit, 3 stoic, 3 science, 3 hype) ---
    { id: "q-reentry-01", text: "Return without ego; rebuilding the groove beats nursing a preventable strain.", author: "Reentry Maxim", category: "reentry", tone: "grit" },
    { id: "q-reentry-02", text: "The comeback starts the moment you refuse to let one gap become a year.", author: "Consistency Rule", category: "reentry", tone: "grit" },
    { id: "q-reentry-03", text: "Leave 3 RIR in the tank this week so next month carries real weight.", author: "Reentry Maxim", category: "reentry", tone: "grit" },
    { id: "q-reentry-04", text: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca", category: "reentry", tone: "stoic" },
    { id: "q-reentry-05", text: "You have power over your mind—not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius", category: "reentry", tone: "stoic" },
    { id: "q-reentry-06", text: "Never punish yourself for time away; put both feet on the floor today.", author: "Stoic Maxim", category: "reentry", tone: "stoic" },
    { id: "q-reentry-07", text: "Myonuclei and neural pathways rebound fast—submaximal reps spark memory.", author: "Hypertrophy Rule", category: "reentry", tone: "science" },
    { id: "q-reentry-08", text: "Controlled reentry limits severe DOMS so you can hit every planned day.", author: "Recovery Rule", category: "reentry", tone: "science" },
    { id: "q-reentry-09", text: "70-75% loads restore tendon tolerance and bar speed in just two weeks.", author: "Progression Log", category: "reentry", tone: "science" },
    { id: "q-reentry-10", text: "Back under the bar—every clean rep wakes up strength you already built.", author: "Reentry Maxim", category: "reentry", tone: "hype" },
    { id: "q-reentry-11", text: "Fresh slate, same athlete—lock the cadence and stack Week 1 back cleanly.", author: "Iron Discipline", category: "reentry", tone: "hype" },
    { id: "q-reentry-12", text: "Day one back is the hardest victory. Take the sets and build momentum.", author: "Consistency Rule", category: "reentry", tone: "hype" },

    // --- final_stretch (12: 3 grit, 3 stoic, 3 science, 3 hype) ---
    { id: "q-final-01", text: "Finish the accessories with the same precision you gave your top set.", author: "Strength Craft", category: "final_stretch", tone: "grit" },
    { id: "q-final-02", text: "Three quarters done—do not mail in the reps that round out the day.", author: "Iron Discipline", category: "final_stretch", tone: "grit" },
    { id: "q-final-03", text: "Close the workout cleanly so nothing is left half-finished.", author: "Consistency Rule", category: "final_stretch", tone: "grit" },
    { id: "q-final-04", text: "End as you began: attentive, unhurried, and faithful to the detail.", author: "Stoic Maxim", category: "final_stretch", tone: "stoic" },
    { id: "q-final-05", text: "Excellence is shown in the small closing sets nobody else is watching.", author: "Stoic Maxim", category: "final_stretch", tone: "stoic" },
    { id: "q-final-06", text: "Stay steady to the final rep; discipline means finishing the measure.", author: "Stoic Maxim", category: "final_stretch", tone: "stoic" },
    { id: "q-final-07", text: "Late-session isolation sets add local stimulus with minimal systemic tax.", author: "Hypertrophy Rule", category: "final_stretch", tone: "science" },
    { id: "q-final-08", text: "Even fatigue-resistant accessories respond best to full range and control.", author: "Hypertrophy Rule", category: "final_stretch", tone: "science" },
    { id: "q-final-09", text: "Log the closing sets accurately—your weekly volume ledger depends on them.", author: "Progression Log", category: "final_stretch", tone: "science" },
    { id: "q-final-10", text: "Home stretch—empty the remaining working sets with crisp form.", author: "Iron Discipline", category: "final_stretch", tone: "hype" },
    { id: "q-final-11", text: "Last few sets of the day. Lock in and finish on your terms.", author: "Training Principle", category: "final_stretch", tone: "hype" },
    { id: "q-final-12", text: "Almost across the line—close this session strong and walk out proud.", author: "Strength Craft", category: "final_stretch", tone: "hype" },

    // --- low_readiness (12: 3 grit, 3 stoic, 3 science, 3 hype) ---
    { id: "q-low-01", text: "On low-fuel days, punching the clock at 80% keeps the chain unbroken.", author: "Consistency Rule", category: "low_readiness", tone: "grit" },
    { id: "q-low-02", text: "Half-tank sessions still count twice when you refused to skip them.", author: "Iron Discipline", category: "low_readiness", tone: "grit" },
    { id: "q-low-03", text: "Lower the bar if needed, not the standard of showing up and moving well.", author: "Training Principle", category: "low_readiness", tone: "grit" },
    { id: "q-low-04", text: "Meet today with the energy you actually have, not the energy you wished for.", author: "Stoic Maxim", category: "low_readiness", tone: "stoic" },
    { id: "q-low-05", text: "Do only what is necessary, and do it cleanly—that is enough for today.", author: "Stoic Maxim", category: "low_readiness", tone: "stoic" },
    { id: "q-low-06", text: "Adjust the sail to the wind; staying on course matters more than speed.", author: "Stoic Maxim", category: "low_readiness", tone: "stoic" },
    { id: "q-low-07", text: "Autoregulating volume on low readiness preserves recovery for peak days.", author: "Recovery Rule", category: "low_readiness", tone: "science" },
    { id: "q-low-08", text: "Maintenance stimulus keeps muscle intact while sleep and stress catch up.", author: "Hypertrophy Rule", category: "low_readiness", tone: "science" },
    { id: "q-low-09", text: "Clean technical reps at 2-3 RIR keep neural drive sharp without burnout.", author: "Progression Log", category: "low_readiness", tone: "science" },
    { id: "q-low-10", text: "Tough morning, steady athlete—hit the crisp minimums and keep the streak.", author: "Consistency Rule", category: "low_readiness", tone: "hype" },
    { id: "q-low-11", text: "Respect the signal, execute smart, and leave better than you walked in.", author: "Training Principle", category: "low_readiness", tone: "hype" },
    { id: "q-low-12", text: "Not every session needs fireworks; today is won by clean minimum work.", author: "Strength Craft", category: "low_readiness", tone: "hype" }
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function esc(ctx, value) {
    if (ctx && typeof ctx.escapeHtml === "function") return ctx.escapeHtml(value);
    return escapeHtml(value);
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

  function localTodayId() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function isCompletedSetEntry(entry) {
    return !!entry && Number(entry.reps) > 0;
  }

  function hasVerifiedReps(dayState) {
    var completed = dayState && dayState.completed;
    if (!completed || typeof completed !== "object") return false;
    return Object.keys(completed).some(function (key) {
      return isCompletedSetEntry(completed[key]);
    });
  }

  function isTrainedSession(dayState) {
    if (!dayState || typeof dayState !== "object") return false;
    if (hasVerifiedReps(dayState)) return true;
    return dayState.status === "reconstructed" && dayState.trained !== false;
  }

  function daysSinceLastWorkoutFallback(ctx, referenceDate) {
    var ref = referenceDate || (ctx && typeof ctx.todayId === "function" && ctx.todayId()) || localTodayId();
    if (!isValidDateId(ref)) return null;
    var stateDays = (ctx && ctx.state && ctx.state.days) || {};
    var seen = {};
    var candidates = [];

    if (ctx && typeof ctx.allDays === "function") {
      (ctx.allDays() || []).forEach(function (entry) {
        var id = entry && entry.day && entry.day.id;
        if (id && !seen[id]) {
          seen[id] = true;
          candidates.push(id);
        }
      });
    }
    Object.keys(stateDays).forEach(function (id) {
      if (!seen[id]) {
        seen[id] = true;
        candidates.push(id);
      }
    });

    var lastDate = null;
    candidates.forEach(function (id) {
      if (!isValidDateId(id) || id >= ref) return;
      if (isTrainedSession(stateDays[id]) && (!lastDate || id > lastDate)) {
        lastDate = id;
      }
    });

    if (!lastDate) return null;
    return { days: Math.round((utcMs(ref) - utcMs(lastDate)) / 86400000), lastDate: lastDate };
  }

  function computeHiatusGap(ctx, refDate) {
    var reentryMod = (ctx && ctx.reentry) || root.reentry;
    if (reentryMod && typeof reentryMod.daysSinceLastWorkout === "function") {
      return reentryMod.daysSinceLastWorkout(ctx, refDate);
    }
    return daysSinceLastWorkoutFallback(ctx, refDate);
  }

  function normalizePhaseValue(ctx, phase) {
    if (ctx && typeof ctx.normalizePhase === "function") return ctx.normalizePhase(phase);
    return String(phase || "").toLowerCase().replace(/\s+/g, "");
  }

  function resolveActiveDay(ctx, day) {
    if (day && typeof day === "object") return day;
    var state = (ctx && ctx.state) || {};
    if (ctx && typeof ctx.getDay === "function" && state.activeDayId) {
      return ctx.getDay(state.activeDayId) || null;
    }
    if (ctx && typeof ctx.allDays === "function" && state.activeDayId) {
      var match = (ctx.allDays() || []).find(function (entry) {
        return entry && entry.day && entry.day.id === state.activeDayId;
      });
      if (match) return match.day || null;
    }
    return null;
  }

  function resolveActiveWeek(ctx, dayId) {
    var state = (ctx && ctx.state) || {};
    var week = null;
    if (ctx && typeof ctx.getWeek === "function" && state.activeWeekId) {
      week = ctx.getWeek(state.activeWeekId);
    }
    var targetDayId = dayId || state.activeDayId;
    if (!week && ctx && typeof ctx.weekForDayId === "function" && targetDayId) {
      week = ctx.weekForDayId(targetDayId);
    }
    if (!week && ctx && typeof ctx.allDays === "function" && targetDayId) {
      var match = (ctx.allDays() || []).find(function (entry) {
        return entry && entry.day && entry.day.id === targetDayId;
      });
      if (match) week = match.week || null;
    }
    return week;
  }

  function resolveDayState(ctx, dayId) {
    var state = (ctx && ctx.state) || {};
    if (dayId && state.days && state.days[dayId]) return state.days[dayId];
    if (dayId && ctx && typeof ctx.dayState === "function") return ctx.dayState(dayId) || {};
    return {};
  }

  function countCompletedSets(ctx, day, ds) {
    if (ctx && typeof ctx.completedSetCount === "function" && day) {
      return Number(ctx.completedSetCount(day, ctx.state)) || 0;
    }
    var completed = (ds && ds.completed) || {};
    return Object.keys(completed).filter(function (key) {
      return isCompletedSetEntry(completed[key]);
    }).length;
  }

  function countTotalSets(ctx, day, ds) {
    if (ctx && typeof ctx.totalSetCount === "function" && day) {
      return Number(ctx.totalSetCount(day)) || 0;
    }
    if (!day || !Array.isArray(day.exercises)) return 0;
    var extraSets = (ds && ds.extraSets) || {};
    var adaptiveTargets = (ds && ds.adaptiveTargets) || {};
    return day.exercises.reduce(function (sum, ex, exIndex) {
      var planned = Array.isArray(ex && ex.sets) ? ex.sets.length : 0;
      var target = adaptiveTargets[String(exIndex)];
      if (target && Number(target.sets) > 0) {
        planned = Math.min(planned, Number(target.sets));
      }
      var extra = Number(extraSets[String(exIndex)] || 0);
      return sum + planned + (Number.isFinite(extra) && extra > 0 ? extra : 0);
    }, 0);
  }

  function hasRecentPr(dayId, ds, rt) {
    var completed = (ds && ds.completed && typeof ds.completed === "object") ? ds.completed : {};
    var lastLog = rt && rt.lastLog;
    if (lastLog && typeof lastLog === "object" && (!dayId || !lastLog.dayId || lastLog.dayId === dayId)) {
      if (lastLog.action === "restore") return false;
      if (lastLog.pr === true || lastLog.isPr === true) return true;
      if (lastLog.key != null) {
        var logged = completed[lastLog.key];
        return !!(isCompletedSetEntry(logged) && logged.pr === true);
      }
      return false;
    }
    return Object.keys(completed).some(function (key) {
      return isCompletedSetEntry(completed[key]) && completed[key].pr === true;
    });
  }

  function hasActiveRest(rt) {
    var rest = rt && rt.rest;
    if (!rest || typeof rest !== "object") return false;
    if (rest.running === false) return false;
    if (rest.remaining != null && rest.remaining !== "") {
      return Number(rest.remaining) > 0;
    }
    var now = Number(rt.now) || Date.now();
    if (rest.endsAt != null && Number(rest.endsAt) > 0) {
      return Math.ceil((Number(rest.endsAt) - now) / 1000) > 0;
    }
    if (rest.running === true && rest.pausedRemaining != null) {
      return Number(rest.pausedRemaining) > 0;
    }
    return false;
  }

  function pickContext(ctx, day, runtime) {
    var state = (ctx && ctx.state) || {};
    var rt = runtime || (ctx && ctx.runtime) || {};
    var activeDay = resolveActiveDay(ctx, day);
    var dayId = (activeDay && activeDay.id) || state.activeDayId || null;
    var ds = resolveDayState(ctx, dayId);

    if (hasRecentPr(dayId, ds, rt)) return "pr";
    if (hasActiveRest(rt)) return "rest";

    var total = countTotalSets(ctx, activeDay, ds);
    var completed = countCompletedSets(ctx, activeDay, ds);
    if (total > 0 && (completed / total) >= 0.75 && completed < total) return "final_stretch";

    if (ds.readiness != null && ds.readiness !== "" && Number.isFinite(Number(ds.readiness)) && Number(ds.readiness) <= 5) {
      return "low_readiness";
    }

    var week = resolveActiveWeek(ctx, dayId);
    var phase = normalizePhaseValue(ctx, (week && week.phase) || (activeDay && activeDay.phase));
    if (phase === "reentry") return "reentry";

    var refDate = dayId || state.activeDayId || (ctx && typeof ctx.todayId === "function" && ctx.todayId()) || localTodayId();
    var gap = computeHiatusGap(ctx, refDate);
    if (gap && gap.days >= 14) return "reentry";

    if (completed === 0) return "start";
    return "grind";
  }

  function normalizePreferredTone(rawTone) {
    var t = String(rawTone || "").trim().toLowerCase();
    if (!t || t === "all" || t === "auto") return null;
    if (t === "analytical") return "science";
    if (t === "grit" || t === "stoic" || t === "science" || t === "hype") return t;
    return null;
  }

  function resolvePreferredTone(ctx) {
    var state = (ctx && ctx.state) || {};
    var settingsTone = state.settings && state.settings.quoteTone;
    if (settingsTone != null && String(settingsTone).trim() !== "") {
      return normalizePreferredTone(settingsTone);
    }
    var coachTone = state.coachMemory && state.coachMemory.tone;
    return normalizePreferredTone(coachTone);
  }

  function stableHash(input) {
    var str = String(input || "");
    var h = 2166136261;
    for (var i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function findQuoteById(id) {
    if (!id) return null;
    for (var i = 0; i < QUOTES.length; i += 1) {
      if (QUOTES[i].id === id) return QUOTES[i];
    }
    return null;
  }

  function sortLeastRecentlyUsed(pool, history) {
    return pool.slice().sort(function (a, b) {
      return history.lastIndexOf(a.id) - history.lastIndexOf(b.id);
    });
  }

  function selectQuoteCandidate(category, preferredTone, currentId, history, seedKey, forceNext) {
    var recentSet = {};
    history.forEach(function (id) { recentSet[id] = true; });

    var tiers = [];
    if (preferredTone) {
      tiers.push({
        unseen: true,
        items: QUOTES.filter(function (q) {
          return q.category === category && q.tone === preferredTone && !recentSet[q.id] && q.id !== currentId;
        })
      });
    }
    tiers.push({
      unseen: true,
      items: QUOTES.filter(function (q) {
        return q.category === category && !recentSet[q.id] && q.id !== currentId;
      })
    });
    if (preferredTone) {
      tiers.push({
        unseen: false,
        items: QUOTES.filter(function (q) {
          return q.category === category && q.tone === preferredTone && q.id !== currentId;
        })
      });
    }
    tiers.push({
      unseen: false,
      items: QUOTES.filter(function (q) {
        return q.category === category && q.id !== currentId;
      })
    });
    if (preferredTone) {
      tiers.push({
        unseen: true,
        items: QUOTES.filter(function (q) {
          return q.tone === preferredTone && !recentSet[q.id] && q.id !== currentId;
        })
      });
    }
    tiers.push({
      unseen: true,
      items: QUOTES.filter(function (q) {
        return !recentSet[q.id] && q.id !== currentId;
      })
    });
    tiers.push({
      unseen: false,
      items: QUOTES.filter(function (q) {
        return q.id !== currentId;
      })
    });

    for (var i = 0; i < tiers.length; i += 1) {
      var tier = tiers[i];
      if (!tier.items.length) continue;
      if (!tier.unseen) {
        return sortLeastRecentlyUsed(tier.items, history)[0];
      }
      var idx = forceNext
        ? stableHash(seedKey + "|" + history.length) % tier.items.length
        : stableHash(seedKey) % tier.items.length;
      return tier.items[idx];
    }

    return QUOTES[0] || { id: "q-fallback", text: "Stay steady and execute the next set.", author: "Training Principle", category: category, tone: "stoic" };
  }

  function recordHistory(rt, quoteId) {
    if (!quoteId) return;
    if (!Array.isArray(rt.quoteHistory)) rt.quoteHistory = [];
    var prevIdx = rt.quoteHistory.indexOf(quoteId);
    if (prevIdx >= 0) rt.quoteHistory.splice(prevIdx, 1);
    rt.quoteHistory.push(quoteId);
    if (rt.quoteHistory.length > MAX_HISTORY) {
      rt.quoteHistory = rt.quoteHistory.slice(rt.quoteHistory.length - MAX_HISTORY);
    }
  }

  function isFavorited(ctx, quoteId) {
    var favs = ctx && ctx.state && Array.isArray(ctx.state.favoriteQuotes) ? ctx.state.favoriteQuotes : [];
    return !!quoteId && favs.indexOf(quoteId) >= 0;
  }

  function labelForCategory(category) {
    return CONTEXT_LABELS[category] || "SESSION FOCUS";
  }

  function labelForTone(tone) {
    return TONE_LABELS[tone] || "Focused";
  }

  function getActiveQuote(ctx, day, runtime, forceNext) {
    var state = (ctx && ctx.state) || {};
    var rt = runtime || (ctx && ctx.runtime) || {};
    var activeDay = resolveActiveDay(ctx, day);
    var dayId = (activeDay && activeDay.id) || state.activeDayId || "today";
    var category = pickContext(ctx, activeDay, rt);
    var preferredTone = resolvePreferredTone(ctx);

    var cached = rt.sessionQuote;
    var chosen = null;

    if (!forceNext && cached && typeof cached === "object" && cached.context === category && cached.preferredTone === preferredTone) {
      var fromCatalog = findQuoteById(cached.id);
      if (fromCatalog) {
        chosen = fromCatalog;
      } else if (typeof cached.text === "string" && cached.text) {
        chosen = cached;
      }
    }

    if (!chosen) {
      var history = Array.isArray(rt.quoteHistory) ? rt.quoteHistory : (rt.quoteHistory = []);
      var currentId = cached && cached.id ? cached.id : null;
      var seedKey = dayId + "|" + category + "|" + (preferredTone || "any");
      chosen = selectQuoteCandidate(category, preferredTone, currentId, history, seedKey, !!forceNext);
      rt.sessionQuote = {
        id: chosen.id,
        text: chosen.text,
        author: chosen.author,
        category: chosen.category,
        tone: chosen.tone,
        context: category,
        preferredTone: preferredTone
      };
      recordHistory(rt, chosen.id);
    }

    return {
      id: chosen.id,
      text: chosen.text,
      author: chosen.author,
      category: chosen.category || category,
      tone: chosen.tone || preferredTone || "stoic",
      label: labelForCategory(category),
      favorited: isFavorited(ctx, chosen.id)
    };
  }

  function toggleFavorite(ctx, quoteId) {
    if (!ctx || !ctx.state) return { favorited: false, count: 0 };
    var id = String(quoteId || "").trim();
    var existing = Array.isArray(ctx.state.favoriteQuotes) ? ctx.state.favoriteQuotes : [];
    var deduped = [];
    var seen = {};
    existing.forEach(function (item) {
      var key = String(item || "").trim();
      if (key && !seen[key]) {
        seen[key] = true;
        deduped.push(key);
      }
    });

    if (!id) {
      ctx.state.favoriteQuotes = deduped;
      return { favorited: false, count: deduped.length };
    }

    var idx = deduped.indexOf(id);
    var favorited;
    if (idx >= 0) {
      deduped.splice(idx, 1);
      favorited = false;
    } else {
      deduped.push(id);
      favorited = true;
    }
    ctx.state.favoriteQuotes = deduped;
    if (typeof ctx.saveState === "function") ctx.saveState("quote-fav");
    return { favorited: favorited, count: deduped.length };
  }

  function quoteMarkSvg() {
    return '<svg class="quote-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4.5-4 5"/>' +
      '<path d="M19 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2.5-1.5 4.5-4 5"/>' +
      "</svg>";
  }

  function heartSvg(favorited) {
    return '<svg class="quote-btn-icon" aria-hidden="true" viewBox="0 0 24 24" fill="' + (favorited ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
      "</svg>";
  }

  function nextSvg(ctx) {
    if (ctx && typeof ctx.icon === "function") return ctx.icon("refresh");
    return '<svg class="quote-btn-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16"/>' +
      '<path d="M21 3v5h-5M3 21v-5h5"/>' +
      "</svg>";
  }

  function renderSessionQuote(ctx, day, runtime) {
    var quote = getActiveQuote(ctx, day, runtime, false);
    var eyebrow = "IN-SESSION FUEL \u00b7 " + (quote.label || labelForCategory(quote.category));
    var toneText = labelForTone(quote.tone);
    var favLabel = quote.favorited ? "Remove quote from favorites" : "Save quote to favorites";

    return '<section class="quote-gadget" data-category="' + esc(ctx, quote.category) + '" data-tone="' + esc(ctx, quote.tone) + '" aria-label="In-session motivation">' +
      '<div class="quote-head">' +
      '<span class="quote-eyebrow">' + quoteMarkSvg() + "<span>" + esc(ctx, eyebrow) + "</span></span>" +
      '<span class="quote-tone">' + esc(ctx, toneText) + "</span>" +
      "</div>" +
      '<blockquote class="quote-text">' + esc(ctx, quote.text) + "</blockquote>" +
      '<div class="quote-foot">' +
      '<cite class="quote-author">\u2014 ' + esc(ctx, quote.author) + "</cite>" +
      '<div class="quote-actions">' +
      '<button type="button" class="quote-btn quote-fav-btn" data-action="quote-fav" data-quote-id="' + esc(ctx, quote.id) + '" aria-pressed="' + String(!!quote.favorited) + '" aria-label="' + esc(ctx, favLabel) + '">' +
      heartSvg(!!quote.favorited) + "<span>" + (quote.favorited ? "Saved" : "Save") + "</span></button>" +
      '<button type="button" class="quote-btn quote-next-btn" data-action="quote-next" aria-label="Next quote">' +
      nextSvg(ctx) + "<span>Next</span></button>" +
      "</div>" +
      "</div>" +
      "</section>";
  }

  function getRestQuoteText(ctx, day, runtime) {
    var quote = getActiveQuote(ctx, day, runtime, false);
    return String(quote && quote.text || "").replace(/\s+/g, " ").trim();
  }

  root.quotes = {
    QUOTES: QUOTES,
    CONTEXT_LABELS: CONTEXT_LABELS,
    TONE_LABELS: TONE_LABELS,
    pickContext: pickContext,
    getActiveQuote: getActiveQuote,
    toggleFavorite: toggleFavorite,
    renderSessionQuote: renderSessionQuote,
    getRestQuoteText: getRestQuoteText
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.quotes;
})();
