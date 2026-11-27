const fs = require("node:fs");
const path = require("node:path");

describe("habit psychology & momentum engagement engine", () => {
  let engagement;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    engagement = require("../features/engagement.js");
  });

  function makeCtx(overrides = {}) {
    const daysById = overrides.daysById || {};
    const state = overrides.state || {
      activeDayId: "2026-11-27",
      profile: { athlete: "Lem", proteinTargetG: 130, proteinRangeMinG: 120 },
      days: {}
    };
    return Object.assign({
      state,
      todayId: () => "2026-11-27",
      getDay: (id) => daysById[id] || null,
      allDays: () => Object.keys(daysById).map((id) => ({ day: daysById[id] })),
      escapeHtml: (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch])),
      formatWeight: (w) => String(w),
      unitLabel: () => "kg",
      cleanNumber: (v, d = 0) => Number(v || 0).toFixed(d),
      kgToDisplay: (kg) => kg,
      trainingStreak: () => 4,
      saveState: jest.fn()
    }, overrides);
  }

  test("contains zero network fetch calls and exports cleanly", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "features", "engagement.js"), "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(window.LIFT_FEATURES.engagement).toBe(engagement);
  });

  test("ensureEngagement initializes exact schema idempotently and backfills from history without fabricating sets", () => {
    const fresh = { days: {} };
    const eng = engagement.ensureEngagement(fresh);
    expect(eng).toEqual({
      xp: 0,
      shields: 1,
      maxShields: 3,
      combo: 0,
      bestCombo: 0,
      shieldEarnedSessions: 0,
      quests: {},
      pledge: null,
      pendingLoot: null,
      unlockedLoot: [],
      feed: [],
      shieldedDates: {},
      rewardedWorkoutDates: {},
      lifetimeSessions: 0,
      lifetimeVolumeKg: 0,
      hypes: 0,
      lastWorkoutDate: null
    });
    expect(engagement.ensureEngagement(fresh)).toBe(eng);

    const historicalState = {
      days: {
        "2026-08-10": {
          finishedAt: 1,
          completed: {
            "0.0": { reps: 10, weight: 100, pr: true, rir: 2 },
            "0.1": { reps: 0, weight: 100 }
          }
        },
        "2026-08-12": { status: "reconstructed", trained: true },
        "2026-08-13": { status: "unknown", completed: { "0.0": { reps: 0, weight: 0 } } }
      }
    };
    const seeded = engagement.ensureEngagement(historicalState);
    expect(seeded.xp).toBeGreaterThan(0);
    expect(seeded.lifetimeSessions).toBe(2);
    expect(seeded.lifetimeVolumeKg).toBe(1000);
    expect(seeded.lastWorkoutDate).toBe("2026-08-12");
    // Reconstructed and unknown days must remain free of fabricated sets
    expect(historicalState.days["2026-08-12"].completed).toBeUndefined();
    expect(historicalState.days["2026-08-10"].completed["0.1"].reps).toBe(0);

    // Calling again does not double-count starter XP
    const xpBefore = seeded.xp;
    engagement.ensureEngagement(historicalState);
    expect(seeded.xp).toBe(xpBefore);

    const legacyRawState = {
      days: {
        "2026-08-10": { completed: { "0.0": { reps: 8, weight: 60 } } }
      }
    };
    const legacySeeded = engagement.ensureEngagement(legacyRawState);
    expect(legacySeeded.xp).toBeGreaterThan(0);
    expect(legacySeeded.lifetimeSessions).toBe(1);
    expect(legacySeeded.lifetimeVolumeKg).toBe(480);

    const activeInProgressState = {
      days: {
        "2026-11-27": { status: "planned", completed: { "0.0": { reps: 8, weight: 60 } } }
      }
    };
    expect(engagement.ensureEngagement(activeInProgressState).lifetimeSessions).toBe(0);
  });

  test("backfills cleanly from Lem's real backup file without fabricating sets", () => {
    const backupPath = "C:/Users/blaya/.gemini/antigravity/brain/fe991b5e-2e4f-46c0-bbbe-0ecc9c6e4150/scratch/user-backup-2026-11-23.json";
    if (!fs.existsSync(backupPath)) return;
    const realState = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    const eng = engagement.ensureEngagement(realState);
    expect(eng.lifetimeSessions).toBe(12);
    expect(eng.lifetimeVolumeKg).toBe(41249);
    expect(eng.lastWorkoutDate).toBe("2026-08-22");
    expect(eng.xp).toBeGreaterThan(1000);
    expect(eng.shields).toBe(3);

    const ctx = makeCtx({ state: realState, todayId: () => "2026-11-27" });
    const defense = engagement.hiatusDefense(ctx, "2026-11-27");
    expect(defense.tier).toBe("reentry");
    expect(defense.gapDays).toBe(97);
    expect(defense.actionLabel).toBe("Start Minimum Dose");
  });

  test("levelInfo computes deterministic rank ladder and Zeigarnik progress", () => {
    expect(engagement.levelInfo(0)).toMatchObject({ level: 1, title: "Novice", pct: 0, xpToNext: 250 });
    expect(engagement.levelInfo(250)).toMatchObject({ level: 2, title: "Iron Regular" });
    expect(engagement.levelInfo(650)).toMatchObject({ level: 3, title: "Steel Lifter" });
    expect(engagement.levelInfo(1250)).toMatchObject({ level: 4, title: "Hypertrophy Tactician" });
    expect(engagement.levelInfo(2100)).toMatchObject({ level: 5, title: "Barbell Architect" });
    expect(engagement.levelInfo(3200)).toMatchObject({ level: 6, title: "Titan" });
    expect(engagement.levelInfo(4600)).toMatchObject({ level: 7, title: "Apex Legend" });
    expect(engagement.levelInfo(6400)).toMatchObject({ level: 8, title: "Apex Legend" });
  });

  test("dailyQuests tracks live training and rest-day progress deterministically", () => {
    const day = {
      id: "2026-11-27",
      title: "Full Body A",
      exercises: [{ name: "Leg Press", sets: [{ reps: 10, weight: 75 }, { reps: 10, weight: 75 }, { reps: 10, weight: 75 }] }]
    };
    const restDay = { id: "2026-11-29", title: "Rest", exercises: [] };
    const ctx = makeCtx({
      daysById: { [day.id]: day, [restDay.id]: restDay },
      state: {
        activeDayId: day.id,
        profile: { proteinTargetG: 130, proteinRangeMinG: 120 },
        days: {
          [day.id]: {
            readiness: 8,
            completed: { "0.0": { reps: 10, weight: 75, rir: 2 } }
          }
        },
        nutrition: {
          [restDay.id]: { entries: [{ proteinG: 125 }] }
        }
      }
    });

    const quests = engagement.dailyQuests(ctx, day.id);
    expect(quests).toHaveLength(3);
    expect(quests[0]).toMatchObject({ id: "first-set", done: true, progress: 1, target: 1 });
    expect(quests[1]).toMatchObject({ id: "readiness-cue", done: true, progress: 2, target: 2 });
    expect(quests[2]).toMatchObject({ id: "session-combo", done: false, progress: 1, target: 3 });

    const restQuests = engagement.dailyQuests(ctx, restDay.id);
    expect(restQuests).toHaveLength(3);
    expect(restQuests.find((q) => q.id === "rest-protein").done).toBe(true);
  });

  test("onSetCompleted escalates combo multipliers, awards PR/RIR/quest XP once, and logs level-ups", () => {
    const day = {
      id: "2026-11-27",
      title: "Full Body A",
      exercises: [{ name: "Leg Press", sets: Array.from({ length: 6 }, () => ({ reps: 10, weight: 75 })) }]
    };
    const ctx = makeCtx({
      daysById: { [day.id]: day },
      state: {
        activeDayId: day.id,
        days: { [day.id]: { readiness: 8, completed: {} } }
      }
    });

    const mults = [];
    for (let i = 1; i <= 6; i += 1) {
      const res = engagement.onSetCompleted(ctx, {
        dayId: day.id,
        exerciseName: "Leg Press",
        weight: 75,
        reps: 10,
        rir: i === 1 ? 2 : null,
        pr: i === 6
      });
      mults.push(res.multiplier);
      if (i === 1) expect(res.questsDone.map((q) => q.id)).toEqual(["first-set", "readiness-cue"]);
      if (i === 2) expect(res.questsDone).toEqual([]);
      if (i === 3) expect(res.questsDone.map((q) => q.id)).toEqual(["session-combo"]);
      if (i === 6) {
        expect(res.leveledUp).toBe(true);
        expect(res.levelInfo.level).toBe(2);
      }
    }
    expect(mults).toEqual([1, 1.5, 1.5, 2, 2, 3]);
    expect(ctx.state.engagement.combo).toBe(6);
    expect(ctx.state.engagement.bestCombo).toBe(6);
    expect(ctx.state.engagement.feed.some((f) => f.kind === "pr")).toBe(true);
    expect(ctx.state.engagement.feed.some((f) => f.kind === "level")).toBe(true);
  });

  test("onWorkoutFinished updates volume/tonnage, earns shields every 4 sessions, fulfills matching pledge, and rolls Mystery Crate", () => {
    const day = {
      id: "2026-11-28",
      title: "Full Body B",
      exercises: [{ name: "Incline DB Press", sets: [{ reps: 8, weight: 20 }, { reps: 8, weight: 20 }] }]
    };
    const ctx = makeCtx({
      todayId: () => "2026-11-27",
      daysById: { [day.id]: day },
      state: {
        activeDayId: day.id,
        days: {
          [day.id]: {
            status: "planned",
            completed: { "0.0": { reps: 8, weight: 20 }, "0.1": { reps: 8, weight: 20 } }
          }
        }
      }
    });

    const pledge = engagement.setPledge(ctx, "Tomorrow", "Morning");
    expect(pledge).toMatchObject({ when: "Tomorrow", slot: "Morning", targetDate: "2026-11-28", bonusXp: 150, status: "active" });

    // Non-matching day does not fulfill Tomorrow's pledge
    const early = engagement.onWorkoutFinished(ctx, "2026-11-27", { roll: () => 0.1 });
    expect(early.pledgeFulfilled).toBe(false);
    expect(ctx.state.engagement.pledge.status).toBe("active");

    // Matching day fulfills pledge (+150 XP) and creates Mythic crate on high roll
    const matched = engagement.onWorkoutFinished(ctx, "2026-11-28", { roll: () => 0.97 });
    expect(matched.pledgeFulfilled).toBe(true);
    expect(matched.pledgeBonus).toBe(150);
    expect(matched.xpGained).toBe(50 + 40 + 150);
    expect(matched.sessionVolume).toBe(320);
    expect(matched.pendingLoot.rarity).toBe("Mythic");

    // 2 more workouts hit 4 total sessions and earn +1 shield (from 1 -> 2)
    engagement.onWorkoutFinished(ctx, "2026-11-29", { roll: () => 0.55 });
    const fourth = engagement.onWorkoutFinished(ctx, "2026-11-30", { roll: () => 0.85 });
    expect(fourth.shieldEarned).toBe(true);
    expect(ctx.state.engagement.shields).toBe(2);

    // Feed never exceeds 40 entries (distinct session dates)
    for (let i = 0; i < 45; i += 1) {
      const dateId = new Date(Date.UTC(2026, 11, 1 + i)).toISOString().slice(0, 10);
      engagement.onWorkoutFinished(ctx, dateId);
    }
    expect(ctx.state.engagement.feed.length).toBeLessThanOrEqual(40);
    expect(ctx.state.engagement.shields).toBe(3); // capped at maxShields

    expect(engagement.tonnageEquivalent(200)).toContain("barbell");
    expect(engagement.tonnageEquivalent(700)).toContain("grand piano");
    expect(engagement.tonnageEquivalent(2700)).toContain("compact car");
    expect(engagement.tonnageEquivalent(60000)).toContain("city bus");
  });

  test("claimLoot applies rewards (including shield overflow XP), moves to unlockedLoot, and logs feed", () => {
    const ctx = makeCtx();
    const eng = engagement.ensureEngagement(ctx.state);
    eng.shields = 3;
    eng.pendingLoot = {
      id: "loot-1",
      rarity: "Epic",
      kind: "Bonus Shield",
      title: "Streak Freeze Shield (+1 Shield)",
      detail: "Bonus protection",
      xpBonus: 20,
      shieldBonus: 1,
      dayId: "2026-11-27"
    };

    const claimed = engagement.claimLoot(ctx);
    expect(claimed.overflowXp).toBe(60);
    expect(eng.xp).toBe(80);
    expect(eng.pendingLoot).toBeNull();
    expect(eng.unlockedLoot).toHaveLength(1);
    expect(eng.feed[0].kind).toBe("loot");
    expect(engagement.claimLoot(ctx)).toBeNull();
  });

  test("activateShield spends shield once per date and rejects when empty", () => {
    const ctx = makeCtx();
    const first = engagement.activateShield(ctx, "2026-11-27");
    expect(first).toEqual({ ok: true, alreadyShielded: false, dateId: "2026-11-27", shields: 0 });
    expect(ctx.state.engagement.shieldedDates["2026-11-27"]).toBe(true);

    const repeat = engagement.activateShield(ctx, "2026-11-27");
    expect(repeat.alreadyShielded).toBe(true);

    const empty = engagement.activateShield(ctx, "2026-11-28");
    expect(empty).toEqual({ ok: false, reason: "no-shields", dateId: "2026-11-28", shields: 0 });
  });

  test("hiatusDefense escalates compassionately across all 5 psychological tiers", () => {
    const makeHiatusCtx = (lastId, refId) => makeCtx({
      todayId: () => refId,
      state: {
        days: lastId ? { [lastId]: { completed: { "0.0": { reps: 10, weight: 60 } } } } : {},
        engagement: { xp: 100, shields: 1, maxShields: 3, combo: 0, bestCombo: 0, shieldEarnedSessions: 0, quests: {}, pledge: null, pendingLoot: null, unlockedLoot: [], feed: [], shieldedDates: {}, lifetimeSessions: lastId ? 1 : 0, lifetimeVolumeKg: 600, hypes: 0, lastWorkoutDate: lastId }
      }
    });

    expect(engagement.hiatusDefense(makeHiatusCtx(null, "2026-11-27"), "2026-11-27")).toMatchObject({ tier: "active", gapDays: 0, title: "Momentum locked" });
    expect(engagement.hiatusDefense(makeHiatusCtx("2026-11-27", "2026-11-27"), "2026-11-27")).toMatchObject({ tier: "active", gapDays: 0, title: "Momentum locked" });
    expect(engagement.hiatusDefense(makeHiatusCtx("2026-11-26", "2026-11-27"), "2026-11-27")).toMatchObject({ tier: "active", gapDays: 1, title: "Momentum locked" });
    expect(engagement.hiatusDefense(makeHiatusCtx("2026-11-24", "2026-11-27"), "2026-11-27")).toMatchObject({ tier: "watch", gapDays: 3, title: "Protect the groove", actionLabel: "Lock Tomorrow Pledge" });
    expect(engagement.hiatusDefense(makeHiatusCtx("2026-11-22", "2026-11-27"), "2026-11-27")).toMatchObject({ tier: "warning", gapDays: 5, title: "Break the friction barrier", actionLabel: "Launch 10-Min Express" });
    expect(engagement.hiatusDefense(makeHiatusCtx("2026-11-17", "2026-11-27"), "2026-11-27")).toMatchObject({ tier: "rescue", gapDays: 10, title: "One light session resets the chain", actionLabel: "Activate Shield + Return" });
    expect(engagement.hiatusDefense(makeHiatusCtx("2026-11-10", "2026-11-27"), "2026-11-27")).toMatchObject({ tier: "reentry", gapDays: 17, title: "Fresh Reentry Ramp Ready", actionLabel: "Start Minimum Dose" });
  });

  test("hypeFeedItem and widgetPayload maintain counts and compact Android widget JSON", () => {
    const day = {
      id: "2026-11-27",
      title: "Full Body A",
      exercises: [{ name: "Leg Press", sets: [{ reps: 10, weight: 75 }] }]
    };
    const ctx = makeCtx({ daysById: { [day.id]: day } });
    engagement.setPledge(ctx, "Today", "Evening");
    const finished = engagement.onWorkoutFinished(ctx, day.id);
    const hype = engagement.hypeFeedItem(ctx, finished.feedItem.id);
    expect(hype).toEqual({ itemId: finished.feedItem.id, itemHypes: 1, totalHypes: 1 });

    const payload = engagement.widgetPayload(ctx);
    expect(payload).toMatchObject({
      level: 1,
      title: "Novice",
      shields: 1,
      hiatusTier: "active",
      gapDays: 0,
      pledgeText: "",
      streak: 4
    });
    expect(typeof payload.nextQuest).toBe("string");
  });

  test("renderMomentumGadget and renderFeedSheet emit clean anti-slop markup and escape untrusted strings", () => {
    const xss = '<img src=x onerror=alert(1)>';
    const day = {
      id: "2026-11-27",
      title: xss,
      exercises: [{ name: "Leg Press", sets: [{ reps: 10, weight: 75 }] }]
    };
    const ctx = makeCtx({
      daysById: { [day.id]: day },
      state: {
        activeDayId: day.id,
        profile: { athlete: xss },
        days: {
          "2026-11-20": { completed: { "0.0": { reps: 10, weight: 75 } } }
        }
      }
    });
    engagement.onWorkoutFinished(ctx, "2026-11-20");
    engagement.setPledge(ctx, "Tomorrow", "Morning");

    const gadgetHtml = engagement.renderMomentumGadget(ctx, day);
    expect(gadgetHtml).toContain("momentum-gadget");
    expect(gadgetHtml).toContain("xp-bar-track");
    expect(gadgetHtml).toContain("xp-bar-fill");
    expect(gadgetHtml).toContain("combo-badge");
    expect(gadgetHtml).toContain("shield-pill");
    expect(gadgetHtml).toContain("quest-list");
    expect(gadgetHtml).toContain("quest-item");
    expect(gadgetHtml).toContain("loot-crate");
    expect(gadgetHtml).toContain("hiatus-card");
    expect(gadgetHtml).toContain('data-action="claim-loot"');
    expect(gadgetHtml).toContain('data-action="open-sheet" data-sheet="feed"');
    expect(gadgetHtml).not.toContain("<img");

    const sheetHtml = engagement.renderFeedSheet(ctx);
    expect(sheetHtml).toContain("feed-list");
    expect(sheetHtml).toContain("feed-card");
    expect(sheetHtml).toContain("story-card");
    expect(sheetHtml).toContain('data-action="set-pledge"');
    expect(sheetHtml).toContain('data-action="activate-shield"');
    expect(sheetHtml).toContain('data-action="hype-feed"');
    expect(sheetHtml).toContain('data-action="share-story"');
    expect(sheetHtml).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(sheetHtml).not.toContain("<img");
    expect(sheetHtml).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(gadgetHtml).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    const nonBarStyles = (gadgetHtml + sheetHtml).match(/style="[^"]*"/g) || [];
    expect(nonBarStyles.every((attr) => /^style="width:\d+%"$/.test(attr))).toBe(true);
    expect(engagement.shareStoryText(ctx)).toContain("Lv 1");
  });

  test("mystery crates cover all rarities and reward types across deterministic rolls", () => {
    const rarities = new Set();
    const kinds = new Set();
    const rolls = [
      [0.10, 0.10], // Common XP Surge
      [0.20, 0.60], // Common Coach Secret
      [0.60, 0.15], // Rare Bonus Shield
      [0.65, 0.40], // Rare Title Unlock
      [0.85, 0.10], // Epic PR Crown
      [0.97, 0.10]  // Mythic PR Crown
    ];
    rolls.forEach(([r1, r2], idx) => {
      const ctx = makeCtx();
      const seq = [r1, r2];
      let cursor = 0;
      const res = engagement.onWorkoutFinished(ctx, `2026-11-0${idx + 1}`, {
        roll: () => seq[cursor++ % seq.length]
      });
      rarities.add(res.pendingLoot.rarity);
      kinds.add(res.pendingLoot.kind);
      const claimed = engagement.claimLoot(ctx);
      expect(claimed).not.toBeNull();
    });
    expect(Array.from(rarities).sort()).toEqual(["Common", "Epic", "Mythic", "Rare"]);
    expect(Array.from(kinds).sort()).toEqual(["Bonus Shield", "Coach Secret", "PR Crown", "Title Unlock", "XP Surge"]);
  });
});
