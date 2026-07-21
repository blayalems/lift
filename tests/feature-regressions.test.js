describe("feature regression fixes", () => {
  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    require("../features/quickadd.js");
    require("../features/calendar.js");
  });

  test("quick-add clamps a bypassed set count to twenty", () => {
    const day = { id: "2026-07-27", exercises: [] };
    const state = { activeDayId: day.id, days: {} };
    const ctx = {
      state,
      runtime: { quickAddDraft: { name: "Machine Chest Press", sets: 23, reps: 8, weight: 23, restSec: 60 } },
      allDays: () => [{ day }],
      displayToKg: (value) => value,
      saveState: jest.fn(),
      toast: jest.fn()
    };

    expect(window.LIFT_FEATURES.quickadd.commit(ctx)).toBe(true);
    expect(state.days[day.id].customExercises[0].sets).toHaveLength(20);
    expect(state.days[day.id].customExercises[0].target).toBe("20 x 8");
  });

  test("quick-add rejects zero-rep exercises", () => {
    const day = { id: "2026-07-27", exercises: [] };
    const ctx = {
      state: { activeDayId: day.id, days: {} },
      runtime: { quickAddDraft: { name: "Invalid", sets: 3, reps: 0, weight: 0, restSec: 60 } },
      allDays: () => [{ day }],
      toast: jest.fn()
    };

    expect(window.LIFT_FEATURES.quickadd.commit(ctx)).toBe(false);
    expect(ctx.toast).toHaveBeenCalledWith("Enter at least 1 rep.");
  });

  test("calendar excludes recovery days and preserves finished partial workouts", () => {
    const workout = { id: "2026-07-27", exercises: [{ sets: [{ reps: 8, weight: 50 }, { reps: 8, weight: 50 }] }] };
    const recovery = { id: "2026-07-29", exercises: [] };
    const state = {
      days: {
        [workout.id]: { finishedAt: 1, completed: { "0.0": { reps: 8, weight: 50 } }, extraSets: {} },
        [recovery.id]: { completed: {}, extraSets: {} }
      }
    };
    const ctx = {
      state,
      allDays: () => [{ day: workout }, { day: recovery }],
      dayStatus: (day) => day.id === workout.id ? "partial" : "rest"
    };
    const calendar = window.LIFT_FEATURES.calendar;

    expect(calendar.statusFor(ctx, workout.id)).toBe("partial");
    expect(calendar.plannedFor(ctx, recovery.id)).toBe(false);
    expect(calendar.statusFor(ctx, recovery.id)).toBe("none");
  });
});
