(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function backupBlob(ctx) {
    return new Blob([JSON.stringify(ctx.state, null, 2)], { type: "application/json" });
  }

  function downloadBackup(ctx) {
    var url = URL.createObjectURL(backupBlob(ctx));
    var a = document.createElement("a");
    a.href = url;
    a.download = "lift-backup-" + ctx.todayId() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
    ctx.state.cloudSync = Object.assign({}, ctx.state.cloudSync || {}, { lastBackupAt: Date.now(), provider: "download" });
    if (ctx.saveState) ctx.saveState();
    ctx.toast("Backup downloaded.");
  }

  async function shareBackup(ctx) {
    var file = new File([backupBlob(ctx)], "lift-backup-" + ctx.todayId() + ".json", { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: "Lift backup" });
      ctx.state.cloudSync = Object.assign({}, ctx.state.cloudSync || {}, { lastBackupAt: Date.now(), provider: "share" });
      if (ctx.saveState) ctx.saveState();
      ctx.toast("Backup shared.");
    } else {
      downloadBackup(ctx);
    }
  }

  function renderBackup(ctx) {
    var sync = ctx.state.cloudSync || {};
    return '<div class="sheet-grid"><div class="overview-card"><strong>Optional cloud export</strong><p>Google Drive and Dropbox uploads require OAuth client IDs. This offline build provides the safe portable path now: download JSON or use the system share sheet to save to Files, Drive, or Dropbox.</p></div><div class="metric-grid"><div class="metric-card"><div class="label">Last backup</div><div class="value">' + (sync.lastBackupAt ? new Date(sync.lastBackupAt).toLocaleDateString() : "Never") + '</div></div><div class="metric-card"><div class="label">Provider</div><div class="value">' + ctx.escapeHtml(sync.provider || "local") + '</div></div></div><div class="sheet-actions"><button class="action-btn" data-action="backup-download">' + ctx.icon("download") + 'Download JSON</button><button class="action-btn secondary" data-action="backup-share">' + ctx.icon("share") + 'Share backup</button><button class="action-btn secondary" data-action="backup-restore">' + ctx.icon("upload") + 'Restore file</button></div></div>';
  }

  function restoreFromFile(ctx, file, callback) {
    var reader = new FileReader();
    reader.onload = function () {
      callback(JSON.parse(String(reader.result || "{}")));
    };
    reader.readAsText(file);
  }

  root.cloud = {
    renderBackup: renderBackup,
    backupBlob: backupBlob,
    downloadBackup: downloadBackup,
    shareBackup: shareBackup,
    restoreFromFile: restoreFromFile
  };
})();
