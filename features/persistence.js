(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var DB_NAME = "lift-durable-v1";
  var STORE = "snapshots";
  var META_KEY = "lift.v4.snapshot.meta";
  var FALLBACK_PREFIX = "lift.v4.rollback.";
  var MAX_SNAPSHOTS = 8;
  var timer = null;
  var pending = null;
  var lastDigest = "";

  function digest(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function readMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || "null") || { count: 0, lastSnapshotAt: null, storage: "pending" };
    } catch (err) {
      return { count: 0, lastSnapshotAt: null, storage: "unavailable" };
    }
  }

  function writeMeta(meta) {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (err) {}
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (typeof window === "undefined" || !window.indexedDB) return reject(new Error("IndexedDB unavailable"));
      var request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB open failed")); };
    });
  }

  function requestPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB request failed")); };
    });
  }

  function createRecord(state, reason) {
    var json = JSON.stringify(state);
    return {
      createdAt: Date.now(),
      reason: reason || "state-change",
      schemaVersion: Number(state && (state.schemaVersion || state.v) || 0),
      digest: digest(json),
      json: json
    };
  }

  function storeFallback(record) {
    try {
      for (var i = 2; i > 0; i -= 1) {
        var previous = localStorage.getItem(FALLBACK_PREFIX + (i - 1));
        if (previous) localStorage.setItem(FALLBACK_PREFIX + i, previous);
      }
      localStorage.setItem(FALLBACK_PREFIX + "0", JSON.stringify(record));
      var count = 0;
      for (var index = 0; index < 3; index += 1) {
        if (localStorage.getItem(FALLBACK_PREFIX + index)) count += 1;
      }
      writeMeta({ count: count, lastSnapshotAt: record.createdAt, storage: "local-fallback", digest: record.digest });
      return true;
    } catch (err) {
      writeMeta({ count: 0, lastSnapshotAt: null, storage: "failed", error: String(err && err.message || err) });
      return false;
    }
  }

  function sortSnapshots(rows) {
    return rows.sort(function (a, b) {
      return (b.createdAt - a.createdAt) || (Number(b.id || 0) - Number(a.id || 0));
    });
  }

  async function prune(db) {
    var tx = db.transaction(STORE, "readwrite");
    var store = tx.objectStore(STORE);
    var all = await requestPromise(store.getAll());
    sortSnapshots(all);
    await Promise.all(all.slice(MAX_SNAPSHOTS).map(function (row) {
      return requestPromise(store.delete(row.id));
    }));
    return Math.min(all.length, MAX_SNAPSHOTS);
  }

  async function forceSnapshot(state, reason) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
    var record = createRecord(state, reason);
    if (record.digest === lastDigest && reason !== "pre-restore") return readMeta();
    lastDigest = record.digest;
    mirrorNative(record.json);
    var db = null;
    try {
      db = await openDb();
      var tx = db.transaction(STORE, "readwrite");
      await requestPromise(tx.objectStore(STORE).add(record));
      var count = await prune(db);
      var meta = { count: count, lastSnapshotAt: record.createdAt, storage: "indexeddb", digest: record.digest };
      writeMeta(meta);
      return meta;
    } catch (err) {
      storeFallback(record);
      return readMeta();
    } finally {
      if (db && typeof db.close === "function") {
        try { db.close(); } catch (ignore) {}
      }
    }
  }

  function scheduleSnapshot(state, reason) {
    pending = { state: state, reason: reason || "state-change" };
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      var job = pending;
      pending = null;
      timer = null;
      if (job) forceSnapshot(job.state, job.reason).catch(function () {});
    }, 700);
  }

  function mirrorNative(json) {
    try {
      if (typeof window !== "undefined" && window.LiftAndroid && typeof window.LiftAndroid.saveStateMirror === "function") {
        return window.LiftAndroid.saveStateMirror(json) !== false;
      }
    } catch (err) {}
    return false;
  }

  function loadNativeMirror() {
    try {
      if (typeof window !== "undefined" && window.LiftAndroid && typeof window.LiftAndroid.loadStateMirror === "function") {
        var raw = window.LiftAndroid.loadStateMirror();
        return raw ? String(raw) : "";
      }
    } catch (err) {}
    return "";
  }

  async function listSnapshots() {
    var db = null;
    try {
      db = await openDb();
      var tx = db.transaction(STORE, "readonly");
      var rows = await requestPromise(tx.objectStore(STORE).getAll());
      return sortSnapshots(rows);
    } catch (err) {
      var fallback = [];
      for (var i = 0; i < 3; i += 1) {
        try {
          var row = JSON.parse(localStorage.getItem(FALLBACK_PREFIX + i) || "null");
          if (row) fallback.push(row);
        } catch (ignore) {}
      }
      return sortSnapshots(fallback);
    } finally {
      if (db && typeof db.close === "function") {
        try { db.close(); } catch (ignore) {}
      }
    }
  }

  async function latestValidSnapshot(skipNewest) {
    var rows = await listSnapshots();
    if (skipNewest) rows = rows.slice(1);
    for (var i = 0; i < rows.length; i += 1) {
      try {
        if (rows[i].digest && digest(String(rows[i].json || "")) !== rows[i].digest) continue;
        var parsed = JSON.parse(rows[i].json);
        var structurallyValid = parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
          parsed.days && typeof parsed.days === "object" && !Array.isArray(parsed.days);
        var validation = root.state && typeof root.state.validateBackup === "function"
          ? root.state.validateBackup(parsed)
          : { valid: structurallyValid };
        if (structurallyValid && validation.valid) {
          return { record: rows[i], state: parsed };
        }
      } catch (err) {}
    }
    return null;
  }

  function deleteSnapshotDatabase() {
    return new Promise(function (resolve, reject) {
      if (typeof window === "undefined" || !window.indexedDB) {
        resolve(false);
        return;
      }
      var request = window.indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = function () { resolve(true); };
      request.onerror = function () { reject(request.error || new Error("IndexedDB reset failed")); };
      request.onblocked = function () { reject(new Error("IndexedDB reset is blocked by another Lift tab")); };
    });
  }

  async function clearAll() {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
    lastDigest = "";
    try {
      localStorage.removeItem(META_KEY);
      for (var i = 0; i < 3; i += 1) localStorage.removeItem(FALLBACK_PREFIX + i);
    } catch (err) {}
    try {
      if (typeof window !== "undefined" && window.LiftAndroid && typeof window.LiftAndroid.clearStateMirror === "function") {
        window.LiftAndroid.clearStateMirror();
      }
    } catch (nativeErr) {}
    return deleteSnapshotDatabase();
  }

  function backupHealth(state, now) {
    var meta = readMeta();
    var external = Number(state && state.backup && state.backup.lastExternalAt || state && state.cloudSync && state.cloudSync.lastBackupAt || 0);
    var age = external ? (Number(now || Date.now()) - external) : Infinity;
    var status = external && age <= 7 * 86400000 ? "protected" : external && age <= 14 * 86400000 ? "needs-backup" : "overdue";
    return {
      status: status,
      lastExternalAt: external || null,
      lastSnapshotAt: meta.lastSnapshotAt || null,
      snapshotCount: Number(meta.count || 0),
      storage: meta.storage || "pending"
    };
  }

  root.persistence = {
    DB_NAME: DB_NAME,
    MAX_SNAPSHOTS: MAX_SNAPSHOTS,
    digest: digest,
    createRecord: createRecord,
    readMeta: readMeta,
    forceSnapshot: forceSnapshot,
    scheduleSnapshot: scheduleSnapshot,
    mirrorNative: mirrorNative,
    loadNativeMirror: loadNativeMirror,
    listSnapshots: listSnapshots,
    latestValidSnapshot: latestValidSnapshot,
    clearAll: clearAll,
    backupHealth: backupHealth
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.persistence;
})();
