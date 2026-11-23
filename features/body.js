(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function dateAdd(dateId, days) {
    var date = new Date(dateId + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function sortedWeights(state) {
    return (state.bodyweight || []).filter(function (row) {
      return row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || "")) && Number(row.kg) > 0;
    }).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  function rollingAverage(state, endDate, days) {
    days = Math.max(1, Number(days) || 7);
    var start = dateAdd(endDate, -(days - 1));
    var rows = sortedWeights(state).filter(function (row) { return row.date >= start && row.date <= endDate; });
    if (!rows.length) return null;
    return rows.reduce(function (sum, row) { return sum + Number(row.kg); }, 0) / rows.length;
  }

  function weekOverWeek(state, endDate) {
    var current = rollingAverage(state, endDate, 7);
    var previous = rollingAverage(state, dateAdd(endDate, -7), 7);
    if (current == null || previous == null) return null;
    return Math.round((current - previous) * 100) / 100;
  }

  function measurementRows(state, key) {
    return (state.measurements || []).filter(function (row) {
      return row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || "")) && Number(row[key]) > 0;
    }).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  function measurementTrend(state, key, lookbackDays, endDate) {
    var rows = measurementRows(state, key);
    if (endDate) rows = rows.filter(function (row) { return row.date <= endDate; });
    if (!rows.length) return null;
    var latest = rows[rows.length - 1];
    var cutoff = dateAdd(latest.date, -(Number(lookbackDays) || 28));
    var baseline = rows.filter(function (row) { return row.date >= cutoff; })[0] || rows[0];
    return {
      latest: Number(latest[key]),
      latestDate: latest.date,
      baseline: Number(baseline[key]),
      baselineDate: baseline.date,
      change: Math.round((Number(latest[key]) - Number(baseline[key])) * 100) / 100
    };
  }

  function waistToHeight(waistCm, heightCm) {
    var waist = Number(waistCm);
    var height = Number(heightCm);
    if (!(waist > 0) || !(height > 0)) return null;
    return waist / height;
  }

  function weightAtOrBefore(state, date) {
    return sortedWeights(state).filter(function (row) { return row.date <= date; }).pop() || null;
  }

  function waistWeightRelationship(state, date) {
    var waist = measurementTrend(state, "waist", 28, date);
    if (!waist || waist.latestDate === waist.baselineDate) return null;
    var currentWeight = weightAtOrBefore(state, waist.latestDate);
    var baselineWeight = weightAtOrBefore(state, waist.baselineDate);
    if (!currentWeight || !baselineWeight) return null;
    var weightChange = Math.round((Number(currentWeight.kg) - Number(baselineWeight.kg)) * 100) / 100;
    return {
      waistChangeCm: waist.change,
      weightChangeKg: weightChange,
      waistChangePerKg: Math.abs(weightChange) < 0.05 ? null : Math.round((waist.change / weightChange) * 100) / 100
    };
  }

  function strengthRetention(ctx, date) {
    var records = root.records;
    if (!records || typeof records.performances !== "function") return null;
    var names = ["Incline DB Press", "Lat Pulldown", "Machine Leg Press"];
    var changes = [];
    names.forEach(function (name) {
      var byDate = {};
      records.performances(ctx, name, date).forEach(function (row) {
        if (records.isAssisted && records.isAssisted(row.exercise)) return;
        byDate[row.date] = Math.max(byDate[row.date] || 0, records.epley(row.set.weight, row.set.reps));
      });
      var sessions = Object.keys(byDate).sort().map(function (sessionDate) { return { date: sessionDate, value: byDate[sessionDate] }; });
      if (sessions.length < 2) return;
      var latest = sessions[sessions.length - 1];
      var baselineCutoff = dateAdd(latest.date, -21);
      var baseline = sessions.filter(function (row) { return row.date <= baselineCutoff; }).pop();
      if (!baseline || !(baseline.value > 0)) return;
      changes.push({ name: name, changePct: (latest.value - baseline.value) / baseline.value * 100 });
    });
    if (!changes.length) return null;
    var average = changes.reduce(function (sum, row) { return sum + row.changePct; }, 0) / changes.length;
    return {
      changePct: Math.round(average * 10) / 10,
      lifts: changes,
      label: average >= 0 ? "Maintained / improving" : average >= -3 ? "Broadly maintained" : "Review recovery"
    };
  }

  function snapshot(state, date) {
    var weights = sortedWeights(state);
    var latestWeight = weights.filter(function (row) { return row.date <= date; }).pop() || null;
    var waist = measurementTrend(state, "waist", 28, date);
    var avg7 = rollingAverage(state, date, 7);
    var weekly = weekOverWeek(state, date);
    var height = Number(state.profile && state.profile.heightCm || 167);
    return {
      latestWeightKg: latestWeight ? Number(latestWeight.kg) : null,
      average7Kg: avg7,
      weeklyChangeKg: weekly,
      waistCm: waist ? waist.latest : null,
      waistChangeCm: waist ? waist.change : null,
      waistToHeight: waist ? waistToHeight(waist.latest, height) : null,
      waistWeightRelationship: waistWeightRelationship(state, date),
      goalMode: state.profile && state.profile.goalMode || "recomposition",
      goalStatement: state.profile && state.profile.goalStatement || "Smaller waist + visible abs while preserving muscle"
    };
  }

  function trendText(value, suffix) {
    if (value == null) return "Not enough data";
    if (Math.abs(value) < 0.01) return "Stable";
    return (value > 0 ? "+" : "") + value.toFixed(1) + suffix;
  }

  function renderDashboard(ctx) {
    var snap = snapshot(ctx.state, ctx.todayId());
    var strength = strengthRetention(ctx, ctx.todayId());
    var profile = ctx.state.profile || {};
    return '<div class="body-recomp-dashboard">' +
      '<div class="overview-card"><strong>Recomposition direction</strong><p>Lose fat gradually while maintaining or gaining muscle and strength. Trends are descriptive, not a medical body-fat estimate.</p></div>' +
      '<div class="metric-grid"><div class="metric-card"><div class="label">7-day weight</div><div class="value">' + (snap.average7Kg == null ? '-' : snap.average7Kg.toFixed(1) + ' kg') + '</div><div class="ring-sub">' + trendText(snap.weeklyChangeKg, ' kg/week') + '</div></div>' +
      '<div class="metric-card"><div class="label">Waist</div><div class="value">' + (snap.waistCm == null ? '-' : snap.waistCm.toFixed(1) + ' cm') + '</div><div class="ring-sub">' + trendText(snap.waistChangeCm, ' cm / 4 wk') + '</div></div>' +
      '<div class="metric-card"><div class="label">Waist / height</div><div class="value">' + (snap.waistToHeight == null ? '-' : snap.waistToHeight.toFixed(2)) + '</div><div class="ring-sub">Trend metric</div></div>' +
      '<div class="metric-card"><div class="label">Key-lift strength</div><div class="value">' + (strength == null ? '-' : (strength.changePct > 0 ? '+' : '') + strength.changePct.toFixed(1) + '%') + '</div><div class="ring-sub">' + (strength ? strength.label : 'Need 3+ weeks of verified sets') + '</div></div></div>' +
      (snap.waistWeightRelationship ? '<div class="overview-card"><strong>Waist relative to scale trend</strong><p>Waist ' + signed(snap.waistWeightRelationship.waistChangeCm, ' cm') + ' while body weight changed ' + signed(snap.waistWeightRelationship.weightChangeKg, ' kg') + '. This is a trend, not a body-fat estimate.</p></div>' : '') +
      '<div class="overview-card"><strong>Goal settings</strong><div class="measure-input-row"><div class="field-block"><label for="profile-height">Height (cm)</label><input id="profile-height" data-profile-height type="number" min="80" max="250" step="0.1" value="' + Number(profile.heightCm || 167) + '"></div><div class="field-block"><label for="profile-goal">Goal mode</label><select id="profile-goal" data-profile-goal><option value="fat_loss"' + selected(profile.goalMode, "fat_loss") + '>Fat loss</option><option value="recomposition"' + selected(profile.goalMode, "recomposition") + '>Recomposition</option><option value="maintenance"' + selected(profile.goalMode, "maintenance") + '>Maintenance</option><option value="muscle_gain"' + selected(profile.goalMode, "muscle_gain") + '>Muscle gain</option></select></div></div><div class="field-block"><label for="profile-statement">Goal statement</label><input id="profile-statement" data-profile-statement value="' + ctx.escapeHtml(snap.goalStatement) + '"></div><div class="sheet-actions"><button class="action-btn" data-action="profile-save">Save goals</button></div></div>' +
      '</div>';
  }

  function selected(current, value) {
    return String(current || "recomposition") === value ? " selected" : "";
  }

  function signed(value, unit) {
    return (Number(value) > 0 ? "+" : "") + Number(value).toFixed(1) + unit;
  }

  root.body = {
    sortedWeights: sortedWeights,
    rollingAverage: rollingAverage,
    weekOverWeek: weekOverWeek,
    measurementTrend: measurementTrend,
    waistToHeight: waistToHeight,
    waistWeightRelationship: waistWeightRelationship,
    strengthRetention: strengthRetention,
    snapshot: snapshot,
    renderDashboard: renderDashboard
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.body;
})();
