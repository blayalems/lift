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

  test("adds three direct ab exposures and two intelligently spaced erector exposures", () => {
    plan.weeks.filter((week) => week.num >= 14 && !week.generated).forEach((week) => {
      const abDays = week.days.filter((day) => day.exercises.some((exercise) => /abdominal machine|hanging knee raise/i.test(exercise.name)));
      const erectorDays = week.days.filter((day) => day.exercises.some((exercise) => /romanian deadlift|back extension/i.test(exercise.name)));
      expect(abDays.length).toBeGreaterThanOrEqual(2);
      expect(abDays.length).toBeLessThanOrEqual(3);
      expect(erectorDays).toHaveLength(2);

      const extensionDay = week.days.find((day) => day.exercises.some((exercise) => exercise.name === "45 Degree Back Extension"));
      const hingeDay = week.days.find((day) => day.exercises.some((exercise) => /Romanian Deadlift/.test(exercise.name)));
      expect((new Date(`${hingeDay.id}T00:00:00Z`) - new Date(`${extensionDay.id}T00:00:00Z`)) / 86400000).toBe(2);
    });
  });

  test("keeps specialization fatigue lower during deload", () => {
    const deload = plan.weeks.find((week) => week.num === 20);
    const extension = deload.days[1].exercises.find((exercise) => exercise.name === "45 Degree Back Extension");
    const kneeRaise = deload.days[5].exercises.find((exercise) => exercise.name === "Hanging Knee Raise");
    expect(extension.sets).toHaveLength(1);
    expect(kneeRaise.sets).toHaveLength(1);
    expect(extension.note).toContain("48 hours before Thursday hinges");
  });

  test("generates a contiguous four-week block after September 27", () => {
    const fixedJson = JSON.stringify(plan.weeks);
    const state = { days: {}, settings: { weightStep: 2.5 }, rollingPlan: { weeks: [] } };
    const generated = program.ensureRollingPlan(state, plan);

    expect(generated).toHaveLength(4);
    expect(generated.map((week) => week.phase)).toEqual(["Consolidate", "Load", "Load +", "Deload"]);
    expect(generated[0].days[0].id).toBe("2026-09-28");
    expect(generated.at(-1).days.at(-1).id).toBe("2026-10-25");
    expect(program.planEnd(plan)).toBe("2026-09-27");
    expect(JSON.stringify(plan.weeks.filter((week) => !week.generated))).toBe(fixedJson);
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
    expect(next[0].num).toBe(25);
    expect(next[0].days[0].id).toBe("2026-10-26");
    expect(next.at(-1).days.at(-1).id).toBe("2026-11-22");
    expect(state.rollingPlan.weeks).toHaveLength(8);
    expect(JSON.stringify(plan.weeks.filter((week) => !week.generated))).toBe(fixedJson);
  });

  test("verified actual load overrides a lower static template in the next block", () => {
    const state = {
      days: {
        "2026-09-15": {
          status: "completed",
          completed: {
            "0.0": { weight: 60, reps: 10 },
            "0.1": { weight: 60, reps: 10 },
            "0.2": { weight: 60, reps: 10 }
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
});
