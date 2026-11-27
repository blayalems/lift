const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const LEM_BACKUP_PATH = "C:/Users/blaya/.gemini/antigravity/brain/fe991b5e-2e4f-46c0-bbbe-0ecc9c6e4150/scratch/user-backup-2026-11-23.json";

const FEATURE_FILES = [
  "state",
  "history",
  "persistence",
  "records",
  "streaks",
  "progression",
  "summary",
  "volume",
  "cardio",
  "nutrition",
  "body",
  "program",
  "forms",
  "voice",
  "notifications",
  "cloud",
  "healthkit",
  "reentry",
  "marketplace",
  "library",
  "quickadd",
  "quotes",
  "engagement",
  "coach"
];

function makeDom() {
  document.body.innerHTML = `
    <div id="app"></div>
    <div id="toast-root"></div>
    <div id="sheet" tabindex="-1"></div>
    <div id="sheet-backdrop"></div>
    <div id="summary-overlay"></div>
    <nav id="bottom-nav"></nav>
    <button id="fab"></button>
    <aside id="nav-drawer" tabindex="-1"></aside>
    <div id="drawer-backdrop"></div>
  `;
}

function manilaTodayId() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date()).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function makePlan(todayId) {
  return {
    meta: {
      athlete: "Lem",
      title: "Adversarial Stress Plan",
      dateRange: `${todayId} to 2027-01-31`,
      timeZone: "Asia/Manila",
      baselines: [{ label: "Leg Press", value: 90, unit: "kg" }]
    },
    weeks: [
      {
        id: "w21",
        num: 21,
        phase: "Rebuild",
        sub: "Stress test",
        dateRange: `${todayId} to 2026-12-03`,
        notice: "Track sets.",
        days: [
          {
            id: todayId,
            dow: "Fri",
            dom: 27,
            month: "Nov",
            type: "legs",
            title: "Full Body A",
            exercises: [
              {
                id: "leg-press",
                name: "Machine Leg Press",
                target: "3 x 8",
                defaultRest: 90,
                primary: true,
                compound: true,
                repRange: [8, 10],
                sets: [
                  { reps: 8, weight: 80 },
                  { reps: 8, weight: 80 },
                  { reps: 8, weight: 80 }
                ]
              },
              {
                id: "calf-raise",
                name: "Seated Calf Raises",
                target: "3 x 12",
                defaultRest: 60,
                repRange: [10, 15],
                sets: [
                  { reps: 12, weight: 40 },
                  { reps: 12, weight: 40 },
                  { reps: 12, weight: 40 }
                ]
              }
            ]
          },
          {
            id: "2099-01-05",
            dow: "Mon",
            dom: 5,
            month: "Jan",
            type: "upper",
            title: "Upper Push/Pull",
            exercises: [
              {
                id: "bench-press",
                name: "Barbell Bench Press",
                target: "3 x 6",
                defaultRest: 120,
                primary: true,
                compound: true,
                repRange: [6, 8],
                sets: [
                  { reps: 6, weight: 60 },
                  { reps: 6, weight: 60 },
                  { reps: 6, weight: 60 }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}

describe("Lift v2.0.0 adversarial stress & edge-case suite", () => {
  const origDocAdd = document.addEventListener.bind(document);
  const origDocRemove = document.removeEventListener.bind(document);
  const origWinAdd = window.addEventListener.bind(window);
  const origWinRemove = window.removeEventListener.bind(window);
  const origSetInterval = global.setInterval;
  const origSetTimeout = global.setTimeout;
  const origRAF = global.requestAnimationFrame;
  const origMatchMedia = window.matchMedia;
  const origScrollTo = window.scrollTo;
  const origAlert = window.alert;

  let docListeners = [];
  let winListeners = [];
  let timers = [];

  function loadModules({ withData = true } = {}) {
    jest.resetModules();
    localStorage.clear();
    makeDom();
    window.LIFT_FEATURES = {};
    delete window.LIFT_PLAN;
    delete window.LiftAndroid;
    delete window.LIFT_IS_NATIVE;
    delete window.__liftHandleBack;
    if (withData) require("../data.js");
    const mods = {};
    FEATURE_FILES.forEach((name) => {
      const mod = require(`../features/${name}.js`);
      if (!window.LIFT_FEATURES[name]) window.LIFT_FEATURES[name] = mod;
      mods[name] = window.LIFT_FEATURES[name];
    });
    return mods;
  }

  function bootApp({ storedRaw = null, storedState = null, nativeBridge = null, plan = null } = {}) {
    jest.resetModules();
    localStorage.clear();
    if (storedRaw != null) {
      localStorage.setItem("lift.v3.state", storedRaw);
    } else if (storedState != null) {
      localStorage.setItem("lift.v3.state", JSON.stringify(storedState));
    }
    makeDom();

    const todayId = manilaTodayId();
    window.LIFT_PLAN = plan || makePlan(todayId);
    window.LIFT_FEATURES = {};
    window.LIFT_IS_NATIVE = !!nativeBridge;
    window.LiftAndroid = nativeBridge || undefined;
    delete window.__liftHandleBack;
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-visual-style");

    FEATURE_FILES.forEach((name) => {
      const mod = require(`../features/${name}.js`);
      if (!window.LIFT_FEATURES[name]) window.LIFT_FEATURES[name] = mod;
    });

    const app = require("../app.js");
    app.render();
    return { app, todayId };
  }

  beforeEach(() => {
    docListeners = [];
    winListeners = [];
    timers = [];
    window.requestAnimationFrame = (cb) => cb();
    global.requestAnimationFrame = window.requestAnimationFrame;
    window.scrollTo = () => {};
    window.matchMedia = () => ({ matches: false, addEventListener: () => {} });
    window.confirm = () => true;
    window.alert = jest.fn();

    document.addEventListener = (type, fn, opts) => {
      docListeners.push([type, fn, opts]);
      return origDocAdd(type, fn, opts);
    };
    window.addEventListener = (type, fn, opts) => {
      winListeners.push([type, fn, opts]);
      return origWinAdd(type, fn, opts);
    };
    global.setInterval = () => 0;
    global.setTimeout = (fn, ms) => {
      const id = origSetTimeout(fn, Math.min(Number(ms) || 0, 5));
      timers.push(id);
      return id;
    };
  });

  afterEach(() => {
    docListeners.forEach(([type, fn, opts]) => origDocRemove(type, fn, opts));
    winListeners.forEach(([type, fn, opts]) => origWinRemove(type, fn, opts));
    timers.forEach((id) => clearTimeout(id));
    document.addEventListener = origDocAdd;
    window.addEventListener = origWinAdd;
    global.setInterval = origSetInterval;
    global.setTimeout = origSetTimeout;
    global.requestAnimationFrame = origRAF;
    window.matchMedia = origMatchMedia;
    window.scrollTo = origScrollTo;
    window.alert = origAlert;
    delete window.LiftAndroid;
    delete window.LIFT_IS_NATIVE;
    delete window.__liftHandleBack;
    delete Object.prototype.polluted;
    delete Object.prototype.pollutedCtor;
    delete Object.prototype.hacked;
    jest.resetModules();
  });

  describe("1. Hostile backups, prototype pollution, XSS & corrupted types", () => {
    test("rejects prototype pollution and prevents __proto__/constructor hijacking on parsed and merged state", () => {
      const mods = loadModules();
      const hostileJson = JSON.stringify({
        constructor: { prototype: { pollutedCtor: true } },
        settings: { visualStyle: "expressive" },
        days: {
          "2026-11-27": {
            status: "completed",
            completed: { "0.0": { reps: 8, weight: 80 } }
          }
        }
      });
      // Inject raw __proto__ properties as JSON.parse produces them from untrusted files
      const rawWithProto =
        '{"__proto__":{"polluted":"yes","toString":null},"constructor":{"prototype":{"pollutedCtor":"yes"}},' +
        '"settings":{"__proto__":{"hacked":true},"visualStyle":"expressive"},' +
        '"days":{"2026-11-27":{"status":"completed","completed":{"__proto__":{"reps":99,"weight":500},"0.0":{"reps":8,"weight":80}}}}}';

      const parsed = mods.state.parseBackupText(rawWithProto);
      expect(parsed.valid).toBe(true);
      expect(({}).polluted).toBeUndefined();
      expect(({}).pollutedCtor).toBeUndefined();
      expect(({}).hacked).toBeUndefined();

      // State objects themselves must retain Object.prototype and never expose hijacked proto props
      expect(Object.getPrototypeOf(parsed.state)).toBe(Object.prototype);
      expect(parsed.state.polluted).toBeUndefined();
      expect(Object.getPrototypeOf(parsed.state.settings)).toBe(Object.prototype);
      expect(parsed.state.settings.hacked).toBeUndefined();
      expect(Object.getPrototypeOf(parsed.state.days["2026-11-27"].completed)).toBe(Object.prototype);
      expect(parsed.state.days["2026-11-27"].completed.reps).toBeUndefined();
      expect(() => String(parsed.state)).not.toThrow();

      // Merge path must also stay clean against raw __proto__
      const base = mods.state.parseBackupText(hostileJson).state;
      const merged = mods.state.mergeStates(base, JSON.parse(rawWithProto));
      expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
      expect(merged.polluted).toBeUndefined();
      expect(({}).polluted).toBeUndefined();
    });

    test("escapes <img src=x onerror=alert(1)> across exercises, coach, pledges, marketplace, quotes, and feed", () => {
      const xss = '<img src=x onerror=alert(1)>';
      const xssAttr = '" onclick="alert(1)" data-evil="';
      const { app, todayId } = bootApp();

      // 1. Custom exercise via QuickAdd & Library
      const quickadd = window.LIFT_FEATURES.quickadd;
      const library = window.LIFT_FEATURES.library;
      const marketplace = window.LIFT_FEATURES.marketplace;
      const coach = window.LIFT_FEATURES.coach;
      const engagement = window.LIFT_FEATURES.engagement;
      const quotes = window.LIFT_FEATURES.quotes;

      const state = app.getState();
      state.profile.athlete = xss;
      app.getRuntime().quickAddDraft = { name: xss, sets: 2, reps: 10, weight: 25, restSec: 60 };
      expect(quickadd.commit({
        state,
        runtime: app.getRuntime(),
        allDays: () => [{ week: window.LIFT_PLAN.weeks[0], day: app.getDay(todayId) }],
        displayToKg: (v) => Number(v),
        saveState: () => {},
        toast: () => {}
      })).toBe(true);

      // 2. Custom library entry + marketplace check
      library.addCustomWorkout({ state }, { name: xss, exercises: [xss, { name: xssAttr, sets: [{ reps: 8, weight: 20 }] }] });
      const marketHtml = marketplace.renderMarketplace({
        state,
        runtime: { marketFilter: "all", marketSelected: "smolov-jr" },
        escapeHtml: app.escapeHtml
      });
      const libHtml = library.renderLibrary({
        state,
        escapeHtml: app.escapeHtml,
        icon: () => "<svg></svg>"
      });

      // Also inject XSS into marketplace & library state + render sheets through app.js
      state.library = [{ id: `lib-${xssAttr}`, title: xss, summary: xss, blocks: [{ day: xss, focus: xss }] }];
      app.openSheet("library");
      app.openSheet("marketplace");

      // 3. Coach XSS question + render
      app.openSheet("coach");
      const input = document.querySelector("[data-coach-input]");
      input.value = `How is my ${xss} doing? ${xssAttr}`;
      app.handleClick({ target: document.querySelector('[data-action="coach-ask"]') });
      const coachRawHtml = coach.renderCoachSheet({
        state,
        allDays: () => [{ week: window.LIFT_PLAN.weeks[0], day: app.getDay(todayId) }],
        getDay: app.getDay,
        getWeek: () => window.LIFT_PLAN.weeks[0],
        weekForDayId: () => window.LIFT_PLAN.weeks[0],
        todayId: () => todayId,
        escapeHtml: app.escapeHtml
      });

      // 4. Engagement pledge + feed item XSS
      engagement.setPledge({ state, todayId: () => todayId }, xss, xssAttr);
      state.engagement.feed.unshift({
        id: `feed-${xssAttr}`,
        kind: "pr",
        title: `PR ${xss}`,
        detail: `Detail ${xss}`,
        date: todayId,
        ts: Date.now(),
        hypes: 0
      });
      const feedRawHtml = engagement.renderFeedSheet({
        state,
        todayId: () => todayId,
        getDay: app.getDay,
        allDays: () => [{ week: window.LIFT_PLAN.weeks[0], day: app.getDay(todayId) }],
        escapeHtml: app.escapeHtml
      });
      app.openSheet("feed");

      // 5. Quotes XSS cached payload & Rest FAB quote
      app.startWorkout(false);
      app.startRest(60, xss);
      const qRuntime = {
        rest: { running: true, remaining: 45 },
        sessionQuote: {
          id: `q-${xssAttr}`,
          text: `Push ${xss}`,
          author: xss,
          category: "rest",
          tone: "grit",
          context: "rest",
          preferredTone: null
        }
      };
      const quoteHtml = quotes.renderSessionQuote({ state, escapeHtml: app.escapeHtml }, app.getDay(todayId), qRuntime);
      app.getRuntime().sessionQuote = qRuntime.sessionQuote;
      app.render();

      // Also render prs, progress, journal, and summary overlay with custom XSS exercise
      app.openSheet("prs");
      app.openSheet("progress");
      app.toggleSet(2, 0);
      app.finishWorkout();
      app.openSheet("journal");

      // Verify zero injected elements or event-handler attributes in any DOM container
      const containers = [
        document.getElementById("app"),
        document.getElementById("sheet"),
        document.getElementById("nav-drawer"),
        document.getElementById("summary-overlay")
      ];
      containers.forEach((el) => {
        expect(el.querySelectorAll("img")).toHaveLength(0);
        expect(el.querySelectorAll("script")).toHaveLength(0);
        expect(el.querySelectorAll("[onerror]")).toHaveLength(0);
        expect(el.querySelectorAll("[onclick]")).toHaveLength(0);
        expect(el.querySelectorAll("[data-evil]")).toHaveLength(0);
      });

      const rawRenderedHtml = [
        coachRawHtml,
        feedRawHtml,
        marketHtml,
        libHtml,
        quoteHtml
      ].join("\n");
      expect(rawRenderedHtml).not.toContain("<img ");
      expect(rawRenderedHtml).not.toContain("<script");
      expect(rawRenderedHtml).not.toContain('onclick="alert');
      expect(rawRenderedHtml).not.toContain('data-evil="');
      expect(rawRenderedHtml).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(window.alert).not.toHaveBeenCalled();
    });

    test("survives corrupted engagement, coachMemory, favoriteQuotes types, NaN/Infinity, and cyclic objects", () => {
      const mods = loadModules();

      const badVariants = [null, "corrupted-string", 42, -99, NaN, Infinity, -Infinity, ["bad", 123, null]];
      badVariants.forEach((badVal) => {
        const corruptedState = {
          v: 4,
          schemaVersion: 4,
          settings: badVal,
          profile: badVal,
          days: {
            "2026-11-27": {
              status: "completed",
              readiness: badVal,
              completed: { "0.0": { reps: 10, weight: 80 } }
            }
          },
          engagement: badVal,
          coachMemory: badVal,
          favoriteQuotes: badVal
        };

        const migrated = mods.state.migrateState(corruptedState);
        expect(Array.isArray(migrated.favoriteQuotes)).toBe(true);
        expect(typeof migrated.coachMemory).toBe("object");
        expect(Array.isArray(migrated.coachMemory.messages)).toBe(true);
        expect(typeof migrated.engagement).toBe("object");
        expect(Number.isFinite(migrated.engagement.xp)).toBe(true);

        const rawClone = {
          days: {},
          engagement: badVal,
          coachMemory: badVal,
          favoriteQuotes: badVal
        };
        const eng = mods.engagement.ensureEngagement(rawClone);
        expect(Number.isFinite(eng.xp)).toBe(true);
        expect(Number.isFinite(eng.shields)).toBe(true);
        expect(Array.isArray(eng.feed)).toBe(true);

        const mem = mods.coach.ensureCoachMemory(rawClone);
        expect(["analytical", "stoic", "hype"]).toContain(mem.tone);
        expect(Array.isArray(mem.messages)).toBe(true);
      });

      // Explicit Infinity/NaN inside engagement fields directly passed to ensureEngagement / seedFromHistory
      const infEngState = {
        days: {
          "2026-11-20": {
            status: "completed",
            completed: { "0.0": { reps: Infinity, weight: 100 } }
          }
        },
        engagement: {
          xp: Infinity,
          shields: Infinity,
          maxShields: Infinity,
          combo: Infinity,
          bestCombo: NaN,
          lifetimeSessions: Infinity,
          lifetimeVolumeKg: Infinity,
          hypes: -Infinity
        }
      };
      const safeEng = mods.engagement.ensureEngagement(infEngState);
      expect(Number.isFinite(safeEng.xp)).toBe(true);
      expect(Number.isFinite(safeEng.shields)).toBe(true);
      expect(Number.isFinite(safeEng.maxShields)).toBe(true);
      expect(Number.isFinite(safeEng.combo)).toBe(true);
      expect(Number.isFinite(safeEng.lifetimeSessions)).toBe(true);
      expect(Number.isFinite(safeEng.lifetimeVolumeKg)).toBe(true);

      const infHistoryOnly = {
        days: {
          "2026-11-20": {
            status: "completed",
            completed: { "0.0": { reps: Infinity, weight: 100 } }
          }
        }
      };
      const seededInf = mods.engagement.ensureEngagement(infHistoryOnly);
      expect(Number.isFinite(seededInf.lifetimeVolumeKg)).toBe(true);

      // Cyclic object resilience across ensureEngagement, ensureCoachMemory, and migrateState
      const cyclic = {
        days: {},
        engagement: { quests: {}, feed: [] },
        coachMemory: { tone: "stoic", messages: [], checkins: [] }
      };
      cyclic.self = cyclic;
      cyclic.engagement.quests["2026-11-27"] = cyclic.engagement;
      cyclic.coachMemory.checkins.push(cyclic.coachMemory);

      expect(() => mods.engagement.ensureEngagement(cyclic)).not.toThrow();
      expect(() => mods.coach.ensureCoachMemory(cyclic)).not.toThrow();
      expect(() => mods.state.migrateState(cyclic)).not.toThrow();

      // App boot with corrupted persisted JSON in localStorage
      const { app } = bootApp({
        storedState: {
          v: 4,
          days: {},
          engagement: "broken",
          coachMemory: 12345,
          favoriteQuotes: { broken: true }
        }
      });
      expect(app.getState().engagement.shields).toBeGreaterThanOrEqual(0);
      expect(app.getState().coachMemory.tone).toBe("analytical");
      expect(app.getState().favoriteQuotes).toEqual([]);
    });

    test("validates, backfills, and boots cleanly from Lem's real user-backup-2026-11-23.json", () => {
      expect(fs.existsSync(LEM_BACKUP_PATH)).toBe(true);
      const raw = fs.readFileSync(LEM_BACKUP_PATH, "utf8");
      const mods = loadModules();
      const parsed = mods.state.parseBackupText(raw);
      expect(parsed.valid).toBe(true);
      expect(parsed.errors).toEqual([]);

      // Boot full app with Lem's backup loaded in storage and real data.js plan
      jest.resetModules();
      localStorage.clear();
      localStorage.setItem("lift.v3.state", raw);
      makeDom();
      window.LIFT_FEATURES = {};
      delete window.LIFT_PLAN;
      require("../data.js");
      FEATURE_FILES.forEach((name) => {
        const mod = require(`../features/${name}.js`);
        if (!window.LIFT_FEATURES[name]) window.LIFT_FEATURES[name] = mod;
      });
      const app = require("../app.js");
      app.render();

      const state = app.getState();
      expect(state.engagement.lifetimeSessions).toBe(12);
      expect(state.engagement.lifetimeVolumeKg).toBe(41249);
      expect(state.engagement.lastWorkoutDate).toBe("2026-08-22");
      expect(state.engagement.xp).toBeGreaterThan(1000);
      // Empty unknown days must never fabricate sets, while verified days stay intact
      expect(state.days["2026-08-03"].status).toBe("unknown");
      expect(state.days["2026-08-03"].completed).toEqual({});
      expect(state.days["2026-09-07"].completed).toEqual({});
      expect(Object.keys(state.days["2026-08-12"].completed)).toHaveLength(6);

      app.openSheet("coach");
      expect(document.getElementById("sheet").textContent).toContain("Reentry Ramp");
      app.openSheet("feed");
      expect(document.getElementById("sheet").textContent).toContain("41249 kg");
    });
  });

  describe("2. Scale & memory stress (5,000-day history benchmark)", () => {
    test("processes 5,000 days under 500ms and caps coachMemory.messages <= 30 and feed <= 40", () => {
      const mods = loadModules();
      const daysMap = {};
      const dayList = [];
      const weekMap = {};
      const dayMap = {};
      const dayWeekMap = {};
      const baseMs = Date.UTC(2013, 0, 1);

      for (let i = 0; i < 5000; i += 1) {
        const dId = new Date(baseMs + i * 86400000).toISOString().slice(0, 10);
        const wId = `w-${Math.floor(i / 7)}`;
        if (!weekMap[wId]) weekMap[wId] = { id: wId, num: Math.floor(i / 7), phase: "Load", days: [] };
        const day = {
          id: dId,
          title: `Session ${i}`,
          exercises: [
            { name: "Machine Leg Press", primary: true, compound: true, repRange: [8, 10], sets: [{ reps: 10, weight: 80 }] },
            { name: "Seated Calf Raises", repRange: [10, 15], sets: [{ reps: 12, weight: 40 }] }
          ]
        };
        weekMap[wId].days.push(day);
        dayMap[dId] = day;
        dayWeekMap[dId] = weekMap[wId];
        dayList.push({ week: weekMap[wId], day });
        daysMap[dId] = {
          status: "completed",
          readiness: 8,
          finishedAt: baseMs + i * 86400000,
          completed: { "0.0": { reps: 10, weight: 80 }, "1.0": { reps: 12, weight: 40 } }
        };
      }

      const lastId = dayList[4999].day.id;
      const bigState = {
        activeWeekId: dayList[4999].week.id,
        activeDayId: lastId,
        profile: { athlete: "Lem", proteinTargetG: 130, proteinRangeMinG: 120 },
        days: daysMap,
        coachMemory: { tone: "analytical", messages: [], checkins: [] }
      };

      const bigCtx = {
        state: bigState,
        progression: mods.progression,
        reentry: mods.reentry,
        allDays: () => dayList,
        getDay: (id) => dayMap[id] || null,
        getWeek: (id) => weekMap[id] || null,
        weekForDayId: (id) => dayWeekMap[id] || null,
        todayId: () => lastId,
        escapeHtml: (v) => String(v == null ? "" : v),
        formatWeight: (w) => String(w),
        unitLabel: () => "kg",
        cleanNumber: (v, d = 0) => Number(v || 0).toFixed(d),
        kgToDisplay: (kg) => kg,
        trainingStreak: () => 50,
        saveState: jest.fn()
      };

      const t0 = performance.now();
      const seeded = mods.engagement.seedFromHistory(bigState);
      const ensured = mods.engagement.ensureEngagement(bigState);
      const t1 = performance.now();
      const analysis = mods.coach.analyzeAthlete(bigCtx, lastId);
      const t2 = performance.now();
      const coachRes = mods.coach.askCoach(bigCtx, "How is my leg press?");
      const t3 = performance.now();
      const feedHtml = mods.engagement.renderFeedSheet(bigCtx);
      const t4 = performance.now();

      const totalMs = t4 - t0;
      expect(seeded).toBe(ensured);
      expect(ensured.lifetimeSessions).toBe(5000);
      expect(analysis.adherence14d).toBe(100);
      expect(coachRes.reply).toContain("Machine Leg Press");
      expect(feedHtml).toContain("5000");
      expect(t1 - t0).toBeLessThan(500);
      expect(t2 - t1).toBeLessThan(500);
      expect(t3 - t2).toBeLessThan(500);
      expect(t4 - t3).toBeLessThan(500);
      expect(totalMs).toBeLessThan(1000);

      // Memory & array caps across heavy chat and workout finishes
      for (let i = 0; i < 50; i += 1) {
        mods.coach.askCoach(bigCtx, `Check today's session #${i}`);
      }
      expect(bigState.coachMemory.messages.length).toBeLessThanOrEqual(30);
      expect(bigState.coachMemory.checkins.length).toBeLessThanOrEqual(30);

      for (let i = 0; i < 60; i += 1) {
        const extraDate = new Date(Date.UTC(2030, 0, 1) + i * 86400000).toISOString().slice(0, 10);
        mods.engagement.onWorkoutFinished(bigCtx, extraDate, { roll: () => 0.1 });
      }
      expect(bigState.engagement.feed.length).toBeLessThanOrEqual(40);
    });
  });

  describe("3. Coach boundary inputs & action idempotency", () => {
    test("handles empty, 10k-char, unknown exercise, NaN/Infinity inputs, repeated express-mode, and unknown actions", () => {
      const mods = loadModules();
      const day = {
        id: "2026-11-27",
        title: "Full Body A",
        exercises: [
          { name: "Machine Leg Press", primary: true, compound: true, repRange: [8, 10], sets: [{ reps: 8, weight: 80 }, { reps: 8, weight: 80 }, { reps: 8, weight: 80 }] },
          { name: "Seated Calf Raises", repRange: [10, 15], sets: [{ reps: 12, weight: 40 }, { reps: 12, weight: 40 }, { reps: 12, weight: 40 }] }
        ]
      };
      const week = { id: "w21", num: 21, phase: "Load", days: [day] };
      const state = mods.state.migrateState({
        v: 4,
        activeWeekId: "w21",
        activeDayId: "2026-11-27",
        days: {
          "2026-11-27": {
            readiness: Infinity,
            completed: { "0.0": { reps: NaN, weight: Infinity } }
          }
        }
      });
      const ctx = {
        state,
        progression: mods.progression,
        reentry: mods.reentry,
        allDays: () => [{ week, day }],
        getDay: (id) => (id === day.id ? day : null),
        getWeek: () => week,
        weekForDayId: () => week,
        todayId: () => "2026-11-27",
        escapeHtml: (v) => String(v == null ? "" : v),
        saveState: jest.fn(),
        openSheet: jest.fn()
      };

      // Empty / whitespace questions return brief without appending empty turns
      [null, undefined, "", "   \t\n  "].forEach((emptyQ) => {
        const res = mods.coach.askCoach(ctx, emptyQ);
        expect(typeof res.reply).toBe("string");
        expect(res.reply.length).toBeGreaterThan(5);
        expect(state.coachMemory.messages).toHaveLength(0);
      });

      // 10,000-character hostile query executes quickly without ReDoS
      const t0 = performance.now();
      const longRes = mods.coach.askCoach(ctx, "x ".repeat(5000));
      expect(performance.now() - t0).toBeLessThan(150);
      expect(longRes.reply.length).toBeGreaterThan(10);
      expect(longRes.reply).not.toContain("NaN");
      expect(longRes.reply).not.toContain("Infinity");

      // Unknown exercise query falls back gracefully
      const unknownExRes = mods.coach.askCoach(ctx, "How is my Bulgarian Underwater Zercher Bosu Squat?");
      expect(typeof unknownExRes.reply).toBe("string");
      expect(unknownExRes.reply.length).toBeGreaterThan(10);

      // NaN / Infinity readiness & reps never leak NaN/Infinity into analysis
      state.days["2026-11-27"].readiness = NaN;
      state.days["2026-11-27"].completed["0.1"] = { reps: Infinity, weight: NaN };
      const nanAnalysis = mods.coach.analyzeAthlete(ctx, "2026-11-27");
      expect(nanAnalysis.readinessScore).toBeNull();
      expect(Number.isFinite(nanAnalysis.hiatusRisk)).toBe(true);

      // Repeated applyCoachAction("express-mode") is idempotent
      const exp1 = mods.coach.applyCoachAction(ctx, "express-mode");
      expect(exp1.ok).toBe(true);
      const snapshot1 = JSON.parse(JSON.stringify(state.days["2026-11-27"].adaptiveTargets));
      expect(snapshot1["0"].sets).toBe(2);
      expect(snapshot1["1"].sets).toBe(1);

      const exp2 = mods.coach.applyCoachAction(ctx, "express-mode");
      expect(exp2.ok).toBe(true);
      const snapshot2 = JSON.parse(JSON.stringify(state.days["2026-11-27"].adaptiveTargets));
      expect(snapshot2["0"].sets).toBe(snapshot1["0"].sets);
      expect(snapshot2["1"].sets).toBe(snapshot1["1"].sets);
      expect(snapshot2["0"].weight).toBe(snapshot1["0"].weight);

      // Unknown actionType safety
      ["unknown-action", "", null, "__proto__"].forEach((badAction) => {
        const res = mods.coach.applyCoachAction(ctx, badAction, {});
        expect(res.ok).toBe(false);
      });
    });
  });

  describe("4. Engagement boundary & idempotency", () => {
    test("handles 100-set combo burst, empty loot, zero shields, invalid pledges, and negative/zero bounds", () => {
      const mods = loadModules();
      const engMod = mods.engagement;
      const day = {
        id: "2026-11-27",
        title: "Mega Volume Day",
        exercises: [{ name: "Leg Press", sets: Array.from({ length: 100 }, () => ({ reps: 10, weight: 80 })) }]
      };
      const ctx = {
        state: { activeDayId: day.id, days: { [day.id]: { status: "planned", completed: {} } } },
        todayId: () => day.id,
        getDay: (id) => (id === day.id ? day : null),
        allDays: () => [{ day }],
        escapeHtml: (v) => String(v == null ? "" : v),
        formatWeight: (w) => String(w),
        unitLabel: () => "kg",
        cleanNumber: (v, d = 0) => Number(v || 0).toFixed(d),
        kgToDisplay: (kg) => kg,
        trainingStreak: () => 1,
        saveState: jest.fn()
      };

      // Rapid 100-set combo chain
      let lastXp = 0;
      for (let i = 0; i < 100; i += 1) {
        const res = engMod.onSetCompleted(ctx, {
          dayId: day.id,
          exerciseName: "Leg Press",
          weight: 80,
          reps: 10,
          pr: i % 10 === 0,
          rir: 2
        });
        expect(res.combo).toBe(i + 1);
        expect(res.multiplier).toBeLessThanOrEqual(3);
        expect(ctx.state.engagement.xp).toBeGreaterThan(lastXp);
        lastXp = ctx.state.engagement.xp;
      }
      expect(ctx.state.engagement.combo).toBe(100);
      expect(ctx.state.engagement.bestCombo).toBe(100);
      expect(ctx.state.engagement.feed.length).toBeLessThanOrEqual(40);
      expect(engMod.levelInfo(ctx.state.engagement.xp).level).toBeGreaterThanOrEqual(6);
      expect(engMod.levelInfo(10000).level).toBeGreaterThanOrEqual(8);

      // claimLoot when pendingLoot == null
      ctx.state.engagement.pendingLoot = null;
      expect(engMod.claimLoot(ctx)).toBeNull();

      // activateShield when shields === 0
      ctx.state.engagement.shields = 0;
      expect(engMod.activateShield(ctx, "2026-11-28")).toEqual({
        ok: false,
        reason: "no-shields",
        dateId: "2026-11-28",
        shields: 0
      });
      expect(ctx.state.engagement.shields).toBe(0);
      expect(ctx.state.engagement.shieldedDates["2026-11-28"]).toBeUndefined();

      // Invalid setPledge args
      [
        [null, undefined],
        [123, {}],
        ["Never", "Midnight"],
        ["<img src=x onerror=alert(1)>", "<script>alert(1)</script>"]
      ].forEach(([w, s]) => {
        const p = engMod.setPledge(ctx, w, s);
        expect(["Today", "Tomorrow"]).toContain(p.when);
        expect(["Morning", "Afternoon", "Evening"]).toContain(p.slot);
        expect(p.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(p.bonusXp).toBe(150);
      });

      // Negative / zero / NaN xp and weight bounds
      expect(engMod.levelInfo(-500)).toMatchObject({ level: 1, xp: 0, pct: 0, xpToNext: 250 });
      expect(engMod.levelInfo(NaN)).toMatchObject({ level: 1, xp: 0, pct: 0, xpToNext: 250 });
      expect(engMod.levelInfo(Infinity).level).toBe(1);
      expect(engMod.tonnageEquivalent(-100)).toBe("0 kg");
      expect(engMod.tonnageEquivalent(0)).toBe("0 kg");
      expect(engMod.tonnageEquivalent(NaN)).toBe("0 kg");

      // Negative/zero weight & reps on onSetCompleted should not write negative loads into feed or award PR XP on 0/negative reps
      const cleanCtx = {
        state: { activeDayId: "2026-11-27", days: { "2026-11-27": { status: "planned", completed: {} } } },
        todayId: () => "2026-11-27"
      };
      engMod.onSetCompleted(cleanCtx, { dayId: "2026-11-27", exerciseName: "Squat", weight: -50, reps: -5, pr: true });
      const latestFeed = cleanCtx.state.engagement.feed[0];
      if (latestFeed) {
        expect(latestFeed.detail).not.toContain("-50");
        expect(latestFeed.detail).not.toContain("x -5");
      }
      expect(cleanCtx.state.engagement.combo).toBe(0);
    });

    test("double onWorkoutFinished calls on the same dayId are idempotent without inflating sessions, volume, or XP", () => {
      const mods = loadModules();
      const engMod = mods.engagement;
      const day = {
        id: "2026-11-27",
        title: "Full Body A",
        exercises: [{ name: "Leg Press", sets: [{ reps: 10, weight: 80 }, { reps: 10, weight: 80 }] }]
      };
      const ctx = {
        state: {
          activeDayId: day.id,
          days: {
            [day.id]: {
              completed: { "0.0": { reps: 10, weight: 80 }, "0.1": { reps: 10, weight: 80 } }
            }
          }
        },
        todayId: () => day.id,
        getDay: (id) => (id === day.id ? day : null),
        allDays: () => [{ day }]
      };

      const first = engMod.onWorkoutFinished(ctx, day.id, { roll: () => 0.1 });
      expect(first.lifetimeSessions).toBe(1);
      expect(first.lifetimeVolumeKg).toBe(1600);
      const xpAfterFirst = ctx.state.engagement.xp;
      const lootAfterFirst = ctx.state.engagement.pendingLoot;

      const second = engMod.onWorkoutFinished(ctx, day.id, { roll: () => 0.9 });
      expect(second.lifetimeSessions).toBe(1);
      expect(second.lifetimeVolumeKg).toBe(1600);
      expect(ctx.state.engagement.xp).toBe(xpAfterFirst);
      expect(ctx.state.engagement.unlockedLoot).toHaveLength(0);
      expect(ctx.state.engagement.pendingLoot).toEqual(lootAfterFirst);

      // Also verify app.finishWorkout() called twice on the same active day does not double-count
      const { app, todayId } = bootApp();
      app.startWorkout(false);
      app.toggleSet(0, 0);
      app.finishWorkout();
      const appSessions1 = app.getState().engagement.lifetimeSessions;
      const appXp1 = app.getState().engagement.xp;
      const appVol1 = app.getState().engagement.lifetimeVolumeKg;

      app.finishWorkout();
      expect(app.getState().engagement.lifetimeSessions).toBe(appSessions1);
      expect(app.getState().engagement.xp).toBe(appXp1);
      expect(app.getState().engagement.lifetimeVolumeKg).toBe(appVol1);
      expect(app.getState().engagement.lastWorkoutDate).toBe(todayId);
    });
  });

  describe("5. Quotes stress & missing DOM/runtime resilience", () => {
    test("200 consecutive forceNext cycles across tones/contexts never crash and never repeat immediately", () => {
      const mods = loadModules();
      const qMod = mods.quotes;
      const day = {
        id: "2026-11-27",
        exercises: [{ name: "Machine Leg Press", sets: [{ reps: 10, weight: 80 }, { reps: 10, weight: 80 }] }]
      };

      ["auto", "stoic", "grit", "science", "hype", "analytical"].forEach((tone) => {
        const runtime = {};
        const ctx = {
          state: {
            activeDayId: day.id,
            settings: { quoteTone: tone },
            favoriteQuotes: [],
            days: {}
          },
          getDay: () => day,
          todayId: () => day.id,
          runtime
        };

        let prevId = null;
        for (let i = 0; i < 200; i += 1) {
          if (i === 50) runtime.rest = { running: true, remaining: 60 };
          if (i === 100) {
            runtime.rest = { running: false, remaining: 0 };
            ctx.state.days[day.id] = { readiness: 4, completed: {} };
          }
          if (i === 150) {
            ctx.state.days[day.id] = { completed: { "0.0": { reps: 10, weight: 100, pr: true } } };
          }
          const quote = qMod.getActiveQuote(ctx, day, runtime, true);
          expect(quote).toBeTruthy();
          expect(typeof quote.id).toBe("string");
          expect(quote.text.trim().length).toBeGreaterThan(10);
          expect(quote.id).not.toBe(prevId);
          expect(runtime.quoteHistory.length).toBeLessThanOrEqual(48);
          prevId = quote.id;
        }
      });

      // Missing DOM / null ctx / missing runtime resilience
      expect(() => qMod.pickContext(null, null, null)).not.toThrow();
      expect(() => qMod.getActiveQuote(null, null, null, true)).not.toThrow();
      expect(() => qMod.toggleFavorite(null, "q-start-01")).not.toThrow();
      expect(() => qMod.renderSessionQuote({}, null, {})).not.toThrow();
      expect(() => qMod.getRestQuoteText(null, null, null)).not.toThrow();
    });
  });

  describe("6. Throwing native Android bridge resilience", () => {
    test("gracefully catches exceptions from every throwing window.LiftAndroid method across full app flows", () => {
      const boom = (name) => () => {
        throw new Error(`LiftAndroid.${name} failed`);
      };
      const throwingBridge = {
        onWorkoutState: jest.fn(boom("onWorkoutState")),
        updateWidgetEngagement: jest.fn(boom("updateWidgetEngagement")),
        scheduleHabitReminder: jest.fn(boom("scheduleHabitReminder")),
        cancelHabitReminder: jest.fn(boom("cancelHabitReminder")),
        setBackConsumerActive: jest.fn(boom("setBackConsumerActive")),
        openNotificationSettings: jest.fn(boom("openNotificationSettings")),
        getAndroidInfo: jest.fn(boom("getAndroidInfo")),
        setSystemBars: jest.fn(boom("setSystemBars")),
        saveStateMirror: jest.fn(boom("saveStateMirror")),
        loadStateMirror: jest.fn(boom("loadStateMirror")),
        clearStateMirror: jest.fn(boom("clearStateMirror")),
        saveBackupFile: jest.fn(boom("saveBackupFile")),
        saveImageFile: jest.fn(boom("saveImageFile")),
        shareText: jest.fn(boom("shareText")),
        shareJsonFile: jest.fn(boom("shareJsonFile")),
        shareImageFile: jest.fn(boom("shareImageFile")),
        haptic: jest.fn(boom("haptic")),
        clearWorkout: jest.fn(boom("clearWorkout"))
      };

      const { app } = bootApp({ nativeBridge: throwingBridge });

      expect(() => app.openSheet("coach")).not.toThrow();
      expect(() => app.handleBackNavigation()).not.toThrow();

      expect(() => app.startWorkout(false)).not.toThrow();
      expect(() => app.toggleSet(0, 0)).not.toThrow();
      expect(() => app.handleClick({ target: document.querySelector('[data-action="quote-next"]') })).not.toThrow();
      expect(() => app.finishWorkout()).not.toThrow();

      app.openSheet("feed");
      expect(() => app.handleClick({ target: document.querySelector('[data-action="set-pledge"]') })).not.toThrow();
      expect(() => app.handleClick({ target: document.querySelector('[data-action="share-story"]') })).not.toThrow();

      expect(() => app.openSheet("settings")).not.toThrow();
      expect(() => app.handleClick({ target: document.querySelector('[data-action="open-android-notif-settings"]') })).not.toThrow();
      expect(() => app.handleClick({ target: document.querySelector('[data-action="cycle-theme"]') })).not.toThrow();

      expect(throwingBridge.setBackConsumerActive).toHaveBeenCalled();
      expect(throwingBridge.cancelHabitReminder).toHaveBeenCalled();
      expect(throwingBridge.updateWidgetEngagement).toHaveBeenCalled();
      expect(throwingBridge.onWorkoutState).toHaveBeenCalled();
      expect(throwingBridge.scheduleHabitReminder).toHaveBeenCalled();
      expect(throwingBridge.openNotificationSettings).toHaveBeenCalled();
      expect(throwingBridge.setSystemBars).toHaveBeenCalled();
    });
  });
});
