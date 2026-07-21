// Quick-add custom exercise mid-workout.
// Adds an exercise to the active day's exercises[] in memory and persists.
// Custom exercises are flagged with custom:true so they can be removed.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  var PRESETS = [
    { name: "Bicep Curl", scheme: { sets: 3, reps: 12, defaultRest: 60 }, tags: ["accessory"] },
    { name: "Tricep Pushdown", scheme: { sets: 3, reps: 12, defaultRest: 60 }, tags: ["accessory"] },
    { name: "Lateral Raise", scheme: { sets: 3, reps: 15, defaultRest: 45 }, tags: ["accessory"] },
    { name: "Face Pull", scheme: { sets: 3, reps: 15, defaultRest: 60 }, tags: ["accessory"] },
    { name: "Plank (seconds)", scheme: { sets: 3, reps: 45, defaultRest: 45 }, tags: ["core"] },
    { name: "Hanging Leg Raise", scheme: { sets: 3, reps: 10, defaultRest: 60 }, tags: ["core"] },
    { name: "Calf Raise", scheme: { sets: 4, reps: 15, defaultRest: 45 }, tags: ["accessory"] },
    { name: "Walking Lunges", scheme: { sets: 3, reps: 12, defaultRest: 75 }, tags: ["accessory"] }
  ];

  function renderQuickAdd(ctx) {
    var draft = (ctx.runtime && ctx.runtime.quickAddDraft) || { name: "", sets: 3, reps: 8, weight: 0, restSec: 60 };
    var unit = ctx.unitLabel ? ctx.unitLabel() : "kg";

    var html = '<div class="quick-add-grid">';
    html += '<div class="overview-card"><strong>Quick add exercise</strong>' +
      '<p>Drop a new exercise into today\'s workout. It saves with your day data and you can delete it any time.</p></div>';

    html += '<div><div class="menu-section">Common picks</div>' +
      '<div class="qa-presets">' +
      PRESETS.map(function (p) {
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
    var entry = {
      name: String(draft.name).trim(),
      target: sets + " x " + reps,
      sets: sets$,
      defaultRest: defaultRest,
      custom: true,
      addedAt: Date.now()
    };
    // Persist custom exercise in state so it survives page reloads.
    var ds = ctx.state.days[dayId] = ctx.state.days[dayId] || {};
    ds.customExercises = Array.isArray(ds.customExercises) ? ds.customExercises : [];
    ds.customExercises.push(entry);
    if (ctx.saveState) ctx.saveState();
    if (ctx.toast) ctx.toast("Added " + entry.name + ".");
    if (ctx.runtime) ctx.runtime.quickAddDraft = null;
    return true;
  }

  root.quickadd = {
    PRESETS: PRESETS,
    renderQuickAdd: renderQuickAdd,
    commit: commit
  };
})();
