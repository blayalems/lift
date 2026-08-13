describe("layered local-first persistence", () => {
  let persistence;

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    delete window.LiftAndroid;
    window.LIFT_FEATURES = {};
    persistence = require("../features/persistence.js");
  });

  afterEach(() => {
    jest.useRealTimers();
    delete window.LiftAndroid;
  });

  test("creates self-describing snapshot records with deterministic digests", () => {
    const state = { v: 4, schemaVersion: 4, days: {} };
    const first = persistence.createRecord(state, "unit-test");
    const second = persistence.createRecord(state, "unit-test");
    expect(first).toMatchObject({ reason: "unit-test", schemaVersion: 4, digest: second.digest });
    expect(JSON.parse(first.json)).toEqual(state);
    expect(persistence.digest(first.json)).toBe(first.digest);
  });

  test("falls back to rolling local generations when IndexedDB is unavailable", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-10T00:00:00Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-01": { status: "unknown" } } }, "one");
    expect(persistence.readMeta()).toMatchObject({ count: 1, storage: "local-fallback" });
    jest.setSystemTime(new Date("2026-08-10T00:00:01Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-02": { status: "unknown" } } }, "two");
    jest.setSystemTime(new Date("2026-08-10T00:00:02Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-03": { status: "unknown" } } }, "three");
    jest.setSystemTime(new Date("2026-08-10T00:00:03Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-04": { status: "unknown" } } }, "four");

    const rows = await persistence.listSnapshots();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.reason)).toEqual(["four", "three", "two"]);
    expect(persistence.readMeta()).toMatchObject({ count: 3, storage: "local-fallback" });
  });

  test("skips a corrupt newest generation and recovers the next valid state", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-10T00:00:00Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-01": { status: "completed" } } }, "valid-old");
    jest.setSystemTime(new Date("2026-08-10T00:00:01Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-02": { status: "completed" } } }, "valid-new");
    const newest = JSON.parse(localStorage.getItem("lift.v4.rollback.0"));
    newest.json = "{corrupt";
    localStorage.setItem("lift.v4.rollback.0", JSON.stringify(newest));

    const recovered = await persistence.latestValidSnapshot(false);
    expect(recovered.record.reason).toBe("valid-old");
    expect(recovered.state.days["2026-08-01"].status).toBe("completed");
  });

  test("rejects a parseable snapshot whose integrity digest no longer matches", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-10T00:00:00Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-01": { status: "unknown" } } }, "valid-old");
    jest.setSystemTime(new Date("2026-08-10T00:00:01Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-02": { status: "unknown" } } }, "tampered-new");
    const newest = JSON.parse(localStorage.getItem("lift.v4.rollback.0"));
    newest.json = JSON.stringify({ v: 4, days: { "2026-08-99": { status: "completed" } } });
    localStorage.setItem("lift.v4.rollback.0", JSON.stringify(newest));

    const recovered = await persistence.latestValidSnapshot(false);
    expect(recovered.record.reason).toBe("valid-old");
  });

  test("supports selecting the prior generation for explicit rollback", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-10T00:00:00Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-01": { status: "unknown" } } }, "before");
    jest.setSystemTime(new Date("2026-08-10T00:00:01Z"));
    await persistence.forceSnapshot({ v: 4, days: { "2026-08-01": { status: "missed" } } }, "current");

    const prior = await persistence.latestValidSnapshot(true);
    expect(prior.record.reason).toBe("before");
    expect(prior.state.days["2026-08-01"].status).toBe("unknown");
  });

  test("mirrors every durable snapshot into native app-private storage", async () => {
    window.LiftAndroid = { saveStateMirror: jest.fn(() => true), loadStateMirror: jest.fn(() => "") };
    const state = { v: 4, days: {} };
    await persistence.forceSnapshot(state, "native-mirror");
    expect(window.LiftAndroid.saveStateMirror).toHaveBeenCalledWith(JSON.stringify(state));
    expect(persistence.loadNativeMirror()).toBe("");
  });

  test("explicit reset clears fallback generations, metadata, and the native mirror", async () => {
    window.LiftAndroid = { clearStateMirror: jest.fn(() => true) };
    localStorage.setItem("lift.v4.snapshot.meta", JSON.stringify({ count: 3 }));
    localStorage.setItem("lift.v4.rollback.0", JSON.stringify({ json: "{}" }));
    await persistence.clearAll();
    expect(localStorage.getItem("lift.v4.snapshot.meta")).toBeNull();
    expect(localStorage.getItem("lift.v4.rollback.0")).toBeNull();
    expect(window.LiftAndroid.clearStateMirror).toHaveBeenCalledTimes(1);
  });

  test("classifies backup health from real external-backup age", () => {
    localStorage.setItem("lift.v4.snapshot.meta", JSON.stringify({ count: 4, lastSnapshotAt: 1000, storage: "indexeddb" }));
    const now = Date.parse("2026-08-15T00:00:00Z");
    const sixDaysAgo = now - 6 * 86400000;
    const tenDaysAgo = now - 10 * 86400000;
    const twentyDaysAgo = now - 20 * 86400000;

    expect(persistence.backupHealth({ backup: { lastExternalAt: sixDaysAgo } }, now)).toMatchObject({ status: "protected", snapshotCount: 4, lastSnapshotAt: 1000 });
    expect(persistence.backupHealth({ backup: { lastExternalAt: tenDaysAgo } }, now).status).toBe("needs-backup");
    expect(persistence.backupHealth({ backup: { lastExternalAt: twentyDaysAgo } }, now).status).toBe("overdue");
    expect(persistence.backupHealth({}, now).status).toBe("overdue");
  });
});

describe("portable backup contract", () => {
  test("labels exports as local-only and never claims a cloud sync", () => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    require("../features/persistence.js");
    const cloud = require("../features/cloud.js");
    const portable = cloud.portableState({ state: { v: 4, schemaVersion: 4, days: {} }, appVersion: "1.8.0" });
    expect(portable.exportMeta).toMatchObject({ app: "lift", appVersion: "1.8.0", schemaVersion: 4, localOnly: true });
  });
});
