// Quick-add custom exercise mid-workout.
// Adds an exercise to the active day's exercises[] in memory and persists.
// Custom exercises are flagged with custom:true so they can be removed.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  var PRESETS = [
    { name: "Low-to-High Cable Fly", scheme: { sets: 2, reps: 12, defaultRest: 60 }, muscleGroups: { upperChest: 1, chest: 0.5 }, weightMode: "machine_total", contexts: ["chest", "primer"] },
    { name: "Cable Lateral Raise", scheme: { sets: 2, reps: 15, defaultRest: 60 }, muscleGroups: { sideDelts: 1 }, weightMode: "per_side", contexts: ["chest", "primer"] },
    { name: "Abdominal Machine", scheme: { sets: 3, reps: 12, defaultRest: 60 }, muscleGroups: { abs: 1 }, weightMode: "machine_total", contexts: ["legs", "chest", "ham"] },
    { name: "Hanging Knee Raise", scheme: { sets: 2, reps: 10, defaultRest: 60 }, muscleGroups: { abs: 1 }, weightMode: "bodyweight", contexts: ["pull", "chest", "primer"] },
    { name: "45 Degree Back Extension", scheme: { sets: 2, reps: 12, defaultRest: 90 }, muscleGroups: { spinalErectors: 1, glutes: 0.5, hamstrings: 0.5 }, weightMode: "total", contexts: ["legs", "pull"] },
    { name: "One-Arm Cable Pulldown", scheme: { sets: 2, reps: 12, defaultRest: 90 }, muscleGroups: { lats: 1, biceps: 0.5 }, weightMode: "per_side", contexts: ["pull", "primer"] },
    { name: "Rear Delt Fly", scheme: { sets: 2, reps: 15, defaultRest: 60 }, muscleGroups: { rearDelts: 1, upperBack: 0.5 }, weightMode: "machine_total", contexts: ["pull", "primer"] },
    { name: "Calf Raise", scheme: { sets: 3, reps: 15, defaultRest: 60 }, muscleGroups: { calves: 1 }, weightMode: "machine_total", contexts: ["legs", "ham"] }
  ];

  function presetsForDay(day) {
    var type = String(day && day.type || "");
    var matched = PRESETS.filter(function (preset) { return preset.contexts.indexOf(type) >= 0; });
    return matched.length ? matched : PRESETS.slice(0, 6);
  }

  function renderQuickAdd(ctx) {
    var draft = (ctx.runtime && ctx.runtime.quickAddDraft) || { name: "", sets: 3, reps: 8, weight: 0, restSec: 60 };
    var unit = ctx.unitLabel ? ctx.unitLabel() : "kg";
    var day = ctx.getDay && ctx.getDay(ctx.state.activeDayId);
    var presets = presetsForDay(day);

    var html = '<div class="quick-add-grid">';
    html += '<div class="overview-card"><strong>Quick add exercise</strong>' +
      '<p>Drop a new exercise into today\'s workout. It saves with your day data and you can delete it any time.</p></div>';

    html += '<div><div class="menu-section">Common picks</div>' +
      '<div class="qa-presets">' +
      presets.map(function (p) {
        return '<button class="qa-preset" data-action="qa-preset" data-name="' + ctx.escapeHtml(p.name) +
          '" data-sets="' + p.scheme.sets + '" data-reps="' + ctx.escapeHtml(p.scheme.reps) +
          '" data-rest="' + p.scheme.defaultRest + '"' +
          (draft.name === p.name ? ' data-active="true"' : "") +
          '>' + ctx.escapeHtml(p.name) + '</button>';
      }).join("") +
      '</div></div>';

    html += '<div class="field-block"><label for="qa-name">Exercise</label>' +
      '<input id="qa-name" type="text" data-action="qa-input" data-field="name" value="' + ctx.escapeHtml(draft.name || "") + '" placeholder="Bicep curl"></div>';

    html += '<div class="measure-input-row">' +
      '<div class="field-block"><label for="qa-sets">Sets</label>' +
      '<input id="qa-sets" type="number" min="1" max="20" step="1" data-action="qa-input" data-field="sets" value="' + ctx.escapeHtml(draft.sets) + '"></div>' +
      '<div class="field-block"><label for="qa-reps">Reps</label>' +
      '<input id="qa-reps" type="text" data-action="qa-input" data-field="reps" value="' + ctx.escapeHtml(draft.reps) + '" placeholder="8"></div>' +
      '<div class="field-block"><label for="qa-rest">Rest (s)</label>' +
      '<input id="qa-rest" type="number" min="0" step="15" data-action="qa-input" data-field="restSec" value="' + ctx.escapeHtml(draft.restSec) + '"></div>' +
      '</div>';

    html += '<div class="field-block"><label for="qa-weight">Suggested weight (' + unit + ')</label>' +
      '<input id="qa-weight" type="number" step="0.5" min="0" data-action="qa-input" data-field="weight" value="' + ctx.escapeHtml(draft.weight) + '"></div>';

    html += '<div class="measure-input-row"><div class="field-block"><label for="qa-muscle">Primary muscle</label><select id="qa-muscle" data-action="qa-input" data-field="muscleGroup">' +
      option("", "Auto-detect", draft.muscleGroup) + option("upperChest", "Upper chest", draft.muscleGroup) + option("sideDelts", "Side delts", draft.muscleGroup) + option("lats", "Lats", draft.muscleGroup) + option("abs", "Abs / core", draft.muscleGroup) + option("spinalErectors", "Lower back", draft.muscleGroup) + option("rearDelts", "Rear delts", draft.muscleGroup) + option("quads", "Quads", draft.muscleGroup) + option("hamstrings", "Hamstrings", draft.muscleGroup) + '</select></div>' +
      '<div class="field-block"><label for="qa-weight-mode">Weight means</label><select id="qa-weight-mode" data-action="qa-input" data-field="weightMode">' + option("machine_total", "Machine / total", draft.weightMode || "machine_total") + option("total", "Dumbbell total", draft.weightMode) + option("per_hand", "Per hand", draft.weightMode) + option("per_side", "Per side", draft.weightMode) + option("bodyweight", "Bodyweight", draft.weightMode) + '</select></div></div>';

    html += '<div class="sheet-actions">' +
      '<button class="action-btn" data-action="qa-commit">Add to today</button>' +
      '<button class="action-btn secondary" data-action="close-sheet">Cancel</button>' +
      '</div>';
    html += '</div>';
    return html;
  }

  function commit(ctx) {
    var draft = (ctx.runtime && ctx.runtime.quickAddDraft) || {};
    if (!draft.name || !String(draft.name).trim()) {
      if (ctx.toast) ctx.toast("Give the exercise a name first.");
      return false;
    }
    var dayId = ctx.state.activeDayId;
    var allDays = ctx.allDays();
    var match = allDays.find(function (e) { return e.day.id === dayId; });
    if (!match) {
      if (ctx.toast) ctx.toast("No active day to add to.");
      return false;
    }
    var rawSets = Number(draft.sets);
    var sets = Math.min(20, Math.max(1, Math.round(Number.isFinite(rawSets) ? rawSets : 3)));
    var rawReps = Number(draft.reps == null || draft.reps === "" ? 8 : draft.reps);
    if (!Number.isFinite(rawReps) || rawReps <= 0) {
      if (ctx.toast) ctx.toast("Enter at least 1 rep.");
      return false;
    }
    var reps = Math.min(999, Math.max(1, Math.round(rawReps)));
    var rawWeight = Number(draft.weight);
    var displayWeight = Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : 0;
    var weightKg = ctx.displayToKg ? ctx.displayToKg(displayWeight) : displayWeight;
    var rawRest = Number(draft.restSec);
    var defaultRest = Math.min(600, Math.max(0, Math.round(Number.isFinite(rawRest) ? rawRest : 60)));
    var sets$ = [];
    for (var i = 0; i < sets; i += 1) {
      sets$.push({ reps: reps, weight: weightKg });
    }
    var preset = PRESETS.find(function (item) { return item.name === String(draft.name).trim(); });
    var muscleGroups = preset && preset.muscleGroups ? preset.muscleGroups : {};
    if (draft.muscleGroup) muscleGroups = (function () { var out = {}; out[draft.muscleGroup] = 1; return out; })();
    var addedAt = Date.now();
    var entry = {
      id: "custom-" + addedAt + "-" + Math.random().toString(16).slice(2),
      name: String(draft.name).trim(),
      target: sets + " x " + reps,
      sets: sets$,
      defaultRest: defaultRest,
      custom: true,
      muscleGroups: muscleGroups,
      weightMode: draft.weightMode || preset && preset.weightMode || "machine_total",
      incrementKg: /lateral|curl|rear delt/i.test(String(draft.name)) ? 1 : 2.5,
      repRange: [Math.max(1, reps - 2), reps],
      addedAt: addedAt
    };
    // Persist custom exercise in state so it survives page reloads.
    var ds = ctx.state.days[dayId] = ctx.state.days[dayId] || {};
    ds.customExercises = Array.isArray(ds.customExercises) ? ds.customExercises : [];
    if (!Number.isInteger(Number(ds.baseExerciseCount)) || Number(ds.baseExerciseCount) < 0) {
      ds.baseExerciseCount = Math.max(0, (match.day.exercises || []).length - ds.customExercises.length);
    }
    ds.customExercises.push(entry);
    if (ctx.saveState) ctx.saveState();
    if (ctx.toast) ctx.toast("Added " + entry.name + ".");
    if (ctx.runtime) ctx.runtime.quickAddDraft = null;
    return true;
  }

  function option(value, label, current) {
    return '<option value="' + value + '"' + (String(current || "") === value ? ' selected' : '') + '>' + label + '</option>';
  }

  function remapExerciseBucket(bucket, removedIndex) {
    var next = {};
    Object.keys(bucket || {}).forEach(function (key) {
      var parts = key.split(".");
      var exIndex = Number(parts[0]);
      if (exIndex === removedIndex) return;
      if (exIndex > removedIndex) parts[0] = String(exIndex - 1);
      next[parts.join(".")] = bucket[key];
    });
    return next;
  }

  function remapIndexedObject(bucket, removedIndex) {
    var next = {};
    Object.keys(bucket || {}).forEach(function (key) {
      var index = Number(key);
      if (index === removedIndex) return;
      next[String(index > removedIndex ? index - 1 : index)] = bucket[key];
    });
    return next;
  }

  function remove(ctx, dayId, mergedIndex) {
    var ds = (ctx.state.days || {})[dayId];
    if (!ds || !Array.isArray(ds.customExercises) || !ds.customExercises.length) return false;
    var match = (ctx.allDays ? ctx.allDays() : []).find(function (entry) { return entry.day.id === dayId; });
    if (!match) return false;
    var baseCount = Math.max(0, (match.day.exercises || []).length - ds.customExercises.length);
    var customIndex = Number(mergedIndex) - baseCount;
    if (customIndex < 0 || customIndex >= ds.customExercises.length) return false;
    ds.customExercises.splice(customIndex, 1);
    ds.completed = remapExerciseBucket(ds.completed, Number(mergedIndex));
    ds.drafts = remapExerciseBucket(ds.drafts, Number(mergedIndex));
    ds.extraSets = remapIndexedObject(ds.extraSets, Number(mergedIndex));
    ds.exerciseFlags = remapIndexedObject(ds.exerciseFlags, Number(mergedIndex));
    ds.adaptiveTargets = remapIndexedObject(ds.adaptiveTargets, Number(mergedIndex));
    if (ctx.runtime && ctx.runtime.lastLog && ctx.runtime.lastLog.dayId === dayId) {
      var loggedIndex = Number(String(ctx.runtime.lastLog.key || "").split(".")[0]);
      if (loggedIndex >= Number(mergedIndex)) ctx.runtime.lastLog = null;
    }
    if (ctx.saveState) ctx.saveState();
    return true;
  }

  root.quickadd = {
    PRESETS: PRESETS,
    presetsForDay: presetsForDay,
    renderQuickAdd: renderQuickAdd,
    commit: commit,
    remove: remove,
    remapExerciseBucket: remapExerciseBucket
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.quickadd;
})();
