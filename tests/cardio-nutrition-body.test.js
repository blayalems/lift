describe("cardio, protein, supplements, and recomposition trends", () => {
  let cardio;
  let nutrition;
  let body;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    cardio = require("../features/cardio.js");
    nutrition = require("../features/nutrition.js");
    require("../features/records.js");
    body = require("../features/body.js");
  });

  test("calculates and formats 1 km pace", () => {
    expect(cardio.paceSecPerKm(1, 365)).toBe(365);
    expect(cardio.paceSecPerKm(2, 720)).toBe(360);
    expect(cardio.formatPace(365)).toBe("6:05/km");
    expect(cardio.paceSecPerKm(0, 300)).toBeNull();
  });

  test("logs full cardio details and an honest recovery skip", () => {
    const state = {};
    const run = cardio.addEntry(state, "2026-08-01", {
      distanceKm: 1,
      durationSec: 360,
      environment: "outdoor",
      rpe: 7,
      heartRate: 154,
      notes: "Conversational",
      ts: 10
    });
    const skip = cardio.addEntry(state, "2026-08-02", { skipped: true, skipReason: "Heavy legs", ts: 20 });

    expect(run).toMatchObject({ distanceKm: 1, durationSec: 360, paceSecPerKm: 360, environment: "outdoor", rpe: 7, heartRate: 154 });
    expect(skip).toMatchObject({ skipped: true, distanceKm: 0, durationSec: 0, skipReason: "Heavy legs" });
    expect(cardio.allEntries(state)).toHaveLength(2);
  });

  test("rejects impossible cardio sessions", () => {
    expect(() => cardio.addEntry({}, "2026-08-01", { distanceKm: 0, durationSec: 300 })).toThrow("greater than zero");
    expect(() => cardio.addEntry({}, "2026-08-01", { distanceKm: 1, durationSec: 0 })).toThrow("greater than zero");
  });

  test("shows sustainable pace and recomp direction without demanding PRs", () => {
    const state = {
      bodyweight: [
        { date: "2026-07-15", kg: 68 },
        { date: "2026-08-10", kg: 67 }
      ]
    };
    cardio.addEntry(state, "2026-07-16", { distanceKm: 1, durationSec: 390, rpe: 7, ts: 1 });
    cardio.addEntry(state, "2026-07-23", { distanceKm: 1, durationSec: 380, rpe: 9, ts: 2 });
    cardio.addEntry(state, "2026-08-02", { distanceKm: 1, durationSec: 360, rpe: 7, ts: 3 });
    cardio.addEntry(state, "2026-08-09", { distanceKm: 1, durationSec: 350, rpe: 8, ts: 4 });

    const result = cardio.trends(state, "2026-08-10");
    expect(result).toMatchObject({ sessions4Weeks: 4, frequencyPerWeek: 1, bestSustainablePaceSec: 350, paceChangeSec: -30, bodyWeightChangeKg: -1 });
    expect(result.recompSignal).toContain("improving while body weight trends down");
  });

  test("recommends recovery-first cardio after demanding lower-body work", () => {
    expect(cardio.recommendation({ type: "ham" }, 5).toLowerCase()).toContain("skip");
    expect(cardio.recommendation({ type: "legs" }, 8)).toContain("conversational");
    expect(cardio.recommendation({ type: "pull" }, 8)).toContain("no PR required");
  });

  test("cardio logger exposes a user-selectable skip reason", () => {
    const html = cardio.renderCardio({
      state: { activeDayId: "2026-08-10", days: { "2026-08-10": { readiness: 5 } }, cardio: {} },
      getDay: () => ({ id: "2026-08-10", type: "legs" }),
      escapeHtml: (value) => String(value),
      todayId: () => "2026-08-10"
    });
    expect(html).toContain("data-cardio-skip-reason");
    expect(html).toContain("Leg soreness");
    expect(html).toContain("Log skip");
  });

  test("tracks Filipino-friendly protein foods toward the center target", () => {
    const state = {};
    nutrition.addFood(state, "2026-08-10", nutrition.foodById("egg"), { servings: 2, meal: "breakfast", ts: 1 });
    nutrition.addFood(state, "2026-08-10", nutrition.foodById("chicken-adobo"), { meal: "lunch", ts: 2 });
    nutrition.addFood(state, "2026-08-10", nutrition.foodById("whey"), { meal: "snack", ts: 3 });

    expect(nutrition.FOODS.map((food) => food.id)).toEqual(expect.arrayContaining(["egg", "chicken-adobo", "tuna", "sardines", "bangus", "tilapia", "tokwa", "monggo", "whey"]));
    expect(nutrition.totalProtein(state, "2026-08-10")).toBe(60);
    expect(nutrition.mealDistribution(state, "2026-08-10")).toEqual({ breakfast: 12, lunch: 24, snack: 24 });
  });

  test("surfaces meal distribution as a primary nutrition workflow", () => {
    const state = { profile: { proteinTargetG: 130, proteinRangeMinG: 120, proteinRangeMaxG: 145 } };
    nutrition.addFood(state, "2026-08-10", nutrition.foodById("egg"), { servings: 2, meal: "breakfast" });
    const html = nutrition.renderNutrition({ state, todayId: () => "2026-08-10", escapeHtml: (value) => String(value) });
    expect(html).toContain("Meal distribution");
    expect(html).toContain("Breakfast");
    expect(html).toContain("12 g");
    expect(html).toContain("data-protein-quick-meal");
  });

  test("supports custom food and rejects empty or zero-protein entries", () => {
    const state = {};
    nutrition.addFood(state, "2026-08-10", { id: "custom", name: "Home-cooked ulam", proteinG: 18, serving: "1 bowl" }, { meal: "dinner" });
    expect(nutrition.totalProtein(state, "2026-08-10")).toBe(18);
    expect(() => nutrition.addFood(state, "2026-08-10", { name: "", proteinG: 10 })).toThrow("Choose a food");
    expect(() => nutrition.addFood(state, "2026-08-10", { name: "Unknown", proteinG: 0 })).toThrow("greater than zero");
  });

  test("calculates seven-day average protein without creating empty date buckets", () => {
    const state = { nutrition: {} };
    nutrition.addFood(state, "2026-08-10", { id: "custom", name: "Protein", proteinG: 140, serving: "day" });
    nutrition.addFood(state, "2026-08-09", { id: "custom", name: "Protein", proteinG: 126, serving: "day" });
    expect(nutrition.dailyAverage(state, "2026-08-10", 2)).toBe(133);
    expect(Object.keys(state.nutrition).sort()).toEqual(["2026-08-09", "2026-08-10"]);
  });

  test("stores lightweight supplement check-ins without dose escalation", () => {
    const state = {};
    nutrition.setSupplement(state, "2026-08-10", "creatine", true);
    nutrition.setSupplement(state, "2026-08-10", "magnesium", true);
    nutrition.setSupplement(state, "2026-08-10", "wheyServings", 2);
    nutrition.setCreatineDose(state, 4.5);
    expect(state.supplements["2026-08-10"]).toEqual({ creatine: true, magnesium: true, wheyServings: 2 });
    expect(state.supplementSettings.creatineDoseG).toBe(4.5);
    expect(nutrition.setCreatineDose(state, 100)).toBe(25);
  });

  test("calculates body-weight rolling averages and week-over-week change", () => {
    const state = {
      bodyweight: [
        { date: "2026-08-01", kg: 68 },
        { date: "2026-08-02", kg: 67.8 },
        { date: "2026-08-08", kg: 67.2 },
        { date: "2026-08-09", kg: 67 }
      ]
    };
    expect(body.rollingAverage(state, "2026-08-09", 7)).toBeCloseTo(67.1, 5);
    expect(body.weekOverWeek(state, "2026-08-09")).toBeCloseTo(-0.8, 5);
  });

  test("does not leak a future body-weight entry into an earlier snapshot", () => {
    const state = { bodyweight: [{ date: "2026-08-10", kg: 67 }] };
    expect(body.snapshot(state, "2026-08-01").latestWeightKg).toBeNull();
  });

  test("calculates waist trend and waist-to-height ratio", () => {
    const state = {
      profile: { heightCm: 167, goalMode: "recomposition", goalStatement: "Smaller waist" },
      measurements: [
        { date: "2026-07-15", waist: 88 },
        { date: "2026-08-10", waist: 86.5 }
      ],
      bodyweight: [{ date: "2026-07-15", kg: 68 }, { date: "2026-08-10", kg: 67 }]
    };
    expect(body.measurementTrend(state, "waist", 28, "2026-08-10")).toMatchObject({ latest: 86.5, baseline: 88, change: -1.5 });
    expect(body.waistToHeight(86.5, 167)).toBeCloseTo(0.518, 3);
    expect(body.snapshot(state, "2026-08-10")).toMatchObject({ latestWeightKg: 67, waistCm: 86.5, waistChangeCm: -1.5, goalMode: "recomposition", goalStatement: "Smaller waist" });
    expect(body.waistWeightRelationship(state, "2026-08-10")).toEqual({ waistChangeCm: -1.5, weightChangeKg: -1, waistChangePerKg: 1.5 });
  });

  test("labels key-lift strength retention from verified performance only", () => {
    const exercise = { name: "Incline DB Press" };
    const first = { id: "2026-07-01", exercises: [exercise] };
    const latest = { id: "2026-08-01", exercises: [exercise] };
    const ctx = {
      state: {
        days: {
          [first.id]: { status: "completed", completed: { "0.0": { weight: 20, reps: 10 } } },
          [latest.id]: { status: "completed", completed: { "0.0": { weight: 20, reps: 12 } } }
        }
      },
      allDays: () => [{ day: first }, { day: latest }]
    };
    const result = body.strengthRetention(ctx, "2026-08-10");
    expect(result.changePct).toBe(5);
    expect(result.label).toBe("Maintained / improving");
  });
});
