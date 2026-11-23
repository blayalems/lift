(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function renderHeatmap(ctx) {
    var volumeByDate = {};
    var max = 0;
    var ids = [];
    (ctx.allDays ? ctx.allDays() : []).forEach(function (entry) {
      if (!entry || !entry.day || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.day.id || ""))) return;
      var v = ctx.completedVolume ? ctx.completedVolume(entry.day) : 0;
      volumeByDate[entry.day.id] = v;
      max = Math.max(max, v);
      ids.push(entry.day.id);
    });
    ids.sort();
    var firstParts = ids.length ? ids[0].split("-").map(Number) : null;
    var lastParts = ids.length ? ids[ids.length - 1].split("-").map(Number) : null;
    var fallbackYear = Number(String(ctx.todayId ? ctx.todayId() : "2026-01-01").slice(0, 4)) || 2026;
    var startMs = firstParts ? Date.UTC(firstParts[0], firstParts[1] - 1, 1) : Date.UTC(fallbackYear, 0, 1);
    var endMs = lastParts ? Date.UTC(lastParts[0], lastParts[1], 0) : Date.UTC(fallbackYear, 12, 0);
    var html = '<div class="sheet-grid"><div class="overview-card"><strong>Training calendar</strong><p>Cells are tinted by logged volume. Tap a plan day to open it.</p></div><div class="heatmap-wrap"><div class="heatmap">';
    for (var ms = startMs; ms <= endMs; ms += 86400000) {
      var id = new Date(ms).toISOString().slice(0, 10);
      var v = volumeByDate[id] || 0;
      var level = max ? Math.ceil((v / max) * 4) : 0;
      var displayVol = ctx.cleanNumber ? ctx.cleanNumber(ctx.kgToDisplay ? ctx.kgToDisplay(v) : v, 0) : String(Math.round(v));
      var unit = ctx.unitLabel ? ctx.unitLabel() : "kg";
      html += '<button class="heat-cell" data-action="heatmap-day" data-day="' + id + '" data-level="' + level + '" title="' + id + ': ' + displayVol + ' ' + unit + '"></button>';
    }
    html += '</div></div></div>';
    return html;
  }

  root.heatmap = { renderHeatmap: renderHeatmap };
})();
