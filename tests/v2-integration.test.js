const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function readSource(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

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

function makeTodayPlan(todayId) {
  return {
    meta: {
      athlete: "Lem",
      title: "Lift v2 Integration Plan",
      dateRange: `${todayId} to 2027-01-31`,
      timeZone: "Asia/Manila",
      baselines: [{ label: "Leg Press", value: 90, unit: "kg" }]
    },
    weeks: [
      {
        id: "w21",
        num: 21,
        phase: "Rebuild",
        sub: "Progressive overload",
        dateRange: `${todayId} to 2026-12-03`,
        notice: "Track top-set RIR cleanly.",
        days: [
          {
            id: todayId,
            dow: "Fri",
            dom: 27,
            month: "Nov",
            type: "legs",
            title: "Legs Strength",
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
                name: "Standing Calf Raise",
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

describe("Lift v2.0.0 end-to-end integration", () => {
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
    "quotes",
    "engagement",
    "coach"
  ];

  const origDocAdd = document.addEventListener.bind(document);
  const origDocRemove = document.removeEventListener.bind(document);
  const origWinAdd = window.addEventListener.bind(window);
  const origWinRemove = window.removeEventListener.bind(window);
  const origSetInterval = global.setInterval;
  const origSetTimeout = global.setTimeout;
  const origRAF = global.requestAnimationFrame;
  const origMatchMedia = window.matchMedia;
  const origScrollTo = window.scrollTo;

  let docListeners = [];
  let winListeners = [];
  let timers = [];

  function bootApp({ storedState = null, nativeBridge = null, plan = null } = {}) {
    jest.resetModules();
    localStorage.clear();
    if (storedState) {
      localStorage.setItem("lift.v3.state", JSON.stringify(storedState));
    }
    makeDom();

    const todayId = manilaTodayId();
    window.LIFT_PLAN = plan || makeTodayPlan(todayId);
    window.LIFT_FEATURES = {};
    window.LIFT_IS_NATIVE = !!nativeBridge;
    window.LiftAndroid = nativeBridge || undefined;
    delete window.__liftHandleBack;
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-visual-style");

    FEATURE_FILES.forEach((name) => {
      const mod = require(`../features/${name}.js`);
      window.LIFT_FEATURES[name] = mod;
    });

    const app = require("../app.js");
    // Ensure init-like startup bindings & initial render settle cleanly
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
    delete window.LiftAndroid;
    delete window.LIFT_IS_NATIVE;
    delete window.__liftHandleBack;
    jest.resetModules();
  });

  test("release metadata, script tags, and SW precache are synchronized to 2.0.0 / lift-v23", () => {
    const indexHtml = readSource("index.html");
    const swText = readSource("sw.js");
    const pkg = JSON.parse(readSource("package.json"));
    const lock = JSON.parse(readSource("package-lock.json"));
    const ver = JSON.parse(readSource("version.json"));
    const gradle = readSource("android/app/build.gradle.kts");

    expect(ver).toEqual({ version: "2.0.0", build: "2026-11-27" });
    expect(pkg.version).toBe("2.0.0");
    expect(lock.version).toBe("2.0.0");
    expect(lock.packages[""].version).toBe("2.0.0");
    expect(gradle).toContain("versionCode = 26");
    expect(gradle).toContain('versionName = "2.0.0"');
    expect(swText).toContain('const APP_VERSION = "2.0.0";');
    expect(swText).toContain('const CACHE_VERSION = "lift-v23";');
    expect(indexHtml).toContain('state.settings.visualStyle ? state.settings.visualStyle : "expressive"');
    expect(indexHtml).toContain('document.documentElement.dataset.visualStyle = "expressive";');

    const reentryPos = indexHtml.indexOf('<script src="./features/reentry.js"></script>');
    const quotesPos = indexHtml.indexOf('<script src="./features/quotes.js"></script>');
    const engPos = indexHtml.indexOf('<script src="./features/engagement.js"></script>');
    const coachPos = indexHtml.indexOf('<script src="./features/coach.js"></script>');
    const appPos = indexHtml.indexOf('<script src="./app.js"></script>');
    expect(reentryPos).toBeGreaterThan(-1);
    expect(quotesPos).toBeGreaterThan(reentryPos);
    expect(engPos).toBeGreaterThan(quotesPos);
    expect(coachPos).toBeGreaterThan(engPos);
    expect(appPos).toBeGreaterThan(coachPos);

    const ctx = { self: { addEventListener: () => {} } };
    vm.runInNewContext(`${swText}\nthis.__sw = { APP_SHELL };`, ctx);
    expect(ctx.__sw.APP_SHELL).toHaveLength(48);
    ["reentry", "quotes", "engagement", "coach"].forEach((name) => {
      expect(ctx.__sw.APP_SHELL).toContain(`./features/${name}.js`);
    });
  });

  test("state.js preserves SCHEMA_VERSION = 4, defaults visualStyle to expressive, and merges v2 durability fields", () => {
    const stateMod = require("../features/state.js");
    expect(stateMod.SCHEMA_VERSION).toBe(4);

    const legacyV4 = {
      v: 4,
      schemaVersion: 4,
      settings: { units: "kg", theme: "dark" },
      days: {
        "2026-11-10": {
          status: "completed",
          trained: true,
          startedAt: 1000,
          finishedAt: 5000,
          completed: {
            "0.0": { weight: 80, reps: 8, rir: 2, ts: 2000, pr: true }
          }
        }
      },
      bodyweight: [{ date: "2026-11-10", kg: 72 }],
      prs: { "Machine Leg Press": { weight: 80, reps: 8, date: "2026-11-10" } }
    };

    const migrated = stateMod.migrateState(legacyV4);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.v).toBe(4);
    expect(migrated.settings.visualStyle).toBe("expressive");
    expect(migrated.settings.quoteTone).toBe("auto");
    expect(migrated.favoriteQuotes).toEqual([]);
    expect(migrated.coachMemory.tone).toBe("analytical");
    expect(migrated.engagement).toBeTruthy();

    const migratedNeural = stateMod.migrateState(Object.assign({}, legacyV4, { settings: { units: "kg", visualStyle: "neural", quoteTone: "stoic" } }));
    expect(migratedNeural.settings.visualStyle).toBe("neural");
    expect(migratedNeural.settings.quoteTone).toBe("stoic");

    const local = Object.assign(JSON.parse(JSON.stringify(migrated)), {
      favoriteQuotes: ["q-1", "q-2"],
      coachMemory: {
        tone: "stoic",
        messages: Array.from({ length: 20 }, (_, i) => ({ role: "user", text: `L${i}`, ts: 1000 + i })),
        lastBriefAt: 1020
      },
      engagement: { xp: 240, shields: 2, maxShields: 3, bestCombo: 4, lifetimeSessions: 5, lifetimeVolumeKg: 4000, quests: { "2026-11-27": { _sets: 2 } }, shieldedDates: { "2026-11-25": true }, unlockedLoot: [{ id: "loot-1", rarity: "Rare" }], feed: [{ id: "f-1", title: "Local", hypes: 2 }] }
    });
    const remote = Object.assign(JSON.parse(JSON.stringify(migrated)), {
      settings: { units: "kg", theme: "dark", visualStyle: "neural", quoteTone: "hype" },
      favoriteQuotes: ["q-2", "q-3"],
      coachMemory: {
        tone: "hype",
        messages: Array.from({ length: 20 }, (_, i) => ({ role: "coach", text: `R${i}`, ts: 2000 + i })),
        lastBriefAt: 3000
      },
      engagement: { xp: 410, shields: 1, maxShields: 3, bestCombo: 6, lifetimeSessions: 7, lifetimeVolumeKg: 6200, quests: { "2026-11-27": { _sets: 4 } }, shieldedDates: { "2026-11-26": true }, unlockedLoot: [{ id: "loot-2", rarity: "Epic" }], feed: [{ id: "f-1", title: "Local", hypes: 5 }, { id: "f-2", title: "Remote", hypes: 1 }] }
    });

    const merged = stateMod.mergeStates(local, remote, {
      normalizeDayEntry: (d) => d || {},
      normalizeBodyweight: (b) => b || [],
      mergeMeasurements: (a, b) => a.concat(b || []),
      mergeDateIds: (a, b) => Array.from(new Set(a.concat(b || []))),
      stateUpdatedAt: () => 5000
    });

    expect(merged.favoriteQuotes).toEqual(["q-1", "q-2", "q-3"]);
    expect(merged.coachMemory.tone).toBe("hype");
    expect(merged.coachMemory.messages).toHaveLength(30);
    expect(merged.coachMemory.messages[merged.coachMemory.messages.length - 1].text).toBe("R19");
    expect(merged.engagement.xp).toBe(410);
    expect(merged.engagement.shields).toBe(2);
    expect(merged.engagement.bestCombo).toBe(6);
    expect(merged.engagement.lifetimeSessions).toBe(7);
    expect(merged.engagement.lifetimeVolumeKg).toBe(6200);
    expect(merged.engagement.shieldedDates).toEqual({ "2026-11-25": true, "2026-11-26": true });
    expect(merged.engagement.unlockedLoot.map((l) => l.id)).toEqual(["loot-1", "loot-2"]);
    expect(merged.engagement.feed.find((f) => f.id === "f-1").hypes).toBe(5);
  });

  test("fresh install defaults visualStyle to expressive, respects neural choice, and stacks home gadgets in planned order", () => {
    const fresh = bootApp();
    expect(document.documentElement.dataset.visualStyle).toBe("expressive");

    const rootHtml = document.getElementById("app").innerHTML;
    const heroIdx = rootHtml.indexOf('class="hero');
    const coachIdx = rootHtml.indexOf('class="coach-gadget');
    const momentumIdx = rootHtml.indexOf('class="momentum-gadget');
    const companionIdx = rootHtml.indexOf('class="companion-card');
    const mainIdx = rootHtml.indexOf('<main class="content');
    expect(heroIdx).toBeGreaterThan(-1);
    expect(coachIdx).toBeGreaterThan(heroIdx);
    expect(momentumIdx).toBeGreaterThan(coachIdx);
    expect(companionIdx).toBeGreaterThan(momentumIdx);
    expect(mainIdx).toBeGreaterThan(companionIdx);
    // Quote gadget only renders during an active workout
    expect(rootHtml).not.toContain('class="quote-gadget');

    const savedNeural = bootApp({
      storedState: {
        v: 4,
        schemaVersion: 4,
        settings: { visualStyle: "neural" },
        days: {}
      }
    });
    expect(savedNeural.app.getState().settings.visualStyle).toBe("neural");
    expect(document.documentElement.dataset.visualStyle).toBe("neural");
  });

  test("backfills engagement XP and lifetime stats when restoring a v4 backup without engagement keys", () => {
    const todayId = manilaTodayId();
    const v4Backup = {
      v: 4,
      schemaVersion: 4,
      settings: { units: "kg", theme: "dark", visualStyle: "neural", defaultRest: 120 },
      days: {
        "2026-11-18": {
          startedAt: Date.UTC(2026, 10, 18, 8, 0, 0),
          finishedAt: Date.UTC(2026, 10, 18, 9, 0, 0),
          status: "completed",
          trained: true,
          completed: {
            "0.0": { weight: 80, reps: 8, rir: 2, ts: 1000, pr: true },
            "0.1": { weight: 80, reps: 8, rir: 2, ts: 2000, pr: false }
          }
        },
        "2026-11-20": {
          startedAt: Date.UTC(2026, 10, 20, 8, 0, 0),
          finishedAt: Date.UTC(2026, 10, 20, 8, 55, 0),
          status: "completed",
          trained: true,
          completed: {
            "0.0": { weight: 60, reps: 10, rir: 2, ts: 3000, pr: false }
          }
        }
      },
      bodyweight: [{ date: "2026-11-20", kg: 71.5 }],
      prs: { "Machine Leg Press": { weight: 80, reps: 8, date: "2026-11-18" } }
    };

    const { app } = bootApp({ storedState: v4Backup, plan: makeTodayPlan(todayId) });
    const state = app.getState();
    expect(state.engagement.lifetimeSessions).toBe(2);
    expect(state.engagement.lifetimeVolumeKg).toBe(80 * 8 * 2 + 60 * 10);
    expect(state.engagement.xp).toBeGreaterThan(100);
    expect(state.coachMemory.tone).toBe("analytical");
  });

  test("wires quotes, coach chat & overrides (before Start Workout), quests, and Android 17 bridge contracts", () => {
    const bridgeCalls = {
      onWorkoutState: [],
      updateWidgetEngagement: [],
      scheduleHabitReminder: [],
      cancelHabitReminder: 0,
      setBackConsumerActive: [],
      openNotificationSettings: 0,
      shareText: []
    };
    const mockBridge = {
      onWorkoutState: (json) => bridgeCalls.onWorkoutState.push(JSON.parse(json)),
      updateWidgetEngagement: (json) => bridgeCalls.updateWidgetEngagement.push(JSON.parse(json)),
      scheduleHabitReminder: (delay, title, body) => {
        bridgeCalls.scheduleHabitReminder.push({ delay, title, body });
        return true;
      },
      cancelHabitReminder: () => {
        bridgeCalls.cancelHabitReminder += 1;
        return true;
      },
      setBackConsumerActive: (active) => bridgeCalls.setBackConsumerActive.push(Boolean(active)),
      openNotificationSettings: () => {
        bridgeCalls.openNotificationSettings += 1;
        return true;
      },
      shareText: (title, text) => {
        bridgeCalls.shareText.push({ title, text });
        return true;
      },
      getAndroidInfo: () => JSON.stringify({
        sdk: 37,
        isAndroid17: true,
        supportsLiveUpdates: true,
        supportsWidgetPreview: true,
        canPostPromotedNotifications: true,
        isLargeScreen: false,
        notificationsEnabled: true
      })
    };

    const { app, todayId } = bootApp({ nativeBridge: mockBridge });

    // 1. Coach Express Mode applied BEFORE Start Workout must survive freezeAdaptiveTargets
    const coachActionBtn = document.querySelector('[data-action="open-sheet"][data-sheet="coach"]');
    expect(coachActionBtn).toBeTruthy();
    app.openSheet("coach");
    expect(bridgeCalls.setBackConsumerActive).toContain(true);
    expect(document.getElementById("sheet").textContent).toContain("Adaptive Coach");

    // Change tone & ask coach a question via DOM input + button + Enter
    const hypeToneBtn = document.querySelector('[data-action="coach-tone"][data-tone="hype"]');
    app.handleClick({ target: hypeToneBtn });
    expect(app.getState().coachMemory.tone).toBe("hype");

    const input = document.querySelector("[data-coach-input]");
    input.value = "I am rushed today, give me a 15-minute express plan";
    app.handleClick({ target: document.querySelector('[data-action="coach-ask"]') });
    expect(app.getState().coachMemory.messages.length).toBeGreaterThanOrEqual(2);

    const expressBtn = document.querySelector('[data-action="coach-action"][data-coach-action="express-mode"]');
    expect(expressBtn).toBeTruthy();
    app.handleClick({ target: expressBtn });
    expect(app.getState().days[todayId].adaptiveTargets["0"].action).toBe("express-mode");

    // 2. Predictive back closes open coach sheet cleanly
    expect(window.__liftHandleBack()).toBe(true);
    expect(app.getRuntime().sheet).toBeNull();
    expect(bridgeCalls.setBackConsumerActive[bridgeCalls.setBackConsumerActive.length - 1]).toBe(false);

    // 3. Start workout cancels habit reminder, syncs widget, shows Quote Gadget, and notifies Android 17 with quote
    app.startWorkout(false);
    expect(bridgeCalls.cancelHabitReminder).toBeGreaterThanOrEqual(1);
    expect(bridgeCalls.updateWidgetEngagement.length).toBeGreaterThanOrEqual(1);
    // Express Mode must NOT be clobbered by freezeAdaptiveTargets!
    expect(app.getState().days[todayId].adaptiveTargets["0"].action).toBe("express-mode");

    app.render();
    const quoteGadget = document.querySelector(".quote-gadget");
    expect(quoteGadget).toBeTruthy();
    const quoteIdx = document.getElementById("app").innerHTML.indexOf('class="quote-gadget');
    const heroIdx = document.getElementById("app").innerHTML.indexOf('class="hero');
    const coachIdx = document.getElementById("app").innerHTML.indexOf('class="coach-gadget');
    expect(quoteIdx).toBeGreaterThan(heroIdx);
    expect(quoteIdx).toBeLessThan(coachIdx);

    const firstQuoteId = app.getRuntime().sessionQuote.id;
    app.handleClick({ target: document.querySelector('[data-action="quote-next"]') });
    const nextQuoteId = app.getRuntime().sessionQuote.id;
    expect(nextQuoteId).not.toBe(firstQuoteId);
    expect(bridgeCalls.onWorkoutState.some((snap) => typeof snap.quote === "string" && snap.quote.length > 0)).toBe(true);

    app.handleClick({ target: document.querySelector('[data-action="quote-fav"]') });
    expect(app.getState().favoriteQuotes).toContain(nextQuoteId);

    // Rest timer integrates rest quote text in rest FAB without using remaining > 0
    app.startRest(90, "Machine Leg Press");
    app.render();
    const restFabHtml = app.renderRestFab();
    expect(restFabHtml).toContain("data-rest-quote");
    const restQuote = document.querySelector("[data-rest-quote]");
    expect(restQuote).toBeTruthy();
    expect(restQuote.textContent.trim().length).toBeGreaterThan(0);

    // Quick prompt on Coach sheet works and pushes answer
    app.openSheet("coach");
    const quickChip = document.querySelector('[data-action="coach-quick-ask"]');
    expect(quickChip).toBeTruthy();
    const msgCountBeforeQuick = app.getState().coachMemory.messages.length;
    app.handleClick({ target: quickChip });
    expect(app.getState().coachMemory.messages.length).toBe(msgCountBeforeQuick + 2);
    expect(window.__liftHandleBack()).toBe(true);

    // 4. Complete sets via toggleSet & didAsPlanned -> XP/quests/widget update
    app.toggleSet(0, 0);
    const xpAfterSet1 = app.getState().engagement.xp;
    expect(xpAfterSet1).toBeGreaterThan(0);
    app.didAsPlanned(1);
    expect(app.getState().engagement.xp).toBeGreaterThan(xpAfterSet1);

    // 5. Finish workout -> XP + pending loot + widget sync + habit reminder scheduled
    const reminderCountBeforeFinish = bridgeCalls.scheduleHabitReminder.length;
    app.finishWorkout();
    expect(app.getState().engagement.lifetimeSessions).toBe(1);
    expect(app.getState().engagement.pendingLoot).toBeTruthy();
    expect(bridgeCalls.scheduleHabitReminder.length).toBeGreaterThan(reminderCountBeforeFinish);

    // Predictive back closes post-workout summary overlay too
    expect(app.getRuntime().summaryDayId).toBe(todayId);
    app.handleNotifAction("navigate-back");
    expect(app.getRuntime().summaryDayId).toBeNull();

    // 6. Momentum & Quests sheet actions: loot unboxing, pledge + habit reminder, shield, hype-feed, share-story
    app.openSheet("feed");
    expect(document.getElementById("sheet").textContent).toContain("Momentum Feed");

    const lootBtn = document.querySelector('[data-action="claim-loot"]');
    expect(lootBtn).toBeTruthy();
    app.handleClick({ target: lootBtn });
    expect(app.getState().engagement.pendingLoot).toBeNull();
    expect(app.getState().engagement.unlockedLoot.length).toBeGreaterThanOrEqual(1);

    const pledgeBtn = document.querySelector('[data-action="set-pledge"][data-when="Tomorrow"]');
    app.handleClick({ target: pledgeBtn });
    expect(app.getState().engagement.pledge.status).toBe("active");
    expect(bridgeCalls.scheduleHabitReminder[bridgeCalls.scheduleHabitReminder.length - 1].title).toContain("Pledge");

    const shieldBtn = document.querySelector('[data-action="activate-shield"]');
    app.handleClick({ target: shieldBtn });
    expect(app.getState().engagement.shieldedDates[todayId]).toBe(true);

    const hypeBtn = document.querySelector('[data-action="hype-feed"]');
    expect(hypeBtn).toBeTruthy();
    const targetFeedId = hypeBtn.dataset.itemId;
    app.handleClick({ target: hypeBtn });
    expect(app.getState().engagement.feed.find((f) => f.id === targetFeedId).hypes).toBe(1);

    const shareBtn = document.querySelector('[data-action="share-story"]');
    app.handleClick({ target: shareBtn });
    expect(bridgeCalls.shareText).toHaveLength(1);
    expect(bridgeCalls.shareText[0].title).toBe("Lift Momentum Card");

    // 7. Settings sheet renders Android 17 info, quote tone selector & notification settings button
    app.openSheet("settings");
    const notifBtn = document.querySelector('[data-action="open-android-notif-settings"]');
    expect(notifBtn).toBeTruthy();
    expect(document.querySelector('#setting-quoteTone')).toBeTruthy();
    expect(document.getElementById("sheet").textContent).toContain("Android 17");
    app.handleClick({ target: notifBtn });
    expect(bridgeCalls.openNotificationSettings).toBe(1);
  });
});
