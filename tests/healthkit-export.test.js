describe("full health export portability", () => {
  let healthkit;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    window.LIFT_APP_VERSION = "1.7.0";
    require("../features/healthkit.js");
    healthkit = window.LIFT_FEATURES.healthkit;
  });

  test("retains existing export fields plus measurement notes and photo check-ins", () => {
    const state = {
      settings: { units: "kg" },
      goals: { weeklySessions: 6 },
      days: { "2026-08-10": { finishedAt: 123 } },
      prs: { "Incline DB Press": { weight: 30, reps: 8 } },
      bodyweight: [{ date: "2026-08-10", kg: 75 }],
      measurements: [{
        date: "2026-08-10",
        waist: 81.2,
        notes: { waist: "Morning, before breakfast" }
      }],
      progressPhotos: ["2026-07-18", "2026-08-10"],
      achievements: { "first-session": { unlocked: 123 } },
      steps: { "2026-08-10": 8123 },
      calories: { "2026-08-10": 420 },
      restingHr: [{ date: "2026-08-10", bpm: 58 }],
      customWorkouts: [{ id: "travel", title: "Travel" }],
      activeWeekId: "w14",
      activeDayId: "2026-08-10"
    };

    const exported = JSON.parse(healthkit.genericJson({ state }));

    expect(exported).toMatchObject({
      app: "lift",
      version: "1.7.0",
      settings: state.settings,
      goals: state.goals,
      days: state.days,
      prs: state.prs,
      bodyweight: state.bodyweight,
      measurements: state.measurements,
      progressPhotos: state.progressPhotos,
      achievements: state.achievements,
      steps: state.steps,
      calories: state.calories,
      restingHr: state.restingHr,
      customWorkouts: state.customWorkouts,
      activeWeekId: state.activeWeekId,
      activeDayId: state.activeDayId
    });
    expect(exported.exportedAt).toEqual(expect.any(String));
  });

  test("always emits portable body-data arrays for older state", () => {
    const exported = JSON.parse(healthkit.genericJson({
      state: {
        settings: {},
        goals: {},
        days: {},
        prs: {},
        bodyweight: [],
        achievements: {}
      }
    }));

    expect(exported.measurements).toEqual([]);
    expect(exported.progressPhotos).toEqual([]);
  });
});
