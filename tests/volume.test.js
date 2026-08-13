describe("effective hypertrophy workload", () => {
  let volume;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    volume = require("../features/volume.js");
  });

  test("tracks every required muscle group", () => {
    expect(volume.GROUPS).toEqual(expect.arrayContaining([
      "chest", "upperChest", "lats", "upperBack", "sideDelts", "rearDelts",
      "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "abs", "spinalErectors"
    ]));
    expect(volume.PRIORITY).toEqual(["upperChest", "sideDelts", "lats", "abs", "spinalErectors"]);
  });

  test("classifies compounds fractionally without calling every contribution a full set", () => {
    expect(volume.classifyExercise({ name: "Incline DB Press" })).toMatchObject({ upperChest: 1, chest: 0.5, triceps: 0.35 });
    expect(volume.classifyExercise({ name: "DB Romanian Deadlift" })).toMatchObject({ hamstrings: 1, glutes: 0.75, spinalErectors: 0.5 });
    expect(volume.classifyExercise({ name: "Seated Cable Row" })).toMatchObject({ upperBack: 1, lats: 0.5, biceps: 0.35 });
  });

  test("explicit exercise metadata overrides name inference", () => {
    expect(volume.classifyExercise({ name: "Custom Move", muscleGroups: { sideDelts: 1, upperChest: 0.25 } })).toEqual({ sideDelts: 1, upperChest: 0.25 });
  });

  test("only meaningful hard working sets count", () => {
    expect(volume.isHardSet({ reps: 10, weight: 50, rir: 2 }, {}, "Load")).toBe(true);
    expect(volume.isHardSet({ reps: 0, weight: 50 }, {}, "Load")).toBe(false);
    expect(volume.isHardSet({ reps: 10, warmup: true }, {}, "Load")).toBe(false);
    expect(volume.isHardSet({ reps: 10, hardSet: false }, {}, "Load")).toBe(false);
    expect(volume.isHardSet({ reps: 10, rir: 5 }, {}, "Load")).toBe(false);
  });

  test("counts verified sets and fractional secondary work", () => {
    const day = {
      id: "2026-08-10",
      exercises: [
        { name: "Incline DB Press", muscleGroups: { upperChest: 1, chest: 0.5, triceps: 0.35 } },
        { name: "Cable Lateral Raise", muscleGroups: { sideDelts: 1 } },
        { name: "DB Romanian Deadlift", muscleGroups: { hamstrings: 1, glutes: 0.75, spinalErectors: 0.5 } }
      ]
    };
    const completed = {
      "0.0": { reps: 10, weight: 20 }, "0.1": { reps: 10, weight: 20 },
      "1.0": { reps: 15, weight: 5 }, "1.1": { reps: 15, weight: 5 }, "1.2": { reps: 0, weight: 5 },
      "2.0": { reps: 10, weight: 42.5 }, "2.1": { reps: 10, weight: 42.5 }
    };
    const ctx = {
      state: { days: { [day.id]: { status: "completed", completed } } },
      allDays: () => [{ week: { phase: "Load" }, day }]
    };

    const result = volume.rangeMetrics(ctx, day.id, day.id);
    expect(result).toMatchObject({ upperChest: 2, chest: 1, triceps: 0.7, sideDelts: 2, hamstrings: 2, glutes: 1.5, spinalErectors: 1 });
  });

  test("discounts deload and technique work instead of rewarding junk volume", () => {
    const deloadDay = { id: "2026-08-11", exercises: [{ name: "Cable Lateral Raise", sets: [] }] };
    const techniqueDay = { id: "2026-08-12", exercises: [{ name: "Abdominal Machine", tag: "technique", sets: [] }] };
    const ctx = {
      state: {
        days: {
          [deloadDay.id]: { completed: { "0.0": { reps: 15 }, "0.1": { reps: 15 } } },
          [techniqueDay.id]: { completed: { "0.0": { reps: 12 }, "0.1": { reps: 12 } } }
        }
      },
      allDays: () => [
        { week: { phase: "Deload" }, day: deloadDay },
        { week: { phase: "Load" }, day: techniqueDay }
      ]
    };

    const result = volume.rangeMetrics(ctx, "2026-08-11", "2026-08-12");
    expect(result.sideDelts).toBe(1);
    expect(result.abs).toBe(1);
  });

  test("reconstructed history without sets contributes no workload", () => {
    const day = { id: "2026-08-13", exercises: [{ name: "Lat Pulldown" }] };
    const ctx = {
      state: { days: { [day.id]: { status: "reconstructed", trained: true, completed: {} } } },
      allDays: () => [{ week: { phase: "Load" }, day }]
    };
    expect(volume.rangeMetrics(ctx, day.id, day.id).lats).toBe(0);
  });

  test("reports current, previous, and four-week average independently", () => {
    const exercise = { name: "Cable Lateral Raise" };
    const current = { id: "2026-08-10", exercises: [exercise] };
    const prior = { id: "2026-08-03", exercises: [exercise] };
    const ctx = {
      state: {
        days: {
          [current.id]: { completed: { "0.0": { reps: 15 }, "0.1": { reps: 15 } } },
          [prior.id]: { completed: { "0.0": { reps: 15 }, "0.1": { reps: 15 }, "0.2": { reps: 15 }, "0.3": { reps: 15 } } }
        }
      },
      allDays: () => [{ week: { phase: "Load" }, day: current }, { week: { phase: "Load" }, day: prior }],
      todayId: () => current.id
    };

    const result = volume.weeklyMetrics(ctx, current.id);
    expect(result.current.sideDelts).toBe(2);
    expect(result.last.sideDelts).toBe(4);
    expect(result.average4.sideDelts).toBe(1.5);
  });

  test("flags under-target, on-target, and excessive volumes", () => {
    expect(volume.volumeStatus("upperChest", 4)).toBe("under");
    expect(volume.volumeStatus("upperChest", 9)).toBe("on-target");
    expect(volume.volumeStatus("upperChest", 15)).toBe("high");
  });
});
