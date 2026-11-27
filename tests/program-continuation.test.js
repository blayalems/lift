describe("specialization and rolling programming", () => {
  let plan;
  let program;

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    delete window.LIFT_PLAN;
    require("../data.js");
    plan = window.LIFT_PLAN;
    program = require("../features/program.js");
  });

  test("adds direct ab and erector exposures while spacing standard weeks cleanly", () => {
    plan.weeks.filter((week) => week.num >= 14 && !week.generated).forEach((week) => {
      const abDays = week.days.filter((day) => day.exercises.some((exercise) => /abdominal machine|hanging knee raise/i.test(exercise.name)));
      const erectorExercises = week.days.flatMap((day) => day.exercises.filter((exercise) => /romanian deadlift|back extension/i.test(exercise.name)));
      expect(abDays.length).toBeGreaterThanOrEqual(2);
      expect(abDays.length).toBeLessThanOrEqual(3);
      expect(erectorExercises).toHaveLength(2);

      if (week.id === "w21") return;
      const extensionDay = week.days.find((day) => day.exercises.some((exercise) => exercise.name === "45 Degree Back Extension"));
      const hingeDay = week.days.find((day) => day.exercises.some((exercise) => /Romanian Deadlift/.test(exercise.name)));
      expect((new Date(`${hingeDay.id}T00:00:00Z`) - new Date(`${extensionDay.id}T00:00:00Z`)) / 86400000).toBe(2);
    });
  });

  test("keeps specialization fatigue lower during deload and reentry", () => {
    const deload = plan.weeks.find((week) => week.num === 20);
    const extension = deload.days[1].exercises.find((exercise) => exercise.name === "45 Degree Back Extension");
    const kneeRaise = deload.days[5].exercises.find((exercise) => exercise.name === "Hanging Knee Raise");
    expect(extension.sets).toHaveLength(1);
    expect(extension.tag).toBe("deload");
    expect(kneeRaise.sets).toHaveLength(1);
    expect(kneeRaise.tag).toBe("deload");
    expect(extension.note).toContain("48 hours before Thursday hinges");

    const reentry = plan.weeks.find((week) => week.num === 21);
    expect(reentry.days[1].exercises).toHaveLength(0);
    const reentryExt = reentry.days[5].exercises.find((exercise) => exercise.name === "45 Degree Back Extension");
    const reentryKnee = reentry.days[5].exercises.find((exercise) => exercise.name === "Hanging Knee Raise");
    expect(reentryExt.sets).toEqual([{ reps: 12, weight: 0 }]);
    expect(reentryExt.tag).toBe("reentry");
    expect(reentryKnee.sets).toEqual([{ reps: 10, weight: 0 }]);
    expect(reentryKnee.tag).toBe("reentry");
  });

  test("generates a contiguous four-week block after January 31, 2027", () => {
    const fixedJson = JSON.stringify(plan.weeks);
    const state = { days: {}, settings: { weightStep: 2.5 }, rollingPlan: { weeks: [] } };
    const generated = program.ensureRollingPlan(state, plan);

    expect(generated).toHaveLength(4);
    expect(generated.map((week) => week.phase)).toEqual(["Consolidate", "Load", "Load +", "Deload"]);
    expect(generated[0].num).toBe(31);
    expect(generated[0].days[0].id).toBe("2027-02-01");
    expect(generated.at(-1).days.at(-1).id).toBe("2027-02-28");
    expect(generated[0].title).not.toContain("Deload");
    expect(program.planEnd(plan)).toBe("2027-01-31");
    expect(JSON.stringify(plan.weeks.filter((week) => !week.generated))).toBe(fixedJson);
  });

  test("clamps generated reps to each exercise repRange including calves", () => {
    const generated = program.ensureRollingPlan({ days: {}, rollingPlan: { weeks: [] } }, plan);
    const legPressReps = generated.map((week) => week.days[0].exercises[0].sets[0].reps);
    const calfReps = generated.map((week) => week.days[0].exercises[3].sets[0].reps);
    expect(legPressReps).toEqual([8, 9, 10, 8]);
    expect(calfReps).toEqual([18, 19, 20, 18]);
  });

  test("attaching the rolling block repeatedly never duplicates it", () => {
    const state = { days: {}, rollingPlan: { weeks: [] } };
    program.ensureRollingPlan(state, plan);
    const firstLength = plan.weeks.length;
    const generatedAt = state.rollingPlan.generatedAt;
    program.ensureRollingPlan(state, plan);
    expect(plan.weeks).toHaveLength(firstLength);
    expect(plan.weeks.filter((week) => week.generated)).toHaveLength(4);
    expect(state.rollingPlan.generatedAt).toBe(generatedAt);
  });

  test("can append repeatable future blocks without changing fixed history", () => {
    const fixedJson = JSON.stringify(plan.weeks);
    const state = { days: {}, rollingPlan: { weeks: [] } };
    program.ensureRollingPlan(state, plan);
    const next = program.appendBlock(state, plan);
    expect(next).toHaveLength(4);
    expect(next[0].num).toBe(35);
    expect(next[0].days[0].id).toBe("2027-03-01");
    expect(next.at(-1).days.at(-1).id).toBe("2027-03-28");
    expect(state.rollingPlan.weeks).toHaveLength(8);
    expect(JSON.stringify(plan.weeks.filter((week) => !week.generated))).toBe(fixedJson);
  });

  test("auto-extends rolling blocks up to cover referenceDate with a 12-block cap", () => {
    const state = { days: {}, rollingPlan: { weeks: [] } };
    const covered = program.ensureRollingPlan(state, plan, "2027-04-15");
    expect(covered).toHaveLength(12);
    expect(covered.at(-1).days.at(-1).id).toBe("2027-04-25");

    const cappedState = { days: {}, rollingPlan: { weeks: [] } };
    const capped = program.ensureRollingPlan(cappedState, plan, "2030-01-01");
    expect(capped).toHaveLength(48);
  });

  test("verified normal-phase actual load overrides template while light deload/reentry logs do not overwrite peaks", () => {
    const state = {
      days: {
        "2026-09-15": {
          status: "completed",
          completed: {
            "0.0": { weight: 60, reps: 10 },
            "0.1": { weight: 60, reps: 10 },
            "0.2": { weight: 60, reps: 10 }
          }
        },
        "2026-09-22": {
          status: "completed",
          completed: {
            "0.0": { weight: 42.5, reps: 10 },
            "0.1": { weight: 42.5, reps: 10 }
          }
        },
        "2026-11-27": {
          status: "completed",
          completed: {
            "1.0": { weight: 37.5, reps: 10 },
            "1.1": { weight: 37.5, reps: 10 }
          }
        }
      },
      rollingPlan: { weeks: [] }
    };
    const generated = program.ensureRollingPlan(state, plan);
    const nextPulldown = generated[0].days[1].exercises.find((exercise) => exercise.name === "Lat Pulldown");
    expect(nextPulldown.sets.every((set) => set.weight === 60)).toBe(true);
  });

  test("the generated fourth week sheds volume and marks every exercise as deload", () => {
    const generated = program.ensureRollingPlan({ days: {}, rollingPlan: { weeks: [] } }, plan);
    generated[3].days.forEach((day) => {
      day.exercises.forEach((exercise) => {
        expect(exercise.tag).toBe("deload");
        expect(exercise.sets.length).toBeLessThanOrEqual(2);
      });
    });
  });

  test("renderProgram labels rolling continuation block and guards missing weeks", () => {
    const state = { days: {}, rollingPlan: { weeks: [] } };
    program.ensureRollingPlan(state, plan);
    const html = program.renderProgram({ state, escapeHtml: (v) => String(v) });
    expect(html).toContain("Rolling continuation block");
    expect(html).not.toContain("Rolling post-September block");
    expect(html).toContain("2027-02-01");
    expect(html).toContain("2027-02-28");

    const emptyHtml = program.renderProgram({ state: { rollingPlan: { weeks: [] } }, escapeHtml: (v) => String(v) });
    expect(emptyHtml).toContain(">-<");
  });
});
