describe("July bridge and Weeks 12-16 training plan", () => {
  let plan;

  beforeAll(() => {
    jest.resetModules();
    delete window.LIFT_PLAN;
    require("../data.js");
    plan = window.LIFT_PLAN;
  });

  test("fills July 20-26 and keeps the five complete progression weeks", () => {
    expect(plan.weeks).toHaveLength(16);
    expect(plan.meta.dateRange).toBe("May 12-August 30, 2026");
    expect(plan.weeks.slice(-6).map((week) => week.id)).toEqual(["w11", "w12", "w13", "w14", "w15", "w16"]);
    expect(plan.weeks[10].days[0].id).toBe("2026-07-20");
    expect(plan.weeks[10].days.at(-1).id).toBe("2026-07-26");
    expect(plan.weeks[11].days[0].id).toBe("2026-07-27");
    expect(plan.weeks[15].days.at(-1).id).toBe("2026-08-30");
  });

  test("uses the missing week as a two-session recovery bridge", () => {
    const bridge = plan.weeks[10];
    expect(bridge.phase).toBe("Deload");
    expect(bridge.days).toHaveLength(7);
    expect(bridge.days.map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(bridge.days.filter((day) => day.exercises.length > 0).map((day) => day.dow)).toEqual(["Thu", "Sat"]);
    expect(bridge.days.filter((day) => day.type === "rest").map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Fri", "Sun"]);
    expect(bridge.days.some((day) => day.type === "primer")).toBe(false);
    expect(bridge.days[3].exercises[0].sets).toEqual([{ reps: 10, weight: 30 }, { reps: 10, weight: 30 }]);
    expect(bridge.days[5].exercises[0].sets).toEqual([{ reps: 8, weight: 25 }, { reps: 8, weight: 25 }]);
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
    plan.weeks.slice(-6).forEach((week) => {
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
