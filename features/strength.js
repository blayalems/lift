// 1RM estimator + strength score trends.
// Reuses Epley formula already implemented in features/records.js; this
// surface focuses on a calculator + a richer top-set view.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function epley(weight, reps) { return Number(weight || 0) * (1 + Number(reps || 0) / 30); }
  function brzycki(weight, reps) {
    reps = Number(reps || 0);
    if (reps >= 36 || reps <= 0) return 0;
    return Number(weight || 0) * 36 / (37 - reps);
  }
  function lombardi(weight, reps) { return Number(weight || 0) * Math.pow(Number(reps || 1), 0.10); }
  function average(weight, reps) {
    return (epley(weight, reps) + brzycki(weight, reps) + lombardi(weight, reps)) / 3;
  }

  function pctOf1RM(rm, pct) {
    if (!rm) return 0;
    return rm * pct / 100;
  }

  function renderStrength(ctx) {
    var calc = ctx.runtime && ctx.runtime.strengthCalc || {};
    var weightDisplay = calc.weight != null ? calc.weight : (ctx.kgToDisplay ? ctx.kgToDisplay(80) : 80);
    var reps = calc.reps || 5;
    var weightKg = ctx.displayToKg ? ctx.displayToKg(weightDisplay) : Number(weightDisplay);
    var unit = ctx.unitLabel ? ctx.unitLabel() : "kg";

    var rmEpley = epley(weightKg, reps);
    var rmAvg = average(weightKg, reps);

    var html = '<div class="sheet-grid">';
    html += '<div class="overview-card"><strong>1RM estimator</strong>' +
      '<p>Plug in a tough set; we average Epley, Brzycki and Lombardi for a sensible estimate. Use the percentage table to seed working weights.</p></div>';

    html += '<div class="measure-input-row">' +
      '<div class="field-block"><label for="rm-w">Weight (' + unit + ')</label>' +
      '<input id="rm-w" type="number" step="0.5" min="0" data-action="rm-input" data-field="weight" value="' + ctx.escapeHtml(weightDisplay) + '"></div>' +
      '<div class="field-block"><label for="rm-r">Reps</label>' +
      '<input id="rm-r" type="number" step="1" min="1" max="20" data-action="rm-input" data-field="reps" value="' + ctx.escapeHtml(reps) + '"></div>' +
      '<button class="action-btn" data-action="rm-save">Save</button>' +
      '</div>';

    html += '<div class="est-card">' +
      '<div class="est-label">Estimated 1RM</div>' +
      '<div class="est-big">' + ctx.escapeHtml(ctx.cleanNumber ? ctx.cleanNumber(ctx.kgToDisplay(rmAvg), 1) : rmAvg.toFixed(1)) +
      ' <span style="font-size:18px;letter-spacing:.04em;text-transform:uppercase;font-variation-settings:\'wght\' 700">' + ctx.escapeHtml(unit) + '</span></div>' +
      '<div class="est-row">' +
      '<div><small>Epley</small><strong>' + ctx.cleanNumber(ctx.kgToDisplay(rmEpley), 1) + ' ' + unit + '</strong></div>' +
      '<div><small>Brzycki</small><strong>' + ctx.cleanNumber(ctx.kgToDisplay(brzycki(weightKg, reps)), 1) + ' ' + unit + '</strong></div>' +
      '<div><small>Lombardi</small><strong>' + ctx.cleanNumber(ctx.kgToDisplay(lombardi(weightKg, reps)), 1) + ' ' + unit + '</strong></div>' +
      '<div><small>Top set used</small><strong>' + ctx.cleanNumber(weightDisplay, 1) + ' &times; ' + reps + '</strong></div>' +
      '</div></div>';

    // Percentage table — common training intensities.
    var pcts = [60, 65, 70, 75, 80, 85, 90, 95];
    html += '<div class="overview-card"><strong>Working weights</strong>' +
      '<table class="mini-table" style="margin-top:6px"><thead><tr><th>%1RM</th><th>Weight</th><th>Reps target</th></tr></thead><tbody>';
    pcts.forEach(function (p) {
      var wKg = pctOf1RM(rmAvg, p);
      var repTarget = p >= 90 ? "1-3"
        : p >= 80 ? "3-5"
        : p >= 70 ? "5-8"
        : p >= 60 ? "8-12"
        : "12-15";
      html += '<tr><td>' + p + '%</td><td>' + ctx.cleanNumber(ctx.kgToDisplay(wKg), 1) + ' ' + unit + '</td><td>' + repTarget + '</td></tr>';
    });
    html += '</tbody></table></div>';

    // Trend across logged sessions.
    var trend = strengthTrend(ctx);
    if (trend) html += trend;

    html += '</div>';
    return html;
  }

  function strengthTrend(ctx) {
    var allDays = (ctx.allDays && ctx.allDays()) || [];
    var rows = {};
    allDays.forEach(function (entry) {
      var day = entry.day;
      var ds = (ctx.state.days && ctx.state.days[day.id]) || {};
      var completed = ds.completed || {};
      (day.exercises || []).forEach(function (ex, exIndex) {
        var best = 0;
        Object.keys(completed).forEach(function (key) {
          if (key.split(".")[0] !== String(exIndex)) return;
          var set = completed[key] || {};
          best = Math.max(best, epley(set.weight, set.reps));
        });
        if (best) {
          if (!rows[ex.name]) rows[ex.name] = [];
          rows[ex.name].push({ date: day.id, value: best });
        }
      });
    });
    var names = Object.keys(rows).filter(function (n) { return rows[n].length >= 2; }).slice(0, 5);
    if (!names.length) return null;
    var html = '<div class="overview-card"><strong>Estimated 1RM trend</strong>';
    names.forEach(function (n) {
      var series = rows[n].sort(function (a, b) { return a.date.localeCompare(b.date); });
      var vals = series.map(function (r) { return ctx.kgToDisplay(r.value); });
      var mn = Math.min.apply(null, vals);
      var mx = Math.max.apply(null, vals);
      var range = Math.max(1, mx - mn);
      var pts = vals.map(function (v, i) {
        var x = (i / Math.max(1, vals.length - 1)) * 280 + 20;
        var y = 90 - ((v - mn) / range) * 70;
        return x + "," + y;
      }).join(" ");
      var first = vals[0], last = vals[vals.length - 1];
      var delta = +(last - first).toFixed(1);
      var trend = delta > 0.1 ? "up" : delta < -0.1 ? "down" : "flat";
      html += '<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;font-size:13px;font-variation-settings:\'wght\' 600">' +
        '<span>' + ctx.escapeHtml(n) + '</span>' +
        '<span class="measure-delta" data-trend="' + trend + '">' + (delta >= 0 ? "+" : "") + delta + ' ' + ctx.unitLabel() + '</span>' +
        '</div>' +
        '<svg viewBox="0 0 320 100" style="width:100%;height:80px"><polyline points="' + pts + '" fill="none" stroke="var(--md-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
    });
    html += '</div>';
    return html;
  }

  root.strength = {
    epley: epley,
    brzycki: brzycki,
    lombardi: lombardi,
    average: average,
    renderStrength: renderStrength
  };
})();
