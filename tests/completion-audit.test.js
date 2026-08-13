describe("completion-audit integration safeguards", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    window.LIFT_FEATURES = {};
    window.LIFT_PLAN = {
      meta: { timeZone: "Asia/Manila" },
      weeks: [{ id: "w1", num: 1, days: [{ id: "2026-08-10", exercises: [] }] }]
    };
  });

  test("recovery chooses the newest valid layer and uses priority only to break timestamp ties", () => {
    const app = require("../app.js");
    const native = { state: { days: {}, updatedAt: 100 }, source: "native", at: 100, priority: 4 };
    const snapshot = { state: { days: {}, updatedAt: 200 }, source: "snapshot", at: 200, priority: 3 };
    expect(app.chooseRecoveryCandidate([native, snapshot]).source).toBe("snapshot");

    snapshot.at = 100;
    expect(app.chooseRecoveryCandidate([snapshot, native]).source).toBe("native");
    expect(app.stateUpdatedAt({ updatedAt: 50, backup: { lastRestoreAt: 75 } })).toBe(75);
  });

  test("day lookup invalidates its cache when a rolling block replaces the plan weeks array", () => {
    const app = require("../app.js");
    expect(app.getDay("2026-08-10")).not.toBeNull();
    expect(app.getDay("2026-09-28")).toBeNull();

    window.LIFT_PLAN.weeks = [{ id: "rolling-w1", num: 21, generated: true, days: [{ id: "2026-09-28", exercises: [] }] }];
    expect(app.getDay("2026-09-28")).toMatchObject({ id: "2026-09-28" });
    expect(app.getDay("2026-08-10")).toBeNull();
  });
});
