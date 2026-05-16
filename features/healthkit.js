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
      var notes = (entry.day.title || "Workout").replace(/,/g, ";");
      lines.push([start, end, "Strength Training", dur, vol, notes].join(","));
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
        application: { name: "Lift", version: window.LIFT_APP_VERSION || "1.4.0" },
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
      version: window.LIFT_APP_VERSION || "1.4.0",
      entries: entries
    }, null, 2);
  }

  function genericJson(ctx) {
    return JSON.stringify({
      app: "lift",
      version: window.LIFT_APP_VERSION || "1.4.0",
      exportedAt: new Date().toISOString(),
      settings: ctx.state.settings,
      goals: ctx.state.goals,
      days: ctx.state.days,
      prs: ctx.state.prs,
      bodyweight: ctx.state.bodyweight,
      measurements: ctx.state.measurements,
      achievements: ctx.state.achievements
    }, null, 2);
  }

  function downloadFile(filename, content, mime) {
    mime = mime || "application/json";
    // If running inside the Android WebView, prefer the native bridge.
    if (window.LIFT_IS_NATIVE && window.LiftAndroid) {
      try {
        if (mime === "text/csv" && typeof window.LiftAndroid.saveBackupFile === "function") {
          window.LiftAndroid.saveBackupFile(filename, content);
          return true;
        }
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
    var stamp = new Date().toISOString().slice(0, 10);
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

  function renderHealthExport(ctx) {
    var html = '<div class="sheet-grid">';
    html += '<div class="overview-card"><strong>Manual export</strong>' +
      '<p>Direct sync with Apple Health and Google Fit requires their native SDKs — instead, Lift hands you a file in the right shape. Pair with apps like Health Auto Export or FitnessSyncer to import.</p></div>';

    html += '<button class="health-target-row" data-action="health-export" data-target="apple">' +
      '<div class="health-icon" data-target="apple">&#127822;</div>' +
      '<div class="health-meta"><strong>Apple Health (CSV)</strong><span>Health Auto Export compatible workout log.</span></div>' +
      ctx.icon("download") +
      '</button>';
    html += '<button class="health-target-row" data-action="health-export" data-target="google">' +
      '<div class="health-icon" data-target="google">&#9774;</div>' +
      '<div class="health-meta"><strong>Google Fit (JSON)</strong><span>ActivitySegment shape for FitnessSyncer and Tasker.</span></div>' +
      ctx.icon("download") +
      '</button>';
    html += '<button class="health-target-row" data-action="health-export" data-target="strava">' +
      '<div class="health-icon" data-target="strava">&#9881;</div>' +
      '<div class="health-meta"><strong>Strava manual log</strong><span>Weight training entries you can post-process into activities.</span></div>' +
      ctx.icon("download") +
      '</button>';
    html += '<button class="health-target-row" data-action="health-export" data-target="generic">' +
      '<div class="health-icon" data-target="generic">{ }</div>' +
      '<div class="health-meta"><strong>Full JSON dump</strong><span>Everything Lift has: settings, days, PRs, body data.</span></div>' +
      ctx.icon("download") +
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
