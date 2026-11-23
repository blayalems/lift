const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function readSource(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function makePlan() {
  return {
    meta: {
      athlete: "Lem",
      title: "Lift Test Plan",
      dateRange: "May 12, 2026-January 31, 2027",
      timeZone: "Asia/Manila",
      baselines: [{ label: "Leg Press", value: 80, unit: "kg" }]
    },
    weeks: [
      {
        id: "w21",
        num: 21,
        phase: "Reentry",
        sub: "Rebuild grooves",
        dateRange: "2026-11-23 to 2026-11-29",
        notice: "Start light with 3+ RIR.",
        days: [
          {
            id: "2026-11-23",
            dow: "Mon",
            dom: 23,
            month: "Nov",
            type: "legs",
            title: "Legs Reentry",
            exercises: [
              {
                name: "Machine Leg Press",
                target: "3 x 8",
                defaultRest: 120,
                repRange: [8, 10],
                sets: [
                  { reps: 8, weight: 70 },
                  { reps: 8, weight: 70 },
                  { reps: 8, weight: 70 }
                ]
              },
              {
                name: "Assisted Dips",
                target: "2 x 8",
                loadDirection: "lower",
                defaultRest: 120,
                repRange: [8, 10],
                sets: [
                  { reps: 8, weight: 40 },
                  { reps: 8, weight: 35 }
                ]
              },
              {
                name: "Failure Plank",
                target: "1 x AMRAP",
                defaultRest: 60,
                sets: [{ reps: 0, weight: 0 }]
              }
            ]
          }
        ]
      },
      {
        id: "w25",
        num: 25,
        phase: "Deload",
        sub: "Holiday deload",
        dateRange: "2026-12-21 to 2026-12-27",
        notice: "Keep 3+ RIR.",
        days: [
          {
            id: "2026-12-21",
            dow: "Mon",
            dom: 21,
            month: "Dec",
            type: "legs",
            title: "Deload Legs",
            exercises: [{ name: "Machine Leg Press", sets: [{ reps: 8, weight: 60 }] }]
          }
        ]
      },
      {
        id: "w29",
        num: 29,
        phase: "Test",
        sub: "Peak test",
        dateRange: "2027-01-18 to 2027-01-24",
        notice: "Earn clean PRs.",
        days: [
          {
            id: "2027-01-18",
            dow: "Mon",
            dom: 18,
            month: "Jan",
            type: "legs",
            title: "Test Legs",
            exercises: [{ name: "Machine Leg Press", sets: [{ reps: 10, weight: 102.5 }] }]
          }
        ]
      }
    ]
  };
}

describe("Lift v1.9 bug-fixer regressions", () => {
  let docListeners = [];
  let winListeners = [];
  let intervalIds = [];
  let timeoutIds = [];
  const origDocAdd = document.addEventListener.bind(document);
  const origWinAdd = window.addEventListener.bind(window);
  const origSetInterval = global.setInterval;
  const origClearInterval = global.clearInterval;
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;
  const origAudioContext = window.AudioContext;
  const origRAF = global.requestAnimationFrame;
  const origScrollTo = window.scrollTo;
  const origMatchMedia = window.matchMedia;
  const origServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    docListeners = [];
    winListeners = [];
    intervalIds = [];
    timeoutIds = [];

    document.body.innerHTML = `
      <div id="app"></div>
      <div id="toast-root"></div>
      <div id="sheet"></div>
      <div id="sheet-backdrop"></div>
      <div id="summary-overlay"></div>
      <nav id="bottom-nav"></nav>
      <button id="fab"></button>
      <aside id="nav-drawer"></aside>
      <div id="drawer-backdrop"></div>
    `;
    window.LIFT_FEATURES = {};
    window.LIFT_PLAN = makePlan();
    window.HTMLElement = window.HTMLElement || Element;
    window.requestAnimationFrame = (cb) => cb();
    global.requestAnimationFrame = window.requestAnimationFrame;
    window.scrollTo = () => {};
    window.matchMedia = () => ({ matches: false, addEventListener: () => {} });
    window.confirm = () => true;

    document.addEventListener = (type, fn, opts) => {
      docListeners.push([type, fn, opts]);
      return origDocAdd(type, fn, opts);
    };
    window.addEventListener = (type, fn, opts) => {
      winListeners.push([type, fn, opts]);
      return origWinAdd(type, fn, opts);
    };
    global.setInterval = (fn, ms) => {
      const id = origSetInterval(fn, ms);
      intervalIds.push(id);
      return id;
    };
    global.setTimeout = (fn, ms) => {
      const id = origSetTimeout(fn, ms);
      timeoutIds.push(id);
      return id;
    };
  });

  afterEach(() => {
    docListeners.forEach(([t, fn, opts]) => document.removeEventListener(t, fn, opts));
    winListeners.forEach(([t, fn, opts]) => window.removeEventListener(t, fn, opts));
    intervalIds.forEach((id) => origClearInterval(id));
    timeoutIds.forEach((id) => origClearTimeout(id));
    document.addEventListener = origDocAdd;
    window.addEventListener = origWinAdd;
    global.setInterval = origSetInterval;
    global.setTimeout = origSetTimeout;
    window.AudioContext = origAudioContext;
    global.requestAnimationFrame = origRAF;
    window.scrollTo = origScrollTo;
    window.matchMedia = origMatchMedia;
    if (origServiceWorker === undefined) delete navigator.serviceWorker;
    else Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: origServiceWorker });
    jest.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  async function bootApp(options = {}) {
    if (options.state) {
      localStorage.setItem("lift.v3.state", JSON.stringify(options.state));
    }
    if (options.url) {
      window.history.replaceState(null, "", options.url);
    }
    const featureFiles = [
      "features/state.js",
      "features/history.js",
      "features/records.js",
      "features/progression.js",
      "features/strength.js",
      "features/nutrition.js",
      "features/library.js",
      "features/marketplace.js",
      "features/calendar.js",
      "features/heatmap.js",
      "features/journal.js",
      "features/achievements.js",
      "features/recap.js",
      "features/summary.js"
    ];
    featureFiles.forEach((file) => require(path.join(ROOT, file)));
    const appSource = readSource("app.js");
    const fn = new Function("module", appSource);
    fn(undefined);
    await new Promise((resolve) => origSetTimeout(resolve, 25));
  }

  test("1. RIR select defaults to '-' on blank sets and selects 0 only when explicitly 0", async () => {
    await bootApp({
      state: {
        v: 4,
        days: {
          "2026-11-23": {
            startedAt: 1000,
            completed: {},
            drafts: { "0.1": { rir: 0 }, "0.2": { rir: "" } }
          }
        }
      }
    });

    const selects = document.querySelectorAll('select[data-action="set-rir"]');
    expect(selects[0].value).toBe("");
    expect(selects[0].querySelector('option[value=""]').selected).toBe(true);
    expect(selects[0].querySelector('option[value="0"]').selected).toBe(false);
    expect(selects[1].value).toBe("0");
    expect(selects[2].value).toBe("");
  });

  test("2. Reentry phase, phase-aware notice headings, and weekForDayId on ctx", async () => {
    await bootApp();
    expect(document.querySelector(".phase-badge").textContent).toBe("Reentry");
    expect(document.querySelector(".hero").dataset.nxPhase).toBe("reentry");
    expect(document.querySelector(".notice strong").textContent).toBe("Reentry note");
    expect(document.querySelector(".notice").dataset.phase).toBe("reentry");

    document.querySelector('[data-action="select-week"][data-week="w25"]').click();
    expect(document.querySelector(".notice strong").textContent).toBe("Deload notice");

    document.querySelector('[data-action="select-week"][data-week="w29"]').click();
    expect(document.querySelector(".notice strong").textContent).toBe("Test week note");
  });

  test("3. removeSet removes the actual last rendered set when adaptiveTargets trimmed set count", async () => {
    await bootApp({
      state: {
        v: 4,
        days: {
          "2026-11-23": {
            startedAt: 1000,
            readiness: 5,
            adaptiveTargets: { "0": { action: "reduced-volume", weight: 70, reps: 8, sets: 2, reason: "Low readiness" } },
            extraSets: { "0": 1 },
            completed: { "0.2": { reps: 8, weight: 70, ts: 123 } }
          }
        }
      }
    });

    const removeBtn = document.querySelector('[data-action="remove-set"][data-ex="0"]');
    expect(removeBtn).not.toBeNull();
    removeBtn.click();

    const saved = JSON.parse(localStorage.getItem("lift.v3.state"));
    expect(saved.days["2026-11-23"].completed["0.2"]).toBeUndefined();
    expect(saved.days["2026-11-23"].extraSets["0"]).toBeUndefined();
  });

  test("4. handleLaunchParams start-workout starts silently and renders Finish button", async () => {
    await bootApp({ url: "/?shortcut=start-workout" });

    const heroBtn = document.querySelector('.hero-btn[data-action="finish-workout"]');
    expect(heroBtn).not.toBeNull();
    expect(heroBtn.textContent).toContain("Finish");
    const toasts = Array.from(document.querySelectorAll("#toast-root .toast")).map((n) => n.textContent);
    expect(toasts).not.toContain("Workout started.");
  });

  test("5. didAsPlanned preserves completed sets, checks adaptive reps, handles assisted PRs, and toasts when all logged", async () => {
    await bootApp({
      state: {
        v: 4,
        days: {
          "2026-08-15": {
            status: "completed",
            completed: { "0.0": { reps: 8, weight: 45 } }
          },
          "2026-11-23": {
            startedAt: 1000,
            readiness: 8,
            completed: {
              "0.0": { reps: 12, weight: 85, rir: 1, ts: 999 }
            },
            drafts: {
              "0.1": { rir: "" }
            }
          }
        }
      }
    });

    // Click did-planned on Failure Plank (exIndex 2) -> rejects 0 reps
    document.querySelector('[data-action="did-planned"][data-ex="2"]').click();
    expect(document.querySelector("#toast-root").textContent).toContain("Enter reps for failure sets individually.");

    // Click did-planned on Leg Press (exIndex 0): preserves 0.0 custom log, completes 0.1 and 0.2
    document.querySelector('[data-action="did-planned"][data-ex="0"]').click();
    let saved = JSON.parse(localStorage.getItem("lift.v3.state"));
    expect(saved.days["2026-11-23"].completed["0.0"]).toMatchObject({ reps: 12, weight: 85, rir: 1 });
    expect(saved.days["2026-11-23"].completed["0.1"].reps).toBe(8);
    expect(saved.days["2026-11-23"].completed["0.1"].rir).toBeNull();
    expect(saved.days["2026-11-23"].completed["0.2"].reps).toBe(8);

    // Click again when all sets are logged
    document.querySelector('[data-action="did-planned"][data-ex="0"]').click();
    expect(document.querySelector("#toast-root").textContent).toContain("All sets already logged.");

    // Assisted dips: adaptive adds a rep (8 -> 9) at 40 kg; verify adaptive reps (9) recorded on PR
    window.LIFT_PLAN.weeks.unshift({
      id: "w20",
      num: 20,
      phase: "Load",
      days: [
        {
          id: "2026-08-15",
          exercises: [{ name: "Assisted Dips", loadDirection: "lower", sets: [{ reps: 8, weight: 45 }] }]
        }
      ]
    });
    document.querySelector('[data-action="did-planned"][data-ex="1"]').click();
    saved = JSON.parse(localStorage.getItem("lift.v3.state"));
    expect(saved.prs["Assisted Dips"]).toMatchObject({ weight: 40, reps: 9 });

    // Also verify assisted PR picks Math.min when multiple weights exist across sets (e.g. Deload / planned)
    window.LIFT_PLAN.weeks[0].days[0].exercises[0].sets = [{ reps: 8, weight: 45 }];
    window.LIFT_PLAN.weeks[1].phase = "Deload";
    delete saved.days["2026-11-23"].completed["1.0"];
    delete saved.days["2026-11-23"].completed["1.1"];
    saved.days["2026-11-23"].adaptiveTargets["1"] = { action: "deload", weight: 40, reps: 8, sets: 2 };
    localStorage.setItem("lift.v3.state", JSON.stringify(saved));
    docListeners.forEach(([t, fn, opts]) => document.removeEventListener(t, fn, opts));
    docListeners = [];
    await bootApp({ state: saved });
    document.querySelector('[data-action="did-planned"][data-ex="1"]').click();
    saved = JSON.parse(localStorage.getItem("lift.v3.state"));
    expect(saved.prs["Assisted Dips"]).toMatchObject({ weight: 35, reps: 8 });
  });

  test("6. beep reuses a single AudioContext singleton and resumes when suspended", async () => {
    const resumeMock = jest.fn(() => Promise.resolve());
    const osc = { type: "", frequency: { value: 0 }, connect: () => ({ connect: () => {} }), start: jest.fn(), stop: jest.fn() };
    const gain = { gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() }, connect: jest.fn(() => gain) };
    const ctxInstance = { state: "suspended", currentTime: 0, destination: {}, resume: resumeMock, createOscillator: () => osc, createGain: () => gain };
    const AudioCtxMock = jest.fn(() => ctxInstance);
    window.AudioContext = AudioCtxMock;

    let tickFn = null;
    const prevSetInterval = global.setInterval;
    global.setInterval = (fn, ms) => {
      if (ms === 1000) tickFn = fn;
      return prevSetInterval(fn, ms);
    };

    const baseNow = Date.now();
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(baseNow);
    localStorage.setItem("lift.v2.rest", JSON.stringify({ duration: 60, endsAt: baseNow - 1000, pausedRemaining: 0, running: true, label: "Rest", completedAt: 0 }));

    await bootApp({
      state: {
        v: 4,
        settings: { sound: true, autoStartRest: true, defaultRest: 60 },
        days: { "2026-11-23": { startedAt: 1000, readiness: 8 } }
      }
    });

    expect(typeof tickFn).toBe("function");
    tickFn();
    expect(AudioCtxMock).toHaveBeenCalledTimes(1);
    expect(resumeMock).toHaveBeenCalledTimes(1);
    expect(osc.start).toHaveBeenCalledTimes(1);

    // Complete a set to start a second rest, then expire it and tick again
    document.querySelector('[data-action="toggle-set"][data-ex="0"][data-set="0"]').click();
    nowSpy.mockReturnValue(baseNow + 200000);
    tickFn();

    expect(AudioCtxMock).toHaveBeenCalledTimes(1);
    expect(osc.start).toHaveBeenCalledTimes(2);
  });

  test("7. plate-input and rm-input update results in place without wiping input focus", async () => {
    await bootApp();

    // Plate calculator
    document.querySelector('[data-action="plate"][data-ex="0"][data-set="0"]').click();
    const plateInput = document.getElementById("plate-target");
    plateInput.focus();
    plateInput.value = "100";
    plateInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.getElementById("plate-target")).toBe(plateInput);
    expect(document.activeElement).toBe(plateInput);
    expect(document.querySelector("[data-plate-result]").textContent).toContain("25 kg");

    // 1RM estimator
    document.querySelector('[data-action="close-sheet"]').click();
    document.querySelector('[data-action="drawer-open-sheet"][data-sheet="strength"]').click();
    const rmInput = document.getElementById("rm-w");
    rmInput.focus();
    rmInput.value = "120";
    rmInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.getElementById("rm-w")).toBe(rmInput);
    expect(document.activeElement).toBe(rmInput);
    expect(document.querySelector("[data-rm-output]").textContent).toContain("120 × 5");
  });

  test("8. save-readiness refreshes adaptiveTargets when workout started with 0 completed sets", async () => {
    window.LIFT_PLAN.weeks[0].phase = "Load";
    window.LIFT_PLAN.weeks.unshift({
      id: "w14",
      num: 14,
      phase: "Load",
      days: [
        {
          id: "2026-08-15",
          exercises: [{ name: "Machine Leg Press", sets: [{ reps: 10, weight: 80 }] }]
        }
      ]
    });
    await bootApp({
      state: {
        v: 4,
        days: {
          "2026-08-15": {
            status: "completed",
            completed: { "0.0": { reps: 10, weight: 80 } }
          },
          "2026-11-23": {
            startedAt: 1000,
            readiness: 8,
            adaptiveTargets: { "0": { action: "add-rep", weight: 80, reps: 10, sets: 3, reason: "Prior" } }
          }
        }
      }
    });
    document.querySelector('[data-action="open-sheet"][data-sheet="readiness"]').click();
    const slider = document.querySelector('[data-action="readiness-input"]');
    slider.value = "4";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('[data-action="save-readiness"]').click();

    const saved = JSON.parse(localStorage.getItem("lift.v3.state"));
    expect(saved.days["2026-11-23"].readiness).toBe(4);
    expect(saved.days["2026-11-23"].adaptiveTargets["0"].sets).toBe(2);
  });

  test("9. applyPendingReload toast, buildLog guard, and cal-prev uses todayId", async () => {
    let swListener = null;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        register: () => Promise.resolve({ update: () => Promise.resolve() }),
        addEventListener: (ev, fn) => { if (ev === "controllerchange") swListener = fn; }
      }
    });

    await bootApp();
    expect(typeof swListener).toBe("function");
    swListener();
    expect(document.querySelector("#toast-root").textContent).toContain("App update ready — reloading…");
    expect(document.querySelector("#toast-root").textContent).not.toContain("App updated to v");

    // buildLog("day") guard when activeDayId invalid
    const appMod = require("../app.js");
    expect(appMod).toBeDefined();
    expect(readSource("app.js")).toContain('if (!day) return "No active day selected.";');

    // cal-prev / cal-next uses todayId()
    expect(readSource("app.js")).toContain("var today = (todayId() || localDateId(new Date())).split(\"-\");");
  });

  test("10. heatmap dynamically covers 2026 and Jan 2027 via UTC-safe dates", () => {
    const heatmap = require("../features/heatmap.js");
    const html = window.LIFT_FEATURES.heatmap.renderHeatmap({
      allDays: () => [
        { day: { id: "2026-08-10" } },
        { day: { id: "2027-01-25" } }
      ],
      completedVolume: (day) => (day.id === "2027-01-25" ? 1500 : 500),
      kgToDisplay: (v) => v,
      cleanNumber: (v) => String(v),
      unitLabel: () => "kg",
      todayId: () => "2026-11-23"
    });
    expect(html).toContain('data-day="2026-08-10"');
    expect(html).toContain('data-day="2027-01-25" data-level="4"');
    expect(html).toContain('data-day="2027-01-31"');
  });

  test("11. marketplace escapes HTML and imported templates render in library", () => {
    require("../features/marketplace.js");
    require("../features/library.js");
    const { marketplace, library } = window.LIFT_FEATURES;

    const state = { customWorkouts: [], library: [] };
    const ctx = {
      state,
      runtime: { marketFilter: "all", marketSelected: "smolov-jr" },
      escapeHtml: (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
      icon: () => "<svg/>",
      saveState: jest.fn(),
      toast: jest.fn()
    };

    marketplace.TEMPLATES[0].title = '<img src=x onerror="alert(1)">';
    const mHtml = marketplace.renderMarketplace(ctx);
    expect(mHtml).not.toContain('<img src=x');
    expect(mHtml).toContain('&lt;img src=x');

    marketplace.importTemplate(ctx, "ppl-hypertrophy");
    const lHtml = library.renderLibrary(ctx);
    expect(lHtml).toContain("Imported templates");
    expect(lHtml).toContain("Push / Pull / Legs");
    expect(lHtml).toContain('data-action="library-start" data-id="ppl-hypertrophy"');
  });

  test("12. strength 1RM math, trend filtering, and rm-save persistence", async () => {
    const strength = require("../features/strength.js");
    expect(strength.epley(100, 1)).toBe(100);
    expect(strength.brzycki(100, 1)).toBe(100);
    expect(strength.lombardi(100, 1)).toBe(100);
    expect(strength.average(100, 1)).toBe(100);
    expect(strength.lombardi(100, 0)).toBe(0);
    expect(strength.average(100, 0)).toBe(0);

    const expected40 = (strength.epley(50, 40) + strength.lombardi(50, 40)) / 2;
    expect(strength.average(50, 40)).toBeCloseTo(expected40, 5);

    const trendHtml = strength.renderStrength({
      state: {
        days: {
          "2026-08-10": {
            completed: {
              "0.0": { weight: 40, reps: 8 },
              "1.0": { weight: 100, reps: 0 }
            }
          },
          "2026-08-17": {
            completed: {
              "0.0": { weight: 35, reps: 10 },
              "1.0": { weight: 100, reps: 0 }
            }
          }
        }
      },
      allDays: () => [
        { day: { id: "2026-08-10", exercises: [{ name: "Assisted Dips", loadDirection: "lower" }, { name: "Leg Press" }] } },
        { day: { id: "2026-08-17", exercises: [{ name: "Assisted Dips", loadDirection: "lower" }, { name: "Leg Press" }] } }
      ],
      kgToDisplay: (v) => v,
      displayToKg: (v) => Number(v),
      cleanNumber: (v, d) => Number(v).toFixed(d).replace(/\.0$/, ""),
      unitLabel: () => "kg",
      escapeHtml: (v) => String(v)
    });
    expect(trendHtml).not.toContain("Estimated 1RM trend");

    await bootApp();
    document.querySelector('[data-action="drawer-open-sheet"][data-sheet="strength"]').click();
    document.querySelector('[data-action="rm-save"]').click();

    const saved = JSON.parse(localStorage.getItem("lift.v3.state"));
    expect(saved.strengthEstimates).toHaveLength(1);
    expect(saved.strengthEstimates[0]).toMatchObject({ weightKg: 80, reps: 5, date: "2026-11-23" });
    expect(saved.strengthEstimates[0].estimated1rmKg).toBeCloseTo(strength.average(80, 5), 2);
    expect(document.getElementById("sheet").textContent).toContain("Saved 1RM estimates");
  });

  test("13. calendar prefers todayId and uses getDay with allDays fallback", () => {
    require("../features/calendar.js");
    const calendar = window.LIFT_FEATURES.calendar;
    const getDay = jest.fn((iso) => (iso === "2026-11-23" ? { id: iso, exercises: [{ sets: [] }] } : null));
    const allDays = jest.fn(() => []);
    const html = calendar.renderCalendar({
      state: { days: {} },
      runtime: {},
      getDay,
      allDays,
      todayId: () => "2026-11-23",
      localDateId: () => "2026-11-22",
      icon: () => "<svg/>",
      escapeHtml: (v) => String(v)
    });
    expect(html).toContain("November 2026");
    expect(html).toContain('data-iso="2026-11-23"');
    expect(html).toContain('data-today="true"');
    expect(getDay).toHaveBeenCalled();
    expect(allDays).not.toHaveBeenCalled();
  });

  test("14. journal ignores 0-set finished days and includes reconstructed sessions and cardio runs", () => {
    require("../features/cardio.js");
    require("../features/journal.js");
    const journal = window.LIFT_FEATURES.journal;
    const items = journal.buildJournal({
      state: {
        days: {
          "2026-08-10": { finishedAt: 1000, completed: {} },
          "2026-08-11": { status: "reconstructed", trained: true, workoutType: "Back", notes: "Logged offline", reconstructedAt: 2000 }
        },
        cardio: {
          "2026-08-12": { entries: [{ id: "c1", distanceKm: 1, durationSec: 360, environment: "treadmill", rpe: 6, ts: 3000 }] },
          "2026-08-13": { entries: [{ id: "c2", skipped: true, skipReason: "Recovery", ts: 4000 }] }
        }
      },
      allDays: () => [
        { day: { id: "2026-08-10", title: "Empty" } },
        { day: { id: "2026-08-11", title: "Pull" } }
      ],
      completedSetCount: () => 0,
      completedVolume: () => 0,
      kgToDisplay: (v) => v,
      cleanNumber: (v) => String(v),
      formatWeight: (v) => String(v),
      unitLabel: () => "kg"
    });
    expect(items.some((i) => i.title.includes("Completed"))).toBe(false);
    expect(items.some((i) => i.type === "reconstructed" && i.title.includes("Back"))).toBe(true);
    expect(items.some((i) => i.type === "cardio" && i.meta.includes("6:00/km"))).toBe(true);
    expect(items).toHaveLength(2);
  });

  test("15. achievements ignores 0-rep sets and updates cycle-complete text", () => {
    require("../features/achievements.js");
    const achievements = window.LIFT_FEATURES.achievements;
    expect(achievements.definitions.find((d) => d[0] === "cycle-complete")[2]).toBe("Complete the full training cycle.");

    const state = {
      days: {
        "2026-08-10": {
          finishedAt: 100,
          completed: { "0.0": { reps: 0, weight: 100 } }
        }
      }
    };
    const unlocked = achievements.evaluate({
      state,
      plan: { meta: { baselines: [] }, weeks: [] },
      allDays: () => [{ day: { id: "2026-08-10", exercises: [{ name: "Machine Leg Press" }] }, week: { num: 14, phase: "Load" } }],
      normalizePhase: (p) => String(p || "").toLowerCase(),
      completedSetCount: () => 0,
      totalSetCountForSource: () => 1,
      trainingStreak: () => 0,
      todayId: () => "2026-11-23"
    });
    expect(unlocked).toEqual([]);
    expect(state.achievements["first-session"]).toBeUndefined();
    expect(state.achievements["leg-press-80"]).toBeUndefined();
  });

  test("16. recap renderCycleReview uses plan dateRange and clean phase labels", () => {
    require("../features/recap.js");
    const recap = window.LIFT_FEATURES.recap;
    const html = recap.renderCycleReview({
      plan: { meta: { dateRange: "May 12, 2026-January 31, 2027" } },
      state: {
        days: {
          "2026-11-23": { finishedAt: 1, completed: { "0.0": { reps: 8, weight: 70 } } }
        }
      },
      allDays: () => [{ week: { phase: "Reentry" }, day: { id: "2026-11-23" } }],
      completedSetCount: () => 1,
      completedVolume: () => 560,
      normalizePhase: (p) => String(p).toLowerCase(),
      kgToDisplay: (v) => v,
      cleanNumber: (v) => String(v),
      trainingStreak: () => 1,
      cycleAdherence: () => 100,
      icon: () => "<svg/>",
      escapeHtml: (v) => String(v)
    });
    expect(html).toContain("May 12, 2026-January 31, 2027");
    expect(html).not.toContain("May-September Cycle");
    expect(html).toContain("Reentry: 1");
    expect(html).not.toContain('{"reentry":1}');
  });

  test("17. nutrition preserves selected quick meal across preset taps", async () => {
    await bootApp();
    document.querySelector('[data-action="open-sheet"][data-sheet="nutrition"]').click();
    const select = document.querySelector("[data-protein-quick-meal]");
    select.value = "lunch";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    document.querySelector('[data-action="protein-preset"][data-food="egg"]').click();
    expect(document.querySelector("[data-protein-quick-meal]").value).toBe("lunch");
    document.querySelector('[data-action="protein-preset"][data-food="tuna"]').click();
    expect(document.querySelector("[data-protein-quick-meal]").value).toBe("lunch");

    const saved = JSON.parse(localStorage.getItem("lift.v3.state"));
    expect(saved.nutrition["2026-11-23"].entries.map((e) => e.meal)).toEqual(["lunch", "lunch"]);
  });

  test("18. QA Phase A: past planned resolves unknown, layoff >14d breaks streak, summary skips 0-rep, state merges library/customWorkouts, reset-day clears lastLog", async () => {
    const history = require("../features/history.js");
    expect(history.resolveStatus({ id: "2026-08-24", exercises: [{}] }, { status: "planned" }, "2026-11-23")).toBe("unknown");
    expect(history.streakMetrics({
      state: {
        days: {
          "2026-08-22": { status: "completed", completed: { "0.0": { reps: 10, weight: 80 } } },
          "2026-08-24": { status: "planned" }
        }
      },
      allDays: () => [
        { day: { id: "2026-08-22", exercises: [{}] } },
        { day: { id: "2026-08-24", exercises: [{}] } },
        { day: { id: "2026-11-23", exercises: [{}] } }
      ],
      todayId: () => "2026-11-23"
    }).current).toBe(0);

    require("../features/summary.js");
    const sum = window.LIFT_FEATURES.summary.buildSummary({
      state: {
        days: {
          "2026-11-23": {
            completed: {
              "0.0": { reps: 0, weight: 300, pr: true },
              "0.1": { reps: 8, weight: 70 }
            }
          }
        }
      },
      getDay: () => ({ id: "2026-11-23", exercises: [{ name: "Leg Press" }] }),
      completedVolume: () => 560,
      completedSetCount: () => 1,
      totalSetCountForSource: () => 2,
      workoutElapsed: () => 600,
      trainingStreak: () => 1
    }, "2026-11-23");
    expect(sum.best).toMatchObject({ weight: 70, reps: 8 });
    expect(sum.prs).toEqual([]);

    const stateMod = require("../features/state.js");
    const merged = stateMod.mergeStates(
      { days: {}, customWorkouts: [{ id: "c1", name: "A" }], library: [{ id: "l1", title: "L1" }] },
      { days: {}, customWorkouts: [{ id: "c2", name: "B" }], library: [{ id: "l2", title: "L2" }] }
    );
    expect(merged.customWorkouts.map((w) => w.id)).toEqual(["c1", "c2"]);
    expect(merged.library.map((l) => l.id)).toEqual(["l1", "l2"]);

    await bootApp({
      state: {
        v: 4,
        days: { "2026-11-23": { startedAt: 1000, readiness: 8 } }
      }
    });
    document.querySelector('[data-action="toggle-set"][data-ex="0"][data-set="0"]').click();
    expect(document.querySelector('[data-action="undo-last"]')).not.toBeNull();
    document.querySelector('[data-action="reset-day"]').click();
    expect(document.querySelector('[data-action="undo-last"]')).toBeNull();
  });
});
