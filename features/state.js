(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var SCHEMA_VERSION = 4;
  var DAY_STATUSES = ["completed", "planned", "rest", "missed", "unknown", "reconstructed"];
  var GOAL_MODES = ["fat_loss", "recomposition", "maintenance", "muscle_gain"];

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function isDateId(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return false;
    var date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
    return date.getUTCFullYear() === +match[1] && date.getUTCMonth() === +match[2] - 1 && date.getUTCDate() === +match[3];
  }

  function hasCompletedSet(dayState) {
    var completed = isObject(dayState && dayState.completed) ? dayState.completed : {};
    return Object.keys(completed).some(function (key) {
      return Number((completed[key] || {}).reps) > 0;
    });
  }

  function normalizeCompleted(input) {
    var out = {};
    if (!isObject(input)) return out;
    Object.keys(input).forEach(function (key) {
      var set = input[key];
      if (!isObject(set)) return;
      var next = Object.assign({}, set);
      if (next.reps != null) next.reps = Math.max(0, Math.round(Number(next.reps) || 0));
      if (next.weight != null) next.weight = Math.max(0, Number(next.weight) || 0);
      if (next.rir != null) next.rir = Math.max(0, Math.min(4, Math.round(Number(next.rir) || 0)));
      out[key] = next;
    });
    return out;
  }

  function normalizePlannedSets(input) {
    if (!Array.isArray(input)) return [];
    return input.filter(isObject).map(function (set) {
      var next = Object.assign({}, set);
      next.reps = Math.max(0, Math.round(Number(next.reps) || 0));
      next.weight = Math.max(0, Number(next.weight) || 0);
      return next;
    });
  }

  function normalizeCustomExercise(exercise) {
    if (!isObject(exercise) || !String(exercise.name || "").trim()) return null;
    var next = Object.assign({}, exercise);
    next.name = String(next.name).trim();
    next.custom = true;
    next.sets = normalizePlannedSets(exercise.sets);
    next.muscleGroups = isObject(exercise.muscleGroups) ? exercise.muscleGroups : {};
    if (exercise.repRange != null) {
      next.repRange = Array.isArray(exercise.repRange)
        ? exercise.repRange.slice(0, 2).map(function (value) { return Math.max(1, Math.round(Number(value) || 1)); })
        : [];
    }
    return next;
  }

  function normalizeDay(dayState) {
    var original = isObject(dayState) ? dayState : {};
    var next = Object.assign({}, original);
    next.completed = normalizeCompleted(original.completed);
    next.extraSets = isObject(original.extraSets) ? original.extraSets : {};
    next.drafts = isObject(original.drafts) ? original.drafts : {};
    next.exerciseFlags = isObject(original.exerciseFlags) ? original.exerciseFlags : {};
    next.adaptiveTargets = isObject(original.adaptiveTargets) ? original.adaptiveTargets : {};
    next.customExercises = Array.isArray(original.customExercises) ? original.customExercises.map(normalizeCustomExercise).filter(Boolean) : [];

    if (original.status === "done") next.status = "completed";
    else if (original.status === "partial" && hasCompletedSet(next)) next.status = "completed";
    else if (DAY_STATUSES.indexOf(original.status) >= 0) next.status = original.status;

    if (original.reconstructed === true || original.trainedWithoutDetails === true) {
      next.status = "reconstructed";
      next.trained = true;
    }
    if (hasCompletedSet(next)) {
      next.status = "completed";
      next.source = next.source || "verified-log";
    } else if (next.status === "reconstructed") {
      next.trained = next.trained !== false;
      next.source = next.source || "user-reconstructed";
    } else if (next.status === "completed") {
      // A completed label without a surviving working set cannot be presented
      // as verified. Preserve an explicit trained marker as reconstruction;
      // otherwise keep the historical outcome unknown.
      if (original.trained === true) {
        next.status = "reconstructed";
        next.source = "legacy-trained-without-details";
      } else {
        next.status = "unknown";
        next.trained = false;
        next.source = "legacy-completed-without-sets";
      }
    } else if (!next.status) {
      // A v3 day shell is evidence of a storage placeholder, not evidence of a
      // missed workout. Preserve that uncertainty explicitly.
      next.status = "unknown";
      next.source = next.source || "legacy-placeholder";
    }
    return next;
  }

  function normalizeProfile(profile) {
    var next = Object.assign({
      athlete: "Lem",
      heightCm: 167,
      goalMode: "recomposition",
      goalStatement: "Smaller waist + visible abs while preserving muscle",
      proteinTargetG: 130,
      proteinRangeMinG: 120,
      proteinRangeMaxG: 145
    }, isObject(profile) ? profile : {});
    if (GOAL_MODES.indexOf(next.goalMode) < 0) next.goalMode = "recomposition";
    next.heightCm = Math.max(80, Math.min(250, Number(next.heightCm) || 167));
    next.proteinTargetG = Math.max(20, Math.min(300, Number(next.proteinTargetG) || 130));
    next.proteinRangeMinG = Math.max(20, Math.min(next.proteinTargetG, Number(next.proteinRangeMinG) || 120));
    next.proteinRangeMaxG = Math.max(next.proteinTargetG, Math.min(350, Number(next.proteinRangeMaxG) || 145));
    return next;
  }

  function normalizeEntryBuckets(input, allowArrayRow) {
    var out = {};
    if (!isObject(input)) return out;
    Object.keys(input).forEach(function (date) {
      if (!isDateId(date)) return;
      var raw = input[date];
      if (allowArrayRow && Array.isArray(raw)) raw = { entries: raw };
      if (!isObject(raw)) return;
      var row = Object.assign({}, raw);
      row.entries = Array.isArray(raw.entries) ? raw.entries.filter(isObject) : [];
      out[date] = row;
    });
    return out;
  }

  function normalizeSupplementBuckets(input) {
    var out = {};
    if (!isObject(input)) return out;
    Object.keys(input).forEach(function (date) {
      if (isDateId(date) && isObject(input[date])) out[date] = Object.assign({}, input[date]);
    });
    return out;
  }

  function normalizeRollingPlan(input) {
    var plan = isObject(input) ? Object.assign({}, input) : { weeks: [] };
    plan.weeks = (Array.isArray(plan.weeks) ? plan.weeks : []).filter(isObject).map(function (week) {
      var nextWeek = Object.assign({}, week);
      nextWeek.days = (Array.isArray(week.days) ? week.days : []).filter(function (day) {
        return isObject(day) && isDateId(day.id);
      }).map(function (day) {
        var nextDay = Object.assign({}, day);
        nextDay.exercises = (Array.isArray(day.exercises) ? day.exercises : []).filter(function (exercise) {
          return isObject(exercise) && String(exercise.name || "").trim();
        }).map(function (exercise) {
          var nextExercise = Object.assign({}, exercise);
          nextExercise.name = String(exercise.name).trim();
          nextExercise.sets = normalizePlannedSets(exercise.sets);
          nextExercise.muscleGroups = isObject(exercise.muscleGroups) ? exercise.muscleGroups : {};
          return nextExercise;
        });
        return nextDay;
      });
      return nextWeek;
    });
    return plan;
  }

  function migrateState(input) {
    var source = isObject(input) ? clone(input) : {};
    var fromVersion = Number(source.schemaVersion || source.v || 1) || 1;
    var next = Object.assign({}, source);
    next.v = SCHEMA_VERSION;
    next.schemaVersion = SCHEMA_VERSION;
    next.migration = Object.assign({}, isObject(source.migration) ? source.migration : {}, {
      fromVersion: Math.min(fromVersion, SCHEMA_VERSION),
      migratedAt: source.migration && source.migration.migratedAt ? source.migration.migratedAt : Date.now(),
      emptyLegacyDaysAreUnknown: true
    });

    next.days = {};
    if (isObject(source.days)) {
      Object.keys(source.days).forEach(function (date) {
        if (!isDateId(date)) return;
        next.days[date] = normalizeDay(source.days[date]);
      });
    }

    next.profile = normalizeProfile(source.profile);
    next.bodyweight = Array.isArray(source.bodyweight) ? source.bodyweight.filter(function (row) {
      return isObject(row) && isDateId(row.date) && Number(row.kg) > 0;
    }) : [];
    next.measurements = Array.isArray(source.measurements) ? source.measurements.filter(function (row) {
      return isObject(row) && isDateId(row.date);
    }) : [];
    next.progressPhotos = Array.isArray(source.progressPhotos) ? source.progressPhotos.filter(isDateId).map(String) : [];
    next.nutrition = normalizeEntryBuckets(source.nutrition, false);
    next.cardio = normalizeEntryBuckets(source.cardio, true);
    next.supplements = normalizeSupplementBuckets(source.supplements);
    next.supplementSettings = Object.assign({ creatineDoseG: null }, isObject(source.supplementSettings) ? source.supplementSettings : {});
    var creatineDose = Number(next.supplementSettings.creatineDoseG);
    next.supplementSettings.creatineDoseG = creatineDose > 0 ? Math.min(25, Math.round(creatineDose * 10) / 10) : null;
    next.history = Object.assign({ dataLossEvents: [], reconstructedCount: 0 }, isObject(source.history) ? source.history : {});
    next.history.dataLossEvents = Array.isArray(next.history.dataLossEvents) ? next.history.dataLossEvents : [];
    next.backup = Object.assign({
      lastExternalAt: source.cloudSync && source.cloudSync.lastBackupAt || null,
      lastNativeMirrorAt: null,
      lastRestoreAt: null,
      lastRestoreMode: null
    }, isObject(source.backup) ? source.backup : {});
    next.rollingPlan = normalizeRollingPlan(source.rollingPlan);
    return next;
  }

  function hasMalformedEntryBuckets(value, allowArrayRow) {
    if (!isObject(value)) return true;
    return Object.keys(value).some(function (date) {
      var row = value[date];
      if (!isDateId(date)) return true;
      if (allowArrayRow && Array.isArray(row)) return row.some(function (entry) { return !isObject(entry); });
      return !isObject(row) || (row.entries != null && (!Array.isArray(row.entries) || row.entries.some(function (entry) { return !isObject(entry); })));
    });
  }

  function validateBackup(value) {
    var errors = [];
    if (!isObject(value)) errors.push("Backup must contain a JSON object.");
    if (isObject(value) && value.days != null && !isObject(value.days)) errors.push("Workout days must be an object keyed by date.");
    if (isObject(value) && value.bodyweight != null && !Array.isArray(value.bodyweight)) errors.push("Body-weight history must be an array.");
    if (isObject(value) && value.measurements != null && !Array.isArray(value.measurements)) errors.push("Measurements must be an array.");
    if (isObject(value) && value.nutrition != null && hasMalformedEntryBuckets(value.nutrition, false)) errors.push("Nutrition history contains malformed rows.");
    if (isObject(value) && value.cardio != null && hasMalformedEntryBuckets(value.cardio, true)) errors.push("Cardio history contains malformed rows.");
    if (isObject(value) && value.supplements != null && (!isObject(value.supplements) || Object.keys(value.supplements).some(function (date) {
      return !isDateId(date) || !isObject(value.supplements[date]);
    }))) errors.push("Supplement history contains malformed rows.");
    if (isObject(value) && isObject(value.days) && Object.keys(value.days).some(function (date) {
      var day = value.days[date];
      return !isDateId(date) || !isObject(day) || (day.customExercises != null && (!Array.isArray(day.customExercises) || day.customExercises.some(function (exercise) {
        return !isObject(exercise) || !String(exercise.name || "").trim() || (exercise.sets != null && !Array.isArray(exercise.sets));
      })));
    })) errors.push("Workout history contains malformed day or custom-exercise rows.");
    var recognized = isObject(value) && ["days", "bodyweight", "measurements", "nutrition", "cardio", "settings", "profile", "prs"].some(function (key) {
      return Object.prototype.hasOwnProperty.call(value, key);
    });
    if (isObject(value) && !recognized) errors.push("No recognized Lift data was found.");
    return { valid: errors.length === 0, errors: errors };
  }

  function parseBackupText(text) {
    var parsed;
    try {
      parsed = JSON.parse(String(text || ""));
    } catch (err) {
      return { valid: false, errors: ["The selected file is not valid JSON."], state: null };
    }
    var result = validateBackup(parsed);
    return { valid: result.valid, errors: result.errors, state: result.valid ? migrateState(parsed) : null };
  }

  function mergeText(a, b) {
    var left = String(a || "").trim();
    var right = String(b || "").trim();
    if (!left) return right;
    if (!right || left === right) return left;
    return left + "\n--- Restored note ---\n" + right;
  }

  function mergeCompleted(a, b) {
    var out = Object.assign({}, isObject(a) ? a : {});
    Object.keys(isObject(b) ? b : {}).forEach(function (key) {
      var current = out[key];
      var incoming = b[key];
      if (!current) {
        out[key] = incoming;
        return;
      }
      var currentTs = Number(current.ts || 0);
      var incomingTs = Number(incoming.ts || 0);
      if (incomingTs > currentTs || (incomingTs === currentTs && Number(incoming.reps || 0) > Number(current.reps || 0))) {
        out[key] = incoming;
      }
    });
    return out;
  }

  function exerciseSignature(exercise) {
    if (exercise && exercise.id) return "id:" + String(exercise.id).toLowerCase();
    return [exercise && exercise.name, exercise && exercise.addedAt, exercise && exercise.target].join("|").toLowerCase();
  }

  function mergeCustomExercises(a, b) {
    var seen = {};
    return (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : []).filter(function (exercise) {
      if (!isObject(exercise)) return false;
      var signature = exerciseSignature(exercise);
      if (seen[signature]) return false;
      seen[signature] = true;
      return true;
    });
  }

  function statusRank(status) {
    return ({ completed: 6, reconstructed: 5, missed: 4, unknown: 3, planned: 2, rest: 1 })[status] || 0;
  }

  function customBase(day) {
    var value = Number(day && day.baseExerciseCount);
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  function remapExerciseIndex(index, entry, sourceDay, mergedCustom, targetBase) {
    var sourceCustom = Array.isArray(sourceDay && sourceDay.customExercises) ? sourceDay.customExercises : [];
    var sourceBase = customBase(sourceDay);
    var signature = entry && entry.exerciseId ? "id:" + String(entry.exerciseId).toLowerCase() : null;
    if (!signature && sourceBase != null && index >= sourceBase && index < sourceBase + sourceCustom.length) {
      signature = exerciseSignature(sourceCustom[index - sourceBase]);
    }
    if (!signature || targetBase == null) return index;
    var targetPosition = mergedCustom.findIndex(function (exercise) { return exerciseSignature(exercise) === signature; });
    return targetPosition >= 0 ? targetBase + targetPosition : index;
  }

  function remapSetBucket(bucket, sourceDay, mergedCustom, targetBase) {
    var out = {};
    Object.keys(isObject(bucket) ? bucket : {}).forEach(function (key) {
      var parts = String(key).split(".");
      var index = Number(parts[0]);
      if (!Number.isInteger(index)) return;
      parts[0] = String(remapExerciseIndex(index, bucket[key], sourceDay, mergedCustom, targetBase));
      var nextKey = parts.join(".");
      if (!out[nextKey] || Number(bucket[key] && bucket[key].ts || 0) >= Number(out[nextKey] && out[nextKey].ts || 0)) out[nextKey] = bucket[key];
    });
    return out;
  }

  function remapIndexedBucket(bucket, sourceDay, mergedCustom, targetBase) {
    var out = {};
    Object.keys(isObject(bucket) ? bucket : {}).forEach(function (key) {
      var index = Number(key);
      if (!Number.isInteger(index)) return;
      var nextKey = String(remapExerciseIndex(index, null, sourceDay, mergedCustom, targetBase));
      var value = bucket[key];
      out[nextKey] = isObject(value)
        ? Object.assign({}, isObject(out[nextKey]) ? out[nextKey] : {}, value)
        : value;
    });
    return out;
  }

  function mergeDay(a, b) {
    var left = normalizeDay(a);
    var right = normalizeDay(b);
    var out = Object.assign({}, left, right);
    out.customExercises = mergeCustomExercises(left.customExercises, right.customExercises);
    var targetBase = customBase(left);
    if (targetBase == null) targetBase = customBase(right);
    if (targetBase != null) out.baseExerciseCount = targetBase;
    var leftCompleted = remapSetBucket(left.completed, left, out.customExercises, targetBase);
    var rightCompleted = remapSetBucket(right.completed, right, out.customExercises, targetBase);
    out.completed = mergeCompleted(leftCompleted, rightCompleted);
    out.drafts = Object.assign({}, remapSetBucket(left.drafts, left, out.customExercises, targetBase), remapSetBucket(right.drafts, right, out.customExercises, targetBase));
    out.extraSets = Object.assign({}, remapIndexedBucket(left.extraSets, left, out.customExercises, targetBase), remapIndexedBucket(right.extraSets, right, out.customExercises, targetBase));
    out.exerciseFlags = Object.assign({}, remapIndexedBucket(left.exerciseFlags, left, out.customExercises, targetBase), remapIndexedBucket(right.exerciseFlags, right, out.customExercises, targetBase));
    out.adaptiveTargets = Object.assign({}, remapIndexedBucket(left.adaptiveTargets, left, out.customExercises, targetBase), remapIndexedBucket(right.adaptiveTargets, right, out.customExercises, targetBase));
    out.notes = mergeText(left.notes, right.notes);
    if (hasCompletedSet(out)) {
      out.status = "completed";
      out.source = "verified-log";
    } else if (statusRank(left.status) > statusRank(right.status)) {
      out.status = left.status;
      out.source = left.source;
      out.trained = left.trained;
    }
    return out;
  }

  function mergeRowsByDate(a, b) {
    var map = {};
    (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : []).forEach(function (row) {
      if (!isObject(row) || !isDateId(row.date)) return;
      var prior = map[row.date] || { date: row.date };
      var next = Object.assign({}, prior, row, { date: row.date });
      if (prior.notes || row.notes) next.notes = Object.assign({}, prior.notes || {}, row.notes || {});
      map[row.date] = next;
    });
    return Object.keys(map).sort().map(function (date) { return map[date]; });
  }

  function entrySignature(entry) {
    if (!isObject(entry)) return "";
    return String(entry.id || [entry.type, entry.name, entry.foodId, entry.distanceKm, entry.durationSec, entry.proteinG, entry.ts].join("|"));
  }

  function mergeEntries(a, b) {
    var seen = {};
    return (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : []).filter(function (entry) {
      if (!isObject(entry)) return false;
      var signature = entrySignature(entry);
      if (!signature || seen[signature]) return false;
      seen[signature] = true;
      return true;
    });
  }

  function mergeDateBuckets(a, b) {
    var out = clone(isObject(a) ? a : {});
    Object.keys(isObject(b) ? b : {}).forEach(function (date) {
      if (!isDateId(date)) return;
      var left = isObject(out[date]) ? out[date] : {};
      var right = isObject(b[date]) ? b[date] : {};
      out[date] = Object.assign({}, left, right);
      if (Array.isArray(left.entries) || Array.isArray(right.entries)) out[date].entries = mergeEntries(left.entries, right.entries);
    });
    return out;
  }

  function mergeStates(current, incoming) {
    var rawIncoming = isObject(incoming) ? incoming : {};
    var left = migrateState(current);
    var right = migrateState(incoming);
    var out = clone(left);
    Object.keys(rawIncoming).forEach(function (key) { out[key] = clone(right[key]); });
    out.settings = Object.assign({}, left.settings || {}, isObject(rawIncoming.settings) ? right.settings || {} : {});
    out.goals = Object.assign({}, left.goals || {}, isObject(rawIncoming.goals) ? right.goals || {} : {});
    out.profile = normalizeProfile(Object.assign({}, left.profile || {}, isObject(rawIncoming.profile) ? rawIncoming.profile : {}));
    out.days = {};
    var dates = {};
    Object.keys(left.days || {}).concat(Object.keys(right.days || {})).forEach(function (date) { dates[date] = true; });
    Object.keys(dates).forEach(function (date) {
      out.days[date] = left.days[date] && right.days[date]
        ? mergeDay(left.days[date], right.days[date])
        : normalizeDay(left.days[date] || right.days[date]);
    });
    out.bodyweight = mergeRowsByDate(left.bodyweight, right.bodyweight);
    out.measurements = mergeRowsByDate(left.measurements, right.measurements);
    out.progressPhotos = Array.from(new Set((left.progressPhotos || []).concat(right.progressPhotos || []))).filter(isDateId).sort();
    out.nutrition = mergeDateBuckets(left.nutrition, right.nutrition);
    out.cardio = mergeDateBuckets(left.cardio, right.cardio);
    out.supplements = mergeDateBuckets(left.supplements, right.supplements);
    out.supplementSettings = Object.assign({}, left.supplementSettings || {}, isObject(rawIncoming.supplementSettings) ? rawIncoming.supplementSettings : {});
    out.prs = Object.assign({}, left.prs || {}, right.prs || {});
    out.achievements = Object.assign({}, left.achievements || {}, right.achievements || {});
    out.history = Object.assign({}, left.history || {}, isObject(rawIncoming.history) ? right.history || {} : {});
    out.history.dataLossEvents = Array.from(new Map((left.history && left.history.dataLossEvents || []).concat(right.history && right.history.dataLossEvents || []).map(function (event) {
      return [JSON.stringify(event), event];
    })).values());
    out.history.reconstructedCount = Math.max(Number(left.history && left.history.reconstructedCount || 0), Number(right.history && right.history.reconstructedCount || 0));
    out.backup = Object.assign({}, left.backup || {});
    if (isObject(rawIncoming.backup)) {
      Object.keys(rawIncoming.backup).forEach(function (key) {
        if (right.backup[key] != null) out.backup[key] = right.backup[key];
      });
    }
    out.backup.lastExternalAt = Math.max(Number(left.backup && left.backup.lastExternalAt || 0), Number(right.backup && right.backup.lastExternalAt || 0)) || null;
    out.backup.lastRestoreAt = Date.now();
    out.backup.lastRestoreMode = "merge";
    return migrateState(out);
  }

  root.state = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    DAY_STATUSES: DAY_STATUSES,
    GOAL_MODES: GOAL_MODES,
    clone: clone,
    hasCompletedSet: hasCompletedSet,
    isDateId: isDateId,
    migrateState: migrateState,
    normalizeDay: normalizeDay,
    normalizeProfile: normalizeProfile,
    parseBackupText: parseBackupText,
    validateBackup: validateBackup,
    mergeDay: mergeDay,
    mergeStates: mergeStates,
    mergeRowsByDate: mergeRowsByDate
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.state;
})();
