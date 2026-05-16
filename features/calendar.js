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

  function statusFor(ctx, iso) {
    var ds = (ctx.state.days && ctx.state.days[iso]) || null;
    if (!ds) return "none";
    if (ds.finishedAt) return "done";
    var hasAny = ds.completed && Object.keys(ds.completed).length > 0;
    if (hasAny) return "partial";
    return "planned";
  }

  function plannedFor(ctx, iso) {
    var days = (ctx.allDays && ctx.allDays()) || [];
    return days.some(function (e) { return e.day.id === iso; });
  }

  function renderCalendar(ctx) {
    var rt = ctx.runtime || {};
    var today = (ctx.localDateId && ctx.localDateId(new Date())) || new Date().toISOString().slice(0, 10);
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
        (isToday ? ' data-today="true"' : "") +
        '>' + c.date + '</button>';
    });
    html += '</div>' +
      '<div class="cal-legend">' +
      '<span><span class="dot" style="background:linear-gradient(135deg,var(--md-primary),var(--md-secondary))"></span>Done</span>' +
      '<span><span class="dot" style="background:var(--md-secondary-container)"></span>Partial</span>' +
      '<span><span class="dot" style="background:color-mix(in oklab,var(--md-tertiary) 18%,transparent)"></span>Planned</span>' +
      '<span><span class="dot" style="background:transparent;border:2px solid var(--md-primary)"></span>Today</span>' +
      '</div></div>';

    // Summary metrics for the visible month.
    var counts = { done: 0, partial: 0, planned: 0 };
    cells.forEach(function (c) {
      if (c.other) return;
      var s = statusFor(ctx, c.iso);
      if (s === "done") counts.done += 1;
      else if (s === "partial") counts.partial += 1;
      else if (plannedFor(ctx, c.iso)) counts.planned += 1;
    });
    html += '<div class="metric-grid">' +
      '<div class="metric-card"><div class="label">Completed</div><div class="value">' + counts.done + '</div></div>' +
      '<div class="metric-card"><div class="label">Partial</div><div class="value">' + counts.partial + '</div></div>' +
      '<div class="metric-card"><div class="label">Planned ahead</div><div class="value">' + counts.planned + '</div></div>' +
      '<div class="metric-card"><div class="label">Adherence</div><div class="value">' +
      (counts.planned + counts.done + counts.partial > 0
        ? Math.round((counts.done) / Math.max(1, counts.done + counts.partial + counts.planned) * 100) + "%"
        : "-") +
      '</div></div></div>';

    html += '</div>';
    return html;
  }

  root.calendar = {
    buildMonth: buildMonth,
    statusFor: statusFor,
    renderCalendar: renderCalendar
  };
})();
