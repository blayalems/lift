// Calendar month view — shows completed/planned/partial workouts for a month.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  function toIso(y, m, d) {
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return y + "-" + pad(m + 1) + "-" + pad(d);
  }

  function buildMonth(year, month) {
    var first = new Date(Date.UTC(year, month, 1));
    var firstDow = (first.getUTCDay() + 6) % 7; // Mon=0
    var lastDate = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    var prevLast = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var cells = [];
    for (var i = firstDow - 1; i >= 0; i -= 1) {
      cells.push({ date: prevLast - i, iso: toIso(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, prevLast - i), other: true });
    }
    for (var d = 1; d <= lastDate; d += 1) {
      cells.push({ date: d, iso: toIso(year, month, d), other: false });
    }
    while (cells.length % 7 !== 0) {
      var next = cells.length - (firstDow + lastDate) + 1;
      cells.push({ date: next, iso: toIso(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, next), other: true });
    }
    return cells;
  }

  function planEntryFor(ctx, iso) {
    if (ctx && typeof ctx.getDay === "function") {
      var direct = ctx.getDay(iso);
      return direct ? { day: direct } : null;
    }
    var days = (ctx.allDays && ctx.allDays()) || [];
    return days.find(function (entry) { return entry.day.id === iso; }) || null;
  }

  function plannedFor(ctx, iso) {
    var entry = planEntryFor(ctx, iso);
    return !!(entry && (entry.day.exercises || []).length);
  }

  function statusFor(ctx, iso) {
    var entry = planEntryFor(ctx, iso);
    var ds = (ctx.state.days && ctx.state.days[iso]) || null;
    if (entry && root.history && typeof root.history.resolveStatus === "function") {
      return root.history.resolveStatus(entry.day, ds, ctx.todayId ? ctx.todayId() : null);
    }
    if (entry && !(entry.day.exercises || []).length) return "rest";
    if (!ds) return entry ? "planned" : "none";
    var hasAny = ds.completed && Object.keys(ds.completed).some(function (key) {
      return Number((ds.completed[key] || {}).reps) > 0;
    });
    if (hasAny || (ds.finishedAt && plannedFor(ctx, iso))) return "completed";
    return plannedFor(ctx, iso) ? "planned" : "none";
  }

  function statusMark(status) {
    return ({ completed: "\u2713", reconstructed: "R", missed: "!", unknown: "?", planned: "\u2022", rest: "\u2013" })[status] || "";
  }

  function statusLabel(status) {
    if (root.history && typeof root.history.statusLabel === "function") return root.history.statusLabel(status);
    return ({ completed: "Verified workout", reconstructed: "Trained - details unavailable", missed: "Missed", unknown: "Unknown", planned: "Planned", rest: "Rest", none: "No planned session" })[status] || status;
  }

  function renderCalendar(ctx) {
    var rt = ctx.runtime || {};
    var today = (ctx.todayId && ctx.todayId()) || (ctx.localDateId && ctx.localDateId(new Date())) || new Date().toISOString().slice(0, 10);
    var parts = today.split("-");
    var year = rt.calYear != null ? rt.calYear : +parts[0];
    var month = rt.calMonth != null ? rt.calMonth : (+parts[1] - 1);
    var cells = buildMonth(year, month);

    var html = '<div class="sheet-grid">';
    html += '<div class="cal-month">' +
      '<div class="cal-head">' +
      '<strong>' + MONTH_NAMES[month] + ' ' + year + '</strong>' +
      '<div class="cal-nav">' +
      '<button class="icon-btn" data-action="cal-prev" aria-label="Previous month">' + ctx.icon("chevron-left") + '</button>' +
      '<button class="icon-btn" data-action="cal-today" aria-label="Today">' + ctx.icon("today") + '</button>' +
      '<button class="icon-btn" data-action="cal-next" aria-label="Next month">' + ctx.icon("chevron-right") + '</button>' +
      '</div></div>' +
      '<div class="cal-dow-row">' +
      DOW.map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join("") +
      '</div>' +
      '<div class="cal-grid">';
    cells.forEach(function (c) {
      var status = statusFor(ctx, c.iso);
      if (status === "none" && plannedFor(ctx, c.iso)) status = "planned";
      var isToday = c.iso === today;
      html += '<button class="cal-cell" data-action="cal-day" data-iso="' + ctx.escapeHtml(c.iso) +
        '" data-status="' + status + '" data-other="' + (c.other ? "true" : "false") + '"' +
        ' aria-label="' + ctx.escapeHtml(c.iso + ", " + statusLabel(status)) + '"' +
        (isToday ? ' data-today="true"' : "") +
        '><span class="cal-date">' + c.date + '</span><span class="cal-status-mark" aria-hidden="true">' + statusMark(status) + '</span></button>';
    });
    html += '</div>' +
      '<div class="cal-legend">' +
      '<span><span class="legend-mark">\u2713</span>Verified</span>' +
      '<span><span class="legend-mark">R</span>Reconstructed</span>' +
      '<span><span class="legend-mark">\u2022</span>Planned</span>' +
      '<span><span class="legend-mark">?</span>Unknown</span>' +
      '<span><span class="legend-mark">!</span>Missed</span>' +
      '<span><span class="legend-mark">\u2013</span>Rest</span>' +
      '<span><span class="dot" style="background:transparent;border:2px solid var(--md-primary)"></span>Today</span>' +
      '</div></div>';

    // Summary metrics for the visible month.
    var counts = { completed: 0, reconstructed: 0, missed: 0, unknown: 0, plannedAhead: 0 };
    cells.forEach(function (c) {
      if (c.other) return;
      var s = statusFor(ctx, c.iso);
      if (s === "completed") counts.completed += 1;
      else if (s === "reconstructed") counts.reconstructed += 1;
      else if (s === "missed") counts.missed += 1;
      else if (s === "unknown") counts.unknown += 1;
      else if (plannedFor(ctx, c.iso)) {
        if (c.iso > today) counts.plannedAhead += 1;
      }
    });
    html += '<div class="metric-grid">' +
      '<div class="metric-card"><div class="label">Verified</div><div class="value">' + counts.completed + '</div></div>' +
      '<div class="metric-card"><div class="label">Reconstructed</div><div class="value">' + counts.reconstructed + '</div></div>' +
      '<div class="metric-card"><div class="label">Unknown</div><div class="value">' + counts.unknown + '</div></div>' +
      '<div class="metric-card"><div class="label">Adherence</div><div class="value">' +
      (counts.completed + counts.reconstructed + counts.missed > 0
        ? Math.round((counts.completed + counts.reconstructed) / Math.max(1, counts.completed + counts.reconstructed + counts.missed) * 100) + "%"
        : "-") +
      '</div></div></div>';

    html += '</div>';
    return html;
  }

  root.calendar = {
    buildMonth: buildMonth,
    plannedFor: plannedFor,
    statusFor: statusFor,
    renderCalendar: renderCalendar
  };
})();
