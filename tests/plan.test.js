describe("May 2026-January 2027 training plan", () => {
  let plan;

  beforeAll(() => {
    jest.resetModules();
    delete window.LIFT_PLAN;
    require("../data.js");
    plan = window.LIFT_PLAN;
  });

  test("preserves Weeks 1-20 and extends the plan with Weeks 21-30 through January 31, 2027", () => {
    expect(plan.weeks).toHaveLength(30);
    expect(plan.meta.dateRange).toBe("May 12, 2026-January 31, 2027");
    expect(plan.weeks.slice(10, 20).map((week) => week.id)).toEqual([
      "w11", "w12", "w13", "w14", "w15", "w16", "w17", "w18", "w19", "w20"
    ]);
    expect(plan.weeks.slice(20).map((week) => week.id)).toEqual([
      "w21", "w22", "w23", "w24", "w25", "w26", "w27", "w28", "w29", "w30"
    ]);
    expect(plan.weeks[10].days[0].id).toBe("2026-07-20");
    expect(plan.weeks[10].days.at(-1).id).toBe("2026-07-26");
    expect(plan.weeks[13].days[0].id).toBe("2026-08-10");
    expect(plan.weeks[19].days.at(-1).id).toBe("2026-09-27");
    expect(plan.weeks[20].days[0].id).toBe("2026-11-23");
    expect(plan.weeks[25].days[3].id).toBe("2026-12-31");
    expect(plan.weeks[25].days[4].id).toBe("2027-01-01");
    expect(plan.weeks[29].days.at(-1).id).toBe("2027-01-31");
  });

  test("uses the missing week as a low-fatigue six-session bridge", () => {
    const bridge = plan.weeks[10];
    expect(bridge.phase).toBe("Deload");
    expect(bridge.days).toHaveLength(7);
    expect(bridge.days.map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(bridge.days[3].exercises[0].sets).toEqual([{ reps: 10, weight: 30 }, { reps: 10, weight: 30 }]);
    expect(bridge.days[5].exercises[0].sets).toEqual([{ reps: 8, weight: 25 }, { reps: 8, weight: 25 }]);
  });

  test("uses six training days, fixed main days, and Sunday rest in standard Weeks 11-30 with Week 21 compressed to Fri-Sat", () => {
    plan.weeks.slice(10).forEach((week) => {
      expect(week.days).toHaveLength(7);
      expect(week.days.map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
      if (week.id === "w21") {
        expect(week.days.map((day) => day.type)).toEqual(["rest", "rest", "rest", "rest", "legs", "chest", "rest"]);
        expect(week.days.filter((day) => day.exercises.length > 0).map((day) => day.dow)).toEqual(["Fri", "Sat"]);
        expect(week.days.filter((day) => day.type === "rest").map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Thu", "Sun"]);
        return;
      }
      expect(week.days.map((day) => day.type)).toEqual(["legs", "pull", "primer", "ham", "primer", "chest", "rest"]);
      expect(week.days.filter((day) => day.exercises.length > 0).map((day) => day.dow)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
      expect(week.days.filter((day) => day.type === "rest").map((day) => day.dow)).toEqual(["Sun"]);
    });
  });

  test("trains each priority area and arms at least twice weekly in standard Weeks 14-30 and covers them cleanly in compressed Week 21", () => {
    plan.weeks.slice(13).forEach((week) => {
      const exposureDays = (pattern) => week.days
        .filter((day) => day.exercises.some((exercise) => pattern.test(exercise.name)))
        .map((day) => day.dow);

      if (week.id === "w21") {
        expect(exposureDays(/^Incline DB Press$/)).toEqual(["Fri", "Sat"]);
        expect(exposureDays(/^Machine Leg Press$/)).toEqual(["Fri"]);
        expect(exposureDays(/^Lat Pulldown$/)).toEqual(["Fri"]);
        expect(exposureDays(/^Seated Cable Row$/)).toEqual(["Fri"]);
        expect(exposureDays(/^DB Bicep Curls$/)).toEqual(["Fri"]);
        expect(exposureDays(/^Abdominal Machine$/)).toEqual(["Fri"]);
        expect(exposureDays(/^DB Romanian Deadlift$/)).toEqual(["Sat"]);
        expect(exposureDays(/^High Cable Row \/ Face Pull$/)).toEqual(["Sat"]);
        expect(exposureDays(/^Cable Lateral Raises$/)).toEqual(["Sat"]);
        expect(exposureDays(/^Tricep Pushdowns$/)).toEqual(["Sat"]);
        expect(exposureDays(/^45 Degree Back Extension$/)).toEqual(["Sat"]);
        expect(exposureDays(/^Hanging Knee Raise$/)).toEqual(["Sat"]);
        return;
      }

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

  test("preserves Weeks 14-20 baseline, progression, and deload structure", () => {
    expect(plan.weeks.slice(13, 20).map((week) => week.phase)).toEqual([
      "Load +", "Deload", "Test", "Consolidate", "Load", "Load +", "Deload"
    ]);
    expect(plan.weeks[15].title).toBe("Week 16 - Controlled Baseline");
    expect(plan.weeks[15].days.at(-1).title).toBe("Block Transition / Full Rest");

    const extension = plan.weeks.slice(16, 20);
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

  test("structures Weeks 21-30 gym reentry, peak matching, holiday deload, and 2027 progression", () => {
    const reentryBlock = plan.weeks.slice(20);
    expect(reentryBlock.map((week) => week.phase)).toEqual([
      "Reentry", "Consolidate", "Load", "Load +", "Deload",
      "Consolidate", "Load", "Load +", "Test", "Deload"
    ]);
    expect(reentryBlock[0].title).toBe("Week 21 - Gym Reentry Ramp");
    expect(reentryBlock[0].notice).toContain("70-75%");
    expect(reentryBlock[0].days.slice(0, 4).every((d) => d.type === "rest" && d.exercises.length === 0)).toBe(true);
    expect(reentryBlock[0].days[4].id).toBe("2026-11-27");
    expect(reentryBlock[0].days[4].exercises[0].name).toBe("Machine Leg Press");
    expect(reentryBlock[0].days[4].exercises[0].sets).toEqual([{ reps: 10, weight: 75 }, { reps: 10, weight: 75 }]);
    expect(reentryBlock[0].days[4].exercises[1].name).toBe("Lat Pulldown");
    expect(reentryBlock[0].days[4].exercises[1].sets).toEqual([{ reps: 10, weight: 37.5 }, { reps: 10, weight: 37.5 }]);
    expect(reentryBlock[0].days[4].exercises[2].name).toBe("Incline DB Press");
    expect(reentryBlock[0].days[4].exercises[2].sets).toEqual([{ reps: 10, weight: 16 }, { reps: 10, weight: 16 }]);
    expect(reentryBlock[0].days[5].id).toBe("2026-11-28");
    expect(reentryBlock[0].days[5].exercises[0].name).toBe("Incline DB Press");
    expect(reentryBlock[0].days[5].exercises[0].sets).toEqual([
      { reps: 8, weight: 20 }, { reps: 8, weight: 20 }, { reps: 8, weight: 20 }
    ]);
    expect(reentryBlock[0].days[5].exercises[1].name).toBe("DB Romanian Deadlift");
    expect(reentryBlock[0].days[5].exercises[1].sets).toEqual([
      { reps: 10, weight: 30 }, { reps: 10, weight: 30 }
    ]);
    expect(reentryBlock[0].days[5].exercises.some((ex) => ex.name === "Assisted Dips")).toBe(false);
    expect(reentryBlock[4].days[5].exercises.some((ex) => ex.name === "Assisted Dips")).toBe(false);
    expect(reentryBlock[9].days[5].exercises.some((ex) => ex.name === "Assisted Dips")).toBe(false);
    expect(reentryBlock[4].days[4].exercises.every((ex) => ex.sets.length === 1)).toBe(true);

    const janLoadBlock = reentryBlock.slice(6, 9);
    expect(janLoadBlock.map((w) => w.days[0].exercises[0].sets[0])).toEqual([
      { reps: 8, weight: 102.5 },
      { reps: 9, weight: 102.5 },
      { reps: 10, weight: 102.5 }
    ]);
    expect(janLoadBlock.map((w) => w.days[0].exercises[3].sets[0])).toEqual([
      { reps: 16, weight: 45 },
      { reps: 18, weight: 45 },
      { reps: 20, weight: 45 }
    ]);
    expect(janLoadBlock.map((w) => w.days[5].exercises[0].sets[0])).toEqual([
      { reps: 8, weight: 30 },
      { reps: 9, weight: 30 },
      { reps: 10, weight: 30 }
    ]);
    expect(reentryBlock[9].days[6].footer).toContain("February 2027");
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

    [plan.weeks.slice(13, 20), plan.weeks.slice(20)].forEach((block) => {
      const blockDays = block.flatMap((week) => week.days);
      for (let index = 1; index < blockDays.length; index += 1) {
        const previous = new Date(`${blockDays[index - 1].id}T00:00:00Z`);
        const current = new Date(`${blockDays[index].id}T00:00:00Z`);
        expect(current.valueOf() - previous.valueOf()).toBe(24 * 60 * 60 * 1000);
      }
    });
  });

  test("uses supported phases and valid prescriptions", () => {
    plan.weeks.slice(10).forEach((week) => {
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
