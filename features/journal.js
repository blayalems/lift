(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function cardioEntries(state) {
    if (root.cardio && typeof root.cardio.allEntries === "function") return root.cardio.allEntries(state);
    var rows = [];
    Object.keys((state && state.cardio) || {}).forEach(function (date) {
      var row = state.cardio[date];
      var entries = Array.isArray(row) ? row : row && row.entries;
      (Array.isArray(entries) ? entries : []).filter(function (entry) {
        return entry && typeof entry === "object" && !Array.isArray(entry);
      }).forEach(function (entry) { rows.push(Object.assign({ date: date }, entry)); });
    });
    return rows;
  }

  function formatCardioPace(distanceKm, durationSec, paceSec) {
    var sec = paceSec != null ? Number(paceSec) : (Number(distanceKm) > 0 && Number(durationSec) > 0 ? Number(durationSec) / Number(distanceKm) : null);
    if (!(sec >= 0) || sec == null) return "";
    if (root.cardio && typeof root.cardio.formatPace === "function") return root.cardio.formatPace(sec);
    var rounded = Math.round(sec);
    return Math.floor(rounded / 60) + ":" + String(rounded % 60).padStart(2, "0") + "/km";
  }

  function buildJournal(ctx) {
    var items = [];
    var daysState = (ctx.state && ctx.state.days) || {};
    var seenDays = {};
    (ctx.allDays ? ctx.allDays() : []).forEach(function (entry) {
      var day = entry && entry.day;
      if (!day) return;
      seenDays[day.id] = true;
      var ds = daysState[day.id] || {};
      var completedSets = ctx.completedSetCount ? ctx.completedSetCount(day, ctx.state) : 0;
      if (ds.finishedAt && completedSets > 0) {
        items.push({ ts: ds.finishedAt, date: day.id, type: "session", title: "Completed " + day.title, meta: completedSets + " sets | " + ctx.cleanNumber(ctx.kgToDisplay(ctx.completedVolume(day)), 0) + " " + ctx.unitLabel() });
      } else if (ds.status === "reconstructed" && ds.trained !== false) {
        items.push({
          ts: ds.reconstructedAt || ds.finishedAt || new Date(day.id + "T12:00:00Z").getTime(),
          date: day.id,
          type: "reconstructed",
          title: "Trained (reconstructed): " + (ds.workoutType || day.title || "Workout"),
          meta: ds.notes ? "Details unavailable - " + ds.notes : "Trained - details unavailable"
        });
      }
      Object.keys(ds.completed || {}).forEach(function (key) {
        var set = ds.completed[key] || {};
        if (!set.pr || !(Number(set.reps) > 0)) return;
        var ex = (day.exercises || [])[Number(key.split(".")[0])] || {};
        items.push({ ts: set.ts || ds.finishedAt || 0, date: day.id, type: "pr", title: "PR: " + ex.name, meta: ctx.formatWeight(set.weight) + " " + ctx.unitLabel() + " x " + set.reps });
      });
    });
    Object.keys(daysState).forEach(function (date) {
      if (seenDays[date] || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      var ds = daysState[date] || {};
      if (ds.status === "reconstructed" && ds.trained !== false) {
        items.push({
          ts: ds.reconstructedAt || ds.finishedAt || new Date(date + "T12:00:00Z").getTime(),
          date: date,
          type: "reconstructed",
          title: "Trained (reconstructed): " + (ds.workoutType || "Workout"),
          meta: ds.notes ? "Details unavailable - " + ds.notes : "Trained - details unavailable"
        });
      }
    });
    cardioEntries(ctx.state).forEach(function (entry) {
      if (entry.skipped || !(Number(entry.distanceKm) > 0)) return;
      var pace = formatCardioPace(entry.distanceKm, entry.durationSec, entry.paceSecPerKm);
      var metaParts = [entry.distanceKm + " km"];
      if (pace) metaParts.push(pace);
      if (entry.environment) metaParts.push(entry.environment);
      if (entry.rpe) metaParts.push("RPE " + entry.rpe);
      items.push({
        ts: Number(entry.ts) || new Date(entry.date + "T12:00:00Z").getTime(),
        date: entry.date,
        type: "cardio",
        title: "Cardio run",
        meta: metaParts.join(" | ")
      });
    });
    Object.keys((ctx.state && ctx.state.achievements) || {}).forEach(function (id) {
      var a = ctx.state.achievements[id];
      items.push({ ts: a.unlocked || 0, date: a.dayId || "", type: "badge", title: "Badge unlocked", meta: id.replace(/-/g, " ") });
    });
    ((ctx.state && ctx.state.bodyweight) || []).forEach(function (row) {
      items.push({ ts: new Date(row.date + "T00:00:00").getTime(), date: row.date, type: "body", title: "Body weight logged", meta: ctx.formatWeight(row.kg) + " " + ctx.unitLabel() });
    });
    Object.keys((ctx.state && ctx.state.steps) || {}).forEach(function (date) {
      var row = ctx.state.steps[date];
      if (row && row.count) items.push({ ts: row.lastSampleTs || new Date(date + "T00:00:00").getTime(), date: date, type: "steps", title: "Steps logged", meta: row.count + " steps (" + (row.source || "manual") + ")" });
    });
    items.sort(function (a, b) { return b.ts - a.ts; });
    return items;
  }

  function renderJournal(ctx) {
    var items = buildJournal(ctx).slice(0, 80);
    if (!items.length) return '<div class="overview-card"><strong>No journal entries</strong><p>Finish workouts, unlock badges, or log steps to build the feed.</p></div>';
    var html = '<div class="journal-list">';
    items.forEach(function (item) {
      html += '<div class="journal-item"><div class="journal-icon">' + iconFor(ctx, item.type) + '</div><div><div class="journal-title">' + ctx.escapeHtml(item.title) + '</div><div class="journal-meta">' + ctx.escapeHtml(item.date + " - " + item.meta) + '</div></div></div>';
    });
    return html + '</div>';
  }

  function iconFor(ctx, type) {
    if (type === "pr") return ctx.icon("chart");
    if (type === "badge") return ctx.icon("check");
    if (type === "steps") return ctx.icon("today");
    if (type === "cardio") return ctx.icon("shoe");
    return ctx.icon("play");
  }

  root.journal = {
    buildJournal: buildJournal,
    renderJournal: renderJournal
  };
})();
