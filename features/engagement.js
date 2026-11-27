// Habit-stickiness & anti-hiatus behavioral psychology engine.
// Implements the Hooked Loop (Trigger -> Action -> Variable Reward -> Investment),
// Zeigarnik progress/quests, implementation-intention pledges, streak freeze
// shields, and escalating shame-free hiatus defense — 100% offline/local-first.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var FEED_CAP = 40;

  var RANKS = [
    { level: 1, title: "Novice", minXp: 0, nextXp: 250 },
    { level: 2, title: "Iron Regular", minXp: 250, nextXp: 650 },
    { level: 3, title: "Steel Lifter", minXp: 650, nextXp: 1250 },
    { level: 4, title: "Hypertrophy Tactician", minXp: 1250, nextXp: 2100 },
    { level: 5, title: "Barbell Architect", minXp: 2100, nextXp: 3200 },
    { level: 6, title: "Titan", minXp: 3200, nextXp: 4600 },
    { level: 7, title: "Apex Legend", minXp: 4600, nextXp: 6400 }
  ];

  var TITLES = [
    "Iron Groove",
    "Comeback Architect",
    "Zero-Zero Breaker",
    "Volume Sovereign",
    "Unbroken Chain"
  ];

  var COACH_SECRETS = [
    "Mechanical tension beats ego load: control a clean 2-3 second eccentric on your top working set.",
    "Two missed days never detrain muscle; showing up for ten focused minutes preserves the neural groove.",
    "Leaving 1-2 reps in reserve on compound lifts builds more weekly recoverable volume than grinding to failure.",
    "Log RIR honestly: matching reps at a lower RIR than last week is real hypertrophy progress.",
    "Pre-committing when and where you train doubles follow-through compared to relying on willpower."
  ];

  var RARITY_WEIGHTS = [
    { rarity: "Common", weight: 0.52 },
    { rarity: "Rare", weight: 0.28 },
    { rarity: "Epic", weight: 0.15 },
    { rarity: "Mythic", weight: 0.05 }
  ];

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function localEscapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function esc(ctx, value) {
    if (ctx && typeof ctx.escapeHtml === "function") return ctx.escapeHtml(value);
    return localEscapeHtml(value);
  }

  function isValidDateId(id) {
    var m = DATE_RE.exec(String(id || ""));
    if (!m) return false;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    var dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  }

  function utcMs(id) {
    var m = DATE_RE.exec(String(id || ""));
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function isoDateAddDays(iso, days) {
    if (!isValidDateId(iso)) return iso;
    var dt = new Date(utcMs(iso));
    dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
    return dt.toISOString().slice(0, 10);
  }

  function dateDiffDays(fromId, toId) {
    if (!isValidDateId(fromId) || !isValidDateId(toId)) return 0;
    return Math.round((utcMs(toId) - utcMs(fromId)) / 86400000);
  }

  function currentTodayId(ctx) {
    if (ctx && typeof ctx.todayId === "function") {
      var id = ctx.todayId();
      if (isValidDateId(id)) return id;
    }
    if (ctx && typeof ctx.localDateId === "function") {
      var local = ctx.localDateId(new Date());
      if (isValidDateId(local)) return local;
    }
    var now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  }

  function finiteNum(value, fallback) {
    var num = Number(value);
    return Number.isFinite(num) ? num : (fallback === undefined ? 0 : fallback);
  }

  function validCompletedKeys(ds) {
    var completed = isObject(ds && ds.completed) ? ds.completed : {};
    return Object.keys(completed).filter(function (key) {
      var reps = finiteNum((completed[key] || {}).reps, 0);
      return reps > 0;
    });
  }

  function isTrainedDayState(ds) {
    if (!isObject(ds)) return false;
    if (validCompletedKeys(ds).length > 0) return true;
    return ds.status === "reconstructed" && ds.trained !== false;
  }

  function makeId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 100000).toString(36);
  }

  function defaultEngagement() {
    return {
      xp: 0,
      shields: 1,
      maxShields: 3,
      combo: 0,
      bestCombo: 0,
      shieldEarnedSessions: 0,
      quests: {},
      pledge: null,
      pendingLoot: null,
      unlockedLoot: [],
      feed: [],
      shieldedDates: {},
      rewardedWorkoutDates: {},
      lifetimeSessions: 0,
      lifetimeVolumeKg: 0,
      hypes: 0,
      lastWorkoutDate: null
    };
  }

  function isHistoricalSession(ds) {
    if (!isObject(ds)) return false;
    if (ds.status === "reconstructed" && ds.trained !== false) return true;
    if (ds.startedAt && !ds.finishedAt && ds.status !== "completed") return false;
    if (validCompletedKeys(ds).length === 0) return false;
    return !!ds.finishedAt || ds.status === "completed" || !ds.status;
  }

  function seedFromHistory(state, skipDateId) {
    if (!isObject(state)) return defaultEngagement();
    var eng = isObject(state.engagement) ? state.engagement : (state.engagement = defaultEngagement());
    if (finiteNum(eng.xp, 0) > 0 || finiteNum(eng.lifetimeSessions, 0) > 0) return eng;
    if (!isObject(eng.rewardedWorkoutDates)) eng.rewardedWorkoutDates = {};

    var days = isObject(state.days) ? state.days : {};
    var dates = Object.keys(days).filter(isValidDateId).sort();
    var sessions = 0;
    var totalXp = 0;
    var totalVolumeKg = 0;
    var lastDate = null;

    dates.forEach(function (date) {
      if (skipDateId && date === skipDateId) return;
      var ds = days[date];
      if (!isHistoricalSession(ds)) return;
      var keys = validCompletedKeys(ds);
      sessions += 1;
      lastDate = date;
      eng.rewardedWorkoutDates[date] = true;
      if (keys.length > 0) {
        var prs = 0;
        var rirs = 0;
        keys.forEach(function (k) {
          var set = ds.completed[k] || {};
          var reps = Math.max(0, finiteNum(set.reps, 0));
          var weight = Math.max(0, finiteNum(set.weight, 0));
          totalVolumeKg += weight * reps;
          if (set.pr) prs += 1;
          if (set.rir != null && set.rir !== "") rirs += 1;
        });
        totalXp += keys.length * 10 + prs * 15 + rirs * 3 + (ds.finishedAt ? 50 : 25);
      } else {
        totalXp += 40;
      }
    });

    if (sessions > 0) {
      eng.xp = totalXp;
      eng.lifetimeSessions = sessions;
      eng.lifetimeVolumeKg = Math.round(totalVolumeKg);
      eng.lastWorkoutDate = lastDate;
      eng.shieldEarnedSessions = sessions % 4;
      eng.shields = Math.min(eng.maxShields, Math.max(eng.shields, 1 + Math.floor(sessions / 4)));
      if (!Array.isArray(eng.feed)) eng.feed = [];
      if (eng.feed.length === 0) {
        eng.feed.unshift({
          id: "seed-history-" + lastDate,
          kind: "milestone",
          title: "History synced: " + sessions + " verified sessions",
          detail: Math.round(totalVolumeKg) + " kg lifetime volume · +" + totalXp + " starter XP",
          date: lastDate,
          ts: Date.now(),
          hypes: 0
        });
      }
    }
    return eng;
  }

  function ensureEngagement(state, skipDateId) {
    if (!isObject(state)) return defaultEngagement();
    var eng = isObject(state.engagement) ? state.engagement : (state.engagement = {});
    var maxShields = Math.max(1, Math.round(finiteNum(eng.maxShields, 3)));
    var shieldsVal = eng.shields == null ? 1 : Math.round(finiteNum(eng.shields, 0));

    eng.xp = Math.max(0, Math.round(finiteNum(eng.xp, 0)));
    eng.maxShields = maxShields;
    eng.shields = Math.max(0, Math.min(maxShields, shieldsVal));
    eng.combo = Math.max(0, Math.round(finiteNum(eng.combo, 0)));
    eng.bestCombo = Math.max(0, Math.round(finiteNum(eng.bestCombo, 0)));
    if (eng.combo > eng.bestCombo) eng.bestCombo = eng.combo;
    eng.shieldEarnedSessions = Math.max(0, Math.round(finiteNum(eng.shieldEarnedSessions, 0)));
    eng.quests = isObject(eng.quests) ? eng.quests : {};
    eng.pledge = isObject(eng.pledge) ? eng.pledge : null;
    eng.pendingLoot = isObject(eng.pendingLoot) ? eng.pendingLoot : null;
    eng.unlockedLoot = Array.isArray(eng.unlockedLoot) ? eng.unlockedLoot : [];
    eng.feed = Array.isArray(eng.feed) ? eng.feed.slice(0, FEED_CAP).map(function (item) {
      if (isObject(item)) item.hypes = Math.max(0, Math.round(finiteNum(item.hypes, 0)));
      return item;
    }) : [];
    eng.shieldedDates = isObject(eng.shieldedDates) ? eng.shieldedDates : {};
    eng.rewardedWorkoutDates = isObject(eng.rewardedWorkoutDates) ? eng.rewardedWorkoutDates : {};
    eng.lifetimeSessions = Math.max(0, Math.round(finiteNum(eng.lifetimeSessions, 0)));
    eng.lifetimeVolumeKg = Math.max(0, Math.round(finiteNum(eng.lifetimeVolumeKg, 0)));
    eng.hypes = Math.max(0, Math.round(finiteNum(eng.hypes, 0)));
    eng.lastWorkoutDate = isValidDateId(eng.lastWorkoutDate) ? eng.lastWorkoutDate : null;

    if (eng.xp === 0 && eng.lifetimeSessions === 0 && isObject(state.days)) {
      seedFromHistory(state, skipDateId);
    }
    return eng;
  }

  function levelInfo(xp) {
    var safeXp = Math.max(0, Math.round(finiteNum(xp, 0)));
    var entry = RANKS[0];
    for (var i = 0; i < RANKS.length; i += 1) {
      if (safeXp >= RANKS[i].minXp) entry = RANKS[i];
    }
    var level = entry.level;
    var title = entry.title;
    var currentLevelXp = entry.minXp;
    var nextLevelXp = entry.nextXp;

    if (safeXp >= 6400) {
      var extra = Math.floor((safeXp - 6400) / 1800) + 1;
      level = 7 + extra;
      title = "Apex Legend";
      currentLevelXp = 6400 + (extra - 1) * 1800;
      nextLevelXp = currentLevelXp + 1800;
    }

    var span = Math.max(1, nextLevelXp - currentLevelXp);
    var pct = Math.max(0, Math.min(100, Math.round(((safeXp - currentLevelXp) / span) * 100)));
    var xpToNext = Math.max(0, nextLevelXp - safeXp);

    return {
      level: level,
      title: title,
      xp: safeXp,
      currentLevelXp: currentLevelXp,
      nextLevelXp: nextLevelXp,
      pct: pct,
      xpToNext: xpToNext
    };
  }

  function resolveDay(ctx, dateId) {
    if (!ctx) return null;
    if (typeof ctx.getDay === "function") {
      var found = ctx.getDay(dateId);
      if (found) return found;
    }
    if (typeof ctx.allDays === "function") {
      var list = ctx.allDays() || [];
      for (var i = 0; i < list.length; i += 1) {
        if (list[i] && list[i].day && list[i].day.id === dateId) return list[i].day;
      }
    }
    return null;
  }

  function countPlannedSets(day, ds) {
    if (!day || !Array.isArray(day.exercises) || !day.exercises.length) return 0;
    var adaptive = isObject(ds && ds.adaptiveTargets) ? ds.adaptiveTargets : {};
    var extra = isObject(ds && ds.extraSets) ? ds.extraSets : {};
    return day.exercises.reduce(function (sum, ex, exIndex) {
      var count = Array.isArray(ex && ex.sets) ? ex.sets.length : 0;
      var target = adaptive[String(exIndex)];
      if (target && Number(target.sets) > 0) count = Math.min(count, Number(target.sets));
      return sum + count + Math.max(0, Number(extra[String(exIndex)]) || 0);
    }, 0);
  }

  function hasEffortOrNoteCue(ds, questBucket) {
    if (questBucket && questBucket._cue) return true;
    if (ds && String(ds.notes || "").trim().length > 0) return true;
    var completed = isObject(ds && ds.completed) ? ds.completed : {};
    if (Object.keys(completed).some(function (k) {
      var entry = completed[k];
      return entry && entry.rir != null && entry.rir !== "";
    })) return true;
    var drafts = isObject(ds && ds.drafts) ? ds.drafts : {};
    return Object.keys(drafts).some(function (k) {
      var entry = drafts[k];
      return entry && entry.rir != null && entry.rir !== "";
    });
  }

  function dailyProteinTotal(state, dateId) {
    if (root.nutrition && typeof root.nutrition.totalProtein === "function") {
      return Number(root.nutrition.totalProtein(state, dateId)) || 0;
    }
    var bucket = state && state.nutrition && state.nutrition[dateId];
    var entries = bucket && Array.isArray(bucket.entries) ? bucket.entries : [];
    return entries.reduce(function (sum, item) { return sum + (Number(item && item.proteinG) || 0); }, 0);
  }

  function dailyQuests(ctx, dateId) {
    var state = (ctx && ctx.state) || {};
    var targetDate = isValidDateId(dateId) ? dateId : currentTodayId(ctx);
    var eng = isObject(state.engagement) ? state.engagement : defaultEngagement();
    var questBucket = (isObject(eng.quests) && isObject(eng.quests[targetDate])) ? eng.quests[targetDate] : {};
    var ds = (isObject(state.days) && isObject(state.days[targetDate])) ? state.days[targetDate] : {};
    var day = resolveDay(ctx, targetDate);
    var plannedSets = countPlannedSets(day, ds);
    var completedKeys = validCompletedKeys(ds);
    var liveSets = Math.max(completedKeys.length, Number(questBucket._sets || 0));

    // Explicit rest / off-day micro-quests keep the trigger loop positive without forcing gym work.
    if (day && plannedSets === 0) {
      var proteinNow = Math.round(dailyProteinTotal(state, targetDate));
      var proteinGoal = Math.max(60, Number((state.profile && state.profile.proteinRangeMinG) || (state.profile && state.profile.proteinTargetG) || 120));
      var hasActivePledge = !!(eng.pledge && eng.pledge.status === "active");
      var checkedIn = !!(String(ds.notes || "").trim() || ds.readiness != null || hasActivePledge || proteinNow > 0);
      return [
        {
          id: "rest-checkin",
          title: "Recovery Check-In",
          progress: checkedIn ? 1 : 0,
          target: 1,
          done: checkedIn || !!(questBucket["rest-checkin"] && questBucket["rest-checkin"].done),
          xpReward: 25
        },
        {
          id: "rest-protein",
          title: "Hit Protein Floor",
          progress: Math.min(proteinGoal, proteinNow),
          target: proteinGoal,
          done: proteinNow >= proteinGoal || !!(questBucket["rest-protein"] && questBucket["rest-protein"].done),
          xpReward: 40
        },
        {
          id: "rest-pledge",
          title: "Lock Next Session Pledge",
          progress: hasActivePledge ? 1 : 0,
          target: 1,
          done: hasActivePledge || !!(questBucket["rest-pledge"] && questBucket["rest-pledge"].done),
          xpReward: 35
        }
      ];
    }

    var readinessLogged = ds.readiness != null ? 1 : 0;
    var cueLogged = hasEffortOrNoteCue(ds, questBucket) ? 1 : 0;
    var cueProgress = readinessLogged + cueLogged;
    var comboTarget = plannedSets > 0 ? Math.min(3, plannedSets) : 3;

    var q1Done = liveSets >= 1 || !!(questBucket["first-set"] && questBucket["first-set"].done);
    var q2Done = cueProgress >= 2 || !!(questBucket["readiness-cue"] && questBucket["readiness-cue"].done);
    var q3Done = liveSets >= comboTarget || !!(questBucket["session-combo"] && questBucket["session-combo"].done);

    return [
      {
        id: "first-set",
        title: "First Working Set",
        progress: q1Done ? 1 : Math.min(1, liveSets),
        target: 1,
        done: q1Done,
        xpReward: 30
      },
      {
        id: "readiness-cue",
        title: "Log Readiness & Cue",
        progress: q2Done ? 2 : Math.min(2, cueProgress),
        target: 2,
        done: q2Done,
        xpReward: 40
      },
      {
        id: "session-combo",
        title: comboTarget + "-Set Momentum",
        progress: q3Done ? comboTarget : Math.min(comboTarget, liveSets),
        target: comboTarget,
        done: q3Done,
        xpReward: 50
      }
    ];
  }

  function pushFeed(eng, item) {
    if (!Array.isArray(eng.feed)) eng.feed = [];
    eng.feed.unshift(item);
    if (eng.feed.length > FEED_CAP) eng.feed = eng.feed.slice(0, FEED_CAP);
  }

  function comboMultiplier(combo) {
    if (combo >= 6) return 3;
    if (combo >= 4) return 2;
    if (combo >= 2) return 1.5;
    return 1;
  }

  function formatLoad(ctx, kg) {
    var n = Number(kg || 0);
    if (ctx && typeof ctx.formatWeight === "function" && typeof ctx.unitLabel === "function") {
      return ctx.formatWeight(n) + " " + ctx.unitLabel();
    }
    return Number(n.toFixed(1)) + " kg";
  }

  function onSetCompleted(ctx, info) {
    info = isObject(info) ? info : {};
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    var dateId = isValidDateId(info.dayId) ? info.dayId : (isValidDateId(state.activeDayId) ? state.activeDayId : currentTodayId(ctx));

    var invalidReps = info.reps != null && (!Number.isFinite(Number(info.reps)) || Number(info.reps) <= 0);
    var invalidWeight = info.weight != null && (!Number.isFinite(Number(info.weight)) || Number(info.weight) < 0);
    if (invalidReps || invalidWeight) {
      return {
        xpGained: 0,
        combo: eng.combo,
        multiplier: comboMultiplier(eng.combo),
        leveledUp: false,
        levelInfo: levelInfo(eng.xp),
        questsDone: [],
        celebrationText: ""
      };
    }

    if (!isObject(eng.quests[dateId])) eng.quests[dateId] = {};
    var bucket = eng.quests[dateId];
    var setKey = info.setKey != null && String(info.setKey).trim() ? String(info.setKey).trim() : "";
    if (setKey) {
      if (!isObject(bucket._rewardedSetKeys)) bucket._rewardedSetKeys = {};
      if (bucket._rewardedSetKeys[setKey]) {
        return {
          xpGained: 0,
          combo: eng.combo,
          multiplier: comboMultiplier(eng.combo),
          leveledUp: false,
          levelInfo: levelInfo(eng.xp),
          questsDone: [],
          celebrationText: "",
          alreadyRewarded: true
        };
      }
      bucket._rewardedSetKeys[setKey] = true;
    }

    var prevLevel = levelInfo(eng.xp);
    eng.combo += 1;
    if (eng.combo > eng.bestCombo) eng.bestCombo = eng.combo;
    var multiplier = comboMultiplier(eng.combo);

    var isPr = !!(info.pr || info.isPr);
    var hasRir = info.rir != null && info.rir !== "";

    bucket._sets = Math.max(0, Math.round(finiteNum(bucket._sets, 0))) + 1;
    if (hasRir) bucket._cue = true;

    var baseSetXp = Math.round(10 * multiplier);
    var prBonus = isPr ? 35 : 0;
    var rirBonus = hasRir ? 5 : 0;

    var quests = dailyQuests(ctx, dateId);
    var questsDone = [];
    var questXp = 0;
    quests.forEach(function (q) {
      if (q.done && !(bucket[q.id] && bucket[q.id].rewarded)) {
        bucket[q.id] = { done: true, rewarded: true, completedAt: Date.now(), xpReward: q.xpReward };
        questXp += Math.max(0, Math.round(finiteNum(q.xpReward, 0)));
        questsDone.push(Object.assign({}, q));
      }
    });

    var xpGained = baseSetXp + prBonus + rirBonus + questXp;
    eng.xp += xpGained;
    if (!eng.lastWorkoutDate || dateId > eng.lastWorkoutDate) eng.lastWorkoutDate = dateId;

    var nextLevel = levelInfo(eng.xp);
    var leveledUp = nextLevel.level > prevLevel.level;

    if (isPr) {
      var detailParts = [];
      if (info.weight != null && info.reps != null) {
        var safeWeight = Math.max(0, finiteNum(info.weight, 0));
        var safeReps = Math.max(0, Math.round(finiteNum(info.reps, 0)));
        detailParts.push(formatLoad(ctx, safeWeight) + " x " + safeReps);
      }
      detailParts.push("+" + xpGained + " XP");
      pushFeed(eng, {
        id: makeId("pr"),
        kind: "pr",
        title: "New PR" + (info.exerciseName ? ": " + String(info.exerciseName) : ""),
        detail: detailParts.join(" · "),
        date: dateId,
        ts: Date.now(),
        hypes: 0
      });
    }

    if (leveledUp) {
      pushFeed(eng, {
        id: makeId("level"),
        kind: "level",
        title: "Level " + nextLevel.level + ": " + nextLevel.title,
        detail: "Reached " + eng.xp + " total XP",
        date: dateId,
        ts: Date.now(),
        hypes: 0
      });
    }

    var celebrationText;
    if (leveledUp) {
      celebrationText = "Level " + nextLevel.level + " " + nextLevel.title + " unlocked! +" + xpGained + " XP";
    } else if (isPr) {
      celebrationText = "PR logged! " + multiplier + "x combo · +" + xpGained + " XP";
    } else if (questsDone.length) {
      celebrationText = "Quest complete: " + questsDone[0].title + " · +" + xpGained + " XP";
    } else if (multiplier > 1) {
      celebrationText = eng.combo + "-set combo (" + multiplier + "x) · +" + xpGained + " XP";
    } else {
      celebrationText = "+" + xpGained + " XP";
    }

    if (ctx && typeof ctx.saveState === "function") ctx.saveState("engagement-set");

    return {
      xpGained: xpGained,
      combo: eng.combo,
      multiplier: multiplier,
      leveledUp: leveledUp,
      levelInfo: nextLevel,
      questsDone: questsDone,
      celebrationText: celebrationText
    };
  }

  function tonnageEquivalent(kg) {
    var safeKg = Math.max(0, Number(kg) || 0);
    if (safeKg <= 0) return "0 kg";
    if (safeKg < 350) {
      var bars = Math.max(1, Math.round(safeKg / 20));
      return bars + " Olympic barbell" + (bars === 1 ? "" : "s");
    }
    if (safeKg < 1500) {
      var pianos = (safeKg / 350).toFixed(1).replace(/\.0$/, "");
      return pianos + " grand piano" + (pianos === "1" ? "" : "s");
    }
    if (safeKg < 50000) {
      var cars = (safeKg / 1350).toFixed(1).replace(/\.0$/, "");
      return cars + " compact car" + (cars === "1" ? "" : "s");
    }
    var buses = (safeKg / 12000).toFixed(1).replace(/\.0$/, "");
    return buses + " city bus" + (buses === "1" ? "" : "es");
  }

  function rollLootCrate(dayId, eng, rollFn) {
    var r = typeof rollFn === "function" ? Number(rollFn()) : Math.random();
    if (!Number.isFinite(r) || r < 0 || r >= 1) r = Math.random();

    var rarity = "Common";
    var acc = 0;
    for (var i = 0; i < RARITY_WEIGHTS.length; i += 1) {
      acc += RARITY_WEIGHTS[i].weight;
      if (r < acc) {
        rarity = RARITY_WEIGHTS[i].rarity;
        break;
      }
    }

    var subRoll = typeof rollFn === "function" ? Number(rollFn()) : Math.random();
    if (!Number.isFinite(subRoll) || subRoll < 0 || subRoll >= 1) subRoll = Math.random();

    var xpByRarity = { Common: 35, Rare: 75, Epic: 140, Mythic: 250 };
    var crownXpByRarity = { Common: 55, Rare: 100, Epic: 175, Mythic: 300 };

    var kind = "XP Surge";
    if (rarity === "Mythic") {
      kind = subRoll < 0.45 ? "PR Crown" : subRoll < 0.75 ? "Title Unlock" : "XP Surge";
    } else if (rarity === "Epic") {
      kind = subRoll < 0.30 ? "PR Crown" : subRoll < 0.55 ? "Bonus Shield" : subRoll < 0.80 ? "Title Unlock" : "XP Surge";
    } else if (rarity === "Rare") {
      kind = subRoll < 0.30 ? "Bonus Shield" : subRoll < 0.55 ? "Title Unlock" : subRoll < 0.80 ? "Coach Secret" : "XP Surge";
    } else {
      kind = subRoll < 0.45 ? "XP Surge" : subRoll < 0.75 ? "Coach Secret" : subRoll < 0.90 ? "Bonus Shield" : "Title Unlock";
    }

    var idx = Math.floor(subRoll * 1000);
    var title = "";
    var detail = "";
    var xpBonus = 0;
    var shieldBonus = 0;
    var unlockTitle = null;

    if (kind === "XP Surge") {
      xpBonus = xpByRarity[rarity];
      title = rarity + " XP Surge (+" + xpBonus + " XP)";
      detail = "Variable-ratio momentum boost banked directly into your rank ladder.";
    } else if (kind === "Bonus Shield") {
      shieldBonus = 1;
      xpBonus = 20;
      title = "Streak Freeze Shield (+1 Shield)";
      detail = "Extra protection against a busy life day — keeps the chain intact.";
    } else if (kind === "Title Unlock") {
      unlockTitle = TITLES[idx % TITLES.length];
      xpBonus = 40;
      title = 'Title Unlocked: "' + unlockTitle + '"';
      detail = "Wear this identity badge on your Momentum Story Card (+40 XP).";
    } else if (kind === "Coach Secret") {
      xpBonus = 30;
      title = "Coach Secret Unlocked";
      detail = COACH_SECRETS[idx % COACH_SECRETS.length];
    } else {
      xpBonus = crownXpByRarity[rarity];
      title = "PR Crown (" + rarity + ")";
      detail = "Championship effort bonus — +" + xpBonus + " XP surge.";
    }

    return {
      id: makeId("loot"),
      rarity: rarity,
      kind: kind,
      title: title,
      detail: detail,
      xpBonus: xpBonus,
      shieldBonus: shieldBonus,
      unlockTitle: unlockTitle,
      dayId: dayId,
      createdAt: Date.now()
    };
  }

  function applyCrateReward(eng, item) {
    if (!item) return item;
    var prevLevel = levelInfo(eng.xp);
    var xpDelta = Math.max(0, Number(item.xpBonus) || 0);
    if (Number(item.shieldBonus) > 0) {
      if (eng.shields < eng.maxShields) {
        eng.shields = Math.min(eng.maxShields, eng.shields + Number(item.shieldBonus));
      } else {
        item.overflowXp = 60;
        xpDelta += 60;
      }
    }
    eng.xp += xpDelta;
    var nextLevel = levelInfo(eng.xp);
    item.leveledUp = nextLevel.level > prevLevel.level;
    item.levelInfo = nextLevel;
    item.claimedAt = Date.now();
    return item;
  }

  function onWorkoutFinished(ctx, dayId, options) {
    var state = (ctx && ctx.state) || {};
    var rawDateId = isValidDateId(dayId) ? dayId : (isValidDateId(state.activeDayId) ? state.activeDayId : currentTodayId(ctx));
    var eng = ensureEngagement(state, rawDateId);
    var dateId = rawDateId;
    if (isObject(eng.rewardedWorkoutDates) && eng.rewardedWorkoutDates[dateId]) {
      return {
        alreadyRewarded: true,
        xpGained: 0,
        adherenceBonus: 0,
        pledgeFulfilled: false,
        pledgeBonus: 0,
        sessionVolume: 0,
        lifetimeSessions: eng.lifetimeSessions,
        lifetimeVolumeKg: eng.lifetimeVolumeKg,
        tonnageLabel: tonnageEquivalent(eng.lifetimeVolumeKg),
        shieldEarned: false,
        shields: eng.shields,
        pendingLoot: eng.pendingLoot,
        leveledUp: false,
        levelInfo: levelInfo(eng.xp),
        feedItem: null
      };
    }

    var ds = (isObject(state.days) && isObject(state.days[dateId])) ? state.days[dateId] : {};
    var day = resolveDay(ctx, dateId);
    var keys = validCompletedKeys(ds);

    var sessionVolume = 0;
    if (keys.length > 0) {
      keys.forEach(function (k) {
        var set = ds.completed[k] || {};
        sessionVolume += Math.max(0, finiteNum(set.weight, 0)) * Math.max(0, finiteNum(set.reps, 0));
      });
    } else if (day && ctx && typeof ctx.completedVolume === "function") {
      sessionVolume = Math.max(0, finiteNum(ctx.completedVolume(day), 0));
    }

    var plannedSets = countPlannedSets(day, ds);
    var completedSets = keys.length;
    var adherenceBonus = 0;
    if (plannedSets > 0) {
      adherenceBonus = Math.round(Math.min(1, completedSets / plannedSets) * 40);
    } else if (completedSets > 0) {
      adherenceBonus = 25;
    }

    var pledgeFulfilled = false;
    var pledgeBonus = 0;
    if (eng.pledge && eng.pledge.status === "active") {
      var matchesTarget = eng.pledge.targetDate === dateId;
      var matchesToday = eng.pledge.when === "Today" && eng.pledge.createdDate === dateId;
      if (matchesTarget || matchesToday) {
        eng.pledge.status = "fulfilled";
        eng.pledge.fulfilledDate = dateId;
        pledgeBonus = Math.max(0, Math.round(finiteNum(eng.pledge.bonusXp, 150)));
        pledgeFulfilled = true;
      }
    }

    var prevLevel = levelInfo(eng.xp);
    var baseXp = 50;
    var xpGained = baseXp + adherenceBonus + pledgeBonus;
    eng.xp += xpGained;

    if (!isObject(eng.rewardedWorkoutDates)) eng.rewardedWorkoutDates = {};
    eng.rewardedWorkoutDates[dateId] = true;
    eng.lifetimeSessions += 1;
    eng.lifetimeVolumeKg = Math.round(eng.lifetimeVolumeKg + sessionVolume);
    if (!eng.lastWorkoutDate || dateId > eng.lastWorkoutDate) eng.lastWorkoutDate = dateId;
    eng.combo = 0;

    eng.shieldEarnedSessions += 1;
    var shieldEarned = false;
    while (eng.shieldEarnedSessions >= 4) {
      eng.shieldEarnedSessions -= 4;
      if (eng.shields < eng.maxShields) {
        eng.shields += 1;
        shieldEarned = true;
      }
    }

    // Preserve any unclaimed crate value before generating the new crate.
    if (eng.pendingLoot) {
      var priorClaim = applyCrateReward(eng, Object.assign({}, eng.pendingLoot, { autoClaimed: true }));
      eng.unlockedLoot.unshift(priorClaim);
      eng.pendingLoot = null;
    }

    var rollFn = options && typeof options.roll === "function" ? options.roll : (ctx && typeof ctx.random === "function" ? ctx.random : null);
    eng.pendingLoot = rollLootCrate(dateId, eng, rollFn);

    var nextLevel = levelInfo(eng.xp);
    var leveledUp = nextLevel.level > prevLevel.level;

    var summaryParts = [];
    if (completedSets > 0) summaryParts.push(completedSets + " sets");
    if (sessionVolume > 0) summaryParts.push(Math.round(sessionVolume) + " kg (" + tonnageEquivalent(sessionVolume) + ")");
    summaryParts.push("+" + xpGained + " XP");
    if (pledgeFulfilled) summaryParts.push("Pledge fulfilled");
    if (shieldEarned) summaryParts.push("+1 Streak Shield");

    var feedItem = {
      id: makeId("workout"),
      kind: "workout",
      title: (day && day.title ? day.title : "Workout") + " complete",
      detail: summaryParts.join(" · "),
      date: dateId,
      volumeKg: Math.round(sessionVolume),
      sets: completedSets,
      xpGained: xpGained,
      ts: Date.now(),
      hypes: 0
    };
    pushFeed(eng, feedItem);

    if (leveledUp) {
      pushFeed(eng, {
        id: makeId("level"),
        kind: "level",
        title: "Level " + nextLevel.level + ": " + nextLevel.title,
        detail: "Reached " + eng.xp + " total XP",
        date: dateId,
        ts: Date.now(),
        hypes: 0
      });
    }

    if (ctx && typeof ctx.saveState === "function") ctx.saveState("engagement-finish");

    return {
      xpGained: xpGained,
      adherenceBonus: adherenceBonus,
      pledgeFulfilled: pledgeFulfilled,
      pledgeBonus: pledgeBonus,
      sessionVolume: Math.round(sessionVolume),
      lifetimeSessions: eng.lifetimeSessions,
      lifetimeVolumeKg: eng.lifetimeVolumeKg,
      tonnageLabel: tonnageEquivalent(eng.lifetimeVolumeKg),
      shieldEarned: shieldEarned,
      shields: eng.shields,
      pendingLoot: eng.pendingLoot,
      leveledUp: leveledUp,
      levelInfo: nextLevel,
      feedItem: feedItem
    };
  }

  function claimLoot(ctx) {
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    if (!eng.pendingLoot) return null;

    var item = applyCrateReward(eng, Object.assign({}, eng.pendingLoot));
    eng.unlockedLoot.unshift(item);
    eng.pendingLoot = null;

    var totalBonus = Number(item.xpBonus || 0) + Number(item.overflowXp || 0);
    pushFeed(eng, {
      id: makeId("loot"),
      kind: "loot",
      title: item.rarity + " Crate: " + item.kind,
      detail: item.title + (totalBonus > 0 ? " · +" + totalBonus + " XP" : ""),
      date: item.dayId || currentTodayId(ctx),
      ts: Date.now(),
      hypes: 0
    });

    if (ctx && typeof ctx.saveState === "function") ctx.saveState("claim-loot");
    return item;
  }

  function activateShield(ctx, dateId) {
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    var targetDate = isValidDateId(dateId) ? dateId : currentTodayId(ctx);

    if (eng.shieldedDates[targetDate]) {
      return { ok: true, alreadyShielded: true, dateId: targetDate, shields: eng.shields };
    }
    if (eng.shields <= 0) {
      return { ok: false, reason: "no-shields", dateId: targetDate, shields: 0 };
    }

    eng.shields -= 1;
    eng.shieldedDates[targetDate] = true;
    pushFeed(eng, {
      id: makeId("shield"),
      kind: "shield",
      title: "Streak Shield activated",
      detail: "Momentum protected for " + targetDate + " — zero penalty for a busy day.",
      date: targetDate,
      ts: Date.now(),
      hypes: 0
    });

    if (ctx && typeof ctx.saveState === "function") ctx.saveState("activate-shield");
    return { ok: true, alreadyShielded: false, dateId: targetDate, shields: eng.shields };
  }

  function normalizeSlot(slotLabel) {
    var raw = String(slotLabel || "").toLowerCase();
    if (/morning|\bam\b/.test(raw)) return "Morning";
    if (/afternoon|midday|noon/.test(raw)) return "Afternoon";
    if (/evening|night|\bpm\b/.test(raw)) return "Evening";
    return "Morning";
  }

  function setPledge(ctx, whenLabel, slotLabel) {
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    var when = /^tomorrow$/i.test(String(whenLabel || "").trim()) ? "Tomorrow" : "Today";
    var slot = normalizeSlot(slotLabel);
    var createdDate = currentTodayId(ctx);
    var targetDate = when === "Tomorrow" ? isoDateAddDays(createdDate, 1) : createdDate;

    eng.pledge = {
      when: when,
      slot: slot,
      createdDate: createdDate,
      targetDate: targetDate,
      bonusXp: 150,
      status: "active"
    };

    pushFeed(eng, {
      id: makeId("pledge"),
      kind: "pledge",
      title: "Comeback Pledge locked",
      detail: when + " · " + slot + " (" + targetDate + ") · +150 XP on completion",
      date: createdDate,
      ts: Date.now(),
      hypes: 0
    });

    if (ctx && typeof ctx.saveState === "function") ctx.saveState("set-pledge");
    return eng.pledge;
  }

  function latestTrainedDateUpTo(ctx, ref) {
    var state = (ctx && ctx.state) || {};
    var stateDays = isObject(state.days) ? state.days : {};
    var eng = isObject(state.engagement) ? state.engagement : null;
    var lastDate = null;

    Object.keys(stateDays).forEach(function (id) {
      if (!isValidDateId(id) || id > ref) return;
      if (isTrainedDayState(stateDays[id]) && (!lastDate || id > lastDate)) {
        lastDate = id;
      }
    });

    if (!lastDate && eng && isValidDateId(eng.lastWorkoutDate) && eng.lastWorkoutDate <= ref) {
      lastDate = eng.lastWorkoutDate;
    }

    return lastDate;
  }

  function hiatusDefense(ctx, refDate) {
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    var ref = isValidDateId(refDate) ? refDate : currentTodayId(ctx);
    var lastDate = latestTrainedDateUpTo(ctx, ref);
    var gapDays = lastDate ? Math.max(0, dateDiffDays(lastDate, ref)) : 0;
    var shielded = !!eng.shieldedDates[ref];

    if (!lastDate || gapDays <= 1) {
      return {
        tier: "active",
        gapDays: gapDays,
        lastDate: lastDate,
        hasHistory: !!lastDate,
        shielded: shielded,
        shieldsAvailable: eng.shields,
        title: "Momentum locked",
        message: lastDate
          ? "Habit loop warm. Show up for your next planned set — consistency beats intensity."
          : "Day 1 ready. Complete your first set to ignite your combo and unlock your starter quest.",
        actionLabel: "Log First Set",
        action: "start-workout"
      };
    }

    if (gapDays <= 3) {
      return {
        tier: "watch",
        gapDays: gapDays,
        lastDate: lastDate,
        hasHistory: true,
        shielded: shielded,
        shieldsAvailable: eng.shields,
        title: "Protect the groove",
        message: gapDays + " days since " + lastDate + ". Normal recovery — lock a time slot now so two days never stretch into two weeks.",
        actionLabel: "Lock Tomorrow Pledge",
        action: "set-pledge"
      };
    }

    if (gapDays <= 6) {
      return {
        tier: "warning",
        gapDays: gapDays,
        lastDate: lastDate,
        hasHistory: true,
        shielded: shielded,
        shieldsAvailable: eng.shields,
        title: "Break the friction barrier",
        message: gapDays + " days off. Skip the all-or-nothing trap — a 10-minute express session preserves strength and resets rhythm.",
        actionLabel: "Launch 10-Min Express",
        action: "coach-action"
      };
    }

    if (gapDays <= 13) {
      return {
        tier: "rescue",
        gapDays: gapDays,
        lastDate: lastDate,
        hasHistory: true,
        shielded: shielded,
        shieldsAvailable: eng.shields,
        title: "One light session resets the chain",
        message: gapDays + " days off. Zero guilt — activate a Streak Shield and log one easy groove set to keep your identity unbroken.",
        actionLabel: "Activate Shield + Return",
        action: "activate-shield"
      };
    }

    return {
      tier: "reentry",
      gapDays: gapDays,
      lastDate: lastDate,
      hasHistory: true,
      shielded: shielded,
      shieldsAvailable: eng.shields,
      title: "Fresh Reentry Ramp Ready",
      message: gapDays + " days away (" + lastDate + "). Muscle memory rebounds fast — start with 2 smooth sets at ~70-75% and 3+ RIR.",
      actionLabel: "Start Minimum Dose",
      action: "reentry-start"
    };
  }

  function hypeFeedItem(ctx, itemId) {
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    var target = null;
    for (var i = 0; i < eng.feed.length; i += 1) {
      if (String(eng.feed[i].id) === String(itemId)) {
        target = eng.feed[i];
        break;
      }
    }
    if (!target) return null;
    target.hypes = (Number(target.hypes) || 0) + 1;
    eng.hypes = (Number(eng.hypes) || 0) + 1;
    if (ctx && typeof ctx.saveState === "function") ctx.saveState("hype-feed");
    return {
      itemId: target.id,
      itemHypes: target.hypes,
      totalHypes: eng.hypes
    };
  }

  function computeStreak(ctx) {
    if (ctx && typeof ctx.trainingStreak === "function") {
      try { return Number(ctx.trainingStreak()) || 0; } catch (err) {}
    }
    if (root.streaks && typeof root.streaks.streakCount === "function") {
      try { return Number(root.streaks.streakCount(ctx)) || 0; } catch (err2) {}
    }
    return 0;
  }

  function formatPledgeText(pledge) {
    if (!pledge || pledge.status !== "active") return "";
    return pledge.when + " · " + pledge.slot + " (+" + (pledge.bonusXp || 150) + " XP)";
  }

  function widgetPayload(ctx) {
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    var lvl = levelInfo(eng.xp);
    var today = currentTodayId(ctx);
    var hiatus = hiatusDefense(ctx, today);
    var quests = dailyQuests(ctx, today);
    var openQuest = quests.find(function (q) { return !q.done; }) || null;
    var nextQuest = openQuest
      ? openQuest.title + " (" + openQuest.progress + "/" + openQuest.target + ")"
      : (quests.length ? "All daily quests complete" : "Start a workout");

    return {
      level: lvl.level,
      title: lvl.title,
      xp: lvl.xp,
      xpPct: lvl.pct,
      shields: eng.shields,
      hiatusTier: hiatus.tier,
      gapDays: hiatus.gapDays,
      pledgeText: formatPledgeText(eng.pledge),
      nextQuest: nextQuest,
      streak: computeStreak(ctx)
    };
  }

  function svgBolt() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7Z"/></svg>';
  }

  function svgShield() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6Z"/></svg>';
  }

  function svgCrate() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>';
  }

  function svgCheck(done) {
    if (done) {
      return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>';
    }
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>';
  }

  function svgPulse() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>';
  }

  function svgTrophy() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v5a6 6 0 0 1-12 0Z"/><path d="M6 6H3v2a3 3 0 0 0 3 3M18 6h3v2a3 3 0 0 1-3 3M12 15v5M8 20h8"/></svg>';
  }

  function svgShare() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 16V3M7 8l5-5 5 5"/></svg>';
  }

  function feedIcon(kind) {
    if (kind === "pr") return svgTrophy();
    if (kind === "shield") return svgShield();
    if (kind === "loot") return svgCrate();
    if (kind === "level" || kind === "pledge") return svgBolt();
    return svgPulse();
  }

  function renderHiatusCtaButton(ctx, hiatus, today) {
    if (hiatus.tier === "watch") {
      return '<button type="button" class="action-btn compact" data-action="set-pledge" data-when="Tomorrow" data-slot="Morning">' + esc(ctx, hiatus.actionLabel) + '</button>';
    }
    if (hiatus.tier === "warning") {
      return '<button type="button" class="action-btn compact" data-action="coach-action" data-coach-action="express-mode">' + esc(ctx, hiatus.actionLabel) + '</button>';
    }
    if (hiatus.tier === "rescue") {
      return '<button type="button" class="action-btn compact" data-action="activate-shield" data-date="' + esc(ctx, today) + '">' + esc(ctx, hiatus.actionLabel) + '</button>';
    }
    if (hiatus.tier === "reentry") {
      return '<button type="button" class="action-btn compact" data-action="reentry-start">' + esc(ctx, hiatus.actionLabel) + '</button>';
    }
    return '';
  }

  function renderMomentumGadget(ctx, day) {
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    var lvl = levelInfo(eng.xp);
    var today = (day && isValidDateId(day.id)) ? day.id : (isValidDateId(state.activeDayId) ? state.activeDayId : currentTodayId(ctx));
    var quests = dailyQuests(ctx, today);
    var hiatus = hiatusDefense(ctx, currentTodayId(ctx));
    var mult = comboMultiplier(eng.combo);
    var comboLabel = eng.combo > 0
      ? eng.combo + " set" + (eng.combo === 1 ? "" : "s") + (mult > 1 ? " · " + mult + "x" : "")
      : "Best " + eng.bestCombo;

    var html = '<section class="momentum-gadget" aria-label="Momentum and quests">';
    html += '<div class="momentum-head">';
    html += '<div class="momentum-rank">';
    html += '<div class="momentum-eyebrow">LV ' + lvl.level + ' · ' + esc(ctx, lvl.title) + '</div>';
    html += '<div class="momentum-xp-meta"><strong>' + lvl.xp + ' XP</strong><span>' + lvl.xpToNext + ' XP to Lv ' + (lvl.level + 1) + '</span></div>';
    html += '</div>';
    html += '<div class="momentum-pills">';
    html += '<span class="combo-badge" data-active="' + String(eng.combo >= 2) + '">' + svgBolt() + '<span>' + esc(ctx, comboLabel) + '</span></span>';
    html += '<span class="shield-pill" data-shields="' + eng.shields + '" title="Streak Freeze Shields">' + svgShield() + '<span>' + eng.shields + '/' + eng.maxShields + '</span></span>';
    html += '<button type="button" class="tool-btn" data-action="open-sheet" data-sheet="feed">Quests</button>';
    html += '</div></div>';

    html += '<div class="xp-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + lvl.pct + '" aria-label="Level XP progress">';
    html += '<div class="xp-bar-fill" style="width:' + lvl.pct + '%"></div>';
    html += '</div>';

    html += '<div class="quest-list" aria-label="Daily micro-quests">';
    quests.forEach(function (q) {
      html += '<div class="quest-item" data-done="' + String(!!q.done) + '" data-quest-id="' + esc(ctx, q.id) + '">';
      html += '<span class="quest-check">' + svgCheck(q.done) + '</span>';
      html += '<span class="quest-title">' + esc(ctx, q.title) + '</span>';
      html += '<span class="quest-progress">' + q.progress + '/' + q.target + '</span>';
      html += '<span class="quest-xp">+' + q.xpReward + ' XP</span>';
      html += '</div>';
    });
    html += '</div>';

    if (eng.pendingLoot) {
      html += '<button type="button" class="loot-crate" data-action="claim-loot" data-rarity="' + esc(ctx, String(eng.pendingLoot.rarity || "Common").toLowerCase()) + '">';
      html += '<span class="loot-crate-icon">' + svgCrate() + '</span>';
      html += '<span class="loot-crate-copy"><span class="loot-crate-kicker">MYSTERY CRATE · ' + esc(ctx, eng.pendingLoot.rarity) + '</span><strong>Tap to unbox ' + esc(ctx, eng.pendingLoot.kind) + '</strong></span>';
      html += '<span class="loot-crate-cta">Unbox</span>';
      html += '</button>';
    }

    if (hiatus.gapDays >= 2) {
      html += '<div class="hiatus-card" data-tier="' + esc(ctx, hiatus.tier) + '">';
      html += '<div class="hiatus-copy"><strong>' + esc(ctx, hiatus.title) + '</strong><p>' + esc(ctx, hiatus.message) + '</p>';
      if (eng.pledge && eng.pledge.status === "active") {
        html += '<div class="hiatus-pledge">Active pledge: ' + esc(ctx, formatPledgeText(eng.pledge)) + '</div>';
      }
      html += '</div>';
      html += '<div class="hiatus-actions">' + renderHiatusCtaButton(ctx, hiatus, currentTodayId(ctx)) + '</div>';
      html += '</div>';
    } else if (eng.pledge && eng.pledge.status === "active") {
      html += '<div class="momentum-pledge-bar">' + svgBolt() + '<span>Pledge locked: ' + esc(ctx, formatPledgeText(eng.pledge)) + '</span></div>';
    }

    html += '</section>';
    return html;
  }

  function latestUnlockedTitle(eng) {
    for (var i = 0; i < (eng.unlockedLoot || []).length; i += 1) {
      if (eng.unlockedLoot[i] && eng.unlockedLoot[i].unlockTitle) return eng.unlockedLoot[i].unlockTitle;
    }
    return null;
  }

  function formatDisplayVolume(ctx, kg) {
    var safeKg = Math.max(0, Number(kg) || 0);
    if (ctx && typeof ctx.cleanNumber === "function" && typeof ctx.kgToDisplay === "function" && typeof ctx.unitLabel === "function") {
      return ctx.cleanNumber(ctx.kgToDisplay(safeKg), 0) + " " + ctx.unitLabel();
    }
    return Math.round(safeKg) + " kg";
  }

  function shareStoryText(ctx) {
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    var lvl = levelInfo(eng.xp);
    var athlete = (state.profile && state.profile.athlete) || "Athlete";
    var streak = computeStreak(ctx);
    var titleBadge = latestUnlockedTitle(eng) || lvl.title;
    return athlete + " · Lift Lv " + lvl.level + " (" + titleBadge + ") · " + streak + "d streak · " +
      eng.lifetimeSessions + " sessions · " + formatDisplayVolume(ctx, eng.lifetimeVolumeKg) +
      " (" + tonnageEquivalent(eng.lifetimeVolumeKg) + ") · " + eng.xp + " XP";
  }

  function renderFeedSheet(ctx) {
    var state = (ctx && ctx.state) || {};
    var eng = ensureEngagement(state);
    var lvl = levelInfo(eng.xp);
    var today = isValidDateId(state.activeDayId) ? state.activeDayId : currentTodayId(ctx);
    var refToday = currentTodayId(ctx);
    var quests = dailyQuests(ctx, today);
    var hiatus = hiatusDefense(ctx, refToday);
    var streak = computeStreak(ctx);
    var athlete = (state.profile && state.profile.athlete) || "Lem";
    var activeTitle = latestUnlockedTitle(eng);
    var shieldedToday = !!eng.shieldedDates[refToday];
    var sessionsUntilShield = 4 - (eng.shieldEarnedSessions % 4);

    var html = '<div class="sheet-grid">';

    // 1. Identity & Level Progression
    html += '<section class="momentum-gadget">';
    html += '<div class="momentum-head"><div class="momentum-rank">';
    html += '<div class="momentum-eyebrow">LEVEL ' + lvl.level + ' · ' + esc(ctx, lvl.title) + (activeTitle ? ' · ' + esc(ctx, activeTitle) : '') + '</div>';
    html += '<div class="momentum-xp-meta"><strong>' + lvl.xp + ' XP</strong><span>' + lvl.xpToNext + ' XP to Level ' + (lvl.level + 1) + '</span></div>';
    html += '</div><div class="momentum-pills">';
    html += '<span class="combo-badge" data-active="' + String(eng.bestCombo >= 2) + '">' + svgBolt() + '<span>Best ' + eng.bestCombo + 'x</span></span>';
    html += '<span class="shield-pill" data-shields="' + eng.shields + '">' + svgShield() + '<span>' + eng.shields + '/' + eng.maxShields + '</span></span>';
    html += '</div></div>';
    html += '<div class="xp-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + lvl.pct + '"><div class="xp-bar-fill" style="width:' + lvl.pct + '%"></div></div>';
    html += '</section>';

    // 2. Lifetime Identity & Tonnage Stats
    html += '<div class="metric-grid">';
    html += '<div class="metric-card"><div class="label">Sessions</div><div class="value">' + eng.lifetimeSessions + '</div></div>';
    html += '<div class="metric-card"><div class="label">Lifetime Tonnage</div><div class="value">' + esc(ctx, formatDisplayVolume(ctx, eng.lifetimeVolumeKg)) + '</div><div class="ring-sub">' + esc(ctx, tonnageEquivalent(eng.lifetimeVolumeKg)) + '</div></div>';
    html += '<div class="metric-card"><div class="label">Best Combo</div><div class="value">' + eng.bestCombo + '</div></div>';
    html += '<div class="metric-card"><div class="label">Hypes</div><div class="value">' + eng.hypes + '</div></div>';
    html += '</div>';

    // 3. Mystery Crate Unboxer
    if (eng.pendingLoot) {
      html += '<section class="loot-crate" data-rarity="' + esc(ctx, String(eng.pendingLoot.rarity || "Common").toLowerCase()) + '">';
      html += '<span class="loot-crate-icon">' + svgCrate() + '</span>';
      html += '<div class="loot-crate-copy"><span class="loot-crate-kicker">MYSTERY CRATE READY · ' + esc(ctx, eng.pendingLoot.rarity) + '</span><strong>' + esc(ctx, eng.pendingLoot.kind) + ' waiting</strong><p>Variable-ratio workout reward unlocked. Unbox to bank your bonus.</p></div>';
      html += '<button type="button" class="action-btn compact" data-action="claim-loot">Unbox Crate</button>';
      html += '</section>';
    } else {
      var lastCrate = (eng.unlockedLoot || [])[0];
      html += '<section class="overview-card"><strong>Mystery Reward Crate</strong>';
      html += '<p>' + (lastCrate ? 'Last opened: ' + esc(ctx, lastCrate.rarity + ' — ' + lastCrate.title) + '. ' : '') + 'Finish your next workout to roll a new Common, Rare, Epic, or Mythic drop (' + (eng.unlockedLoot || []).length + ' opened).</p></section>';
    }

    // 4. Daily Quests
    html += '<section class="overview-card"><strong>Daily Micro-Quests (' + esc(ctx, today) + ')</strong>';
    html += '<div class="quest-list">';
    quests.forEach(function (q) {
      html += '<div class="quest-item" data-done="' + String(!!q.done) + '" data-quest-id="' + esc(ctx, q.id) + '">';
      html += '<span class="quest-check">' + svgCheck(q.done) + '</span>';
      html += '<span class="quest-title">' + esc(ctx, q.title) + '</span>';
      html += '<span class="quest-progress">' + q.progress + '/' + q.target + '</span>';
      html += '<span class="quest-xp">+' + q.xpReward + ' XP</span>';
      html += '</div>';
    });
    html += '</div></section>';

    // 5. Anti-Hiatus Defense & Streak Freeze Shield Protector
    html += '<section class="hiatus-card" data-tier="' + esc(ctx, hiatus.tier) + '">';
    html += '<div class="hiatus-copy"><strong>Anti-Hiatus Defense · ' + esc(ctx, hiatus.title) + '</strong>';
    html += '<p>' + esc(ctx, hiatus.message) + '</p>';
    html += '<p class="section-sub">Streak Shields: ' + eng.shields + '/' + eng.maxShields + ' available · Next shield in ' + sessionsUntilShield + ' session' + (sessionsUntilShield === 1 ? '' : 's') + '.</p></div>';
    html += '<div class="hiatus-actions">';
    html += '<button type="button" class="action-btn secondary" data-action="activate-shield" data-date="' + esc(ctx, refToday) + '"' + (shieldedToday || eng.shields <= 0 ? ' disabled' : '') + '>' + svgShield() + '<span>' + (shieldedToday ? 'Shield Active Today' : eng.shields <= 0 ? 'No Shields Left' : 'Use Streak Shield') + '</span></button>';
    if (hiatus.gapDays >= 2) html += renderHiatusCtaButton(ctx, hiatus, refToday);
    html += '</div></section>';

    // 6. Implementation-Intention Pledge Picker
    html += '<section class="overview-card"><strong>Implementation-Intention Pledge (+150 XP)</strong>';
    html += '<p>Pick your exact next training window. Showing up on your pledged day awards +150 bonus XP.</p>';
    if (eng.pledge) {
      html += '<p class="section-sub">Current pledge (' + esc(ctx, eng.pledge.status) + '): ' + esc(ctx, eng.pledge.when + ' · ' + eng.pledge.slot + ' (' + eng.pledge.targetDate + ')') + '</p>';
    }
    html += '<div class="pledge-grid">';
    ["Today", "Tomorrow"].forEach(function (whenOpt) {
      ["Morning", "Afternoon", "Evening"].forEach(function (slotOpt) {
        var active = !!(eng.pledge && eng.pledge.status === "active" && eng.pledge.when === whenOpt && eng.pledge.slot === slotOpt);
        html += '<button type="button" class="tool-btn" data-action="set-pledge" data-when="' + whenOpt + '" data-slot="' + slotOpt + '" data-active="' + String(active) + '">' + whenOpt + ' · ' + slotOpt + '</button>';
      });
    });
    html += '</div></section>';

    // 7. Compact Shareable Workout Story Card
    html += '<section class="story-card" aria-label="Shareable workout story card">';
    html += '<div class="story-card-head"><span class="story-eyebrow">LIFT MOMENTUM CARD</span><span class="story-badge">Lv ' + lvl.level + '</span></div>';
    html += '<div class="story-athlete">' + esc(ctx, athlete) + ' — ' + esc(ctx, activeTitle || lvl.title) + '</div>';
    html += '<div class="story-stats"><span>' + streak + 'd streak</span><span>' + eng.lifetimeSessions + ' sessions</span><span>' + esc(ctx, tonnageEquivalent(eng.lifetimeVolumeKg)) + '</span></div>';
    html += '<div class="story-actions"><button type="button" class="action-btn secondary" data-action="share-story">' + svgShare() + '<span>Share Story Card</span></button></div>';
    html += '</section>';

    // 8. Interactive Social-Style Milestone Feed
    html += '<section class="overview-card"><strong>Momentum Feed</strong>';
    if (!eng.feed.length) {
      html += '<p>Complete your first set or session to start building your milestone stream.</p>';
    } else {
      html += '<div class="feed-list">';
      eng.feed.forEach(function (item) {
        html += '<article class="feed-card" data-kind="' + esc(ctx, item.kind || "milestone") + '">';
        html += '<div class="feed-icon">' + feedIcon(item.kind) + '</div>';
        html += '<div class="feed-copy"><div class="feed-title">' + esc(ctx, item.title) + '</div>';
        if (item.detail) html += '<div class="feed-detail">' + esc(ctx, item.detail) + '</div>';
        if (item.date) html += '<div class="feed-date">' + esc(ctx, item.date) + '</div>';
        html += '</div>';
        html += '<button type="button" class="tool-btn feed-hype-btn" data-action="hype-feed" data-item-id="' + esc(ctx, item.id) + '" aria-label="Hype milestone">' + svgBolt() + '<span>Hype</span> <strong>' + Math.max(0, Math.round(finiteNum(item.hypes, 0))) + '</strong></button>';
        html += '</article>';
      });
      html += '</div>';
    }
    html += '</section>';

    html += '</div>';
    return html;
  }

  root.engagement = {
    RANKS: RANKS,
    ensureEngagement: ensureEngagement,
    seedFromHistory: seedFromHistory,
    levelInfo: levelInfo,
    dailyQuests: dailyQuests,
    onSetCompleted: onSetCompleted,
    onWorkoutFinished: onWorkoutFinished,
    tonnageEquivalent: tonnageEquivalent,
    claimLoot: claimLoot,
    activateShield: activateShield,
    setPledge: setPledge,
    hiatusDefense: hiatusDefense,
    hypeFeedItem: hypeFeedItem,
    widgetPayload: widgetPayload,
    shareStoryText: shareStoryText,
    renderMomentumGadget: renderMomentumGadget,
    renderFeedSheet: renderFeedSheet
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.engagement;
})();
