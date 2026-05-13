(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function renderHeatmap(ctx) {
    var volumeByDate = {};
    var max = 0;
    ctx.allDays().forEach(function (entry) {
      var v = ctx.completedVolume(entry.day);
      volumeByDate[entry.day.id] = v;
      max = Math.max(max, v);
    });
    var start = new Date(2026, 0, 1);
    var end = new Date(2026, 11, 31);
    var html = '<div class="sheet-grid"><div class="overview-card"><strong>Training calendar</strong><p>Cells are tinted by logged volume. Tap a plan day to open it.</p></div><div class="heatmap-wrap"><div class="heatmap">';
    for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      var id = ctx.localDateId(d);
      var v = volumeByDate[id] || 0;
      var level = max ? Math.ceil((v / max) * 4) : 0;
      html += '<button class="heat-cell" data-action="heatmap-day" data-day="' + id + '" data-level="' + level + '" title="' + id + ': ' + ctx.cleanNumber(ctx.kgToDisplay(v), 0) + ' ' + ctx.unitLabel() + '"></button>';
    }
    html += '</div></div></div>';
    return html;
  }

  root.heatmap = { renderHeatmap: renderHeatmap };
})();
