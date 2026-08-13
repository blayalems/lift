describe("July bridge and Weeks 12-20 training plan", () => {
  let plan;

  beforeAll(() => {
    jest.resetModules();
    delete window.LIFT_PLAN;
    require("../data.js");
    plan = window.LIFT_PLAN;
  });

  test("fills July 20-26 and extends the plan through September 27", () => {
    expect(plan.weeks).toHaveLength(20);
    expect(plan.meta.dateRange).toBe("May 12-September 27, 2026");
    expect(plan.weeks.slice(-10).map((week) => week.id)).toEqual([
      "w11", "w12", "w13", "w14", "w15", "w16", "w17", "w18", "w19", "w20"
    ]);
    expect(plan.weeks[10].days[0].id).toBe("2026-07-20");
    expect(plan.weeks[10].days.at(-1).id).toBe("2026-07-26");
    expect(plan.weeks[13].days[0].id).toBe("2026-08-10");
    expect(plan.weeks[19].days.at(-1).id).toBe("2026-09-27");
  });

  test("uses the missing week as a low-fatigue six-session bridge", () => {
    const bridge = plan.weeks[10];
    expect(bridge.phase).toBe("Deload");
    expect(bridge.days).toHaveLength(7);
    expect(bridge.days.map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(bridge.days[3].exercises[0].sets).toEqual([{ reps: 10, weight: 30 }, { reps: 10, weight: 30 }]);
    expect(bridge.days[5].exercises[0].sets).toEqual([{ reps: 8, weight: 25 }, { reps: 8, weight: 25 }]);
  });

  test("uses six training days, fixed main days, and Sunday rest in every added week", () => {
    plan.weeks.slice(-10).forEach((week) => {
      expect(week.days).toHaveLength(7);
      expect(week.days.map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
      expect(week.days.map((day) => day.type)).toEqual(["legs", "pull", "primer", "ham", "primer", "chest", "rest"]);
      expect(week.days.filter((day) => day.exercises.length > 0).map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
      expect(week.days.filter((day) => day.type === "rest").map((day) => day.dow)).toEqual(["Sun"]);
    });
  });

  test("trains each priority area and arms at least twice weekly in Weeks 14-20", () => {
    plan.weeks.slice(-7).forEach((week) => {
      const exposureDays = (pattern) => week.days
        .filter((day) => day.exercises.some((exercise) => pattern.test(exercise.name)))
        .map((day) => day.dow);

      expect(exposureDays(/^Incline DB Press$/)).toEqual(["Wed", "Sat"]);
      expect(exposureDays(/^(Lat Pulldown|One-Arm Cable Pulldown)$/)).toEqual(["Tue", "Fri"]);
      expect(exposureDays(/^Cable Lateral Raises$/)).toEqual(["Wed", "Sat"]);
      expect(exposureDays(/^(High Cable Row \/ Face Pull|Rear Delt Fly)$/)).toEqual(["Tue", "Fri"]);
      expect(exposureDays(/^(DB Bicep Curls|Incline DB Curls)$/)).toEqual(["Tue", "Fri"]);
      expect(exposureDays(/^(Incline DB Press|Machine Chest Press|Assisted Dips|Tricep Pushdowns)$/)).toEqual(
        expect.arrayContaining(["Wed", "Fri", "Sat"])
      );
    });
  });

  test("keeps secondary accumulation work brief and progresses reps at fixed load", () => {
    const weeks12to14 = plan.weeks.slice(11, 14);
    weeks12to14.forEach((week, index) => {
      const wedLateral = week.days[2].exercises.find((exercise) => exercise.name === "Cable Lateral Raises");
      const friPulldown = week.days[4].exercises.find((exercise) => exercise.name === "One-Arm Cable Pulldown");
      const friCurl = week.days[4].exercises.find((exercise) => /Curls$/.test(exercise.name));
      const friPushdown = week.days[4].exercises.find((exercise) => exercise.name === "Tricep Pushdowns");

      expect(wedLateral.sets).toHaveLength(2);
      expect(friPulldown.sets).toEqual([
        { reps: 10 + index, weight: 20 },
        { reps: 10 + index, weight: 20 }
      ]);
      expect(friCurl.sets).toHaveLength(1);
      expect(friPushdown.sets).toHaveLength(1);
    });

    const bridgeFriday = plan.weeks[10].days[4];
    expect(bridgeFriday.exercises.find((exercise) => /Curls$/.test(exercise.name)).sets).toHaveLength(1);
    expect(bridgeFriday.exercises.find((exercise) => exercise.name === "Tricep Pushdowns").sets).toHaveLength(1);
  });

  test("uses a controlled baseline, three fixed-load progression weeks, and a deload", () => {
    expect(plan.weeks.slice(-7).map((week) => week.phase)).toEqual([
      "Load +", "Deload", "Test", "Consolidate", "Load", "Load +", "Deload"
    ]);
    expect(plan.weeks[15].title).toBe("Week 16 - Controlled Baseline");
    expect(plan.weeks[15].days.at(-1).title).toBe("Block Transition / Full Rest");

    const extension = plan.weeks.slice(-4);
    const totalSets = extension.map((week) => week.days.reduce(
      (weekTotal, day) => weekTotal + day.exercises.reduce(
        (dayTotal, exercise) => dayTotal + exercise.sets.length,
        0
      ),
      0
    ));
    expect(totalSets).toEqual([67, 67, 67, 40]);

    const saturdayInclines = extension.slice(0, 3).map((week) => week.days[5].exercises[0].sets);
    expect(saturdayInclines.map((sets) => sets.map((set) => set.weight))).toEqual([
      [30, 30, 30, 30], [30, 30, 30, 30], [30, 30, 30, 30]
    ]);
    expect(saturdayInclines.map((sets) => sets.map((set) => set.reps))).toEqual([
      [8, 8, 8, 8], [9, 9, 9, 9], [10, 10, 10, 10]
    ]);
    expect(extension[0].notice).toContain("Week 16");
    expect(extension[1].notice).toContain("Week 17");
    expect(extension[2].notice).toContain("Week 18");
  });

  test("keeps dates unique, strict, contiguous, and accurately labelled", () => {
    const days = plan.weeks.flatMap((week) => week.days);
    const ids = days.map((day) => day.id);
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    expect(new Set(ids).size).toBe(ids.length);
    days.forEach((day) => {
      const date = new Date(`${day.id}T00:00:00Z`);
      expect(Number.isNaN(date.valueOf())).toBe(false);
      expect(date.toISOString().slice(0, 10)).toBe(day.id);
      expect(day.dow).toBe(dow[date.getUTCDay()]);
      expect(day.dom).toBe(date.getUTCDate());
      expect(day.month).toBe(months[date.getUTCMonth()]);
    });

    const currentBlock = plan.weeks.slice(-7).flatMap((week) => week.days);
    for (let index = 1; index < currentBlock.length; index += 1) {
      const previous = new Date(`${currentBlock[index - 1].id}T00:00:00Z`);
      const current = new Date(`${currentBlock[index].id}T00:00:00Z`);
      expect(current.valueOf() - previous.valueOf()).toBe(24 * 60 * 60 * 1000);
    }
  });

  test("uses supported phases and valid prescriptions", () => {
    plan.weeks.slice(-10).forEach((week) => {
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
