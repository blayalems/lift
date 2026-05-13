(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function buildJournal(ctx) {
    var items = [];
    ctx.allDays().forEach(function (entry) {
      var day = entry.day;
      var ds = ctx.state.days[day.id] || {};
      if (ds.finishedAt) {
        items.push({ ts: ds.finishedAt, date: day.id, type: "session", title: "Completed " + day.title, meta: ctx.completedSetCount(day, ctx.state) + " sets | " + ctx.cleanNumber(ctx.kgToDisplay(ctx.completedVolume(day)), 0) + " " + ctx.unitLabel() });
      }
      Object.keys(ds.completed || {}).forEach(function (key) {
        var set = ds.completed[key] || {};
        if (!set.pr) return;
        var ex = (day.exercises || [])[Number(key.split(".")[0])] || {};
        items.push({ ts: set.ts || ds.finishedAt || 0, date: day.id, type: "pr", title: "PR: " + ex.name, meta: ctx.formatWeight(set.weight) + " " + ctx.unitLabel() + " x " + set.reps });
      });
    });
    Object.keys(ctx.state.achievements || {}).forEach(function (id) {
      var a = ctx.state.achievements[id];
      items.push({ ts: a.unlocked || 0, date: a.dayId || "", type: "badge", title: "Badge unlocked", meta: id.replace(/-/g, " ") });
    });
    (ctx.state.bodyweight || []).forEach(function (row) {
      items.push({ ts: new Date(row.date + "T00:00:00").getTime(), date: row.date, type: "body", title: "Body weight logged", meta: ctx.formatWeight(row.kg) + " " + ctx.unitLabel() });
    });
    Object.keys(ctx.state.steps || {}).forEach(function (date) {
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
    return ctx.icon("play");
  }

  root.journal = {
    buildJournal: buildJournal,
    renderJournal: renderJournal
  };
})();
