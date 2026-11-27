// 1RM estimator + strength score trends.
// Reuses Epley formula already implemented in features/records.js; this
// surface focuses on a calculator + a richer top-set view.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function epley(weight, reps) {
    var w = Number(weight || 0);
    var r = Number(reps || 0);
    if (w <= 0 || r <= 0) return 0;
    if (r === 1) return w;
    return w * (1 + r / 30);
  }
  function brzycki(weight, reps) {
    var w = Number(weight || 0);
    var r = Number(reps || 0);
    if (w <= 0 || r <= 0 || r >= 36) return 0;
    if (r === 1) return w;
    return w * 36 / (37 - r);
  }
  function lombardi(weight, reps) {
    var w = Number(weight || 0);
    var r = Number(reps || 0);
    if (w <= 0 || r <= 0) return 0;
    if (r === 1) return w;
    return w * Math.pow(r, 0.10);
  }
  function average(weight, reps) {
    var vals = [epley(weight, reps), brzycki(weight, reps), lombardi(weight, reps)].filter(function (v) {
      return v > 0;
    });
    if (!vals.length) return 0;
    return vals.reduce(function (sum, v) { return sum + v; }, 0) / vals.length;
  }

  function pctOf1RM(rm, pct) {
    if (!rm) return 0;
    return rm * pct / 100;
  }

  function calcState(ctx) {
    var calc = (ctx && ctx.runtime && ctx.runtime.strengthCalc) || {};
    var weightDisplay = calc.weight != null ? calc.weight : (ctx && ctx.kgToDisplay ? ctx.kgToDisplay(80) : 80);
    var reps = calc.reps != null ? (calc.reps === "" ? 0 : Number(calc.reps)) : 5;
    var numericWeight = Number(weightDisplay || 0);
    var weightKg = ctx && ctx.displayToKg ? ctx.displayToKg(numericWeight) : numericWeight;
    var unit = ctx && ctx.unitLabel ? ctx.unitLabel() : "kg";
    return {
      weightDisplay: weightDisplay,
      numericWeight: numericWeight,
      reps: Number.isFinite(reps) ? reps : 0,
      weightKg: Number.isFinite(weightKg) ? weightKg : 0,
      unit: unit
    };
  }

  function esc(ctx, value) {
    if (ctx && typeof ctx.escapeHtml === "function") return ctx.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function formatDisplay(ctx, kgValue) {
    var display = ctx && ctx.kgToDisplay ? ctx.kgToDisplay(kgValue) : kgValue;
    return ctx && ctx.cleanNumber ? ctx.cleanNumber(display, 1) : Number(display || 0).toFixed(1);
  }

  function renderOutput(ctx) {
    var s = calcState(ctx);
    var rmEpley = epley(s.weightKg, s.reps);
    var rmAvg = average(s.weightKg, s.reps);
    var unit = esc(ctx, s.unit);
    var topSetWeight = ctx && ctx.cleanNumber ? ctx.cleanNumber(s.numericWeight, 1) : Number(s.numericWeight || 0).toFixed(1);

    var html = '<div class="est-card">' +
      '<div class="est-label">Estimated 1RM</div>' +
      '<div class="est-big">' + esc(ctx, formatDisplay(ctx, rmAvg)) +
      ' <span class="est-unit">' + unit + '</span></div>' +
      '<div class="est-row">' +
      '<div><small>Epley</small><strong>' + formatDisplay(ctx, rmEpley) + ' ' + unit + '</strong></div>' +
      '<div><small>Brzycki</small><strong>' + formatDisplay(ctx, brzycki(s.weightKg, s.reps)) + ' ' + unit + '</strong></div>' +
      '<div><small>Lombardi</small><strong>' + formatDisplay(ctx, lombardi(s.weightKg, s.reps)) + ' ' + unit + '</strong></div>' +
      '<div><small>Top set used</small><strong>' + topSetWeight + ' &times; ' + s.reps + '</strong></div>' +
      '</div></div>';

    var pcts = [60, 65, 70, 75, 80, 85, 90, 95];
    html += '<div class="overview-card"><strong>Working weights</strong>' +
      '<table class="mini-table strength-table"><thead><tr><th>%1RM</th><th>Weight</th><th>Reps target</th></tr></thead><tbody>';
    pcts.forEach(function (p) {
      var wKg = pctOf1RM(rmAvg, p);
      var repTarget = p >= 90 ? "1-3"
        : p >= 80 ? "3-5"
        : p >= 70 ? "5-8"
        : p >= 60 ? "8-12"
        : "12-15";
      html += '<tr><td>' + p + '%</td><td>' + formatDisplay(ctx, wKg) + ' ' + unit + '</td><td>' + repTarget + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderSavedEstimates(ctx) {
    var rows = (ctx && ctx.state && Array.isArray(ctx.state.strengthEstimates)) ? ctx.state.strengthEstimates : [];
    if (!rows.length) return "";
    var unit = esc(ctx, ctx && ctx.unitLabel ? ctx.unitLabel() : "kg");
    var html = '<div class="overview-card"><strong>Saved 1RM estimates</strong><table class="mini-table strength-table"><thead><tr><th>Date</th><th>Set</th><th>Est. 1RM</th></tr></thead><tbody>';
    rows.slice().reverse().slice(0, 10).forEach(function (row) {
      var wText = formatDisplay(ctx, row.weightKg);
      var rmText = formatDisplay(ctx, row.estimated1rmKg);
      html += '<tr><td>' + esc(ctx, row.date || "") + '</td><td>' + wText + ' ' + unit + ' &times; ' + Number(row.reps || 0) + '</td><td><strong>' + rmText + ' ' + unit + '</strong></td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderStrength(ctx) {
    var s = calcState(ctx);
    var unit = esc(ctx, s.unit);

    var html = '<div class="sheet-grid">';
    html += '<div class="overview-card"><strong>1RM estimator</strong>' +
      '<p>Plug in a tough set; we average Epley, Brzycki and Lombardi for a sensible estimate. Use the percentage table to seed working weights.</p></div>';

    html += '<div class="measure-input-row">' +
      '<div class="field-block"><label for="rm-w">Weight (' + unit + ')</label>' +
      '<input id="rm-w" type="number" step="0.5" min="0" data-action="rm-input" data-field="weight" value="' + esc(ctx, s.weightDisplay) + '"></div>' +
      '<div class="field-block"><label for="rm-r">Reps</label>' +
      '<input id="rm-r" type="number" step="1" min="1" max="100" data-action="rm-input" data-field="reps" value="' + esc(ctx, s.reps) + '"></div>' +
      '<button class="action-btn" data-action="rm-save">Save</button>' +
      '</div>';

    html += '<div class="sheet-grid" data-rm-output>' + renderOutput(ctx) + '</div>';

    var saved = renderSavedEstimates(ctx);
    if (saved) html += saved;

    // Trend across logged sessions.
    var trend = strengthTrend(ctx);
    if (trend) html += trend;

    html += '</div>';
    return html;
  }

  function isAssistedExercise(ex) {
    return !!(ex && ex.loadDirection === "lower") || /\bassisted\b/i.test(ex && ex.name || "");
  }

  function strengthTrend(ctx) {
    var allDays = (ctx.allDays && ctx.allDays()) || [];
    var rows = {};
    allDays.forEach(function (entry) {
      var day = entry.day;
      var ds = (ctx.state.days && ctx.state.days[day.id]) || {};
      var completed = ds.completed || {};
      (day.exercises || []).forEach(function (ex, exIndex) {
        if (!ex || isAssistedExercise(ex)) return;
        var best = 0;
        Object.keys(completed).forEach(function (key) {
          if (key.split(".")[0] !== String(exIndex)) return;
          var set = completed[key] || {};
          if (!(Number(set.reps) > 0)) return;
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
      var unit = esc(ctx, ctx && ctx.unitLabel ? ctx.unitLabel() : "kg");
      html += '<div class="strength-trend-item"><div class="strength-trend-head">' +
        '<span>' + esc(ctx, n) + '</span>' +
        '<span class="measure-delta" data-trend="' + trend + '">' + (delta >= 0 ? "+" : "") + delta + ' ' + unit + '</span>' +
        '</div>' +
        '<svg class="strength-sparkline" viewBox="0 0 320 100" aria-hidden="true"><polyline class="strength-sparkline-line" points="' + pts + '" fill="none" stroke="var(--md-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
    });
    html += '</div>';
    return html;
  }

  root.strength = {
    epley: epley,
    brzycki: brzycki,
    lombardi: lombardi,
    average: average,
    renderOutput: renderOutput,
    renderStrength: renderStrength
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.strength;
})();
