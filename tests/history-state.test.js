describe("v4 history integrity and state migration", () => {
  let stateMod;
  let history;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    stateMod = require("../features/state.js");
    history = require("../features/history.js");
  });

  test("migrates empty v3 day shells to unknown, never missed", () => {
    const migrated = stateMod.migrateState({
      v: 3,
      days: { "2026-06-01": { completed: {}, extraSets: {} } }
    });

    expect(migrated.v).toBe(4);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.days["2026-06-01"].status).toBe("unknown");
    expect(migrated.days["2026-06-01"].source).toBe("legacy-placeholder");
    expect(migrated.days["2026-06-01"].trained).not.toBe(true);
  });

  test("verified set data wins over stale status fields", () => {
    const migrated = stateMod.migrateState({
      v: 3,
      days: {
        "2026-06-02": {
          status: "missed",
          completed: { "0.0": { weight: 50, reps: 10, ts: 4 } }
        }
      }
    });

    expect(migrated.days["2026-06-02"].status).toBe("completed");
    expect(migrated.days["2026-06-02"].source).toBe("verified-log");
  });

  test("a completed label without surviving sets is never presented as verified", () => {
    const migrated = stateMod.migrateState({
      days: { "2026-06-02": { status: "completed", finishedAt: 10, completed: {} } }
    });
    expect(migrated.days["2026-06-02"]).toMatchObject({ status: "unknown", source: "legacy-completed-without-sets", trained: false });

    const explicitlyTrained = stateMod.migrateState({
      days: { "2026-06-03": { status: "completed", trained: true, completed: {} } }
    });
    expect(explicitlyTrained.days["2026-06-03"].status).toBe("reconstructed");
    expect(history.resolveStatus({ id: "2026-06-03", exercises: [{}] }, explicitlyTrained.days["2026-06-03"], "2026-08-01")).toBe("reconstructed");
  });

  test("normalizes RIR to the supported zero-to-four scale", () => {
    const migrated = stateMod.migrateState({
      days: { "2026-06-02": { completed: { "0.0": { weight: 50, reps: 10, rir: 9 } } } }
    });
    expect(migrated.days["2026-06-02"].completed["0.0"].rir).toBe(4);
  });

  test("reconstructs a trained day without fabricating performance", () => {
    const state = { days: {} };
    const row = history.markReconstructed(state, "2026-06-03", "Back + biceps", "Phone was reformatted");

    expect(row).toMatchObject({
      status: "reconstructed",
      source: "user-reconstructed",
      trained: true,
      workoutType: "Back + biceps",
      notes: "Phone was reformatted"
    });
    expect(row).not.toHaveProperty("completed");
    expect(row).not.toHaveProperty("weight");
    expect(row).not.toHaveProperty("volume");
    expect(row).not.toHaveProperty("calories");
    expect(row).not.toHaveProperty("prs");
  });

  test("resolves unknown and true missed dates independently", () => {
    const day = { id: "2026-06-04", exercises: [{ sets: [{ reps: 10, weight: 50 }] }] };
    expect(history.resolveStatus(day, {}, "2026-08-01")).toBe("unknown");

    const state = { days: {} };
    history.markStatus(state, day.id, "missed", "Travel day");
    expect(history.resolveStatus(day, state.days[day.id], "2026-08-01")).toBe("missed");
  });

  test("adherence excludes unknown and rest dates from the denominator", () => {
    const workout = (id) => ({ id, exercises: [{ sets: [{ reps: 10, weight: 50 }] }] });
    const entries = [
      { day: workout("2026-06-01") },
      { day: workout("2026-06-02") },
      { day: workout("2026-06-03") },
      { day: { id: "2026-06-04", exercises: [] } }
    ];
    const ctx = {
      state: {
        days: {
          "2026-06-01": { status: "completed", completed: { "0.0": { reps: 10 } } },
          "2026-06-02": { status: "reconstructed", trained: true },
          "2026-06-03": { status: "unknown" },
          "2026-06-04": { status: "rest" }
        }
      },
      allDays: () => entries,
      todayId: () => "2026-06-04"
    };

    const result = history.adherence(ctx);
    expect(result).toMatchObject({ completed: 1, reconstructed: 1, unknown: 1, rest: 1, reliable: 2, adherencePct: 100 });
  });

  test("unknown gaps do not break consistency, while a true miss does", () => {
    const days = ["2026-06-01", "2026-06-02", "2026-06-03"].map((id) => ({
      day: { id, exercises: [{ sets: [{ reps: 8, weight: 40 }] }] }
    }));
    const ctx = {
      state: {
        days: {
          "2026-06-01": { status: "completed", completed: { "0.0": { reps: 8 } } },
          "2026-06-02": { status: "unknown" },
          "2026-06-03": { status: "reconstructed", trained: true }
        }
      },
      allDays: () => days,
      todayId: () => "2026-06-03"
    };

    expect(history.streakMetrics(ctx)).toMatchObject({ current: 2, reconstructedInCurrent: 1, longestVerified: 1 });
    ctx.state.days["2026-06-02"] = { status: "missed", trained: false };
    expect(history.streakMetrics(ctx).current).toBe(1);
  });

  test("rejects malformed and structurally invalid imports", () => {
    expect(stateMod.parseBackupText("{bad")).toMatchObject({ valid: false, state: null });
    expect(stateMod.parseBackupText(JSON.stringify({ days: [] }))).toMatchObject({ valid: false, state: null });
    expect(stateMod.parseBackupText(JSON.stringify({ random: true }))).toMatchObject({ valid: false, state: null });
    expect(stateMod.parseBackupText(JSON.stringify({ nutrition: { "2026-08-01": { entries: "bad" } } }))).toMatchObject({ valid: false, state: null });
    expect(stateMod.parseBackupText(JSON.stringify({ cardio: { "2026-08-01": { entries: {} } } }))).toMatchObject({ valid: false, state: null });
    expect(stateMod.parseBackupText(JSON.stringify({ days: { "2026-08-01": { customExercises: [{ name: "Curl", sets: "bad" }] } } }))).toMatchObject({ valid: false, state: null });
  });

  test("startup migration safely strips malformed nested collections", () => {
    const migrated = stateMod.migrateState({
      days: {
        "2026-08-01": {
          customExercises: [
            { name: "Safe curl", sets: "bad", muscleGroups: [] },
            { name: "", sets: [] },
            null
          ]
        }
      },
      nutrition: { "2026-08-01": { entries: "bad" }, nope: { entries: [] } },
      cardio: { "2026-08-01": { entries: "bad" } },
      supplements: { "2026-08-01": [], nope: {} },
      rollingPlan: { weeks: [{ days: "bad" }] }
    });

    expect(migrated.days["2026-08-01"].customExercises).toEqual([
      expect.objectContaining({ name: "Safe curl", sets: [], muscleGroups: {} })
    ]);
    expect(migrated.nutrition).toEqual({ "2026-08-01": { entries: [] } });
    expect(migrated.cardio).toEqual({ "2026-08-01": { entries: [] } });
    expect(migrated.supplements).toEqual({});
    expect(migrated.rollingPlan.weeks[0].days).toEqual([]);
  });

  test("accepts partial old backups and fills missing v4 fields", () => {
    const parsed = stateMod.parseBackupText(JSON.stringify({
      v: 2,
      nutrition: { "2026-08-01": { entries: [] } }
    }));

    expect(parsed.valid).toBe(true);
    expect(parsed.state).toMatchObject({ v: 4, schemaVersion: 4, days: {}, nutrition: { "2026-08-01": { entries: [] } } });
    expect(parsed.state.profile).toMatchObject({ heightCm: 167, goalMode: "recomposition", proteinTargetG: 130 });
  });

  test("merge restore chooses the newest set and preserves both notes", () => {
    const current = {
      v: 4,
      days: {
        "2026-08-02": {
          status: "completed",
          notes: "Current note",
          completed: { "0.0": { reps: 10, weight: 50, ts: 20 } }
        }
      }
    };
    const incoming = {
      v: 3,
      days: {
        "2026-08-02": {
          notes: "Backup note",
          completed: {
            "0.0": { reps: 12, weight: 45, ts: 10 },
            "0.1": { reps: 9, weight: 50, ts: 30 }
          }
        }
      }
    };

    const merged = stateMod.mergeStates(current, incoming);
    expect(merged.days["2026-08-02"].completed["0.0"]).toMatchObject({ reps: 10, weight: 50, ts: 20 });
    expect(merged.days["2026-08-02"].completed["0.1"]).toMatchObject({ reps: 9, weight: 50, ts: 30 });
    expect(merged.days["2026-08-02"].notes).toContain("Current note");
    expect(merged.days["2026-08-02"].notes).toContain("Backup note");
    expect(merged.days["2026-08-02"].status).toBe("completed");
  });

  test("merge restore deduplicates sessions and custom exercises", () => {
    const exercise = { name: "Cable Lateral Raise", target: "2 x 15", addedAt: 123, sets: [{ reps: 15, weight: 5 }] };
    const current = {
      days: { "2026-08-03": { customExercises: [exercise] } },
      cardio: { "2026-08-03": { entries: [{ id: "run-1", distanceKm: 1, durationSec: 360 }] } }
    };
    const incoming = {
      days: { "2026-08-03": { customExercises: [exercise] } },
      cardio: { "2026-08-03": { entries: [{ id: "run-1", distanceKm: 1, durationSec: 360 }] } }
    };

    const merged = stateMod.mergeStates(current, incoming);
    expect(merged.days["2026-08-03"].customExercises).toHaveLength(1);
    expect(merged.cardio["2026-08-03"].entries).toHaveLength(1);
  });

  test("merge restore remaps distinct custom exercises instead of colliding on one index", () => {
    const current = {
      days: {
        "2026-08-03": {
          baseExerciseCount: 2,
          customExercises: [{ id: "custom-a", name: "Cable Fly", addedAt: 1 }],
          completed: { "2.0": { exerciseId: "custom-a", reps: 12, weight: 10, ts: 10 } },
          adaptiveTargets: { "2": { reason: "A target" } }
        }
      }
    };
    const incoming = {
      days: {
        "2026-08-03": {
          baseExerciseCount: 2,
          customExercises: [{ id: "custom-b", name: "Knee Raise", addedAt: 2 }],
          completed: { "2.0": { exerciseId: "custom-b", reps: 15, weight: 0, ts: 20 } },
          adaptiveTargets: { "2": { reason: "B target" } }
        }
      }
    };

    const day = stateMod.mergeStates(current, incoming).days["2026-08-03"];
    expect(day.customExercises.map((exercise) => exercise.id)).toEqual(["custom-a", "custom-b"]);
    expect(day.completed["2.0"]).toMatchObject({ exerciseId: "custom-a", reps: 12 });
    expect(day.completed["3.0"]).toMatchObject({ exerciseId: "custom-b", reps: 15 });
    expect(day.adaptiveTargets).toEqual({ "2": { reason: "A target" }, "3": { reason: "B target" } });
  });

  test("partial merge preserves current profile, backup health, and supplement preferences", () => {
    const current = {
      profile: { athlete: "Lem", heightCm: 170, proteinTargetG: 140 },
      backup: { lastExternalAt: 5000 },
      supplementSettings: { creatineDoseG: 4.5 },
      days: {}
    };
    const merged = stateMod.mergeStates(current, { v: 2, cardio: { "2026-08-03": { entries: [] } } });
    expect(merged.profile).toMatchObject({ heightCm: 170, proteinTargetG: 140 });
    expect(merged.backup.lastExternalAt).toBe(5000);
    expect(merged.supplementSettings.creatineDoseG).toBe(4.5);
  });

  test("a reconstructed side of a merge stays reconstructed without sets", () => {
    const merged = stateMod.mergeStates(
      { days: { "2026-08-04": { status: "unknown" } } },
      { days: { "2026-08-04": { status: "reconstructed", trained: true, workoutType: "Legs" } } }
    );

    expect(merged.days["2026-08-04"]).toMatchObject({ status: "reconstructed", trained: true, workoutType: "Legs", completed: {} });
  });
});
