describe("Weeks 11-15 training plan", () => {
  let plan;

  beforeAll(() => {
    jest.resetModules();
    delete window.LIFT_PLAN;
    require("../data.js");
    plan = window.LIFT_PLAN;
  });

  test("adds five complete weeks after the export without inventing missed workouts", () => {
    expect(plan.weeks).toHaveLength(15);
    expect(plan.meta.dateRange).toBe("May 12-August 30, 2026");
    expect(plan.weeks.slice(-5).map((week) => week.id)).toEqual(["w11", "w12", "w13", "w14", "w15"]);
    expect(plan.weeks[10].days[0].id).toBe("2026-07-27");
    expect(plan.weeks[14].days.at(-1).id).toBe("2026-08-30");
  });

  test("uses four lifting days and three explicit recovery days each week", () => {
    plan.weeks.slice(-5).forEach((week) => {
      expect(week.days).toHaveLength(7);
      expect(week.days.map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
      expect(week.days.filter((day) => day.exercises.length > 0)).toHaveLength(4);
      expect(week.days.filter((day) => day.type === "rest").map((day) => day.dow)).toEqual(["Wed", "Fri", "Sun"]);
      expect(week.days.some((day) => day.type === "primer")).toBe(false);
    });
  });

  test("keeps dates unique and calendar labels accurate", () => {
    const days = plan.weeks.flatMap((week) => week.days);
    const ids = days.map((day) => day.id);
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    expect(new Set(ids).size).toBe(ids.length);
    days.forEach((day) => {
      const date = new Date(`${day.id}T00:00:00Z`);
      expect(day.dow).toBe(dow[date.getUTCDay()]);
      expect(day.dom).toBe(date.getUTCDate());
      expect(day.month).toBe(months[date.getUTCMonth()]);
    });
  });

  test("uses supported phases and valid prescriptions", () => {
    expect(plan.weeks.slice(-5).map((week) => week.phase)).toEqual(["Consolidate", "Load", "Load +", "Deload", "Test"]);
    plan.weeks.slice(-5).forEach((week) => {
      week.days.forEach((day) => {
        if (day.type === "rest") expect(day.exercises).toHaveLength(0);
        day.exercises.forEach((exercise) => {
          expect(exercise.sets.length).toBeGreaterThan(0);
          exercise.sets.forEach((set) => {
            expect(set.reps).toBeGreaterThan(0);
            expect(set.weight).toBeGreaterThanOrEqual(0);
          });
          if (exercise.primary) expect(exercise.defaultRest).toBeGreaterThanOrEqual(120);
        });
      });
    });
  });
});
