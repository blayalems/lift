describe("offline adaptive progression engine", () => {
  let progression;
  let base;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    progression = require("../features/progression.js");
    base = {
      exercise: { name: "Lat Pulldown", repRange: [10, 12], incrementKg: 2.5 },
      plannedSets: [
        { reps: 10, weight: 50 },
        { reps: 10, weight: 50 },
        { reps: 10, weight: 50 }
      ]
    };
  });

  const session = (reps, rir = 2, weight = 50, extra = {}) => ({
    date: "2026-08-01",
    sets: reps.map((value, index) => ({ reps: value, weight, ...(index === reps.length - 1 ? { rir } : {}) })),
    ...extra
  });

  test("uses the static plan only when no verified history exists", () => {
    expect(progression.suggest(base)).toMatchObject({ action: "baseline", weight: 50, reps: 10, sets: 3, basedOn: null });
  });

  test("adds the smallest load after top reps with 1-2 RIR", () => {
    const result = progression.suggest({ ...base, history: [session([12, 12, 12], 2)] });
    expect(result).toMatchObject({ action: "increase", weight: 52.5, reps: 10, sets: 3 });
    expect(result.reason).toContain("12/12/12 completed with 2 RIR");
  });

  test("holds load when top reps were a zero-RIR grind", () => {
    const result = progression.suggest({ ...base, history: [session([12, 12, 12], 0)] });
    expect(result).toMatchObject({ action: "hold", weight: 50, reps: 12 });
    expect(result.reason).toContain("0 RIR");
  });

  test("reduces slightly after multiple sets miss the minimum", () => {
    const result = progression.suggest({ ...base, history: [session([10, 8, 7], 0)] });
    expect(result).toMatchObject({ action: "reduce", weight: 47.5, reps: 10 });
    expect(result.reason).toContain("10/8/7");
  });

  test("holds after one missed set instead of blindly progressing", () => {
    expect(progression.suggest({ ...base, history: [session([10, 10, 9], 1)] })).toMatchObject({ action: "hold", weight: 50 });
  });

  test("keeps a beaten programmed load instead of regressing", () => {
    const result = progression.suggest({ ...base, history: [session([10, 10, 10], 2, 60)] });
    expect(result).toMatchObject({ action: "add-rep", weight: 60, reps: 11 });
  });

  test("trims one set when readiness is poor", () => {
    const result = progression.suggest({ ...base, history: [session([11, 11, 11], 2)], readiness: 5 });
    expect(result).toMatchObject({ action: "reduced-volume", weight: 50, sets: 2 });
  });

  test("pain and form warnings block progression", () => {
    expect(progression.suggest({ ...base, history: [session([12, 12, 12], 2, 50, { pain: true })] })).toMatchObject({ action: "pain-hold", sets: 2 });
    expect(progression.suggest({ ...base, history: [session([12, 12, 12], 2, 50, { formIssue: true })] })).toMatchObject({ action: "form-hold", weight: 50 });
  });

  test("deload deliberately overrides recent high performance", () => {
    const result = progression.suggest({ ...base, history: [session([12, 12, 12], 2, 60)], deload: true });
    expect(result).toMatchObject({ action: "deload", weight: 50, reps: 10 });
  });

  test("less assistance is progression on assisted movements", () => {
    const result = progression.suggest({
      exercise: { name: "Assisted Dips", loadDirection: "lower", repRange: [8, 10], incrementKg: 2.5 },
      plannedSets: [{ reps: 8, weight: 35 }, { reps: 8, weight: 35 }],
      history: [{ date: "2026-08-01", sets: [{ reps: 10, weight: 35 }, { reps: 10, weight: 35, rir: 2 }] }]
    });
    expect(result).toMatchObject({ action: "increase", weight: 32.5, reps: 8 });
    expect(result.reason).toContain("less assistance");
  });

  test("exercise-specific increments stay conservative", () => {
    expect(progression.incrementFor({ name: "Cable Lateral Raise" }, 2.5)).toBe(1);
    expect(progression.incrementFor({ name: "Incline DB Press" }, 2.5)).toBe(2);
    expect(progression.incrementFor({ name: "Leg Press", incrementKg: 5 }, 2.5)).toBe(5);
  });

  test("recovery and high-volume safeguards prevent junk progression", () => {
    expect(progression.suggest({ ...base, history: [session([12, 12, 12])], recoveryHours: 24 })).toMatchObject({ action: "recovery-hold", sets: 2 });
    expect(progression.suggest({ ...base, history: [session([12, 12, 12])], recentVolumeHigh: "Lats" })).toMatchObject({ action: "volume-hold", sets: 2 });
  });

  test("history lookup ignores reconstructed sessions without verified sets", () => {
    const exercise = { name: "Lat Pulldown", sets: base.plannedSets };
    const ctx = {
      state: {
        days: {
          "2026-07-01": { status: "reconstructed", completed: {} },
          "2026-07-08": { status: "completed", completed: { "0.0": { reps: 10, weight: 50, rir: 2 } }, exerciseFlags: { "0": { pain: true } } }
        }
      },
      allDays: () => [
        { day: { id: "2026-07-01", exercises: [exercise] } },
        { day: { id: "2026-07-08", exercises: [exercise] } }
      ]
    };

    expect(progression.historyForExercise(ctx, "Lat Pulldown", "2026-08-01")).toEqual([
      expect.objectContaining({ date: "2026-07-08", sets: [expect.objectContaining({ reps: 10 })], flags: { pain: true } })
    ]);
  });

  test("reentry phase returns planned ramp load without overriding from prior peak", () => {
    const result = progression.suggest({
      dayId: "2026-11-23",
      exercise: { name: "Machine Leg Press", repRange: [8, 10], incrementKg: 2.5 },
      plannedSets: [{ reps: 10, weight: 75 }, { reps: 10, weight: 75 }],
      history: [{ date: "2026-08-10", sets: [{ reps: 10, weight: 100 }, { reps: 10, weight: 100 }, { reps: 10, weight: 100 }] }],
      reentry: true
    });
    expect(result).toMatchObject({ action: "reentry", weight: 75, reps: 10, sets: 2 });
    expect(result.reason).toContain("Reentry ramp");
  });

  test("detraining safeguard resets to planned ramp load when gap is 21+ days", () => {
    const result = progression.suggest({
      dayId: "2026-11-30",
      exercise: { name: "Machine Leg Press", repRange: [8, 10], incrementKg: 2.5 },
      plannedSets: [{ reps: 10, weight: 85 }, { reps: 10, weight: 85 }, { reps: 10, weight: 85 }],
      history: [{ date: "2026-08-17", sets: [{ reps: 10, weight: 100 }, { reps: 10, weight: 100 }] }]
    });
    expect(result).toMatchObject({ action: "reentry", weight: 85, reps: 10, sets: 3 });
    expect(result.reason).toContain("Returning after 105 days off");

    const normal = progression.suggest({
      dayId: "2026-08-15",
      exercise: { name: "Lat Pulldown", repRange: [10, 12], incrementKg: 2.5 },
      plannedSets: [{ reps: 10, weight: 50 }, { reps: 10, weight: 50 }, { reps: 10, weight: 50 }],
      history: [{ date: "2026-08-01", sets: [{ reps: 12, weight: 50 }, { reps: 12, weight: 50 }, { reps: 12, weight: 50, rir: 2 }] }]
    });
    expect(normal).toMatchObject({ action: "increase", weight: 52.5, reps: 10 });
  });

  test("forExercise resolves the day's own week phase even when activeWeekId differs", () => {
    const legPress = { name: "Machine Leg Press", repRange: [8, 10], incrementKg: 2.5, sets: [{ reps: 10, weight: 75 }, { reps: 10, weight: 75 }] };
    const priorDay = { id: "2026-08-10", exercises: [{ name: "Machine Leg Press", sets: [{ reps: 10, weight: 100 }] }] };
    const reentryDay = { id: "2026-11-23", exercises: [legPress] };
    const reentryWeek = { id: "w21", phase: "Reentry", days: [reentryDay] };
    const normalWeek = { id: "w14", phase: "Load +", days: [priorDay] };
    const ctx = {
      state: {
        activeWeekId: "w14",
        settings: { weightStep: 2.5 },
        days: {
          "2026-08-10": { status: "completed", completed: { "0.0": { reps: 10, weight: 100 } } }
        }
      },
      allDays: () => [{ week: normalWeek, day: priorDay }, { week: reentryWeek, day: reentryDay }],
      getWeek: (id) => id === "w21" ? reentryWeek : normalWeek
    };

    const result = progression.forExercise(ctx, reentryDay, legPress, 0);
    expect(result).toMatchObject({ action: "reentry", weight: 75, reps: 10, sets: 2 });
  });
});
