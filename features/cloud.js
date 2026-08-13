(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function portableState(ctx) {
    var copy = JSON.parse(JSON.stringify(ctx.state));
    copy.exportMeta = {
      app: "lift",
      appVersion: ctx.appVersion || window.LIFT_APP_VERSION || "unknown",
      schemaVersion: Number(copy.schemaVersion || copy.v || 0),
      exportedAt: new Date().toISOString(),
      localOnly: true
    };
    return copy;
  }

  function backupJson(ctx) {
    return JSON.stringify(portableState(ctx), null, 2);
  }

  function backupBlob(ctx) {
    return new Blob([backupJson(ctx)], { type: "application/json" });
  }

  function markExternal(ctx, provider) {
    var now = Date.now();
    ctx.state.backup = Object.assign({}, ctx.state.backup || {}, { lastExternalAt: now });
    ctx.state.cloudSync = Object.assign({}, ctx.state.cloudSync || {}, { lastBackupAt: now, provider: provider });
    if (root.persistence && root.persistence.forceSnapshot) root.persistence.forceSnapshot(ctx.state, "external-backup").catch(function () {});
    if (ctx.saveState) ctx.saveState("external-backup");
  }

  function downloadBackup(ctx) {
    var filename = "lift-backup-" + ctx.todayId() + ".json";
    var json = backupJson(ctx);
    if (window.LIFT_IS_NATIVE && window.LiftAndroid && typeof window.LiftAndroid.saveBackupFile === "function") {
      try {
        var saved = window.LiftAndroid.saveBackupFile(filename, json);
        if (saved !== false) {
          markExternal(ctx, "android-downloads");
          ctx.toast("Backup saved to Android Downloads.");
          return true;
        }
      } catch (err) {}
    }
    try {
      var url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      var link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      markExternal(ctx, "download");
      ctx.toast("Backup downloaded.");
      return true;
    } catch (err2) {
      ctx.toast("Backup failed: " + (err2.message || "download unavailable"));
      return false;
    }
  }

  async function shareBackup(ctx) {
    var filename = "lift-backup-" + ctx.todayId() + ".json";
    var json = backupJson(ctx);
    if (ctx.nativeShareJson && ctx.nativeShareJson(filename, json, "Lift backup")) {
      markExternal(ctx, "android-share");
      ctx.toast("Opening Android share sheet.");
      return true;
    }
    var file = new File([json], filename, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: "Lift backup" });
      markExternal(ctx, "share");
      ctx.toast("Backup shared.");
      return true;
    }
    return downloadBackup(ctx);
  }

  function healthLabel(status) {
    return ({ protected: "Protected", "needs-backup": "Needs backup", overdue: "Backup overdue" })[status] || "Needs backup";
  }

  function formatTime(value) {
    return value ? new Date(value).toLocaleString() : "Never";
  }

  function renderBackup(ctx) {
    var persistence = root.persistence;
    var health = persistence && persistence.backupHealth ? persistence.backupHealth(ctx.state) : { status: "overdue", snapshotCount: 0 };
    var schema = Number(ctx.state.schemaVersion || ctx.state.v || 0);
    return '<div class="sheet-grid">' +
      '<div class="backup-health" data-backup-health="' + health.status + '"><span>Backup health</span><strong>' + healthLabel(health.status) + '</strong><p>Automatic local snapshots protect against corruption. An external JSON or Android system restore is still needed for device loss.</p></div>' +
      '<div class="metric-grid"><div class="metric-card"><div class="label">Local snapshot</div><div class="value">' + formatTime(health.lastSnapshotAt) + '</div></div><div class="metric-card"><div class="label">External backup</div><div class="value">' + formatTime(health.lastExternalAt) + '</div></div><div class="metric-card"><div class="label">Generations</div><div class="value">' + Number(health.snapshotCount || 0) + '</div></div><div class="metric-card"><div class="label">App / schema</div><div class="value">v' + ctx.escapeHtml(ctx.appVersion || "-") + ' / v' + schema + '</div></div></div>' +
      '<div class="overview-card"><strong>Layered, local-first durability</strong><p>Lift keeps localStorage, a redundant IndexedDB mirror, rolling snapshots, and - in the Android wrapper - an app-private canonical mirror eligible for Android Auto Backup where the device and account support it. No Lift cloud server exists and nothing is silently uploaded.</p></div>' +
      '<div class="sheet-actions"><button class="action-btn" data-action="backup-download">' + ctx.icon("download") + 'Back up now</button><button class="action-btn secondary" data-action="backup-share">' + ctx.icon("share") + 'Share backup</button><button class="action-btn secondary" data-action="backup-restore">' + ctx.icon("upload") + 'Restore / merge</button><button class="action-btn secondary" data-action="backup-rollback">' + ctx.icon("refresh") + 'Roll back snapshot</button><button class="action-btn secondary" data-action="check-updates">' + ctx.icon("refresh") + 'Check for updates</button></div>' +
      '<p class="section-sub">External backup reminders become overdue after 14 days. Android Auto Backup is platform-managed and is not guaranteed on every device.</p></div>';
  }

  function restoreFromFile(ctx, file, callback) {
    var reader = new FileReader();
    reader.onload = function () {
      var stateMod = root.state;
      var result = stateMod && stateMod.parseBackupText
        ? stateMod.parseBackupText(String(reader.result || ""))
        : { valid: false, errors: ["State migration module unavailable."] };
      callback(result);
    };
    reader.onerror = function () { callback({ valid: false, errors: ["The backup file could not be read."] }); };
    reader.readAsText(file);
  }

  root.cloud = {
    portableState: portableState,
    backupJson: backupJson,
    backupBlob: backupBlob,
    downloadBackup: downloadBackup,
    shareBackup: shareBackup,
    renderBackup: renderBackup,
    restoreFromFile: restoreFromFile,
    markExternal: markExternal
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.cloud;
})();
