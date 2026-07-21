const {
  completedSetCount,
  dayStatus,
  isCompletedSet,
  normalizeState
} = require("../app.js");

describe("state regression fixes", () => {
  test("normalizes the generic full-export shape before replacement restore", () => {
    const restored = normalizeState({
      app: "lift",
      version: "1.4.8",
      settings: { units: "kg" },
      goals: { weeklySessions: 5 },
      days: {},
      prs: {},
      bodyweight: [],
      measurements: [],
      achievements: {}
    });

    expect(restored.v).toBe(3);
    expect(restored.calories).toEqual({});
    expect(restored.steps).toEqual({});
    expect(restored.restingHr).toEqual([]);
    expect(restored.customWorkouts).toEqual([]);
    expect(restored.cloudSync).toEqual({ provider: null, lastBackupAt: null, autoWeekly: false });
  });

  test("migrates the former five-session default exactly once", () => {
    const restored = normalizeState({ settings: {}, days: {}, goals: { weeklySessions: 5 } });
    expect(restored.goals.weeklySessions).toBe(4);
    expect(restored.weeklyGoalPlanVersion).toBe(1);

    restored.goals.weeklySessions = 5;
    expect(normalizeState(restored).goals.weeklySessions).toBe(5);
  });

  test("ignores zero-rep completion objects from the supplied export pattern", () => {
    const day = { id: "2026-06-19", exercises: [{ sets: [{ reps: 8, weight: 23 }, { reps: 8, weight: 23 }] }] };
    const state = {
      days: {
        "2026-06-19": {
          completed: {
            "0.0": { reps: 8, weight: 23 },
            "0.1": { reps: 0, weight: 0 }
          },
          extraSets: {}
        }
      }
    };

    expect(isCompletedSet(state.days[day.id].completed["0.0"])).toBe(true);
    expect(isCompletedSet(state.days[day.id].completed["0.1"])).toBe(false);
    expect(completedSetCount(day, state)).toBe(1);
    expect(dayStatus(day, state)).toBe("partial");
  });
});
