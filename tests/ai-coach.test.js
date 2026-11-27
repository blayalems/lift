const fs = require("node:fs");
const path = require("node:path");

describe("offline AI Coach (features/coach.js)", () => {
  let coach;
  let stateMod;
  let progression;
  let reentry;
  let nutrition;
  let body;

  const REAL_AUG_LOGS = {
    "2026-08-10": {
      status: "completed",
      readiness: 8,
      completed: {
        "0.0": { reps: 10, weight: 100, ts: 1786334995547, pr: true },
        "0.1": { reps: 10, weight: 100, ts: 1786335192540, pr: false },
        "0.2": { reps: 10, weight: 100, ts: 1786335448163, pr: false },
        "1.0": { reps: 12, weight: 40, ts: 1786333544721, pr: true },
        "1.1": { reps: 12, weight: 40, ts: 1786333860660, pr: false },
        "1.2": { reps: 12, weight: 40, ts: 1786334167322, pr: false },
        "2.0": { reps: 12, weight: 50, ts: 1786334391727, pr: true },
        "2.1": { reps: 12, weight: 50, ts: 1786334546877, pr: false },
        "2.2": { reps: 12, weight: 50, ts: 1786334704708, pr: false },
        "3.0": { reps: 20, weight: 42.5, ts: 1786335910989, pr: true },
        "3.1": { reps: 20, weight: 42.5, ts: 1786336300785, pr: false },
        "3.2": { reps: 20, weight: 42.5, ts: 1786336520215, pr: false },
        "4.0": { reps: 12, weight: 60, ts: 1786336860312, pr: true },
        "4.1": { reps: 12, weight: 60, ts: 1786337229324, pr: false },
        "4.2": { reps: 12, weight: 60, ts: 1786338226885, pr: false }
      }
    },
    "2026-08-11": {
      status: "completed",
      readiness: 8,
      completed: {
        "0.0": { reps: 10, weight: 50, pr: true },
        "0.1": { reps: 10, weight: 50 },
        "0.2": { reps: 10, weight: 50 },
        "1.0": { reps: 10, weight: 50, pr: true },
        "1.1": { reps: 10, weight: 50 },
        "1.2": { reps: 10, weight: 50 },
        "2.0": { reps: 12, weight: 45, pr: true },
        "3.0": { reps: 12, weight: 20, pr: true }
      }
    },
    "2026-08-13": {
      status: "completed",
      readiness: 8,
      completed: {
        "0.0": { reps: 10, weight: 40 },
        "0.1": { reps: 10, weight: 40 },
        "0.2": { reps: 10, weight: 40 }
      }
    },
    "2026-08-15": {
      status: "completed",
      readiness: 8,
      completed: {
        "0.0": { reps: 8, weight: 20 },
        "0.1": { reps: 8, weight: 20 }
      }
    },
    "2026-08-19": {
      status: "completed",
      readiness: 8,
      completed: {
        "0.0": { reps: 10, weight: 25, pr: true },
        "0.1": { reps: 10, weight: 25 }
      }
    },
    "2026-08-22": {
      status: "completed",
      readiness: 8,
      completed: {
        "0.0": { reps: 8, weight: 20 },
        "1.0": { reps: 10, weight: 25, pr: true }
      }
    }
  };

  function makePlanCtx(options = {}) {
    const plan = window.LIFT_PLAN;
    const weekMap = {};
    const dayMap = {};
    const flatDays = [];
    (plan.weeks || []).forEach((w) => {
      weekMap[w.id] = w;
      (w.days || []).forEach((d) => {
        dayMap[d.id] = d;
        flatDays.push({ week: w, day: d });
      });
    });

    const state = options.state || stateMod.migrateState({
      v: 4,
      schemaVersion: 4,
      activeWeekId: options.activeWeekId || "w21",
      activeDayId: options.activeDayId || "2026-11-27",
      settings: { units: "kg", weightStep: 2.5 },
      profile: {
        athlete: "Lem",
        heightCm: 167,
        goalMode: "recomposition",
        proteinTargetG: 130,
        proteinRangeMinG: 120,
        proteinRangeMaxG: 145
      },
      days: options.days || {},
      nutrition: options.nutrition || {},
      bodyweight: options.bodyweight || [],
      measurements: options.measurements || []
    });

    if (options.activeWeekId) state.activeWeekId = options.activeWeekId;
    if (options.activeDayId) state.activeDayId = options.activeDayId;

    const saveState = jest.fn();
    const openSheet = jest.fn();
    const today = options.today || state.activeDayId || "2026-11-27";

    return {
      state,
      plan,
      progression,
      reentry,
      allDays: () => flatDays.map(({ week, day }) => {
        const ds = (state.days || {})[day.id] || {};
        const custom = Array.isArray(ds.customExercises) ? ds.customExercises : [];
        return {
          week,
          day: custom.length ? Object.assign({}, day, { exercises: (day.exercises || []).concat(custom) }) : day
        };
      }),
      getDay: (id) => {
        const base = dayMap[id] || null;
        if (!base) return null;
        const ds = (state.days || {})[id] || {};
        const custom = Array.isArray(ds.customExercises) ? ds.customExercises : [];
        return custom.length ? Object.assign({}, base, { exercises: (base.exercises || []).concat(custom) }) : base;
      },
      getWeek: (id) => weekMap[id] || null,
      weekForDayId: (id) => {
        const match = flatDays.find((e) => e.day.id === id);
        return match ? match.week : null;
      },
      todayId: () => today,
      unitLabel: () => (state.settings && state.settings.units === "lb" ? "lb" : "kg"),
      kgToDisplay: (kg) => Number(kg || 0),
      escapeHtml: (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
      })[ch]),
      saveState,
      openSheet
    };
  }

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    delete window.LIFT_PLAN;
    require("../data.js");
    stateMod = require("../features/state.js");
    progression = require("../features/progression.js");
    reentry = require("../features/reentry.js");
    nutrition = require("../features/nutrition.js");
    body = require("../features/body.js");
    coach = require("../features/coach.js");
  });

  test("enforces offline zero-fetch, export contracts, and anti-AI-slop rules", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "features", "coach.js"), "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/style\s*=\s*["']/i);
    expect(src).not.toMatch(/&#128293;|[\u{1F300}-\u{1FAFF}]/u);
    expect(window.LIFT_FEATURES.coach).toBe(coach);
  });

  test("ensureCoachMemory normalizes defaults, validates tone, caps at 30 messages, and survives state.migrateState", () => {
    const state = {
      days: {},
      coachMemory: {
        tone: "invalid-tone",
        messages: Array.from({ length: 40 }, (_, i) => ({
          id: `m-${i}`,
          role: i % 2 === 0 ? "user" : "coach",
          text: `Message ${i}`,
          ts: 1000 + i
        })).concat([{ role: "bad", text: "ignored" }]),
        checkins: [{ date: "2026-11-27", readiness: 8 }],
        lastBriefDate: "2026-11-27"
      }
    };

    const mem = coach.ensureCoachMemory(state);
    expect(mem.tone).toBe("analytical");
    expect(mem.messages).toHaveLength(30);
    expect(mem.messages[0].text).toBe("Message 10");
    expect(mem.messages[29].text).toBe("Message 39");
    expect(mem.checkins).toHaveLength(1);
    expect(mem.lastBriefDate).toBe("2026-11-27");

    mem.tone = "stoic";
    const migrated = stateMod.migrateState(state);
    expect(migrated.coachMemory.tone).toBe("stoic");
    expect(migrated.coachMemory.messages).toHaveLength(30);
    expect(stateMod.validateBackup(migrated).valid).toBe(true);
  });

  test("analyzeAthlete evaluates Lem's real August logs + 13-week layoff and fresh boot accurately", () => {
    const lemState = stateMod.migrateState({
      v: 4,
      schemaVersion: 4,
      activeWeekId: "w21",
      activeDayId: "2026-11-27",
      profile: {
        athlete: "Lem",
        heightCm: 167,
        goalMode: "recomposition",
        proteinTargetG: 130,
        proteinRangeMinG: 120,
        proteinRangeMaxG: 145
      },
      days: REAL_AUG_LOGS,
      nutrition: {
        "2026-11-27": { entries: [{ id: "f1", name: "Whey", proteinG: 48 }] }
      }
    });
    const lemCtx = makePlanCtx({ state: lemState, activeWeekId: "w21", activeDayId: "2026-11-27", today: "2026-11-27" });
    const lemAnalysis = coach.analyzeAthlete(lemCtx, "2026-11-27");

    expect(lemAnalysis.daysSinceLast).toBe(97);
    expect(lemAnalysis.hiatusRisk).toBeGreaterThanOrEqual(75);
    expect(lemAnalysis.hiatusTier).toBe("critical");
    expect(lemAnalysis.momentumLabel).toBe("Reentry Ramp");
    expect(lemAnalysis.proteinTodayG).toBe(48);
    expect(lemAnalysis.proteinTargetG).toBe(130);
    expect(lemAnalysis.expressAvailable).toBe(true);

    // Fresh user with zero logged workouts should stay low risk, not critical
    const freshCtx = makePlanCtx({ activeWeekId: "w21", activeDayId: "2026-11-27", today: "2026-11-27" });
    const freshAnalysis = coach.analyzeAthlete(freshCtx, "2026-11-27");
    expect(freshAnalysis.daysSinceLast).toBeNull();
    expect(freshAnalysis.hiatusRisk).toBeLessThan(25);
    expect(freshAnalysis.hiatusTier).toBe("low");
    expect(freshAnalysis.readinessScore).toBeNull();
  });

  test("analyzeAthlete detects 3+ session plateaus, surging lifts, low protein, and hiatus tiers", () => {
    const customDays = [
      { id: "2026-11-16", exercises: [{ name: "Lat Pulldown", incrementKg: 2.5, sets: [{ reps: 10, weight: 50 }] }, { name: "Machine Leg Press", incrementKg: 2.5, sets: [{ reps: 10, weight: 90 }] }] },
      { id: "2026-11-18", exercises: [{ name: "Lat Pulldown", incrementKg: 2.5, sets: [{ reps: 10, weight: 50 }] }, { name: "Machine Leg Press", incrementKg: 2.5, sets: [{ reps: 10, weight: 95 }] }] },
      { id: "2026-11-20", exercises: [{ name: "Lat Pulldown", incrementKg: 2.5, sets: [{ reps: 10, weight: 50 }] }, { name: "Machine Leg Press", incrementKg: 2.5, sets: [{ reps: 10, weight: 100 }] }] },
      { id: "2026-11-22", exercises: [{ name: "Lat Pulldown", incrementKg: 2.5, sets: [{ reps: 10, weight: 50 }] }] },
      { id: "2026-11-24", exercises: [{ name: "Lat Pulldown", incrementKg: 2.5, sets: [{ reps: 10, weight: 50 }] }] },
      { id: "2026-11-26", exercises: [{ name: "Lat Pulldown", incrementKg: 2.5, sets: [{ reps: 10, weight: 50 }] }] },
      { id: "2026-11-27", exercises: [{ name: "Lat Pulldown", primary: true, incrementKg: 2.5, sets: [{ reps: 10, weight: 50 }, { reps: 10, weight: 50 }, { reps: 10, weight: 50 }] }] }
    ];
    const week = { id: "w-load", num: 10, phase: "Load", days: customDays };
    const state = stateMod.migrateState({
      v: 4,
      activeWeekId: "w-load",
      activeDayId: "2026-11-27",
      profile: { proteinTargetG: 130, proteinRangeMinG: 120 },
      days: {
        "2026-11-16": { status: "completed", completed: { "0.0": { reps: 10, weight: 50 }, "1.0": { reps: 10, weight: 90 } } },
        "2026-11-18": { status: "completed", completed: { "0.0": { reps: 10, weight: 50 }, "1.0": { reps: 10, weight: 95 } } },
        "2026-11-20": { status: "completed", completed: { "0.0": { reps: 10, weight: 50 }, "1.0": { reps: 10, weight: 100, pr: true, recordType: "weight" } } },
        "2026-11-22": { status: "missed" },
        "2026-11-24": { status: "missed" },
        "2026-11-26": { status: "completed", readiness: 7, completed: { "0.0": { reps: 10, weight: 50 } } }
      },
      nutrition: {
        "2026-11-24": { entries: [{ name: "Egg", proteinG: 60 }] },
        "2026-11-25": { entries: [{ name: "Egg", proteinG: 135 }] },
        "2026-11-26": { entries: [{ name: "Egg", proteinG: 70 }] }
      }
    });

    const ctx = {
      state,
      progression,
      reentry,
      allDays: () => customDays.map((day) => ({ week, day })),
      getDay: (id) => customDays.find((d) => d.id === id) || null,
      getWeek: () => week,
      weekForDayId: () => week,
      todayId: () => "2026-11-27",
      escapeHtml: (v) => String(v || "")
    };

    const res = coach.analyzeAthlete(ctx, "2026-11-27");
    expect(res.daysSinceLast).toBe(1);
    expect(res.adherence14d).toBe(67);
    expect(res.proteinHitRate).toBe(33);
    expect(res.plateauLifts.map((p) => p.name)).toContain("Lat Pulldown");
    expect(res.surgingLifts.map((s) => s.name)).toContain("Machine Leg Press");
    expect(["low", "moderate"]).toContain(res.hiatusTier);

    // Check moderate/elevated hiatus when missed streak grows and gap is 5 days
    state.days["2026-11-26"] = { status: "missed" };
    state.days["2026-11-27"] = { readiness: 5 };
    const elevated = coach.analyzeAthlete(ctx, "2026-11-27");
    expect(elevated.daysSinceLast).toBe(7);
    expect(elevated.hiatusRisk).toBeGreaterThanOrEqual(60);
    expect(["elevated", "critical"]).toContain(elevated.hiatusTier);
  });

  test("getDailyBrief adapts dynamically across Reentry, Deload, Test, Low Readiness, Hiatus Risk, Plateau, and Load", () => {
    // 1. Reentry
    const reentryCtx = makePlanCtx({ days: REAL_AUG_LOGS, activeWeekId: "w21", activeDayId: "2026-11-27", today: "2026-11-27" });
    const reentryBrief = coach.getDailyBrief(reentryCtx, reentryCtx.getDay("2026-11-27"));
    expect(reentryBrief.tone).toBe("reentry");
    expect(reentryBrief.actionType).toBe("express-mode");

    // 2. Low readiness overrides into autoregulate-light
    const lowCtx = makePlanCtx({
      activeWeekId: "w23",
      activeDayId: "2026-12-07",
      today: "2026-12-07",
      days: { "2026-12-07": { readiness: 4 } }
    });
    const lowBrief = coach.getDailyBrief(lowCtx, lowCtx.getDay("2026-12-07"));
    expect(lowBrief.actionType).toBe("autoregulate-light");
    expect(lowBrief.headline).toContain("4/10");

    // 3. Deload
    const deloadCtx = makePlanCtx({
      activeWeekId: "w25",
      activeDayId: "2026-12-21",
      today: "2026-12-21",
      days: { "2026-12-20": { completed: { "0.0": { reps: 10, weight: 80 } } } }
    });
    expect(coach.getDailyBrief(deloadCtx, deloadCtx.getDay("2026-12-21")).badge).toBe("Deload");

    // 4. Test phase
    const testCtx = makePlanCtx({
      activeWeekId: "w16",
      activeDayId: "2026-08-29",
      today: "2026-08-29",
      days: { "2026-08-28": { completed: { "0.0": { reps: 10, weight: 20 } } } }
    });
    expect(coach.getDailyBrief(testCtx, testCtx.getDay("2026-08-29")).actionType).toBe("pr-push");

    // 5. Healthy Load
    const loadDays = {
      "2026-12-05": { status: "completed", completed: { "0.0": { reps: 8, weight: 25 } } },
      "2026-12-07": { readiness: 8 }
    };
    const loadCtx = makePlanCtx({ activeWeekId: "w23", activeDayId: "2026-12-07", today: "2026-12-07", days: loadDays });
    const loadBrief = coach.getDailyBrief(loadCtx, loadCtx.getDay("2026-12-07"));
    expect(loadBrief.actionType).toBe("pr-push");
    expect(loadBrief.headline).toContain("Machine Leg Press");

    // 6. Rest day
    const restCtx = makePlanCtx({ activeWeekId: "w21", activeDayId: "2026-11-29", today: "2026-11-29" });
    const restBrief = coach.getDailyBrief(restCtx, restCtx.getDay("2026-11-29"));
    expect(restBrief.actionType).toBeNull();
    expect(restBrief.badge).toBe("Recovery");
  });

  test("askCoach parses exercise entities, quotes real logs, detects intents, persists 30-message history", () => {
    const ctx = makePlanCtx({
      days: REAL_AUG_LOGS,
      activeWeekId: "w21",
      activeDayId: "2026-11-27",
      today: "2026-11-27",
      nutrition: { "2026-11-27": { entries: [{ name: "Chicken", proteinG: 62 }] } },
      bodyweight: [
        { date: "2026-11-20", kg: 72.4 },
        { date: "2026-11-27", kg: 71.8 }
      ],
      measurements: [
        { date: "2026-11-01", waist: 84.5 },
        { date: "2026-11-27", waist: 83.2 }
      ]
    });

    // Exercise lookups
    const legPressRes = coach.askCoach(ctx, "How is my leg press looking?");
    expect(legPressRes.reply).toContain("2026-08-10");
    expect(legPressRes.reply).toContain("100");
    expect(legPressRes.reply).toContain("10/10/10");
    expect(legPressRes.reply).toContain("133.3");
    expect(legPressRes.reply).toContain("75 kg");

    const inclineRes = coach.askCoach(ctx, "Where am I at on incline db?");
    expect(inclineRes.reply).toContain("2026-08-22");
    expect(inclineRes.reply).toContain("2026-08-19");
    expect(inclineRes.reply).toContain("25");
    expect(inclineRes.reply).toContain("10/10");
    expect(inclineRes.reply).toContain("33.3");

    const pulldownRes = coach.askCoach(ctx, "Lat pulldown history?");
    expect(pulldownRes.reply).toContain("2026-08-11");
    expect(pulldownRes.reply).toContain("50");

    const rdlRes = coach.askCoach(ctx, "What did I hit on RDL?");
    expect(rdlRes.reply).toContain("2026-08-13");
    expect(rdlRes.reply).toContain("40");

    const squatRes = coach.askCoach(ctx, "Check my squat log");
    expect(squatRes.reply).toContain("Smith Machine Squats");
    expect(squatRes.reply).toContain("40");

    // Soreness -> autoregulate-light
    const soreRes = coach.askCoach(ctx, "My legs are super sore and fatigued today");
    expect(soreRes.suggestedAction.type).toBe("autoregulate-light");

    // Rushed -> express-mode
    const rushRes = coach.askCoach(ctx, "I am rushed, give me a 15-min workout");
    expect(rushRes.suggestedAction.type).toBe("express-mode");

    // Protein / waist recomp
    const nutritionRes = coach.askCoach(ctx, "How much protein do I have left and how is my waist recomp?");
    expect(nutritionRes.reply).toContain("68 g remaining");
    expect(nutritionRes.reply).toContain("83.2 cm");
    expect(nutritionRes.suggestedAction.type).toBe("open-sheet");

    // Hiatus / motivation
    const hiatusRes = coach.askCoach(ctx, "I missed 3 months and feel guilty about my hiatus");
    expect(hiatusRes.reply).toContain("Zero guilt");
    expect(hiatusRes.suggestedAction.type).toBe("express-mode");

    // Today's plan
    const todayRes = coach.askCoach(ctx, "Summarize today's workout plan");
    expect(todayRes.reply).toContain("Full Body A");
    expect(todayRes.reply).toContain("Machine Leg Press");

    // Tone switch
    const toneRes = coach.askCoach(ctx, "Switch tone to hype");
    expect(ctx.state.coachMemory.tone).toBe("hype");
    expect(toneRes.suggestedAction.type).toBe("set-tone");

    expect(ctx.saveState).toHaveBeenCalledWith("coach-chat");

    // Message cap at 30 across repeated conversations
    for (let i = 0; i < 12; i += 1) {
      coach.askCoach(ctx, `Check today workout ${i}`);
    }
    expect(ctx.state.coachMemory.messages.length).toBe(30);
  });

  test("applyCoachAction executes express-mode, autoregulate-light, pr-push, and set-tone safely", () => {
    // 1. Express mode preserves completed sets and caps compounds=2, accessories=1
    const expressCtx = makePlanCtx({
      activeWeekId: "w24",
      activeDayId: "2026-12-14",
      today: "2026-12-14",
      days: {
        "2026-12-14": {
          completed: {
            "1.0": { reps: 11, weight: 40 },
            "1.1": { reps: 11, weight: 40 },
            "1.2": { reps: 11, weight: 40 },
            "2.0": { reps: 11, weight: 50 },
            "2.1": { reps: 11, weight: 50 }
          }
        }
      }
    });
    const expRes = coach.applyCoachAction(expressCtx, "express-mode");
    expect(expRes.ok).toBe(true);
    const targets = expressCtx.state.days["2026-12-14"].adaptiveTargets;
    expect(targets["0"].sets).toBe(2); // Machine Leg Press (compound, 0 done -> max 2)
    expect(targets["1"]).toBeUndefined(); // Smith Squats (all 3 sets already completed -> untouched)
    expect(targets["2"].sets).toBe(2); // Seated Leg Curls (accessory, 2 already done -> preserves 2!)
    expect(targets["3"].sets).toBe(1); // Seated Calf Raises (accessory, 0 done -> 1 crisp set)
    expect(targets["4"].sets).toBe(1); // Abdominal Machine (accessory, 0 done -> 1 crisp set)
    expect(expressCtx.state.days["2026-12-14"].completed["1.2"]).toEqual({ reps: 11, weight: 40 });

    // 2. Autoregulate-light reduces uncompleted weights ~10% (2.5 kg step) & trims 1 set (min 1)
    const lightCtx = makePlanCtx({
      activeWeekId: "w24",
      activeDayId: "2026-12-14",
      today: "2026-12-14",
      days: {
        "2026-12-14": {
          completed: {
            "4.0": { reps: 11, weight: 60 },
            "4.1": { reps: 11, weight: 60 },
            "4.2": { reps: 11, weight: 60 }
          }
        }
      }
    });
    const lightRes = coach.applyCoachAction(lightCtx, "autoregulate-light");
    expect(lightRes.ok).toBe(true);
    const lightTargets = lightCtx.state.days["2026-12-14"].adaptiveTargets;
    expect(lightTargets["0"].weight).toBe(90); // 100 * 0.9 -> 90
    expect(lightTargets["0"].sets).toBe(2); // 3 - 1 -> 2
    expect(lightTargets["1"].weight).toBe(35); // 40 * 0.9 = 36 -> 35 (2.5 step)
    expect(lightTargets["3"].weight).toBe(37.5); // 42.5 * 0.9 = 38.25 -> 37.5
    expect(lightTargets["4"]).toBeUndefined(); // Completed exercise untouched

    // 3. PR push bumps primary weight (+incrementKg) when at rep max, or +1 rep below rep max
    const prCtx = makePlanCtx({
      activeWeekId: "w24",
      activeDayId: "2026-12-14",
      today: "2026-12-14",
      days: {
        "2026-12-10": { status: "completed" },
        "2026-12-14": {
          completed: { "0.0": { reps: 9, weight: 100 } }
        }
      }
    });
    const prRepRes = coach.applyCoachAction(prCtx, "pr-push");
    expect(prRepRes.ok).toBe(true);
    expect(prRepRes.target.weight).toBe(100);
    expect(prRepRes.target.reps).toBe(10); // +1 rep above top completed (9 -> 10)

    prCtx.state.days["2026-12-14"].completed["0.0"] = { reps: 10, weight: 100 };
    const prWeightRes = coach.applyCoachAction(prCtx, "pr-push");
    expect(prWeightRes.target.weight).toBe(102.5); // +incrementKg (2.5) at top of repRange [8,10]

    // 4. Set tone
    const toneRes = coach.applyCoachAction(prCtx, "set-tone", { tone: "stoic" });
    expect(toneRes.ok).toBe(true);
    expect(prCtx.state.coachMemory.tone).toBe("stoic");
    expect(prCtx.saveState).toHaveBeenCalledWith("coach-tone");
  });

  test("quickPrompts, renderCoachStrip, and renderCoachSheet emit M3E hooks and escape XSS", () => {
    const ctx = makePlanCtx({
      activeWeekId: "w21",
      activeDayId: "2026-11-27",
      today: "2026-11-27",
      days: REAL_AUG_LOGS
    });
    ctx.state.coachMemory = {
      tone: "analytical",
      messages: [
        { id: "u1", role: "user", text: '<script>alert("xss")</script>', ts: 1 },
        { id: "c1", role: "coach", text: "Safe reply", ts: 2, actionType: "express-mode", actionLabel: "Express" }
      ]
    };

    const prompts = coach.quickPrompts(ctx, ctx.getDay("2026-11-27"));
    expect(prompts).toHaveLength(4);

    const stripHtml = coach.renderCoachStrip(ctx, ctx.getDay("2026-11-27"));
    const stripRoot = document.createElement("div");
    stripRoot.innerHTML = stripHtml;
    expect(stripRoot.querySelector(".coach-gadget")).not.toBeNull();
    expect(stripRoot.querySelector('[data-action="coach-action"]')).not.toBeNull();
    expect(stripRoot.querySelector('[data-action="open-sheet"][data-sheet="coach"]').textContent).toBe("Ask Coach");

    const sheetHtml = coach.renderCoachSheet(ctx);
    expect(sheetHtml).not.toContain("<script>alert");
    expect(sheetHtml).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");

    const sheetRoot = document.createElement("div");
    sheetRoot.innerHTML = sheetHtml;
    const cards = Array.from(sheetRoot.querySelectorAll(".coach-insight-grid .coach-insight-card")).map((el) => el.textContent);
    expect(cards.some((t) => t.includes("Momentum"))).toBe(true);
    expect(cards.some((t) => t.includes("Hiatus Shield Risk"))).toBe(true);
    expect(cards.some((t) => t.includes("Plateaus / Surges"))).toBe(true);
    expect(cards.some((t) => t.includes("Protein & Recovery"))).toBe(true);
    expect(sheetRoot.querySelectorAll('[data-action="coach-tone"]')).toHaveLength(3);
    expect(sheetRoot.querySelectorAll('[data-action="coach-quick-ask"]')).toHaveLength(4);
    expect(sheetRoot.querySelector(".coach-chat-log .coach-bubble")).not.toBeNull();
    const input = sheetRoot.querySelector("[data-coach-input]");
    expect(input).not.toBeNull();
    expect(sheetRoot.querySelector(`label[for="${input.getAttribute("id")}"]`)).not.toBeNull();
    expect(sheetRoot.querySelector('[data-action="coach-ask"]')).not.toBeNull();
  });

  test("validates cleanly against Lem's staged real backup JSON if available on disk", () => {
    const backupPath = "C:/Users/blaya/.gemini/antigravity/brain/fe991b5e-2e4f-46c0-bbbe-0ecc9c6e4150/scratch/user-backup-2026-11-23.json";
    if (!fs.existsSync(backupPath)) return;
    const raw = fs.readFileSync(backupPath, "utf8");
    const parsed = stateMod.parseBackupText(raw);
    expect(parsed.valid).toBe(true);

    const ctx = makePlanCtx({ state: parsed.state, activeWeekId: "w21", activeDayId: "2026-11-27", today: "2026-11-27" });
    const analysis = coach.analyzeAthlete(ctx, "2026-11-27");
    expect(analysis.daysSinceLast).toBe(97);
    expect(analysis.hiatusTier).toBe("critical");

    const legRes = coach.askCoach(ctx, "How is my leg press?");
    expect(legRes.reply).toContain("2026-08-17");
    expect(legRes.reply).toContain("2026-08-10");
    expect(legRes.reply).toContain("100");
    expect(legRes.reply).toContain("133.3");
  });
});
