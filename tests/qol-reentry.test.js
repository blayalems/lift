const fs = require("node:fs");
const path = require("node:path");

describe("v1.9 QoL gym reentry features", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    localStorage.clear();
    document.body.innerHTML = `
      <div id="app"></div>
      <div id="toast-root"></div>
      <div id="sheet" data-open="false"></div>
      <div id="sheet-backdrop" data-open="false"></div>
      <div id="summary-overlay" data-open="false"></div>
    `;
    window.LIFT_FEATURES = {};
    delete window.LIFT_PLAN;
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  function loadAppWithPlan(weeks, storedState) {
    window.LIFT_PLAN = {
      meta: {
        athlete: "Lem",
        title: "Gym Reentry",
        dateRange: "May 12, 2026-January 31, 2027",
        timeZone: "Asia/Manila"
      },
      weeks
    };
    if (storedState) {
      localStorage.setItem("lift.v3.state", JSON.stringify(storedState));
    }
    require("../features/state.js");
    require("../features/progression.js");
    require("../features/reentry.js");
    require("../features/cardio.js");
    require("../features/library.js");
    return require("../app.js");
  }

  test("daysSinceLastWorkout finds verified and reconstructed sessions and ignores zero-rep shells", () => {
    const reentry = require("../features/reentry.js");
    const ctx = {
      allDays: () => [
        { day: { id: "2026-08-10" } },
        { day: { id: "2026-08-22" } },
        { day: { id: "2026-09-01" } },
        { day: { id: "2026-11-23" } }
      ],
      state: {
        days: {
          "2026-08-10": { status: "reconstructed", trained: true },
          "2026-08-22": { status: "completed", completed: { "0.0": { reps: 10, weight: 75 } } },
          "2026-09-01": { status: "unknown", completed: { "0.0": { reps: 0, weight: 0 } } },
          "2026-10-05": { status: "reconstructed", trained: true },
          "2026-11-23": { status: "completed", completed: { "0.0": { reps: 10, weight: 75 } } }
        }
      }
    };

    expect(reentry.daysSinceLastWorkout(ctx, "2026-11-23")).toEqual({
      days: 49,
      lastDate: "2026-10-05"
    });

    delete ctx.state.days["2026-10-05"];
    expect(reentry.daysSinceLastWorkout(ctx, "2026-11-23")).toEqual({
      days: 93,
      lastDate: "2026-08-22"
    });

    expect(reentry.daysSinceLastWorkout({ allDays: () => [], state: { days: {} } }, "2026-11-23")).toBeNull();
  });

  test("shouldShowBanner and renderBanner respect reentry phase, 14+ day gap, null gap, and dismissal", () => {
    const reentry = require("../features/reentry.js");
    const weeks = {
      w14: { id: "w14", num: 14, phase: "Load +", days: [{ id: "2026-08-10" }] },
      w21: { id: "w21", num: 21, phase: "Reentry", days: [{ id: "2026-11-23" }] },
      w22: { id: "w22", num: 22, phase: "Consolidate", days: [{ id: "2026-11-30" }] }
    };
    const makeCtx = (overrides = {}) => Object.assign({
      state: {
        activeWeekId: "w21",
        activeDayId: "2026-11-23",
        reentryDismissedWeekId: null,
        days: {}
      },
      allDays: () => [
        { week: weeks.w14, day: weeks.w14.days[0] },
        { week: weeks.w21, day: weeks.w21.days[0] },
        { week: weeks.w22, day: weeks.w22.days[0] }
      ],
      getWeek: (id) => weeks[id],
      todayId: () => "2026-11-23",
      escapeHtml: (v) => String(v == null ? "" : v)
    }, overrides);

    // Fresh boot in Reentry week (gap === null) shows banner cleanly without "null days".
    const freshCtx = makeCtx();
    expect(reentry.shouldShowBanner(freshCtx)).toBe(true);
    const freshHtml = reentry.renderBanner(freshCtx);
    expect(freshHtml).toContain('<section class="reentry-banner"');
    expect(freshHtml).toContain("Reentry Week");
    expect(freshHtml).not.toContain("null");
    expect(freshHtml).toContain('data-action="reentry-start"');
    expect(freshHtml).toContain('data-action="open-sheet" data-sheet="measurements"');
    expect(freshHtml).toContain('data-action="reentry-dismiss"');

    // 14+ day gap triggers banner even outside reentry phase.
    const gapCtx = makeCtx({
      state: {
        activeWeekId: "w22",
        activeDayId: "2026-11-30",
        reentryDismissedWeekId: null,
        days: { "2026-08-22": { completed: { "0.0": { reps: 10, weight: 75 } } } }
      }
    });
    expect(reentry.shouldShowBanner(gapCtx)).toBe(true);
    expect(reentry.renderBanner(gapCtx)).toContain("Welcome back after 100 days");
    expect(reentry.renderBanner(gapCtx)).toContain("2026-08-22");

    // Dismissing hides it for that week only.
    gapCtx.state.reentryDismissedWeekId = "w22";
    expect(reentry.shouldShowBanner(gapCtx)).toBe(false);

    // Recent session (<14 days) in non-reentry phase hides banner.
    const recentCtx = makeCtx({
      state: {
        activeWeekId: "w22",
        activeDayId: "2026-11-30",
        reentryDismissedWeekId: null,
        days: { "2026-11-28": { completed: { "0.0": { reps: 10, weight: 80 } } } }
      }
    });
    expect(reentry.shouldShowBanner(recentCtx)).toBe(false);
  });

  test("dumbbellPerHandText formats total dumbbell weights and skips non-total or non-DB lifts", () => {
    const reentry = require("../features/reentry.js");
    expect(reentry.dumbbellPerHandText({ name: "Incline DB Press", weightMode: "total" }, 20)).toBe("20 kg total = 10 kg per hand");
    expect(reentry.dumbbellPerHandText({ name: "Dumbbell Romanian Deadlift", weightMode: "total" }, 25)).toBe("25 kg total = 12.5 kg per hand");
    expect(reentry.dumbbellPerHandText({ name: "Incline DB Press", weightMode: "per_hand" }, 20)).toBe("");
    expect(reentry.dumbbellPerHandText({ name: "Machine Leg Press", weightMode: "total" }, 100)).toBe("");
    expect(reentry.dumbbellPerHandText({ name: "Incline DB Press", weightMode: "total" }, 0)).toBe("");
  });

  test("renders reentry banner above content, db-hint below weight-semantics, and handles reentry actions", () => {
    const app = loadAppWithPlan([
      {
        id: "w15",
        num: 15,
        phase: "Deload",
        dateRange: "Aug 17-23",
        days: [{ id: "2026-08-22", dow: "Sat", dom: 22, month: "Aug", type: "chest", title: "Chest", exercises: [{ name: "Incline DB Press", weightMode: "total", sets: [{ reps: 10, weight: 20 }] }] }]
      },
      {
        id: "w21",
        num: 21,
        phase: "Reentry",
        dateRange: "Nov 23-29",
        days: [{
          id: "2026-11-23",
          dow: "Mon",
          dom: 23,
          month: "Nov",
          type: "chest",
          title: "Reentry Chest",
          exercises: [
            { name: "Incline DB Press", weightMode: "total", sets: [{ reps: 8, weight: 20 }, { reps: 8, weight: 20 }] },
            { name: "Cable Lateral Raises", weightMode: "per_side", sets: [{ reps: 12, weight: 5 }] }
          ]
        }]
      }
    ], {
      v: 4,
      settings: { units: "kg", weightStep: 2.5 },
      days: {
        "2026-08-22": { status: "completed", completed: { "0.0": { reps: 10, weight: 20 } } }
      }
    });

    const state = app.getState();
    state.activeWeekId = "w21";
    state.activeDayId = "2026-11-23";
    app.render();

    const html = document.getElementById("app").innerHTML;
    expect(html.indexOf('<section class="reentry-banner"')).toBeGreaterThan(-1);
    expect(html.indexOf('<section class="reentry-banner"')).toBeLessThan(html.indexOf('<main class="content">'));
    expect(html).toContain("Welcome back after 93 days");
    expect(html).toContain("20 kg total = 10 kg per hand");
    expect(html.indexOf('<div class="weight-semantics">')).toBeLessThan(html.indexOf('<div class="db-hint">'));

    // Clicking reentry-start opens readiness check-in sheet.
    app.handleClick({ target: document.querySelector('[data-action="reentry-start"]'), preventDefault: () => {} });
    expect(document.getElementById("sheet").dataset.open).toBe("true");
    expect(document.getElementById("sheet").dataset.type).toBe("readiness");

    // Clicking reentry-dismiss sets reentryDismissedWeekId and removes banner.
    app.handleClick({ target: document.querySelector('[data-action="reentry-dismiss"]'), preventDefault: () => {} });
    expect(app.getState().reentryDismissedWeekId).toBe("w21");
    expect(document.querySelector(".reentry-banner")).toBeNull();
  });

  test("stepSetValue uses exercise-specific increments in kg and weightStep in lb", () => {
    const app = loadAppWithPlan([
      {
        id: "w21",
        num: 21,
        phase: "Reentry",
        dateRange: "Nov 23-29",
        days: [{
          id: "2026-11-23",
          dow: "Mon",
          dom: 23,
          month: "Nov",
          type: "chest",
          title: "Test",
          exercises: [
            { name: "Cable Lateral Raises", sets: [{ reps: 15, weight: 5 }] },
            { name: "Incline DB Press", weightMode: "total", sets: [{ reps: 8, weight: 20 }] },
            { name: "Machine Leg Press", sets: [{ reps: 10, weight: 75 }] }
          ]
        }]
      }
    ], { v: 4, settings: { units: "kg", weightStep: 2.5 }, days: {} });

    app.getState().activeWeekId = "w21";
    app.getState().activeDayId = "2026-11-23";

    app.stepSetValue(0, 0, "weight", 1);
    app.stepSetValue(1, 0, "weight", 1);
    app.stepSetValue(2, 0, "weight", 1);

    expect(app.getState().days["2026-11-23"].drafts["0.0"].weight).toBe(6);
    expect(app.getState().days["2026-11-23"].drafts["1.0"].weight).toBe(22);
    expect(app.getState().days["2026-11-23"].drafts["2.0"].weight).toBe(77.5);

    // Switching to lb falls back to settings.weightStep.
    app.getState().settings.units = "lb";
    app.getState().settings.weightStep = 5;
    app.stepSetValue(0, 0, "weight", 1);
    expect(app.getState().days["2026-11-23"].drafts["0.0"].weight).toBeCloseTo(6 + 5 / 2.2046226218, 4);
  });

  test("copy-set1 copies Set 1 target to remaining uncompleted drafts without altering completed sets", () => {
    const app = loadAppWithPlan([
      {
        id: "w21",
        num: 21,
        phase: "Reentry",
        dateRange: "Nov 23-29",
        days: [{
          id: "2026-11-23",
          dow: "Mon",
          dom: 23,
          month: "Nov",
          type: "chest",
          title: "Chest",
          exercises: [
            { name: "Incline DB Press", sets: [{ reps: 8, weight: 20 }, { reps: 8, weight: 20 }, { reps: 8, weight: 20 }] },
            { name: "Tricep Pushdowns", sets: [{ reps: 12, weight: 25 }] }
          ]
        }]
      }
    ], {
      v: 4,
      settings: { units: "kg", weightStep: 2.5 },
      days: {
        "2026-11-23": {
          completed: {
            "0.0": { reps: 9, weight: 22, ts: 1 },
            "0.2": { reps: 8, weight: 20, ts: 2 }
          },
          drafts: {}
        }
      }
    });

    app.getState().activeWeekId = "w21";
    app.getState().activeDayId = "2026-11-23";
    app.render();

    // Appears for 3-set exercise, not for 1-set exercise.
    expect(document.querySelector('[data-action="copy-set1"][data-ex="0"]')).not.toBeNull();
    expect(document.querySelector('[data-action="copy-set1"][data-ex="1"]')).toBeNull();

    app.handleClick({ target: document.querySelector('[data-action="copy-set1"][data-ex="0"]'), preventDefault: () => {} });

    const ds = app.getState().days["2026-11-23"];
    // Uncompleted Set 2 gets Set 1's weight and reps in drafts.
    expect(ds.drafts["0.1"]).toMatchObject({ weight: 22, reps: 9 });
    // Already-completed Set 3 is never touched.
    expect(ds.completed["0.2"]).toMatchObject({ weight: 20, reps: 8 });
    expect(ds.drafts["0.2"]).toBeUndefined();
    // Toast is shown and Match S1 hides now that remaining uncompleted sets match S1.
    expect(document.getElementById("toast-root").textContent).toContain("Copied Set 1 target to remaining sets.");
    expect(document.querySelector('[data-action="copy-set1"][data-ex="0"]')).toBeNull();
  });

  test("rest-dismiss resets active rest timer, saves rest storage, and hides the rest fab", () => {
    const app = loadAppWithPlan([
      {
        id: "w21",
        num: 21,
        phase: "Reentry",
        dateRange: "Nov 23-29",
        days: [{ id: "2026-11-23", dow: "Mon", dom: 23, month: "Nov", type: "legs", title: "Legs", exercises: [{ name: "Leg Press", sets: [{ reps: 10, weight: 75 }] }] }]
      }
    ], { v: 4, settings: { units: "kg" }, days: {} });

    const state = app.getState();
    state.activeWeekId = "w21";
    state.activeDayId = "2026-11-23";
    app.startRest(90, "Leg Press");
    app.render();

    const dismissBtn = document.querySelector(".rest-fab .rest-dismiss-btn[data-action='rest-dismiss']");
    expect(dismissBtn).not.toBeNull();

    app.handleClick({ target: dismissBtn, preventDefault: () => {} });

    expect(app.getRest()).toMatchObject({ running: false, completedAt: 0 });
    expect(JSON.parse(localStorage.getItem("lift.v2.rest"))).toMatchObject({ running: false, completedAt: 0 });
    expect(document.querySelector(".rest-fab")).toBeNull();
  });

  test("lastSessionHint includes short month/day and Deload or Reentry phase tags", () => {
    const app = loadAppWithPlan([
      {
        id: "w14",
        num: 14,
        phase: "Load +",
        dateRange: "Aug 10-16",
        days: [{ id: "2026-08-10", dow: "Mon", dom: 10, month: "Aug", type: "legs", title: "Legs", exercises: [{ name: "Machine Leg Press", sets: [{ reps: 10, weight: 100 }] }] }]
      },
      {
        id: "w15",
        num: 15,
        phase: "Deload",
        dateRange: "Aug 17-23",
        days: [{ id: "2026-08-17", dow: "Mon", dom: 17, month: "Aug", type: "legs", title: "Deload", exercises: [{ name: "Machine Leg Press", sets: [{ reps: 10, weight: 75 }] }] }]
      },
      {
        id: "w21",
        num: 21,
        phase: "Reentry",
        dateRange: "Nov 23-29",
        days: [{ id: "2026-11-23", dow: "Mon", dom: 23, month: "Nov", type: "legs", title: "Reentry", exercises: [{ name: "Machine Leg Press", sets: [{ reps: 8, weight: 70 }] }] }]
      },
      {
        id: "w22",
        num: 22,
        phase: "Consolidate",
        dateRange: "Nov 30-Dec 6",
        days: [{ id: "2026-11-30", dow: "Mon", dom: 30, month: "Nov", type: "legs", title: "Consolidate", exercises: [{ name: "Machine Leg Press", sets: [{ reps: 8, weight: 85 }] }] }]
      }
    ], {
      v: 4,
      settings: { units: "kg" },
      days: {
        "2026-08-10": { completed: { "0.0": { reps: 10, weight: 100 }, "0.1": { reps: 10, weight: 100 }, "0.2": { reps: 10, weight: 100 } } },
        "2026-08-17": { completed: { "0.0": { reps: 10, weight: 75 }, "0.1": { reps: 10, weight: 75 } } },
        "2026-11-23": { completed: { "0.0": { reps: 8, weight: 70 }, "0.1": { reps: 8, weight: 70 } } }
      }
    });

    expect(app.lastSessionHint("Machine Leg Press", "2026-08-17")).toBe("Last: 100 kg x 10 x3 (Wk 14 · Aug 10)");
    expect(app.lastSessionHint("Machine Leg Press", "2026-11-23")).toBe("Last: 75 kg x 10 x2 (Wk 15 Deload · Aug 17)");
    expect(app.lastSessionHint("Machine Leg Press", "2026-11-30")).toBe("Last: 70 kg x 8 x2 (Wk 21 Reentry · Nov 23)");
  });

  test("library.applyTemplateToDay applies DEFAULTS, customWorkouts, and imported marketplace blocks onto active day", () => {
    const library = require("../features/library.js");
    const baseDay = { id: "2026-11-23", exercises: [{ name: "Leg Press", sets: [{ reps: 10, weight: 75 }] }] };
    const state = {
      activeDayId: "2026-11-23",
      days: {},
      customWorkouts: [{ id: "custom-1", name: "Hotel upper body", exercises: [] }],
      library: [{
        id: "smolov-jr",
        title: "Smolov Jr. Bench",
        summary: "Bench specialization",
        blocks: [{ day: "Mon", focus: "6x6 @70%" }]
      }]
    };
    const saveState = jest.fn();
    const ctx = {
      state,
      allDays: () => {
        const ds = state.days["2026-11-23"] || {};
        const merged = Object.assign({}, baseDay, {
          exercises: baseDay.exercises.concat(ds.customExercises || [])
        });
        return [{ day: merged }];
      },
      saveState
    };

    const resDefault = library.applyTemplateToDay(ctx, "travel-30");
    expect(resDefault.added).toHaveLength(5);
    expect(state.days["2026-11-23"].baseExerciseCount).toBe(1);
    expect(state.days["2026-11-23"].customExercises[0]).toMatchObject({
      name: "Goblet squat",
      custom: true,
      sets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }, { reps: 10, weight: 0 }]
    });

    const resMarket = library.applyTemplateToDay(ctx, "smolov-jr");
    expect(resMarket.added).toHaveLength(1);
    expect(resMarket.added[0].name).toContain("Smolov Jr. Bench");

    const resCustom = library.applyTemplateToDay(ctx, "custom-1");
    expect(resCustom.added).toHaveLength(1);
    expect(resCustom.added[0].name).toBe("Hotel upper body");
    expect(state.days["2026-11-23"].baseExerciseCount).toBe(1);
    expect(saveState).toHaveBeenCalledTimes(3);
  });

  test("clicking library-start applies template exercises to today, closes sheet, and renders", () => {
    const app = loadAppWithPlan([
      {
        id: "w21",
        num: 21,
        phase: "Reentry",
        dateRange: "Nov 23-29",
        days: [{ id: "2026-11-23", dow: "Mon", dom: 23, month: "Nov", type: "legs", title: "Reentry", exercises: [{ name: "Leg Press", sets: [{ reps: 10, weight: 75 }] }] }]
      }
    ], { v: 4, settings: { units: "kg" }, days: {} });

    const state = app.getState();
    state.activeWeekId = "w21";
    state.activeDayId = "2026-11-23";
    app.openSheet("library");

    const useBtn = document.querySelector('[data-action="library-start"][data-id="light-pull"]');
    expect(useBtn).not.toBeNull();
    app.handleClick({ target: useBtn, preventDefault: () => {} });

    expect(window.confirm).toHaveBeenCalled();
    expect(app.getState().days["2026-11-23"].customExercises.map((ex) => ex.name)).toEqual([
      "Lat pulldown", "Cable row", "Face pull", "Curl"
    ]);
    expect(document.getElementById("sheet").dataset.open).toBe("false");
    expect(document.getElementById("app").textContent).toContain("Lat pulldown");
  });

  test("cardio.deleteEntry and cardio-delete click handler remove recent entries cleanly", () => {
    const app = loadAppWithPlan([
      {
        id: "w21",
        num: 21,
        phase: "Reentry",
        dateRange: "Nov 23-29",
        days: [{ id: "2026-11-23", dow: "Mon", dom: 23, month: "Nov", type: "legs", title: "Reentry", exercises: [{ name: "Leg Press", sets: [{ reps: 10, weight: 75 }] }] }]
      }
    ], { v: 4, settings: { units: "kg" }, days: {} });

    const cardio = window.LIFT_FEATURES.cardio;
    app.getState().activeWeekId = "w21";
    app.getState().activeDayId = "2026-11-23";
    const entry = cardio.addEntry(app.getState(), "2026-11-23", { id: "run-keep-test", distanceKm: 1, durationSec: 360, ts: 1 });
    expect(entry.id).toBe("run-keep-test");

    expect(cardio.deleteEntry(app.getState(), "2026-11-23", "missing")).toBe(false);

    app.openSheet("cardio");
    const delBtn = document.querySelector('.cardio-delete-btn[data-action="cardio-delete"][data-date="2026-11-23"][data-id="run-keep-test"]');
    expect(delBtn).not.toBeNull();

    app.handleClick({ target: delBtn, preventDefault: () => {} });

    expect(app.getState().cardio["2026-11-23"]).toBeUndefined();
    expect(document.querySelector('.cardio-delete-btn[data-id="run-keep-test"]')).toBeNull();
  });

  test("index.html and sw.js include features/reentry.js", () => {
    const root = path.join(__dirname, "..");
    const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const swJs = fs.readFileSync(path.join(root, "sw.js"), "utf8");

    expect(indexHtml).toContain('<script src="./features/reentry.js"></script>');
    expect(indexHtml.indexOf('<script src="./features/reentry.js"></script>')).toBeLessThan(indexHtml.indexOf('<script src="./app.js"></script>'));
    expect(swJs).toContain('"./features/reentry.js"');
  });
});
