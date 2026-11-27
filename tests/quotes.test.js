const fs = require("node:fs");
const path = require("node:path");

describe("v2 offline motivational quote engine (features/quotes.js)", () => {
  const quotesPath = path.join(__dirname, "..", "features", "quotes.js");
  let quotes;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    quotes = require("../features/quotes.js");
  });

  function makeCtx(overrides = {}) {
    const day = overrides.day || {
      id: "2026-11-27",
      exercises: [
        { name: "Machine Leg Press", sets: [{ reps: 10, weight: 75 }, { reps: 10, weight: 75 }] },
        { name: "Seated Leg Curls", sets: [{ reps: 12, weight: 40 }, { reps: 12, weight: 40 }] }
      ]
    };
    const week = overrides.week || { id: "w21", num: 21, phase: "Load" };
    const state = Object.assign({
      activeWeekId: week.id,
      activeDayId: day.id,
      settings: {},
      favoriteQuotes: [],
      days: {}
    }, overrides.state || {});

    return Object.assign({
      state,
      allDays: () => [{ week, day }],
      getDay: (id) => (id === day.id ? day : null),
      getWeek: (id) => (id === week.id ? week : null),
      weekForDayId: (id) => (id === day.id ? week : null),
      todayId: () => day.id,
      escapeHtml: (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (ch) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
      )),
      saveState: jest.fn(),
      runtime: {}
    }, overrides.ctx || {});
  }

  test("attaches window.LIFT_FEATURES.quotes, exports via module.exports, and has zero fetch calls", () => {
    const src = fs.readFileSync(quotesPath, "utf8");
    expect(window.LIFT_FEATURES.quotes).toBe(quotes);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/style\s*=/i);
    expect(src).not.toMatch(/&#\d{5,};/);
    expect(src).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  test("curates 60+ unique, grounded, single-line quotes across all 7 categories and 4 tones", () => {
    const expectedCategories = ["start", "grind", "rest", "pr", "reentry", "final_stretch", "low_readiness"];
    const expectedTones = ["grit", "stoic", "science", "hype"];

    expect(quotes.QUOTES.length).toBeGreaterThanOrEqual(60);

    const ids = new Set();
    const catCounts = {};
    const toneCounts = {};

    quotes.QUOTES.forEach((q) => {
      expect(typeof q.id).toBe("string");
      expect(q.id.trim().length).toBeGreaterThan(0);
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);

      expect(typeof q.text).toBe("string");
      expect(q.text.trim().length).toBeGreaterThan(15);
      expect(q.text).not.toMatch(/[\r\n]/);

      expect(typeof q.author).toBe("string");
      expect(q.author.trim().length).toBeGreaterThan(0);

      expect(expectedCategories).toContain(q.category);
      expect(expectedTones).toContain(q.tone);

      catCounts[q.category] = (catCounts[q.category] || 0) + 1;
      toneCounts[q.tone] = (toneCounts[q.tone] || 0) + 1;
    });

    expectedCategories.forEach((cat) => {
      expect(catCounts[cat]).toBeGreaterThanOrEqual(4);
    });
    expectedTones.forEach((tone) => {
      expect(toneCounts[tone]).toBeGreaterThanOrEqual(10);
    });
  });

  test("pickContext deterministically reaches all 7 contexts in priority order", () => {
    // 1. start: 0 completed sets
    const startCtx = makeCtx();
    expect(quotes.pickContext(startCtx, startCtx.getDay("2026-11-27"), {})).toBe("start");

    // 2. grind: 1 of 4 completed (0.25 < 0.75)
    const grindCtx = makeCtx({
      state: {
        activeWeekId: "w21",
        activeDayId: "2026-11-27",
        days: { "2026-11-27": { completed: { "0.0": { reps: 10, weight: 75 } } } }
      }
    });
    expect(quotes.pickContext(grindCtx, grindCtx.getDay("2026-11-27"), {})).toBe("grind");

    // 3. reentry via phase
    const reentryPhaseCtx = makeCtx({
      week: { id: "w21", num: 21, phase: "Reentry" }
    });
    expect(quotes.pickContext(reentryPhaseCtx, reentryPhaseCtx.getDay("2026-11-27"), {})).toBe("reentry");

    // 3b. reentry via 14+ day hiatus gap
    const reentryGapCtx = makeCtx({
      state: {
        activeWeekId: "w22",
        activeDayId: "2026-11-27",
        days: {
          "2026-11-01": { status: "completed", completed: { "0.0": { reps: 10, weight: 75 } } }
        }
      },
      week: { id: "w22", num: 22, phase: "Consolidate" }
    });
    expect(quotes.pickContext(reentryGapCtx, reentryGapCtx.getDay("2026-11-27"), {})).toBe("reentry");

    // 4. low_readiness overrides reentry and start
    const lowCtx = makeCtx({
      week: { id: "w21", num: 21, phase: "Reentry" },
      state: {
        activeWeekId: "w21",
        activeDayId: "2026-11-27",
        days: { "2026-11-27": { readiness: 5, completed: {} } }
      }
    });
    expect(quotes.pickContext(lowCtx, lowCtx.getDay("2026-11-27"), {})).toBe("low_readiness");

    // Empty readiness string should NOT trigger low_readiness
    const emptyReadinessCtx = makeCtx({
      state: {
        activeWeekId: "w21",
        activeDayId: "2026-11-27",
        days: { "2026-11-27": { readiness: "", completed: {} } }
      }
    });
    expect(quotes.pickContext(emptyReadinessCtx, emptyReadinessCtx.getDay("2026-11-27"), {})).toBe("start");

    // 5. final_stretch: >= 0.75 and < 1 (3 of 4 completed), overrides low_readiness
    const finalCtx = makeCtx({
      state: {
        activeWeekId: "w21",
        activeDayId: "2026-11-27",
        days: {
          "2026-11-27": {
            readiness: 4,
            completed: {
              "0.0": { reps: 10, weight: 75 },
              "0.1": { reps: 10, weight: 75 },
              "1.0": { reps: 12, weight: 40 }
            }
          }
        }
      }
    });
    expect(quotes.pickContext(finalCtx, finalCtx.getDay("2026-11-27"), {})).toBe("final_stretch");

    // 4 of 4 completed (ratio === 1) does NOT trigger final_stretch
    const doneCtx = makeCtx({
      state: {
        activeWeekId: "w21",
        activeDayId: "2026-11-27",
        days: {
          "2026-11-27": {
            completed: {
              "0.0": { reps: 10, weight: 75 },
              "0.1": { reps: 10, weight: 75 },
              "1.0": { reps: 12, weight: 40 },
              "1.1": { reps: 12, weight: 40 }
            }
          }
        }
      }
    });
    expect(quotes.pickContext(doneCtx, doneCtx.getDay("2026-11-27"), {})).toBe("grind");

    // 6. rest: active rest overrides final_stretch and low_readiness
    expect(quotes.pickContext(finalCtx, finalCtx.getDay("2026-11-27"), {
      rest: { running: true, remaining: 42 }
    })).toBe("rest");

    // Rest with endsAt in future also triggers rest
    expect(quotes.pickContext(startCtx, startCtx.getDay("2026-11-27"), {
      now: 10000,
      rest: { running: true, endsAt: 55000 }
    })).toBe("rest");

    // Inactive rest (running: false or remaining: 0) does NOT trigger rest
    expect(quotes.pickContext(startCtx, startCtx.getDay("2026-11-27"), {
      rest: { running: false, remaining: 90 }
    })).toBe("start");
    expect(quotes.pickContext(startCtx, startCtx.getDay("2026-11-27"), {
      rest: { running: true, remaining: 0 }
    })).toBe("start");

    // 7. pr: PR in lastLog or completed sets overrides rest
    expect(quotes.pickContext(finalCtx, finalCtx.getDay("2026-11-27"), {
      rest: { running: true, remaining: 42 },
      lastLog: { dayId: "2026-11-27", key: "1.0", pr: true }
    })).toBe("pr");

    const prSessionCtx = makeCtx({
      state: {
        activeWeekId: "w21",
        activeDayId: "2026-11-27",
        days: {
          "2026-11-27": {
            completed: { "0.0": { reps: 10, weight: 105, pr: true } }
          }
        }
      }
    });
    expect(quotes.pickContext(prSessionCtx, prSessionCtx.getDay("2026-11-27"), {
      rest: { running: true, remaining: 30 }
    })).toBe("pr");

    // Unchecking a set (action === "restore") should not fire PR
    expect(quotes.pickContext(prSessionCtx, prSessionCtx.getDay("2026-11-27"), {
      lastLog: { dayId: "2026-11-27", key: "0.0", action: "restore" }
    })).toBe("grind");
  });

  test("getActiveQuote caches stably per context, avoids back-to-back repeats and quoteHistory on forceNext, and respects preferred tone", () => {
    const ctx = makeCtx({
      state: {
        activeWeekId: "w21",
        activeDayId: "2026-11-27",
        settings: { quoteTone: "stoic" },
        days: {}
      }
    });
    const day = ctx.getDay("2026-11-27");
    const runtime = {};

    const first = quotes.getActiveQuote(ctx, day, runtime, false);
    expect(first.category).toBe("start");
    expect(first.tone).toBe("stoic");
    expect(first.label).toBe("SESSION OPENER");
    expect(first.favorited).toBe(false);
    expect(runtime.sessionQuote).toBeTruthy();
    expect(runtime.sessionQuote.id).toBe(first.id);

    // Re-render without forceNext keeps exact same quote
    const second = quotes.getActiveQuote(ctx, day, runtime, false);
    expect(second.id).toBe(first.id);

    // Context change refreshes quote to match new context
    runtime.rest = { running: true, remaining: 60 };
    const restQuote = quotes.getActiveQuote(ctx, day, runtime, false);
    expect(restQuote.category).toBe("rest");
    expect(restQuote.tone).toBe("stoic");
    expect(restQuote.label).toBe("REST FOCUS");

    // forceNext picks unique quotes without repeating recent quoteHistory or back-to-back
    delete ctx.state.settings.quoteTone;
    const seen = [];
    let prevId = restQuote.id;
    const restPoolSize = quotes.QUOTES.filter((q) => q.category === "rest").length;
    for (let i = 0; i < restPoolSize + 4; i += 1) {
      const next = quotes.getActiveQuote(ctx, day, runtime, true);
      expect(next.id).not.toBe(prevId);
      expect(next.category).toBe("rest");
      seen.push(next.id);
      prevId = next.id;
    }
    // Every unseen rest quote was cycled before any repeat
    expect(new Set(seen.slice(0, restPoolSize - 1)).size).toBe(restPoolSize - 1);

    // Respects state.coachMemory.tone including "analytical" -> "science"
    const coachCtx = makeCtx({
      state: {
        activeWeekId: "w21",
        activeDayId: "2026-11-27",
        coachMemory: { tone: "analytical" },
        days: {}
      }
    });
    const analyticalQuote = quotes.getActiveQuote(coachCtx, coachCtx.getDay("2026-11-27"), {}, false);
    expect(analyticalQuote.tone).toBe("science");

    // Pre-seeded quoteHistory IDs are skipped on forceNext
    const startQuotes = quotes.QUOTES.filter((q) => q.category === "start");
    const preSeeded = startQuotes.slice(0, startQuotes.length - 1).map((q) => q.id);
    const expectedRemaining = startQuotes[startQuotes.length - 1].id;
    const historyRt = {
      sessionQuote: { id: preSeeded[0], context: "start", preferredTone: null, category: "start", tone: "grit" },
      quoteHistory: preSeeded.slice()
    };
    const nextUnseen = quotes.getActiveQuote(makeCtx(), day, historyRt, true);
    expect(nextUnseen.id).toBe(expectedRemaining);
  });

  test("toggleFavorite adds/removes quote IDs idempotently and persists via saveState", () => {
    const ctx = makeCtx();
    const day = ctx.getDay("2026-11-27");
    const runtime = {};
    const q = quotes.getActiveQuote(ctx, day, runtime, false);

    const addRes = quotes.toggleFavorite(ctx, q.id);
    expect(addRes).toEqual({ favorited: true, count: 1 });
    expect(ctx.state.favoriteQuotes).toEqual([q.id]);
    expect(ctx.saveState).toHaveBeenCalledWith("quote-fav");
    expect(quotes.getActiveQuote(ctx, day, runtime, false).favorited).toBe(true);

    // Duplicate entries in dirty state still deduplicate cleanly on toggle off
    ctx.state.favoriteQuotes.push(q.id);
    const removeRes = quotes.toggleFavorite(ctx, q.id);
    expect(removeRes).toEqual({ favorited: false, count: 0 });
    expect(ctx.state.favoriteQuotes).toEqual([]);
    expect(quotes.getActiveQuote(ctx, day, runtime, false).favorited).toBe(false);
  });

  test("renderSessionQuote emits semantic M3E markup with crisp SVGs and escapes XSS payloads", () => {
    const ctx = makeCtx();
    const day = ctx.getDay("2026-11-27");
    const runtime = {
      rest: { running: true, remaining: 75 }
    };

    const html = quotes.renderSessionQuote(ctx, day, runtime);
    expect(html).toContain('class="quote-gadget"');
    expect(html).toContain('class="quote-head"');
    expect(html).toContain('class="quote-eyebrow"');
    expect(html).toContain("IN-SESSION FUEL \u00b7 REST FOCUS");
    expect(html).toContain('class="quote-text"');
    expect(html).toContain('class="quote-author"');
    expect(html).toContain('data-action="quote-fav"');
    expect(html).toContain('data-quote-id="');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('data-action="quote-next"');
    expect(html).toContain("<svg");
    expect(html).not.toMatch(/style\s*=/i);

    // XSS injection in cached runtime.sessionQuote is escaped
    const xssRuntime = {
      sessionQuote: {
        id: 'id"<img src=x onerror=alert(1)>',
        text: '<script>alert("xss")</script>',
        author: '<b>Mallory</b>',
        category: "start",
        tone: "grit",
        context: "start",
        preferredTone: null
      }
    };
    const xssHtml = quotes.renderSessionQuote(ctx, day, xssRuntime);
    expect(xssHtml).not.toContain("<script>");
    expect(xssHtml).not.toContain("<img ");
    expect(xssHtml).not.toContain("<b>Mallory</b>");
    expect(xssHtml).toContain("&lt;script&gt;");
    expect(xssHtml).toContain("&lt;b&gt;Mallory&lt;/b&gt;");
  });

  test("getRestQuoteText returns concise single-line text matching active session quote", () => {
    const ctx = makeCtx();
    const day = ctx.getDay("2026-11-27");
    const runtime = { rest: { running: true, remaining: 50 } };

    const active = quotes.getActiveQuote(ctx, day, runtime, false);
    const restText = quotes.getRestQuoteText(ctx, day, runtime);

    expect(typeof restText).toBe("string");
    expect(restText.length).toBeGreaterThan(10);
    expect(restText).not.toMatch(/[\r\n]/);
    expect(restText).toBe(active.text);
  });
});
