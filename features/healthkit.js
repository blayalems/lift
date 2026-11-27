// Apple Health / Google Fit / generic manual export.
// Lift can't push into Health/Fit APIs from a WebView, but it can hand the
// user a properly formatted JSON or CSV file they can import via third
// party apps (Health Auto Export, FitnessSyncer, etc.).
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function toIsoDateTime(date) {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date.length === 10 ? date + "T08:00:00Z" : date;
    }
    var d = new Date(date || Date.now());
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) +
      "T" + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds()) + "Z";
  }

  function workoutVolume(day, ds) {
    var completed = ds.completed || {};
    var total = 0;
    Object.keys(completed).forEach(function (key) {
      var set = completed[key] || {};
      total += Number(set.weight || 0) * Number(set.reps || 0);
    });
    return Math.round(total);
  }

  function workoutDuration(ds) {
    if (!ds.startedAt) return 0;
    var end = ds.finishedAt || ds.startedAt;
    return Math.round((end - ds.startedAt) / 1000);
  }

  function resolveVersion(ctx) {
    return (ctx && ctx.appVersion) || window.LIFT_APP_VERSION || "2.0.0";
  }

  function csvCell(value) {
    var text = value == null ? "" : String(value);
    if (/[",\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function appleHealthCsv(ctx) {
    // Health Auto Export compatible workout CSV.
    var lines = ["Start,End,Type,Duration(s),Volume(kg),Notes"];
    (ctx.allDays() || []).forEach(function (entry) {
      var ds = (ctx.state.days && ctx.state.days[entry.day.id]) || {};
      if (!ds.startedAt) return;
      var start = toIsoDateTime(ds.startedAt);
      var end = toIsoDateTime(ds.finishedAt || ds.startedAt);
      var vol = workoutVolume(entry.day, ds);
      var dur = workoutDuration(ds);
      var notes = entry.day.title || "Workout";
      lines.push([start, end, "Strength Training", dur, vol, notes].map(csvCell).join(","));
    });
    return lines.join("\n");
  }

  function googleFitJson(ctx) {
    // Loose Google Fit "ActivitySegment" shape — most third-party importers grok this.
    var sessions = [];
    (ctx.allDays() || []).forEach(function (entry) {
      var ds = (ctx.state.days && ctx.state.days[entry.day.id]) || {};
      if (!ds.startedAt) return;
      sessions.push({
        name: entry.day.title || "Workout",
        startTimeMillis: ds.startedAt,
        endTimeMillis: ds.finishedAt || ds.startedAt,
        activityType: 80, // STRENGTH_TRAINING
        application: { name: "Lift", version: resolveVersion(ctx) },
        description: entry.day.subtitle || "",
        volumeKg: workoutVolume(entry.day, ds)
      });
    });
    return JSON.stringify({ source: "lift", exportedAt: new Date().toISOString(), sessions: sessions }, null, 2);
  }

  function stravaPseudoTcx(ctx) {
    // Strava can't ingest strength TCX natively; this is a simplified manual log.
    var entries = (ctx.allDays() || [])
      .map(function (entry) {
        var ds = (ctx.state.days && ctx.state.days[entry.day.id]) || {};
        if (!ds.startedAt) return null;
        return {
          name: entry.day.title || "Workout",
          start: toIsoDateTime(ds.startedAt),
          end: toIsoDateTime(ds.finishedAt || ds.startedAt),
          durationSec: workoutDuration(ds),
          totalVolumeKg: workoutVolume(entry.day, ds)
        };
      })
      .filter(Boolean);
    return JSON.stringify({
      sport: "WeightTraining",
      source: "Lift",
      version: resolveVersion(ctx),
      entries: entries
    }, null, 2);
  }

  function genericJson(ctx) {
    return JSON.stringify(Object.assign({}, ctx.state || {}, {
      app: "lift",
      version: resolveVersion(ctx),
      exportedAt: new Date().toISOString(),
      measurements: Array.isArray(ctx.state.measurements) ? ctx.state.measurements : [],
      progressPhotos: Array.isArray(ctx.state.progressPhotos) ? ctx.state.progressPhotos : []
    }), null, 2);
  }

  function downloadFile(filename, content, mime) {
    mime = mime || "application/json";
    // If running inside the Android WebView, prefer the native bridge.
    if (window.LIFT_IS_NATIVE && window.LiftAndroid) {
      try {
        if (typeof window.LiftAndroid.saveBackupFile === "function") {
          window.LiftAndroid.saveBackupFile(filename, content);
          return true;
        }
      } catch (err) {}
    }
    try {
      var blob = new Blob([content], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return true;
    } catch (err) {
      return false;
    }
  }

  function exportTarget(ctx, target) {
    var stamp = ctx.todayId ? ctx.todayId() : new Date().toISOString().slice(0, 10);
    if (target === "apple") {
      var ok = downloadFile("lift-apple-health-" + stamp + ".csv", appleHealthCsv(ctx), "text/csv");
      if (ctx.toast) ctx.toast(ok ? "Apple Health CSV exported." : "Export failed.");
    } else if (target === "google") {
      var ok2 = downloadFile("lift-google-fit-" + stamp + ".json", googleFitJson(ctx));
      if (ctx.toast) ctx.toast(ok2 ? "Google Fit JSON exported." : "Export failed.");
    } else if (target === "strava") {
      var ok3 = downloadFile("lift-strava-" + stamp + ".json", stravaPseudoTcx(ctx));
      if (ctx.toast) ctx.toast(ok3 ? "Strava JSON exported." : "Export failed.");
    } else {
      var ok4 = downloadFile("lift-export-" + stamp + ".json", genericJson(ctx));
      if (ctx.toast) ctx.toast(ok4 ? "Full export saved." : "Export failed.");
    }
  }

  function iconOrFallback(ctx, name, fallbackSvg) {
    if (ctx && typeof ctx.icon === "function") return ctx.icon(name);
    return fallbackSvg;
  }

  function renderHealthExport(ctx) {
    var downloadIcon = iconOrFallback(ctx, "download", '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>');
    var appleIcon = iconOrFallback(ctx, "heart", '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>');
    var googleIcon = iconOrFallback(ctx, "rings", '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>');
    var stravaIcon = iconOrFallback(ctx, "chart", '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 3 5-7"/></svg>');
    var jsonIcon = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2"/></svg>';
    var html = '<div class="sheet-grid">';
    html += '<div class="overview-card"><strong>Manual export</strong>' +
      '<p>Direct sync with Apple Health and Google Fit requires their native SDKs — instead, Lift hands you a file in the right shape. Pair with apps like Health Auto Export or FitnessSyncer to import.</p></div>';

    html += '<button class="health-target-row" data-action="health-export" data-target="apple">' +
      '<div class="health-icon" data-target="apple">' + appleIcon + '</div>' +
      '<div class="health-meta"><strong>Apple Health (CSV)</strong><span>Health Auto Export compatible workout log.</span></div>' +
      downloadIcon +
      '</button>';
    html += '<button class="health-target-row" data-action="health-export" data-target="google">' +
      '<div class="health-icon" data-target="google">' + googleIcon + '</div>' +
      '<div class="health-meta"><strong>Google Fit (JSON)</strong><span>ActivitySegment shape for FitnessSyncer and Tasker.</span></div>' +
      downloadIcon +
      '</button>';
    html += '<button class="health-target-row" data-action="health-export" data-target="strava">' +
      '<div class="health-icon" data-target="strava">' + stravaIcon + '</div>' +
      '<div class="health-meta"><strong>Strava manual log</strong><span>Weight training entries you can post-process into activities.</span></div>' +
      downloadIcon +
      '</button>';
    html += '<button class="health-target-row" data-action="health-export" data-target="generic">' +
      '<div class="health-icon" data-target="generic">' + jsonIcon + '</div>' +
      '<div class="health-meta"><strong>Full JSON dump</strong><span>Everything Lift has: settings, days, PRs, body data.</span></div>' +
      downloadIcon +
      '</button>';
    html += '<p class="section-sub">Files land in Downloads. Lift never uploads on its own.</p>';
    html += '</div>';
    return html;
  }

  root.healthkit = {
    appleHealthCsv: appleHealthCsv,
    googleFitJson: googleFitJson,
    stravaPseudoTcx: stravaPseudoTcx,
    genericJson: genericJson,
    exportTarget: exportTarget,
    renderHealthExport: renderHealthExport
  };
})();
