(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function paceSecPerKm(distanceKm, durationSec) {
    var distance = Number(distanceKm);
    var duration = Number(durationSec);
    if (!(distance > 0) || !(duration > 0)) return null;
    return duration / distance;
  }

  function formatPace(seconds) {
    if (!(seconds >= 0)) return "-";
    var rounded = Math.round(seconds);
    return Math.floor(rounded / 60) + ":" + String(rounded % 60).padStart(2, "0") + "/km";
  }

  function bucket(state, date) {
    state.cardio = state.cardio && typeof state.cardio === "object" ? state.cardio : {};
    var row = state.cardio[date];
    if (Array.isArray(row)) row = { entries: row };
    row = row && typeof row === "object" ? row : { entries: [] };
    row.entries = Array.isArray(row.entries) ? row.entries : [];
    state.cardio[date] = row;
    return row;
  }

  function addEntry(state, date, input) {
    input = input || {};
    var skipped = !!input.skipped;
    var distance = skipped ? 0 : Number(input.distanceKm);
    var duration = skipped ? 0 : Math.round(Number(input.durationSec));
    if (!skipped && (!(distance > 0) || !(duration > 0))) throw new Error("Distance and duration must be greater than zero.");
    var entry = {
      id: input.id || "cardio-" + Date.now() + "-" + Math.random().toString(16).slice(2),
      type: input.type || "run",
      context: input.context || "post-workout",
      distanceKm: distance,
      durationSec: duration,
      paceSecPerKm: skipped ? null : paceSecPerKm(distance, duration),
      environment: input.environment === "outdoor" ? "outdoor" : "treadmill",
      rpe: input.rpe == null ? null : Math.max(1, Math.min(10, Number(input.rpe) || 1)),
      heartRate: input.heartRate ? Math.max(30, Math.min(240, Math.round(Number(input.heartRate)))) : null,
      skipped: skipped,
      skipReason: skipped ? String(input.skipReason || "Recovery") : null,
      notes: String(input.notes || "").trim(),
      ts: Number(input.ts || Date.now())
    };
    bucket(state, date).entries.push(entry);
    return entry;
  }

  function allEntries(state) {
    var rows = [];
    Object.keys(state.cardio || {}).forEach(function (date) {
      var row = state.cardio[date];
      var entries = Array.isArray(row) ? row : row && row.entries;
      (Array.isArray(entries) ? entries : []).filter(function (entry) {
        return entry && typeof entry === "object" && !Array.isArray(entry);
      }).forEach(function (entry) { rows.push(Object.assign({ date: date }, entry)); });
    });
    return rows.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || Number(a.ts || 0) - Number(b.ts || 0); });
  }

  function trends(state, referenceDate) {
    var cutoff = new Date((referenceDate || "9999-12-31") + "T23:59:59Z");
    cutoff.setUTCDate(cutoff.getUTCDate() - 27);
    var start = cutoff.toISOString().slice(0, 10);
    var entries = allEntries(state).filter(function (entry) {
      return !entry.skipped && entry.distanceKm > 0 && entry.date >= start && entry.date <= (referenceDate || "9999-12-31");
    });
    var oneKm = entries.filter(function (entry) { return Math.abs(Number(entry.distanceKm) - 1) <= 0.1; });
    var avg = oneKm.length ? oneKm.reduce(function (sum, entry) { return sum + paceSecPerKm(entry.distanceKm, entry.durationSec); }, 0) / oneKm.length : null;
    var sustainable = oneKm.filter(function (entry) { return entry.rpe == null || Number(entry.rpe) <= 8; });
    var best = sustainable.length ? Math.min.apply(null, sustainable.map(function (entry) { return paceSecPerKm(entry.distanceKm, entry.durationSec); })) : null;
    var totalKm = entries.reduce(function (sum, entry) { return sum + Number(entry.distanceKm || 0); }, 0);
    var paceChange = null;
    if (oneKm.length >= 2) {
      var split = Math.ceil(oneKm.length / 2);
      var early = oneKm.slice(0, split);
      var recent = oneKm.slice(split);
      if (recent.length) {
        var mean = function (rows) { return rows.reduce(function (sum, entry) { return sum + paceSecPerKm(entry.distanceKm, entry.durationSec); }, 0) / rows.length; };
        paceChange = Math.round(mean(recent) - mean(early));
      }
    }
    var weights = (state.bodyweight || []).filter(function (row) {
      return row && row.date >= start && row.date <= (referenceDate || "9999-12-31") && Number(row.kg) > 0;
    }).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var weightChange = weights.length >= 2 ? Math.round((Number(weights[weights.length - 1].kg) - Number(weights[0].kg)) * 10) / 10 : null;
    var recompSignal = "Log more sessions to compare pace and body-weight direction.";
    if (paceChange != null && weightChange != null) {
      if (paceChange < 0 && weightChange < 0) recompSignal = "Sustainable pace is improving while body weight trends down.";
      else if (paceChange <= 0) recompSignal = "Pace is stable or improving; keep the run sustainable.";
      else recompSignal = "Pace has slowed recently; recovery matters more than forcing a post-lift PR.";
    }
    return { average1kPaceSec: avg, bestSustainablePaceSec: best, sessions4Weeks: entries.length, frequencyPerWeek: entries.length / 4, totalKm: Math.round(totalKm * 10) / 10, paceChangeSec: paceChange, bodyWeightChangeKg: weightChange, recompSignal: recompSignal };
  }

  function recommendation(day, readiness) {
    var type = String(day && day.type || "");
    if ((type === "legs" || type === "ham") && Number(readiness || 10) < 7) {
      return "Recovery option: easy walk or relaxed 1 km; skip the run if leg mechanics feel compromised.";
    }
    if (type === "legs" || type === "ham") return "Keep the 1 km conversational after legs; consistency matters more than pace.";
    return "Optional 1 km post-workout run at a sustainable effort - no PR required.";
  }

  function renderCardio(ctx) {
    var date = ctx.state.activeDayId || ctx.todayId();
    var day = ctx.getDay && ctx.getDay(ctx.state.activeDayId);
    var ds = (ctx.state.days || {})[ctx.state.activeDayId] || {};
    var summary = trends(ctx.state, date);
    var recent = allEntries(ctx.state).slice(-8).reverse();
    var html = '<div class="sheet-grid"><div class="overview-card"><strong>Post-workout cardio</strong><p>' + ctx.escapeHtml(recommendation(day, ds.readiness)) + '</p></div>';
    html += '<div class="metric-grid"><div class="metric-card"><div class="label">Avg 1 km</div><div class="value">' + formatPace(summary.average1kPaceSec) + '</div></div><div class="metric-card"><div class="label">Sustainable best</div><div class="value">' + formatPace(summary.bestSustainablePaceSec) + '</div></div><div class="metric-card"><div class="label">Frequency</div><div class="value">' + summary.frequencyPerWeek.toFixed(1) + '/wk</div></div><div class="metric-card"><div class="label">Pace direction</div><div class="value">' + (summary.paceChangeSec == null ? '-' : (summary.paceChangeSec > 0 ? '+' : '') + summary.paceChangeSec + 's') + '</div></div></div>';
    html += '<div class="overview-card"><strong>Recomp signal</strong><p>' + ctx.escapeHtml(summary.recompSignal) + '</p></div>';
    html += '<div class="overview-card"><strong>Log 1 km post-workout run</strong><div class="measure-input-row"><div class="field-block"><label>Distance (km)</label><input data-cardio-distance type="number" min="0.1" step="0.1" value="1"></div><div class="field-block"><label>Minutes</label><input data-cardio-min type="number" min="0" step="1" value="6"></div><div class="field-block"><label>Seconds</label><input data-cardio-sec type="number" min="0" max="59" step="1" value="0"></div></div>';
    html += '<div class="measure-input-row"><div class="field-block"><label>Where</label><select data-cardio-environment><option value="treadmill">Treadmill</option><option value="outdoor">Outdoor</option></select></div><div class="field-block"><label>RPE</label><input data-cardio-rpe type="number" min="1" max="10" step="1" value="6"></div><div class="field-block"><label>Heart rate (optional)</label><input data-cardio-hr type="number" min="30" max="240"></div></div>';
    html += '<div class="field-block"><label>Notes</label><input data-cardio-notes placeholder="Easy, conversational pace"></div><div class="field-block"><label>Skip reason</label><select data-cardio-skip-reason><option value="Recovery">Recovery</option><option value="Leg soreness">Leg soreness</option><option value="Time">Time</option><option value="Weather or equipment">Weather or equipment</option><option value="Other">Other</option></select></div><div class="sheet-actions"><button class="action-btn" data-action="cardio-log-1k">Log run</button><button class="action-btn secondary" data-action="cardio-skip">Log skip</button></div></div>';
    if (recent.length) {
      html += '<div class="overview-card"><strong>Recent</strong><table class="mini-table"><thead><tr><th>Date</th><th>Result</th><th>RPE</th></tr></thead><tbody>';
      recent.forEach(function (entry) {
        html += '<tr><td>' + ctx.escapeHtml(entry.date) + '</td><td>' + (entry.skipped ? 'Skipped: ' + ctx.escapeHtml(entry.skipReason || "Recovery") : entry.distanceKm + ' km - ' + formatPace(entry.paceSecPerKm)) + '</td><td>' + (entry.rpe || '-') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    return html + '</div>';
  }

  root.cardio = {
    paceSecPerKm: paceSecPerKm,
    formatPace: formatPace,
    addEntry: addEntry,
    allEntries: allEntries,
    trends: trends,
    recommendation: recommendation,
    renderCardio: renderCardio
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.cardio;
})();
