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
    var custom = (ctx && ctx.state && Array.isArray(ctx.state.customWorkouts)) ? ctx.state.customWorkouts : [];
    var imported = (ctx && ctx.state && Array.isArray(ctx.state.library)) ? ctx.state.library : [];
    return DEFAULTS.concat(custom, imported).find(function (w) { return w && w.id === id; }) || null;
  }

  function cloneDefaultSets() {
    return [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }];
  }

  function normalizeTemplateSets(sets) {
    if (!Array.isArray(sets) || !sets.length) return cloneDefaultSets();
    return sets.map(function (s) {
      return {
        reps: Math.max(1, Math.round(Number(s && s.reps) || 10)),
        weight: Math.max(0, Number(s && s.weight) || 0)
      };
    });
  }

  function templateExercises(template) {
    if (!template) return [];
    if (Array.isArray(template.exercises) && template.exercises.length) {
      return template.exercises.map(function (item) {
        if (typeof item === "string") {
          return { name: item.trim(), sets: cloneDefaultSets() };
        }
        if (item && typeof item === "object" && String(item.name || "").trim()) {
          return {
            name: String(item.name).trim(),
            sets: normalizeTemplateSets(item.sets),
            defaultRest: Number(item.defaultRest) > 0 ? Number(item.defaultRest) : 90,
            weightMode: item.weightMode || "machine_total",
            muscleGroups: item.muscleGroups && typeof item.muscleGroups === "object" && !Array.isArray(item.muscleGroups) ? item.muscleGroups : {},
            repRange: Array.isArray(item.repRange) && item.repRange.length >= 2 ? item.repRange.slice(0, 2) : null,
            note: String(item.note || "")
          };
        }
        return null;
      }).filter(function (item) { return item && item.name; });
    }
    if (Array.isArray(template.blocks) && template.blocks.length) {
      var title = String(template.title || template.name || "Template").trim();
      return template.blocks.reduce(function (acc, block) {
        if (block && Array.isArray(block.exercises) && block.exercises.length) {
          return acc.concat(block.exercises.map(function (item) {
            return typeof item === "string"
              ? { name: item.trim(), sets: cloneDefaultSets() }
              : (item && item.name ? Object.assign({}, item, { sets: normalizeTemplateSets(item.sets) }) : null);
          }));
        }
        var dayLabel = block && block.day ? String(block.day).trim() : "";
        var focus = block && block.focus ? String(block.focus).trim() : "";
        var label = [title, [dayLabel, focus].filter(Boolean).join(": ")].filter(Boolean).join(" - ");
        acc.push({
          name: label,
          sets: cloneDefaultSets(),
          note: String(template.summary || "")
        });
        return acc;
      }, []).filter(function (item) { return item && item.name; });
    }
    var fallbackName = String(template.name || template.title || "").trim();
    return fallbackName ? [{ name: fallbackName, sets: cloneDefaultSets() }] : [];
  }

  function applyTemplateToDay(ctx, templateId) {
    if (!ctx || !ctx.state) return null;
    var template = instantiateWorkout(ctx, templateId);
    if (!template) return null;
    var dayId = ctx.state.activeDayId;
    if (!dayId) return null;
    var match = (ctx.allDays ? ctx.allDays() : []).find(function (entry) {
      return entry && entry.day && entry.day.id === dayId;
    });
    if (!match && ctx.getDay) {
      var directDay = ctx.getDay(dayId);
      if (directDay) match = { day: directDay };
    }
    if (!match || !match.day) return null;

    var items = templateExercises(template);
    if (!items.length) return null;

    ctx.state.days = ctx.state.days || {};
    var ds = ctx.state.days[dayId] = ctx.state.days[dayId] || {};
    ds.customExercises = Array.isArray(ds.customExercises) ? ds.customExercises : [];
    if (typeof ds.baseExerciseCount !== "number" || !Number.isInteger(ds.baseExerciseCount) || ds.baseExerciseCount < 0) {
      ds.baseExerciseCount = Math.max(0, (match.day.exercises || []).length - ds.customExercises.length);
    }

    var addedAt = Date.now();
    var added = items.map(function (item, idx) {
      var sets = normalizeTemplateSets(item.sets);
      var firstReps = sets[0] ? sets[0].reps : 10;
      var entry = {
        id: "tpl-" + addedAt + "-" + idx + "-" + Math.random().toString(16).slice(2, 8),
        name: item.name,
        target: sets.length + " x " + firstReps,
        sets: sets,
        defaultRest: Number(item.defaultRest) > 0 ? Number(item.defaultRest) : 90,
        custom: true,
        templateId: template.id || templateId,
        muscleGroups: item.muscleGroups || {},
        weightMode: item.weightMode || "machine_total",
        repRange: item.repRange || [Math.max(1, firstReps - 2), firstReps],
        note: item.note || "",
        addedAt: addedAt + idx
      };
      ds.customExercises.push(entry);
      return entry;
    });

    if (ctx.saveState) ctx.saveState("library-apply");
    return {
      template: template,
      dayId: dayId,
      added: added
    };
  }

  root.library = {
    defaultWorkouts: DEFAULTS,
    ensureLibrary: ensureLibrary,
    renderLibrary: renderLibrary,
    addCustomWorkout: addCustomWorkout,
    instantiateWorkout: instantiateWorkout,
    applyTemplateToDay: applyTemplateToDay
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.library;
})();
