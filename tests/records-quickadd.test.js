describe("honest personal-record semantics", () => {
  let records;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    records = require("../features/records.js");
  });

  function contextFor(exercise, priorSets, options = {}) {
    const priorDay = { id: "2026-08-01", exercises: [exercise] };
    const currentDay = { id: "2026-08-08", exercises: [exercise] };
    const completed = {};
    priorSets.forEach((set, index) => { completed[`0.${index}`] = set; });
    return {
      state: {
        days: {
          [priorDay.id]: { status: options.status || "completed", completed },
          [currentDay.id]: { status: "planned", completed: {} }
        }
      },
      allDays: () => [{ day: priorDay }, { day: currentDay }]
    };
  }

  test("treats the first verified set as a baseline, not a fake PR", () => {
    const exercise = { name: "Lat Pulldown" };
    const ctx = contextFor(exercise, []);
    expect(records.evaluateSet(ctx, exercise, { weight: 50, reps: 10 }, "2026-08-08", "0.0")).toEqual({
      type: "baseline", types: ["baseline"], isPr: false, reason: "First verified Lift record"
    });
  });

  test("differentiates weight, rep, estimated-1RM, and set-volume records", () => {
    const exercise = { name: "Lat Pulldown" };
    const weight = records.evaluateSet(contextFor(exercise, [{ weight: 50, reps: 10 }]), exercise, { weight: 52.5, reps: 10 }, "2026-08-08", "0.0");
    expect(weight.types).toEqual(expect.arrayContaining(["weight", "estimated1rm", "volume"]));

    const reps = records.evaluateSet(contextFor(exercise, [{ weight: 50, reps: 10 }]), exercise, { weight: 50, reps: 12 }, "2026-08-08", "0.0");
    expect(reps.types).toEqual(expect.arrayContaining(["reps", "estimated1rm", "volume"]));
    expect(records.recordLabel("estimated1rm")).toBe("Estimated 1RM PR");
  });

  test("recognizes less assistance as an assisted-movement record", () => {
    const exercise = { name: "Assisted Dips", loadDirection: "lower" };
    const result = records.evaluateSet(contextFor(exercise, [{ weight: 35, reps: 10 }]), exercise, { weight: 32.5, reps: 10 }, "2026-08-08", "0.0");
    expect(result).toMatchObject({ type: "weight", isPr: true });
    expect(result.types).toEqual(["weight"]);
  });

  test("reconstructed days without sets cannot generate a record", () => {
    const exercise = { name: "Incline DB Press" };
    const ctx = contextFor(exercise, [], { status: "reconstructed" });
    expect(records.evaluateSet(ctx, exercise, { weight: 20, reps: 12 }, "2026-08-08", "0.0")).toMatchObject({ type: "baseline", isPr: false });
    expect(records.scanRecords(ctx)).toEqual([]);
  });

  test("zero-rep incomplete objects are never scanned as records", () => {
    const exercise = { name: "Cable Lateral Raise" };
    const ctx = contextFor(exercise, [{ weight: 7.5, reps: 0 }]);
    expect(records.scanRecords(ctx)).toEqual([]);
  });
});

describe("prominent and durable Quick Add", () => {
  let quickadd;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    quickadd = require("../features/quickadd.js");
  });

  test("offers contextual presets for chest, pull, and leg sessions", () => {
    expect(quickadd.presetsForDay({ type: "chest" }).map((item) => item.name)).toEqual(expect.arrayContaining(["Low-to-High Cable Fly", "Cable Lateral Raise", "Abdominal Machine"]));
    expect(quickadd.presetsForDay({ type: "pull" }).map((item) => item.name)).toEqual(expect.arrayContaining(["One-Arm Cable Pulldown", "Rear Delt Fly", "Hanging Knee Raise"]));
    expect(quickadd.presetsForDay({ type: "legs" }).map((item) => item.name)).toEqual(expect.arrayContaining(["Calf Raise", "Abdominal Machine", "45 Degree Back Extension"]));
  });

  test("persists custom exercise metadata through JSON export", () => {
    const fixedDay = { id: "2026-08-10", type: "chest", exercises: [] };
    const state = { activeDayId: fixedDay.id, days: {} };
    const ctx = {
      state,
      runtime: {
        quickAddDraft: {
          name: "Low-to-High Cable Fly", sets: 2, reps: 12, weight: 12.5, restSec: 60,
          muscleGroup: "upperChest", weightMode: "per_side"
        }
      },
      allDays: () => [{ day: fixedDay }],
      displayToKg: (value) => value,
      saveState: jest.fn(),
      toast: jest.fn()
    };

    expect(quickadd.commit(ctx)).toBe(true);
    const saved = JSON.parse(JSON.stringify(state)).days[fixedDay.id].customExercises[0];
    expect(saved).toMatchObject({ custom: true, name: "Low-to-High Cable Fly", weightMode: "per_side", muscleGroups: { upperChest: 1 }, incrementKg: 2.5, repRange: [10, 12] });
    expect(saved.sets).toHaveLength(2);
    expect(ctx.saveState).toHaveBeenCalled();
  });

  test("safe removal remaps every exercise-indexed state bucket", () => {
    const fixed = [{ name: "Fixed A" }, { name: "Fixed B" }];
    const customA = { name: "Custom A", custom: true };
    const customB = { name: "Custom B", custom: true };
    const dayId = "2026-08-10";
    const state = {
      activeDayId: dayId,
      days: {
        [dayId]: {
          customExercises: [customA, customB],
          completed: { "0.0": { reps: 8 }, "2.0": { reps: 12 }, "3.0": { reps: 15 } },
          drafts: { "3.1": { reps: 14 } },
          extraSets: { "2": 1, "3": 2 },
          exerciseFlags: { "2": { pain: true }, "3": { formIssue: true } },
          adaptiveTargets: { "2": { reason: "A" }, "3": { reason: "B" } }
        }
      }
    };
    const mergedDay = { id: dayId, exercises: fixed.concat([customA, customB]) };
    const ctx = { state, runtime: { lastLog: { dayId, key: "3.0" } }, allDays: () => [{ day: mergedDay }], saveState: jest.fn() };

    expect(quickadd.remove(ctx, dayId, 2)).toBe(true);
    const ds = state.days[dayId];
    expect(ds.customExercises.map((item) => item.name)).toEqual(["Custom B"]);
    expect(ds.completed).toEqual({ "0.0": { reps: 8 }, "2.0": { reps: 15 } });
    expect(ds.drafts).toEqual({ "2.1": { reps: 14 } });
    expect(ds.extraSets).toEqual({ "2": 2 });
    expect(ds.exerciseFlags).toEqual({ "2": { formIssue: true } });
    expect(ds.adaptiveTargets).toEqual({ "2": { reason: "B" } });
    expect(ctx.runtime.lastLog).toBeNull();
    expect(ctx.saveState).toHaveBeenCalled();
  });

  test("refuses to remove a fixed-plan exercise", () => {
    const dayId = "2026-08-10";
    const custom = { name: "Custom", custom: true };
    const state = { days: { [dayId]: { customExercises: [custom] } } };
    const ctx = { state, allDays: () => [{ day: { id: dayId, exercises: [{ name: "Fixed" }, custom] } }] };
    expect(quickadd.remove(ctx, dayId, 0)).toBe(false);
    expect(state.days[dayId].customExercises).toHaveLength(1);
  });
});
