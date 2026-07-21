// Body measurements — log waist / arm / chest / thigh / hip / neck, plot trends.
// Persists into state.measurements as an array of records:
//   { date: "YYYY-MM-DD", waist: 0, arm: 0, ... } in CM (canonical).
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  var FIELDS = [
    { key: "waist",    label: "Waist",    icon: "circle" },
    { key: "chest",    label: "Chest",    icon: "circle" },
    { key: "armL",     label: "Arm L",    icon: "arm" },
    { key: "armR",     label: "Arm R",    icon: "arm" },
    { key: "thighL",   label: "Thigh L",  icon: "leg" },
    { key: "thighR",   label: "Thigh R",  icon: "leg" },
    { key: "hip",      label: "Hip",      icon: "circle" },
    { key: "neck",     label: "Neck",     icon: "circle" },
    { key: "calfL",    label: "Calf L",   icon: "leg" },
    { key: "calfR",    label: "Calf R",   icon: "leg" },
    { key: "shoulder", label: "Shoulder", icon: "shoulder" },
    { key: "forearm",  label: "Forearm",  icon: "arm" }
  ];

  function todayId(ctx) {
    if (ctx && typeof ctx.todayId === "function") return ctx.todayId();
    if (ctx && typeof ctx.localDateId === "function") return ctx.localDateId(new Date());
    var d = new Date();
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
  }

  function getRecords(ctx) {
    var s = ctx.state || {};
    if (!Array.isArray(s.measurements)) s.measurements = [];
    return s.measurements;
  }

  function isDateId(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return false;
    var date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
    return date.getUTCFullYear() === +match[1] &&
      date.getUTCMonth() === +match[2] - 1 &&
      date.getUTCDate() === +match[3];
  }

  function monthKey(dateId) {
    return isDateId(dateId) ? String(dateId).slice(0, 7) : "";
  }

  function getPhotoCheckins(ctx) {
    var s = ctx.state || {};
    if (!Array.isArray(s.progressPhotos)) s.progressPhotos = [];
    s.progressPhotos = s.progressPhotos.filter(isDateId).map(String);
    return s.progressPhotos;
  }

  function photoReminderStatus(ctx, dateId) {
    var today = dateId || todayId(ctx);
    var currentMonth = monthKey(today);
    var checkins = getPhotoCheckins(ctx).filter(isDateId).slice().sort();
    var current = checkins.filter(function (date) {
      return monthKey(date) === currentMonth;
    }).pop() || null;
    return {
      due: !!currentMonth && !current,
      today: today,
      month: currentMonth,
      currentDate: current,
      lastDate: checkins.length ? checkins[checkins.length - 1] : null
    };
  }

  function recordPhotoCheckin(ctx, dateStr) {
    var date = dateStr || todayId(ctx);
    if (!isDateId(date)) {
      if (ctx.toast) ctx.toast("Choose a valid progress-photo date.");
      return false;
    }
    var selectedMonth = monthKey(date);
    var next = getPhotoCheckins(ctx).filter(function (entry) {
      return isDateId(entry) && monthKey(entry) !== selectedMonth;
    });
    next.push(date);
    next.sort();
    ctx.state.progressPhotos = next;
    if (ctx.saveState) ctx.saveState();
    if (ctx.toast) ctx.toast("Progress-photo check-in saved.");
    return true;
  }

  function renderPhotoReminderCard(ctx) {
    var status = photoReminderStatus(ctx);
    if (status.due) {
      return '<div class="overview-card progress-photo-card" data-due="true">' +
        '<strong>Monthly progress photos due</strong>' +
        '<p>Take front, side, and back photos with the same lighting, distance, camera height, and time of day.</p>' +
        '<div class="sheet-actions"><button class="action-btn" data-action="photo-checkin" data-date="' +
        ctx.escapeHtml(status.today) + '">Mark photos taken</button></div>' +
        (status.lastDate ? '<p class="section-sub">Last check-in: ' + ctx.escapeHtml(status.lastDate) + '</p>' : '') +
        '</div>';
    }
    return '<div class="overview-card progress-photo-card" data-due="false">' +
      '<strong>Progress photos checked in</strong>' +
      '<p>' + ctx.escapeHtml(status.currentDate || status.today) +
      ' is logged for this month. Keep the original photos outside Lift for side-by-side comparison.</p></div>';
  }

  function unitForLength(ctx) {
    // Length is tracked in cm canonical; flip to inches if units = lb (Imperial bias).
    return (ctx.state && ctx.state.settings && ctx.state.settings.units === "lb") ? "in" : "cm";
  }

  function toDisplay(cm, unit) {
    if (cm == null || cm === "") return "";
    var n = Number(cm);
    if (!isFinite(n)) return "";
    if (unit === "in") return +(n / 2.54).toFixed(1);
    return +n.toFixed(1);
  }
  function fromDisplay(value, unit) {
    var n = Number(value);
    if (!isFinite(n)) return null;
    if (unit === "in") return +(n * 2.54).toFixed(2);
    return +n.toFixed(2);
  }

  function trendFor(records, key) {
    var withVal = records.filter(function (r) { return r[key] != null; })
      .slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (!withVal.length) return null;
    var last = withVal[withVal.length - 1];
    var prev = withVal.length > 1 ? withVal[withVal.length - 2] : null;
    var delta = prev ? +(last[key] - prev[key]).toFixed(2) : 0;
    return { last: last[key], delta: delta, count: withVal.length, lastDate: last.date };
  }

  function renderMeasurements(ctx) {
    var records = getRecords(ctx);
    var unit = unitForLength(ctx);
    var today = todayId(ctx);

    var html = '<div class="sheet-grid">';
    html += renderPhotoReminderCard(ctx);
    html += '<div class="overview-card"><strong>Body measurements</strong><p>Log circumference in ' + unit +
      '. Trends use most recent vs. previous entry.</p></div>';

    // Quick add row.
    html += '<div class="overview-card">' +
      '<strong>Log new entry</strong>' +
      '<div class="field-block" style="margin-top:10px"><label for="m-date">Date</label>' +
      '<input id="m-date" type="date" data-m-date value="' + ctx.escapeHtml(today) + '"></div>';
    FIELDS.forEach(function (f) {
      html += '<div class="measure-input-row" style="margin-top:8px">' +
        '<div class="field-block"><label>' + ctx.escapeHtml(f.label) + ' (' + unit + ')</label>' +
        '<input type="number" step="0.1" min="0" data-m-field="' + ctx.escapeHtml(f.key) + '" placeholder="-"></div>' +
        '<div class="field-block"><label>Note</label>' +
        '<input type="text" data-m-note="' + ctx.escapeHtml(f.key) + '" placeholder="optional"></div>' +
        '<button class="action-btn secondary" data-action="measure-add" data-field="' + ctx.escapeHtml(f.key) + '">Add</button>' +
        '</div>';
    });
    html += '</div>';

    // Trends grid.
    html += '<div class="measure-grid">';
    FIELDS.forEach(function (f) {
      var t = trendFor(records, f.key);
      if (!t) {
        html += '<div class="measure-card"><label>' + ctx.escapeHtml(f.label) + '</label>' +
          '<div class="measure-val"><span style="color:var(--md-on-surface-variant)">-</span><span class="unit">' + unit + '</span></div>' +
          '<div class="measure-delta">No data yet</div></div>';
        return;
      }
      var dispLast = toDisplay(t.last, unit);
      var dispDelta = toDisplay(Math.abs(t.delta), unit);
      var trend = t.delta > 0.05 ? "up" : t.delta < -0.05 ? "down" : "flat";
      var arrow = trend === "up" ? "+" : trend === "down" ? "-" : "~";
      var trendCopy = t.count > 1
        ? arrow + dispDelta + " " + unit + " vs prev"
        : t.count + " entry";
      html += '<div class="measure-card"><label>' + ctx.escapeHtml(f.label) + '</label>' +
        '<div class="measure-val">' + dispLast + '<span class="unit">' + unit + '</span></div>' +
        '<div class="measure-delta" data-trend="' + trend + '">' + trendCopy + '</div></div>';
    });
    html += '</div>';

    // History table.
    if (records.length) {
      html += '<div class="overview-card"><strong>Recent entries</strong>' +
        '<table class="mini-table" style="margin-top:6px"><thead><tr><th>Date</th><th>Field</th><th>Value</th><th></th></tr></thead><tbody>';
      var flat = [];
      records.slice().reverse().forEach(function (r) {
        FIELDS.forEach(function (f) {
          if (r[f.key] != null) flat.push({
            date: r.date,
            key: f.key,
            label: f.label,
            value: r[f.key],
            note: r.notes && r.notes[f.key] ? r.notes[f.key] : ""
          });
        });
      });
      flat.slice(0, 12).forEach(function (entry) {
        html += '<tr><td>' + ctx.escapeHtml(entry.date) + '</td><td>' + ctx.escapeHtml(entry.label) + '</td><td>' +
          toDisplay(entry.value, unit) + ' ' + unit +
          (entry.note ? '<br><small>' + ctx.escapeHtml(entry.note) + '</small>' : '') + '</td>' +
          '<td><button class="link-btn" data-action="measure-delete" data-date="' + ctx.escapeHtml(entry.date) +
          '" data-field="' + ctx.escapeHtml(entry.key) + '">Delete</button></td></tr>';
      });
      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }

  function addEntry(ctx, fieldKey, displayValue, dateStr, note) {
    var unit = unitForLength(ctx);
    var cm = fromDisplay(displayValue, unit);
    if (cm == null || cm <= 0) {
      if (ctx.toast) ctx.toast("Enter a value first.");
      return false;
    }
    var date = dateStr || todayId(ctx);
    if (!isDateId(date)) {
      if (ctx.toast) ctx.toast("Choose a valid measurement date.");
      return false;
    }
    var records = getRecords(ctx);
    var existing = records.find(function (r) { return r.date === date; });
    if (!existing) {
      existing = { date: date };
      records.push(existing);
    }
    existing[fieldKey] = cm;
    if (note != null) {
      var cleanNote = String(note).trim();
      existing.notes = existing.notes && typeof existing.notes === "object" ? existing.notes : {};
      if (cleanNote) existing.notes[fieldKey] = cleanNote;
      else delete existing.notes[fieldKey];
      if (!Object.keys(existing.notes).length) delete existing.notes;
    }
    if (ctx.saveState) ctx.saveState();
    if (ctx.toast) ctx.toast("Logged " + fieldKey + ": " + displayValue + " " + unit);
    return true;
  }

  function deleteEntry(ctx, date, fieldKey) {
    var records = getRecords(ctx);
    var existing = records.find(function (r) { return r.date === date; });
    if (!existing) return;
    delete existing[fieldKey];
    if (existing.notes && typeof existing.notes === "object") {
      delete existing.notes[fieldKey];
      if (!Object.keys(existing.notes).length) delete existing.notes;
    }
    // Drop empty record shells.
    var keys = FIELDS.filter(function (field) { return existing[field.key] != null; });
    if (!keys.length) {
      var idx = records.indexOf(existing);
      if (idx >= 0) records.splice(idx, 1);
    }
    if (ctx.saveState) ctx.saveState();
  }

  root.measurements = {
    FIELDS: FIELDS,
    todayId: todayId,
    monthKey: monthKey,
    getPhotoCheckins: getPhotoCheckins,
    photoReminderStatus: photoReminderStatus,
    recordPhotoCheckin: recordPhotoCheckin,
    renderPhotoReminderCard: renderPhotoReminderCard,
    renderMeasurements: renderMeasurements,
    addEntry: addEntry,
    deleteEntry: deleteEntry
  };
})();
