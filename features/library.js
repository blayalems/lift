(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var DEFAULTS = [
    { id: "travel-30", name: "Travel 30-min full-body", exercises: ["Goblet squat", "Push-up", "One-arm row", "Split squat", "Plank"] },
    { id: "mobility-flow", name: "Mobility flow", exercises: ["Hip airplanes", "Thoracic rotations", "Scap push-ups", "Hamstring floss"] },
    { id: "light-pull", name: "Light pull", exercises: ["Lat pulldown", "Cable row", "Face pull", "Curl"] }
  ];

  function ensureLibrary(ctx) {
    ctx.state.customWorkouts = Array.isArray(ctx.state.customWorkouts) ? ctx.state.customWorkouts : [];
  }

  function renderLibrary(ctx) {
    ensureLibrary(ctx);
    var html = '<div class="sheet-grid"><div class="overview-card"><strong>Workout library</strong><p>Templates for training outside the fixed cycle. They are stored locally and do not alter plan data.</p></div>';
    DEFAULTS.concat(ctx.state.customWorkouts).forEach(function (w) {
      html += '<div class="overview-card"><strong>' + ctx.escapeHtml(w.name) + '</strong><p>' + ctx.escapeHtml((w.exercises || []).join(" - ") || "Custom template") + '</p><div class="sheet-actions"><button class="action-btn secondary" data-action="library-start" data-id="' + ctx.escapeHtml(w.id || "") + '">Use template</button></div></div>';
    });
    html += '<div class="field-block"><label>Custom workout name</label><input data-library-name placeholder="Hotel upper body"></div><div class="sheet-actions"><button class="action-btn" data-action="library-add">' + ctx.icon("plus") + 'Save custom workout</button></div></div>';
    return html;
  }

  function addCustomWorkout(ctx, workout) {
    ensureLibrary(ctx);
    ctx.state.customWorkouts.push({
      id: "custom-" + Date.now(),
      name: workout.name,
      exercises: workout.exercises || []
    });
  }

  function instantiateWorkout(ctx, id) {
    ensureLibrary(ctx);
    return DEFAULTS.concat(ctx.state.customWorkouts).find(function (w) { return w.id === id; }) || null;
  }

  root.library = {
    defaultWorkouts: DEFAULTS,
    ensureLibrary: ensureLibrary,
    renderLibrary: renderLibrary,
    addCustomWorkout: addCustomWorkout,
    instantiateWorkout: instantiateWorkout
  };
})();
