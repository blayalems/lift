describe("streak and weekly focus metrics", () => {
  let streaks;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    require("../features/streaks.js");
    streaks = window.LIFT_FEATURES.streaks;
  });

  test("counts only finished sessions with valid reps toward weekly progress and history", () => {
    const days = [
      { id: "2026-08-10", exercises: [{ name: "Incline DB Press" }] },
      { id: "2026-08-11", exercises: [{ name: "Lat Pulldown" }] },
      { id: "2026-08-12", exercises: [{ name: "Cable Lateral Raises" }] }
    ];
    const ctx = {
      state: {
        goals: { weeklySessions: 6 },
        days: {
          "2026-08-10": { completed: { "0.0": { reps: 8, weight: 30 } } },
          "2026-08-11": { finishedAt: 1, completed: { "0.0": { reps: 10, weight: 50 } } },
          "2026-08-12": { finishedAt: 1, completed: { "0.0": { reps: 0, weight: 0 } } }
        }
      },
      allDays: () => days.map((day) => ({ day })),
      localDateId: () => "2026-08-12",
      dayStatus: () => "done"
    };

    expect(streaks.weekProgress(ctx)).toEqual({ count: 1, goal: 6, ratio: 1 / 6 });
    expect(streaks.weeklyHistory(ctx, 1)).toEqual([{ weekStart: "2026-08-10", sessions: 1 }]);
    expect(streaks.streakCount(ctx)).toBe(2);
  });

  test("keeps the prior Mon-Sat streak through Sunday rest and an unstarted Monday", () => {
    const days = [];
    const state = { goals: { weeklySessions: 6 }, days: {} };
    for (let dom = 10; dom <= 15; dom += 1) {
      const id = `2026-08-${dom}`;
      days.push({ id, exercises: [{ name: "Training" }] });
      state.days[id] = { completed: { "0.0": { reps: 8, weight: 20 } } };
    }
    days.push({ id: "2026-08-16", exercises: [] });
    days.push({ id: "2026-08-17", exercises: [{ name: "Training" }] });
    const localDateId = jest.fn(() => "2026-08-18");
    const ctx = {
      state,
      allDays: () => days.map((day) => ({ day })),
      todayId: () => "2026-08-17",
      localDateId
    };

    expect(streaks.streakCount(ctx)).toBe(6);
    expect(streaks.weekProgress(ctx)).toEqual({ count: 0, goal: 6, ratio: 0 });
    expect(streaks.weeklyHistory(ctx, 1)[0].weekStart).toBe("2026-08-17");
    expect(localDateId).not.toHaveBeenCalled();

    state.days["2026-08-17"] = { completed: { "0.0": { reps: 5, weight: 20 } } };
    expect(streaks.streakCount(ctx)).toBe(7);

    delete state.days["2026-08-14"];
    expect(streaks.streakCount(ctx)).toBe(2);
  });

  test("classifies stable exercise names without treating leg curls as arm work", () => {
    expect(streaks.classifyExerciseName("Primer: Incline DB Press")).toEqual(["upperChest"]);
    expect(streaks.classifyExerciseName("High Cable Row / Face Pull")).toEqual(["back", "rearDelts"]);
    expect(streaks.classifyExerciseName("Cable Lateral Raises")).toEqual(["sideDelts"]);
    expect(streaks.classifyExerciseName("Incline DB Curls")).toEqual(["arms"]);
    expect(streaks.classifyExerciseName("Tricep Pushdowns")).toEqual(["arms"]);
    expect(streaks.classifyExerciseName("Lying Leg Curls")).toEqual([]);
  });

  test("reports valid completed sets and reps for each weekly focus area", () => {
    const monday = {
      id: "2026-08-10",
      exercises: [
        { name: "Primer: Incline DB Press" },
        { name: "High Cable Row / Face Pull" },
        { name: "Cable Lateral Raises" },
        { name: "DB Bicep Curls" },
        { name: "Lying Leg Curls" }
      ]
    };
    const tuesday = {
      id: "2026-08-11",
      exercises: [
        { name: "One-Arm Cable Pulldown" },
        { name: "Primer: Rear Delt Cable Fly" },
        { name: "Tricep Pushdowns" },
        { name: "Machine Chest Press" }
      ]
    };
    const ctx = {
      state: {
        days: {
          [monday.id]: {
            completed: {
              "0.0": { reps: 8, weight: 30 },
              "0.1": { reps: 0, weight: 30 },
              "1.0": { reps: 12, weight: 45 },
              "2.0": { reps: 15, weight: 10 },
              "3.0": { reps: 10, weight: 20 },
              "4.0": { reps: 12, weight: 45 }
            }
          },
          [tuesday.id]: {
            completed: {
              "0.0": { reps: 10, weight: 25 },
              "1.0": { reps: 12, weight: 10 },
              "2.0": { reps: 10, weight: 30 },
              "3.0": { reps: 10, weight: 35 }
            }
          }
        }
      },
      allDays: () => [{ day: monday }, { day: tuesday }],
      localDateId: () => "2026-08-12"
    };

    const focus = streaks.weeklyFocus(ctx);
    expect(focus.upperChest).toMatchObject({ sets: 1, reps: 8 });
    expect(focus.back).toMatchObject({ sets: 2, reps: 22 });
    expect(focus.sideDelts).toMatchObject({ sets: 1, reps: 15 });
    expect(focus.rearDelts).toMatchObject({ sets: 2, reps: 24 });
    expect(focus.arms).toMatchObject({ sets: 2, reps: 20 });

    const html = streaks.renderWeeklyFocus(ctx);
    expect(html).toContain("This week's focus");
    expect(html).toContain("Upper chest");
    expect(html).toContain("Lats / back");
    expect(html).toContain("Rear delts");
  });
});
