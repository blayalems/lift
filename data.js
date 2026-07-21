(function () {
  var DEFAULT_REST = 90;

  function repeatSet(count, reps, weight) {
    var out = [];
    for (var i = 0; i < count; i += 1) {
      out.push({ reps: reps, weight: weight });
    }
    return out;
  }

  function setList(items) {
    var out = [];
    for (var i = 0; i < items.length; i += 1) {
      out.push({ reps: items[i][0], weight: items[i][1] });
    }
    return out;
  }

  function exercise(cfg) {
    return {
      name: cfg.name,
      target: cfg.target,
      primary: !!cfg.primary,
      tag: cfg.tag || null,
      note: cfg.note || "",
      defaultRest: cfg.defaultRest || DEFAULT_REST,
      toFailure: !!cfg.toFailure,
      sets: cfg.sets || []
    };
  }

  function day(cfg) {
    return {
      id: cfg.id,
      dow: cfg.dow,
      dom: cfg.dom,
      month: cfg.month,
      type: cfg.type,
      title: cfg.title,
      subtitle: cfg.subtitle || "",
      warmup: cfg.warmup || "",
      footer: cfg.footer || "",
      exercises: cfg.exercises || []
    };
  }

  window.LIFT_PLAN = {
    meta: {
      title: "Lem Progressive Overload Plan",
      athlete: "Lem",
      dateRange: "May 12-August 30, 2026",
      timeZone: "Asia/Manila",
      source: "reference/lem_progressive_overload_may_june_2026.html",
      enrichmentSource: "reference/Workout Tracker.html",
      baselines: [
        { label: "Incline DB (entering)", value: 25, unit: "kg total" },
        { label: "Leg Press (entering)", value: 60, unit: "kg" },
        { label: "Machine Chest (entering)", value: 25, unit: "kg" },
        { label: "Cable Row (entering)", value: 37.5, unit: "kg" }
      ]
    },
    weeks: [
      {
        id: "w1",
        num: 1,
        title: "Week 1 - Consolidation",
        phase: "Consolidate",
        sub: "Own the new baselines",
        subtitle: "Own the new baselines",
        dateRange: "May 12-17",
        notice: "",
        days: [
          day({
            id: "2026-05-12",
            dow: "Tue",
            dom: 12,
            month: "May",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            subtitle: "Push the legs.",
            warmup: "Bodyweight squats x 15 - Leg swings x 10/side - Leg press 40 kg x 1 x 10",
            footer: "3-sec descent, 1-sec pause on leg press. Primary driver of the session.",
            exercises: [
              exercise({
                name: "Machine Leg Press",
                target: "60 kg - 3 x 11",
                primary: true,
                note: "Three-second descent, one-second pause at the bottom, controlled drive up. This is the primary lift - everything else is secondary. If the first two sets feel genuinely clean, attempt 12 reps on the third set only.",
                sets: repeatSet(3, 11, 60)
              }),
              exercise({
                name: "Smith Machine Squats",
                target: "30 kg - 3 x 10",
                note: "Drop to 2 sets if readiness feels below 7 after the leg press.",
                sets: repeatSet(3, 10, 30)
              }),
              exercise({
                name: "Seated Leg Curls",
                target: "37.5 kg - 3 x 12",
                note: "If 37.5 kg isn't available, run 35 kg x 4 x 12.",
                sets: repeatSet(3, 12, 37.5)
              }),
              exercise({
                name: "Seated Calf Raises",
                target: "27.5 kg - 4 x 20",
                sets: repeatSet(4, 20, 27.5)
              }),
              exercise({
                name: "Abdominal Machine",
                target: "40 kg - 3 x 12",
                sets: repeatSet(3, 12, 40)
              })
            ]
          }),
          day({
            id: "2026-05-13",
            dow: "Wed",
            dom: 13,
            month: "May",
            type: "pull",
            title: "Back & Biceps (Pull)",
            subtitle: "Pull day.",
            warmup: "Light scap pulls - Band pull-aparts x 15 - Lat activation",
            footer: "Readiness caveat: one day after heavy legs. If readiness <7, cable row drops to 37.5 kg across all sets.",
            exercises: [
              exercise({
                name: "Lat Pulldown",
                target: "37.5 kg - 3 x 12",
                primary: true,
                note: "Confirm all three sets cleanly - this is consolidation, not a load jump.",
                sets: repeatSet(3, 12, 37.5)
              }),
              exercise({
                name: "Seated Cable Row",
                target: "40 kg - 3 x 12",
                tag: "jump",
                note: "Strict 90-second rest. If you need more than 2 min before set 3, drop to 37.5 kg. Density over load.",
                sets: repeatSet(3, 12, 40)
              }),
              exercise({
                name: "High Cable Row / Face Pull",
                target: "35 kg - 3 x 12",
                sets: repeatSet(3, 12, 35)
              }),
              exercise({
                name: "DB Bicep Curls",
                target: "12 kg total - 3 x 10",
                note: "6 kg per hand.",
                sets: repeatSet(3, 10, 12)
              })
            ]
          }),
          day({
            id: "2026-05-14",
            dow: "Thu",
            dom: 14,
            month: "May",
            type: "rest",
            title: "Rest / Active Recovery",
            subtitle: "Full rest. Walk if you like.",
            footer: "Full rest or light walk only. LISS dropped this week due to compressed schedule.",
            exercises: []
          }),
          day({
            id: "2026-05-15",
            dow: "Fri",
            dom: 15,
            month: "May",
            type: "ham",
            title: "Hamstrings & Glutes",
            subtitle: "Hinge & posterior chain.",
            warmup: "Hip airplanes - Glute bridges x 12 - Empty bar RDLs x 8",
            footer: "RDL: feel the load in hamstrings, not lower back. Hinge quality over weight.",
            exercises: [
              exercise({
                name: "DB Romanian Deadlift",
                target: "30 kg total - 3 x 10",
                primary: true,
                note: "15 kg per hand. Priority is hinge quality - load in the hamstrings, not the lower back. Weight is new; form ownership before progression.",
                sets: repeatSet(3, 10, 30)
              }),
              exercise({
                name: "High/Wide Leg Press",
                target: "57.5 kg - 3 x 12",
                note: "If 57.5 kg isn't available, run 55 kg x 4 x 12.",
                sets: repeatSet(3, 12, 57.5)
              }),
              exercise({
                name: "Lying Leg Curls",
                target: "35 kg - 3 x 12",
                note: "Target: clean 12/12/12 across all sets before adding load next week.",
                sets: repeatSet(3, 12, 35)
              }),
              exercise({
                name: "Walking Lunges",
                target: "12.5 kg total - 3 x 12/leg",
                note: "6.25 kg per hand or nearest available.",
                sets: repeatSet(3, 12, 12.5)
              }),
              exercise({
                name: "Abdominal Machine",
                target: "40 kg - 3 sets",
                sets: repeatSet(3, 12, 40)
              })
            ]
          }),
          day({
            id: "2026-05-16",
            dow: "Sat",
            dom: 16,
            month: "May",
            type: "chest",
            title: "Primer + Chest Consolidation",
            subtitle: "Combined session.",
            warmup: "Band shoulder dislocates - Scap push-ups x 10 - Light dumbbell flyes",
            footer: "Stretch goal: 25/25/25/22.5. Gauntlet trigger for 15 kg/hand: 4 clean sets at 12.5 kg/hand, no shoulder irritation.",
            exercises: [
              exercise({
                name: "Primer: Incline DB Press",
                target: "15 kg total - 1 x 10 (RPE 5)",
                note: "Primer block - 1 round only.",
                sets: repeatSet(1, 10, 15)
              }),
              exercise({
                name: "Primer: DB Shoulder Press",
                target: "12 kg total - 1 x 10",
                sets: repeatSet(1, 10, 12)
              }),
              exercise({
                name: "Primer: Cable Lateral Raises",
                target: "5 kg/side - 1 x 12",
                sets: repeatSet(1, 12, 5)
              }),
              exercise({
                name: "Primer: Rear Delt Cable Fly",
                target: "15 kg - 1 x 12",
                sets: repeatSet(1, 12, 15)
              }),
              exercise({
                name: "Primer: Tricep Pushdowns",
                target: "22.5 kg - 1 x 12",
                sets: repeatSet(1, 12, 22.5)
              }),
              exercise({
                name: "Incline DB Press",
                target: "25 / 25 / 22.5 / 22.5 kg",
                primary: true,
                note: "Stretch goal 25/25/25/22.5 if set 3 feels controlled. Gauntlet trigger for 15 kg/hand: four clean sets at 12.5 kg/hand, no shoulder irritation, no grinding reps.",
                sets: setList([[8, 25], [8, 25], [8, 22.5], [8, 22.5]])
              }),
              exercise({
                name: "Machine Chest Press",
                target: "25 kg - 3 x 10",
                note: "Confirm the PR weight cleanly before loading further.",
                sets: repeatSet(3, 10, 25)
              }),
              exercise({
                name: "Machine Pec Fly",
                target: "30 kg - 3 x 12",
                sets: repeatSet(3, 12, 30)
              }),
              exercise({
                name: "Assisted Dips",
                target: "55 kg assist - 3 x failure",
                toFailure: true,
                sets: repeatSet(3, 0, 55)
              })
            ]
          }),
          day({
            id: "2026-05-17",
            dow: "Sun",
            dom: 17,
            month: "May",
            type: "rest",
            title: "Rest",
            subtitle: "Rest day.",
            footer: "",
            exercises: []
          })
        ]
      },
      {
        id: "w2",
        num: 2,
        title: "Week 2 - Load",
        phase: "Load",
        sub: "First true load jump week",
        subtitle: "First true load jump week",
        dateRange: "May 18-24",
        notice: "",
        days: [
          day({
            id: "2026-05-18",
            dow: "Mon",
            dom: 18,
            month: "May",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            footer: "First load jump on leg press. If 62.5 unavailable use 60 kg x 3 x 12 as alternative progression.",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "62.5 kg - 3 x 10", primary: true, tag: "load", sets: repeatSet(3, 10, 62.5) }),
              exercise({ name: "Smith Machine Squats", target: "32.5 kg - 3 x 10", sets: repeatSet(3, 10, 32.5) }),
              exercise({ name: "Seated Leg Curls", target: "37.5 kg - 3 x 12", sets: repeatSet(3, 12, 37.5) }),
              exercise({ name: "Seated Calf Raises", target: "30 kg - 4 x 20", sets: repeatSet(4, 20, 30) }),
              exercise({ name: "Abdominal Machine", target: "42.5 kg - 3 x 12", sets: repeatSet(3, 12, 42.5) })
            ]
          }),
          day({
            id: "2026-05-19",
            dow: "Tue",
            dom: 19,
            month: "May",
            type: "pull",
            title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "40 kg - 3 x 10", primary: true, tag: "jump", sets: repeatSet(3, 10, 40) }),
              exercise({ name: "Seated Cable Row", target: "40 kg - 3 x 10", sets: repeatSet(3, 10, 40) }),
              exercise({ name: "High Cable Row / Face Pull", target: "37.5 kg - 3 x 12", sets: repeatSet(3, 12, 37.5) }),
              exercise({ name: "DB Bicep Curls", target: "12 kg - 3 x 12", sets: repeatSet(3, 12, 12) })
            ]
          }),
          day({
            id: "2026-05-20",
            dow: "Wed",
            dom: 20,
            month: "May",
            type: "rest",
            title: "LISS + Core",
            footer: "30-40 min incline walk. Light abdominal work. Recovery day restored this week.",
            exercises: []
          }),
          day({
            id: "2026-05-21",
            dow: "Thu",
            dom: 21,
            month: "May",
            type: "ham",
            title: "Hamstrings & Glutes",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "32.5 kg - 3 x 10", primary: true, tag: "load", sets: repeatSet(3, 10, 32.5) }),
              exercise({ name: "High/Wide Leg Press", target: "60 kg - 3 x 12", tag: "load", sets: repeatSet(3, 12, 60) }),
              exercise({ name: "Lying Leg Curls", target: "37.5 kg - 3 x 10", sets: repeatSet(3, 10, 37.5) }),
              exercise({ name: "Walking Lunges", target: "12.5 kg - 3 x 12", sets: repeatSet(3, 12, 12.5) }),
              exercise({ name: "Abdominal Machine", target: "42.5 kg - 3 sets", sets: repeatSet(3, 12, 42.5) })
            ]
          }),
          day({
            id: "2026-05-22",
            dow: "Fri",
            dom: 22,
            month: "May",
            type: "primer",
            title: "Push Primer",
            footer: "2 rounds restored. Cap at RPE 6-7. Stop if shoulder fatigue appears.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "17.5 kg - 2 x 10 (RPE 6)", sets: repeatSet(2, 10, 17.5) }),
              exercise({ name: "DB Shoulder Press", target: "12 kg - 2 x 10", sets: repeatSet(2, 10, 12) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 2 x 12", sets: repeatSet(2, 12, 5) }),
              exercise({ name: "Rear Delt Fly", target: "15 kg - 2 x 12", sets: repeatSet(2, 12, 15) }),
              exercise({ name: "Tricep Pushdowns", target: "22.5 kg - 2 x 12", sets: repeatSet(2, 12, 22.5) })
            ]
          }),
          day({
            id: "2026-05-23",
            dow: "Sat",
            dom: 23,
            month: "May",
            type: "chest",
            title: "Chest - Load Week",
            footer: "Incline DB target: 3 sets at full 25 kg (12.5 kg/hand). Machine Chest load jump to 27.5 kg.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 / 25 / 25 / 22.5 kg", primary: true, tag: "sets", sets: setList([[8, 25], [8, 25], [8, 25], [8, 22.5]]) }),
              exercise({ name: "Machine Chest Press", target: "27.5 kg - 3 x 8", tag: "load", sets: repeatSet(3, 8, 27.5) }),
              exercise({ name: "Machine Pec Fly", target: "32.5 kg - 3 x 10", sets: repeatSet(3, 10, 32.5) }),
              exercise({ name: "Assisted Dips", target: "50 kg assist - 3 x failure", toFailure: true, sets: repeatSet(3, 0, 50) })
            ]
          })
        ]
      },
      {
        id: "w3",
        num: 3,
        title: "Week 3 - Load +",
        phase: "Load +",
        sub: "Second load accumulation week",
        subtitle: "Second load accumulation week",
        dateRange: "May 25-31",
        notice: "",
        days: [
          day({
            id: "2026-05-25",
            dow: "Mon",
            dom: 25,
            month: "May",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            footer: "Second load jump on leg press. Confirm 62.5 was clean before attempting 65.",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "65 kg - 3 x 10", primary: true, tag: "load", sets: repeatSet(3, 10, 65) }),
              exercise({ name: "Smith Machine Squats", target: "32.5 kg - 3 x 12", sets: repeatSet(3, 12, 32.5) }),
              exercise({ name: "Seated Leg Curls", target: "40 kg - 3 x 10", sets: repeatSet(3, 10, 40) }),
              exercise({ name: "Seated Calf Raises", target: "30 kg - 4 x 20", sets: repeatSet(4, 20, 30) }),
              exercise({ name: "Abdominal Machine", target: "42.5 kg - 3 x 12", sets: repeatSet(3, 12, 42.5) })
            ]
          }),
          day({
            id: "2026-05-26",
            dow: "Tue",
            dom: 26,
            month: "May",
            type: "pull",
            title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "40 kg - 3 x 12", primary: true, sets: repeatSet(3, 12, 40) }),
              exercise({ name: "Seated Cable Row", target: "42.5 kg - 3 x 8", tag: "load", sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "37.5 kg - 3 x 12", sets: repeatSet(3, 12, 37.5) }),
              exercise({ name: "DB Bicep Curls", target: "14 kg total - 3 x 10", sets: repeatSet(3, 10, 14) })
            ]
          }),
          day({
            id: "2026-05-27",
            dow: "Wed",
            dom: 27,
            month: "May",
            type: "rest",
            title: "LISS + Core",
            footer: "30-40 min incline walk. Light core. This becomes critical as weekly volume accumulates.",
            exercises: []
          }),
          day({
            id: "2026-05-28",
            dow: "Thu",
            dom: 28,
            month: "May",
            type: "ham",
            title: "Hamstrings & Glutes",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "35 kg - 3 x 8", primary: true, tag: "load", sets: repeatSet(3, 8, 35) }),
              exercise({ name: "High/Wide Leg Press", target: "62.5 kg - 3 x 10", sets: repeatSet(3, 10, 62.5) }),
              exercise({ name: "Lying Leg Curls", target: "37.5 kg - 3 x 12", sets: repeatSet(3, 12, 37.5) }),
              exercise({ name: "Walking Lunges", target: "15 kg - 3 x 12", sets: repeatSet(3, 12, 15) }),
              exercise({ name: "Abdominal Machine", target: "42.5 kg - 3 sets", sets: repeatSet(3, 12, 42.5) })
            ]
          }),
          day({
            id: "2026-05-29",
            dow: "Fri",
            dom: 29,
            month: "May",
            type: "primer",
            title: "Push Primer",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg - 2 x 10 (RPE 6)", sets: repeatSet(2, 10, 20) }),
              exercise({ name: "DB Shoulder Press", target: "14 kg - 2 x 10", sets: repeatSet(2, 10, 14) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", sets: repeatSet(2, 12, 7.5) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 12", sets: repeatSet(2, 12, 17.5) }),
              exercise({ name: "Tricep Pushdowns", target: "25 kg - 2 x 12", sets: repeatSet(2, 12, 25) })
            ]
          }),
          day({
            id: "2026-05-30",
            dow: "Sat",
            dom: 30,
            month: "May",
            type: "chest",
            title: "Chest - Gauntlet Attempt",
            footer: "Target: 4 x 10 at 25 kg total (12.5 kg/hand) all clean. If achieved, Week 5 attempts 30 kg total (15 kg/hand).",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 / 25 / 25 / 25 kg", primary: true, tag: "PR target", sets: repeatSet(4, 10, 25) }),
              exercise({ name: "Machine Chest Press", target: "27.5 kg - 3 x 10", sets: repeatSet(3, 10, 27.5) }),
              exercise({ name: "Machine Pec Fly", target: "32.5 kg - 3 x 12", sets: repeatSet(3, 12, 32.5) }),
              exercise({ name: "Assisted Dips", target: "50 kg assist - 3 x failure", toFailure: true, sets: repeatSet(3, 0, 50) })
            ]
          })
        ]
      },
      {
        id: "w4",
        num: 4,
        title: "Week 4 - Deload",
        phase: "Deload",
        sub: "Planned recovery week",
        subtitle: "Planned recovery week",
        dateRange: "Jun 1-7",
        notice: "Deload week. This is not optional - 3 weeks of progressive loading require a recovery week before the next mesocycle. Volume drops 30-40%, loads drop 10-15%. You will feel like you're undertraining. That feeling is adaptation happening. Same split, same exercises, reduced intensity.",
        days: [
          day({
            id: "2026-06-01",
            dow: "Mon",
            dom: 1,
            month: "Jun",
            type: "legs",
            title: "Legs & Core (Deload)",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "52.5 kg - 2 x 10", primary: true, sets: repeatSet(2, 10, 52.5) }),
              exercise({ name: "Smith Machine Squats", target: "25 kg - 2 x 10", sets: repeatSet(2, 10, 25) }),
              exercise({ name: "Seated Leg Curls", target: "30 kg - 2 x 12", sets: repeatSet(2, 12, 30) }),
              exercise({ name: "Seated Calf Raises", target: "22.5 kg - 3 x 15", sets: repeatSet(3, 15, 22.5) }),
              exercise({ name: "Abdominal Machine", target: "35 kg - 2 x 12", sets: repeatSet(2, 12, 35) })
            ]
          }),
          day({
            id: "2026-06-02",
            dow: "Tue",
            dom: 2,
            month: "Jun",
            type: "pull",
            title: "Back & Biceps (Deload)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "32.5 kg - 2 x 10", primary: true, sets: repeatSet(2, 10, 32.5) }),
              exercise({ name: "Seated Cable Row", target: "35 kg - 2 x 10", sets: repeatSet(2, 10, 35) }),
              exercise({ name: "High Cable Row / Face Pull", target: "30 kg - 2 x 12", sets: repeatSet(2, 12, 30) }),
              exercise({ name: "DB Bicep Curls", target: "10 kg - 2 x 12", sets: repeatSet(2, 12, 10) })
            ]
          }),
          day({
            id: "2026-06-03",
            dow: "Wed",
            dom: 3,
            month: "Jun",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. Sleep quality is the training stimulus this day.",
            exercises: []
          }),
          day({
            id: "2026-06-04",
            dow: "Thu",
            dom: 4,
            month: "Jun",
            type: "ham",
            title: "Hamstrings & Glutes (Deload)",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "25 kg - 2 x 10", primary: true, sets: repeatSet(2, 10, 25) }),
              exercise({ name: "High/Wide Leg Press", target: "50 kg - 2 x 12", sets: repeatSet(2, 12, 50) }),
              exercise({ name: "Lying Leg Curls", target: "30 kg - 2 x 12", sets: repeatSet(2, 12, 30) }),
              exercise({ name: "Walking Lunges", target: "10 kg - 2 x 10", sets: repeatSet(2, 10, 10) })
            ]
          }),
          day({
            id: "2026-06-05",
            dow: "Fri",
            dom: 5,
            month: "Jun",
            type: "rest",
            title: "Rest",
            footer: "No primer this week. Let the shoulders and chest recover ahead of Week 5 gauntlet.",
            exercises: []
          }),
          day({
            id: "2026-06-06",
            dow: "Sat",
            dom: 6,
            month: "Jun",
            type: "chest",
            title: "Chest (Deload)",
            footer: "RPE should feel like 5-6 max. These are flush sets, not working sets.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg - 3 x 10 (easy)", primary: true, sets: repeatSet(3, 10, 20) }),
              exercise({ name: "Machine Chest Press", target: "20 kg - 2 x 10", sets: repeatSet(2, 10, 20) }),
              exercise({ name: "Machine Pec Fly", target: "25 kg - 2 x 12", sets: repeatSet(2, 12, 25) })
            ]
          })
        ]
      },
      {
        id: "w5",
        num: 5,
        title: "Week 5 - Test Week",
        phase: "Test",
        sub: "New bracket assault",
        subtitle: "New bracket assault",
        dateRange: "Jun 8-14",
        notice: "",
        days: [
          day({
            id: "2026-06-08",
            dow: "Mon",
            dom: 8,
            month: "Jun",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            footer: "Post-deload, your legs will feel fresh. 67.5 kg is the Week 5 leg press target. Don't hold back.",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "67.5 kg - 3 x 10", primary: true, tag: "PR attempt", sets: repeatSet(3, 10, 67.5) }),
              exercise({ name: "Smith Machine Squats", target: "35 kg - 3 x 10", sets: repeatSet(3, 10, 35) }),
              exercise({ name: "Seated Leg Curls", target: "40 kg - 3 x 12", sets: repeatSet(3, 12, 40) }),
              exercise({ name: "Seated Calf Raises", target: "32.5 kg - 4 x 20", sets: repeatSet(4, 20, 32.5) }),
              exercise({ name: "Abdominal Machine", target: "45 kg - 3 x 12", sets: repeatSet(3, 12, 45) })
            ]
          }),
          day({
            id: "2026-06-09",
            dow: "Tue",
            dom: 9,
            month: "Jun",
            type: "pull",
            title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "42.5 kg - 3 x 8", primary: true, tag: "PR attempt", sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "Seated Cable Row", target: "45 kg - 3 x 8", tag: "PR attempt", sets: repeatSet(3, 8, 45) }),
              exercise({ name: "High Cable Row / Face Pull", target: "40 kg - 3 x 12", sets: repeatSet(3, 12, 40) }),
              exercise({ name: "DB Bicep Curls", target: "14 kg - 3 x 12", sets: repeatSet(3, 12, 14) })
            ]
          }),
          day({
            id: "2026-06-10",
            dow: "Wed",
            dom: 10,
            month: "Jun",
            type: "rest",
            title: "LISS + Core",
            footer: "30-40 min incline walk. Light core only. Recovery between the two test days.",
            exercises: []
          }),
          day({
            id: "2026-06-11",
            dow: "Thu",
            dom: 11,
            month: "Jun",
            type: "ham",
            title: "Hamstrings & Glutes",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "35 kg - 3 x 10", primary: true, sets: repeatSet(3, 10, 35) }),
              exercise({ name: "High/Wide Leg Press", target: "65 kg - 3 x 10", tag: "PR attempt", sets: repeatSet(3, 10, 65) }),
              exercise({ name: "Lying Leg Curls", target: "40 kg - 3 x 10", sets: repeatSet(3, 10, 40) }),
              exercise({ name: "Walking Lunges", target: "15 kg - 3 x 12", sets: repeatSet(3, 12, 15) }),
              exercise({ name: "Abdominal Machine", target: "45 kg - 3 sets", sets: repeatSet(3, 12, 45) })
            ]
          }),
          day({
            id: "2026-06-12",
            dow: "Fri",
            dom: 12,
            month: "Jun",
            type: "primer",
            title: "Push Primer",
            footer: "Keep this genuinely light. Saturday is the most important session of the cycle.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg - 2 x 10 (RPE 5-6)", sets: repeatSet(2, 10, 20) }),
              exercise({ name: "DB Shoulder Press", target: "14 kg - 2 x 10", sets: repeatSet(2, 10, 14) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", sets: repeatSet(2, 12, 7.5) }),
              exercise({ name: "Tricep Pushdowns", target: "25 kg - 2 x 12", sets: repeatSet(2, 12, 25) })
            ]
          }),
          day({
            id: "2026-06-13",
            dow: "Sat",
            dom: 13,
            month: "Jun",
            type: "chest",
            title: "Chest - New Bracket Gauntlet",
            footer: "This is the May 9 moment for the next bracket. 15 kg/hand is the new frontier. Attempt Sets 1-2 only; back off to 12.5 kg/hand for Sets 3-4. Condition: only attempt if May 30 gauntlet confirmed 4 x 10 at 12.5 kg/hand cleanly.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total sets 1-2; 25 kg total sets 3-4 back-off", primary: true, tag: "New bracket", sets: setList([[8, 30], [8, 30], [8, 25], [8, 25]]) }),
              exercise({ name: "Machine Chest Press", target: "30 kg - 3 x 8", tag: "PR attempt", sets: repeatSet(3, 8, 30) }),
              exercise({ name: "Machine Pec Fly", target: "35 kg - 3 x 10", sets: repeatSet(3, 10, 35) }),
              exercise({ name: "Assisted Dips", target: "45 kg assist - 3 x failure", toFailure: true, sets: repeatSet(3, 0, 45) })
            ]
          })
        ]
      },
      {
        id: "w6",
        num: 6,
        title: "Week 6 - Consolidation",
        phase: "Consolidate",
        sub: "Own the Week 5 brackets",
        subtitle: "Own the Week 5 brackets",
        dateRange: "Jun 15-21",
        notice: "",
        days: [
          day({
            id: "2026-06-15",
            dow: "Mon",
            dom: 15,
            month: "Jun",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            subtitle: "Confirm the new leg press bracket.",
            warmup: "Bodyweight squats x 15 - Leg swings x 10/side - Leg press 50 kg x 1 x 10",
            footer: "Week 5 logged 85 kg x 10 x 3 on the leg press - far ahead of plan. This week is about owning it, not jumping again.",
            exercises: [
              exercise({
                name: "Machine Leg Press",
                target: "85 kg - 3 x 10",
                primary: true,
                note: "You hit 85 kg x 10 x 3 on Jun 8. Confirm it was no fluke: same load, three clean sets, 3-sec descent. No load jump this week.",
                sets: repeatSet(3, 10, 85)
              }),
              exercise({
                name: "Smith Machine Squats",
                target: "35 kg - 3 x 12",
                note: "Rep progression: 35 kg moved well at 3 x 10 on Jun 8. Add reps before load.",
                sets: repeatSet(3, 12, 35)
              }),
              exercise({
                name: "Seated Leg Curls",
                target: "42.5 kg - 3 x 10",
                tag: "load",
                note: "40 kg x 12 x 3 was clean on Jun 8 - earned the 2.5 kg jump.",
                sets: repeatSet(3, 10, 42.5)
              }),
              exercise({
                name: "Seated Calf Raises",
                target: "35 kg - 4 x 20",
                note: "35 kg x 20 x 4 PR'd on Jun 8. Consolidate before adding load.",
                sets: repeatSet(4, 20, 35)
              }),
              exercise({
                name: "Abdominal Machine",
                target: "47.5 kg - 3 x 12",
                sets: repeatSet(3, 12, 47.5)
              })
            ]
          }),
          day({
            id: "2026-06-16",
            dow: "Tue",
            dom: 16,
            month: "Jun",
            type: "pull",
            title: "Back & Biceps (Pull)",
            footer: "Cable row set 3 fell to 6 reps on Jun 9. Re-confirm 45 kg x 8 across all three sets before any jump.",
            exercises: [
              exercise({
                name: "Lat Pulldown",
                target: "45 kg - 3 x 10",
                primary: true,
                note: "45 kg x 8 x 3 done in Week 5. Build reps at this load before 47.5.",
                sets: repeatSet(3, 10, 45)
              }),
              exercise({
                name: "Seated Cable Row",
                target: "45 kg - 3 x 8",
                note: "Jun 9 went 8 / 8 / 6. Strict 90-second rest, complete all three sets of 8 to earn the next jump.",
                sets: repeatSet(3, 8, 45)
              }),
              exercise({
                name: "High Cable Row / Face Pull",
                target: "40 kg - 3 x 12",
                sets: repeatSet(3, 12, 40)
              }),
              exercise({
                name: "DB Bicep Curls",
                target: "16 kg total - 3 x 10",
                tag: "load",
                note: "8 kg per hand. 14 kg x 12 x 3 was comfortable in Week 5.",
                sets: repeatSet(3, 10, 16)
              })
            ]
          }),
          day({
            id: "2026-06-17",
            dow: "Wed",
            dom: 17,
            month: "Jun",
            type: "rest",
            title: "LISS + Core",
            footer: "30-40 min incline walk. Light abdominal work. Keep this - the second mesocycle accumulates faster.",
            exercises: []
          }),
          day({
            id: "2026-06-18",
            dow: "Thu",
            dom: 18,
            month: "Jun",
            type: "ham",
            title: "Hamstrings & Glutes",
            footer: "High/wide leg press jumped 15 kg in Week 5 (80 kg x 10 x 3). Hold it there one more week.",
            exercises: [
              exercise({
                name: "DB Romanian Deadlift",
                target: "37.5 kg total - 3 x 8",
                primary: true,
                tag: "load",
                note: "35 kg moved for 3 x 10 on Jun 11 - earned the jump. Hinge quality first: load in the hamstrings, not the lower back.",
                sets: repeatSet(3, 8, 37.5)
              }),
              exercise({
                name: "High/Wide Leg Press",
                target: "80 kg - 3 x 10",
                note: "Confirm the Jun 11 PR weight cleanly before loading further.",
                sets: repeatSet(3, 10, 80)
              }),
              exercise({
                name: "Lying Leg Curls",
                target: "45 kg - 3 x 12",
                note: "45 kg x 10 x 3 PR'd Jun 11. Push reps to 12 before adding load.",
                sets: repeatSet(3, 12, 45)
              }),
              exercise({
                name: "Walking Lunges",
                target: "15 kg total - 3 x 12/leg",
                sets: repeatSet(3, 12, 15)
              }),
              exercise({
                name: "Abdominal Machine",
                target: "47.5 kg - 3 sets",
                sets: repeatSet(3, 12, 47.5)
              })
            ]
          }),
          day({
            id: "2026-06-19",
            dow: "Fri",
            dom: 19,
            month: "Jun",
            type: "primer",
            title: "Push Primer",
            footer: "2 rounds, cap at RPE 6-7. The May 29 primer got pushed hard - keep this one genuinely light.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg - 2 x 10 (RPE 6)", sets: repeatSet(2, 10, 20) }),
              exercise({ name: "DB Shoulder Press", target: "16 kg - 2 x 10", sets: repeatSet(2, 10, 16) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", sets: repeatSet(2, 12, 7.5) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 12", sets: repeatSet(2, 12, 17.5) }),
              exercise({ name: "Tricep Pushdowns", target: "27.5 kg - 2 x 12", sets: repeatSet(2, 12, 27.5) })
            ]
          }),
          day({
            id: "2026-06-20",
            dow: "Sat",
            dom: 20,
            month: "Jun",
            type: "chest",
            title: "Chest - New Bracket Consolidation",
            footer: "Hold the Jun 13 pattern: 15 kg/hand for sets 1-2, back off to 12.5 kg/hand for 3-4. Build set-by-set ownership of the bracket.",
            exercises: [
              exercise({
                name: "Incline DB Press",
                target: "30 / 30 / 25 / 25 kg",
                primary: true,
                note: "Same shape as the Week 5 gauntlet. If both 30 kg sets are clean and shoulders are quiet, Week 7 adds a third set at 30.",
                sets: setList([[8, 30], [8, 30], [8, 25], [8, 25]])
              }),
              exercise({
                name: "Machine Chest Press",
                target: "30 kg - 3 x 8",
                note: "May 30 went 8 / 7 / 8-at-25. Three clean sets of 8 at 30 kg is the gate to 32.5.",
                sets: repeatSet(3, 8, 30)
              }),
              exercise({
                name: "Machine Pec Fly",
                target: "35 kg - 3 x 10",
                sets: repeatSet(3, 10, 35)
              }),
              exercise({
                name: "Assisted Dips",
                target: "45 kg assist - 3 x failure",
                toFailure: true,
                sets: repeatSet(3, 0, 45)
              })
            ]
          })
        ]
      },
      {
        id: "w7",
        num: 7,
        title: "Week 7 - Load",
        phase: "Load",
        sub: "First load jump of mesocycle 2",
        subtitle: "First load jump of mesocycle 2",
        dateRange: "Jun 22-28",
        notice: "",
        days: [
          day({
            id: "2026-06-22",
            dow: "Mon",
            dom: 22,
            month: "Jun",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            footer: "First leg press jump of the new cycle. 2.5 kg steps from here - the 15-20 kg leaps of May are behind you.",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "87.5 kg - 3 x 10", primary: true, tag: "load", sets: repeatSet(3, 10, 87.5) }),
              exercise({ name: "Smith Machine Squats", target: "37.5 kg - 3 x 10", tag: "load", sets: repeatSet(3, 10, 37.5) }),
              exercise({ name: "Seated Leg Curls", target: "42.5 kg - 3 x 12", sets: repeatSet(3, 12, 42.5) }),
              exercise({ name: "Seated Calf Raises", target: "37.5 kg - 4 x 20", tag: "load", sets: repeatSet(4, 20, 37.5) }),
              exercise({ name: "Abdominal Machine", target: "50 kg - 3 x 12", note: "Matches the May 25 PR. Own it for three sets.", sets: repeatSet(3, 12, 50) })
            ]
          }),
          day({
            id: "2026-06-23",
            dow: "Tue",
            dom: 23,
            month: "Jun",
            type: "pull",
            title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "45 kg - 3 x 12", primary: true, note: "Full rep target at 45 kg - matches the May 26 PR for three straight sets.", sets: repeatSet(3, 12, 45) }),
              exercise({ name: "Seated Cable Row", target: "45 kg - 3 x 10", tag: "jump", note: "Only if Week 6 completed 3 x 8 cleanly. Otherwise repeat 3 x 8.", sets: repeatSet(3, 10, 45) }),
              exercise({ name: "High Cable Row / Face Pull", target: "42.5 kg - 3 x 10", tag: "load", sets: repeatSet(3, 10, 42.5) }),
              exercise({ name: "DB Bicep Curls", target: "16 kg - 3 x 12", sets: repeatSet(3, 12, 16) })
            ]
          }),
          day({
            id: "2026-06-24",
            dow: "Wed",
            dom: 24,
            month: "Jun",
            type: "rest",
            title: "LISS + Core",
            footer: "30-40 min incline walk. Light core.",
            exercises: []
          }),
          day({
            id: "2026-06-25",
            dow: "Thu",
            dom: 25,
            month: "Jun",
            type: "ham",
            title: "Hamstrings & Glutes",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "37.5 kg - 3 x 10", primary: true, note: "Rep progression at the new load before 40 kg in Week 8.", sets: repeatSet(3, 10, 37.5) }),
              exercise({ name: "High/Wide Leg Press", target: "82.5 kg - 3 x 10", tag: "load", sets: repeatSet(3, 10, 82.5) }),
              exercise({ name: "Lying Leg Curls", target: "47.5 kg - 3 x 10", tag: "load", sets: repeatSet(3, 10, 47.5) }),
              exercise({ name: "Walking Lunges", target: "17.5 kg - 3 x 10", tag: "load", sets: repeatSet(3, 10, 17.5) }),
              exercise({ name: "Abdominal Machine", target: "50 kg - 3 sets", sets: repeatSet(3, 12, 50) })
            ]
          }),
          day({
            id: "2026-06-26",
            dow: "Fri",
            dom: 26,
            month: "Jun",
            type: "primer",
            title: "Push Primer",
            footer: "2 rounds. RPE 6-7 cap. Stop if shoulder fatigue appears.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "22.5 kg - 2 x 10 (RPE 6)", sets: repeatSet(2, 10, 22.5) }),
              exercise({ name: "DB Shoulder Press", target: "16 kg - 2 x 10", sets: repeatSet(2, 10, 16) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", sets: repeatSet(2, 12, 7.5) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 12", sets: repeatSet(2, 12, 17.5) }),
              exercise({ name: "Tricep Pushdowns", target: "27.5 kg - 2 x 12", sets: repeatSet(2, 12, 27.5) })
            ]
          }),
          day({
            id: "2026-06-27",
            dow: "Sat",
            dom: 27,
            month: "Jun",
            type: "chest",
            title: "Chest - Load Week",
            footer: "Third set joins the 30 kg bracket. Gauntlet trigger for Week 10: 4 x 8 at 15 kg/hand, no shoulder irritation, no grinding reps.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 / 30 / 30 / 25 kg", primary: true, tag: "sets", sets: setList([[8, 30], [8, 30], [8, 30], [8, 25]]) }),
              exercise({ name: "Machine Chest Press", target: "30 kg - 3 x 10", sets: repeatSet(3, 10, 30) }),
              exercise({ name: "Machine Pec Fly", target: "35 kg - 3 x 12", sets: repeatSet(3, 12, 35) }),
              exercise({ name: "Assisted Dips", target: "42.5 kg assist - 3 x failure", toFailure: true, sets: repeatSet(3, 0, 42.5) })
            ]
          })
        ]
      },
      {
        id: "w8",
        num: 8,
        title: "Week 8 - Load +",
        phase: "Load +",
        sub: "Second load accumulation week",
        subtitle: "Second load accumulation week",
        dateRange: "Jun 29-Jul 5",
        notice: "",
        days: [
          day({
            id: "2026-06-29",
            dow: "Mon",
            dom: 29,
            month: "Jun",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            footer: "90 kg leg press at slightly lower reps. Confirm 87.5 was clean before attempting.",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "90 kg - 3 x 8", primary: true, tag: "load", sets: repeatSet(3, 8, 90) }),
              exercise({ name: "Smith Machine Squats", target: "37.5 kg - 3 x 12", sets: repeatSet(3, 12, 37.5) }),
              exercise({ name: "Seated Leg Curls", target: "45 kg - 3 x 10", tag: "load", sets: repeatSet(3, 10, 45) }),
              exercise({ name: "Seated Calf Raises", target: "37.5 kg - 4 x 20", sets: repeatSet(4, 20, 37.5) }),
              exercise({ name: "Abdominal Machine", target: "52.5 kg - 3 x 10", tag: "load", sets: repeatSet(3, 10, 52.5) })
            ]
          }),
          day({
            id: "2026-06-30",
            dow: "Tue",
            dom: 30,
            month: "Jun",
            type: "pull",
            title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "47.5 kg - 3 x 10", primary: true, tag: "load", sets: repeatSet(3, 10, 47.5) }),
              exercise({ name: "Seated Cable Row", target: "47.5 kg - 3 x 8", tag: "load", sets: repeatSet(3, 8, 47.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "42.5 kg - 3 x 12", sets: repeatSet(3, 12, 42.5) }),
              exercise({ name: "DB Bicep Curls", target: "18 kg total - 3 x 10", tag: "load", note: "9 kg per hand or nearest available.", sets: repeatSet(3, 10, 18) })
            ]
          }),
          day({
            id: "2026-07-01",
            dow: "Wed",
            dom: 1,
            month: "Jul",
            type: "rest",
            title: "LISS + Core",
            footer: "30-40 min incline walk. Light core. Critical as the accumulation peaks this week.",
            exercises: []
          }),
          day({
            id: "2026-07-02",
            dow: "Thu",
            dom: 2,
            month: "Jul",
            type: "ham",
            title: "Hamstrings & Glutes",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "40 kg total - 3 x 8", primary: true, tag: "load", note: "20 kg per hand. Heaviest hinge of the cycle - hinge quality is the gate, not the load.", sets: repeatSet(3, 8, 40) }),
              exercise({ name: "High/Wide Leg Press", target: "85 kg - 3 x 10", tag: "load", sets: repeatSet(3, 10, 85) }),
              exercise({ name: "Lying Leg Curls", target: "47.5 kg - 3 x 12", sets: repeatSet(3, 12, 47.5) }),
              exercise({ name: "Walking Lunges", target: "17.5 kg - 3 x 12", sets: repeatSet(3, 12, 17.5) }),
              exercise({ name: "Abdominal Machine", target: "52.5 kg - 3 sets", sets: repeatSet(3, 10, 52.5) })
            ]
          }),
          day({
            id: "2026-07-03",
            dow: "Fri",
            dom: 3,
            month: "Jul",
            type: "primer",
            title: "Push Primer",
            footer: "Last full primer before the deload. The May 29 numbers (20 kg press, 10 kg laterals, 30 kg pushdowns) are the ceiling - not the target.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "22.5 kg - 2 x 10 (RPE 6)", sets: repeatSet(2, 10, 22.5) }),
              exercise({ name: "DB Shoulder Press", target: "18 kg - 2 x 10", sets: repeatSet(2, 10, 18) }),
              exercise({ name: "Cable Lateral Raises", target: "10 kg - 2 x 12", sets: repeatSet(2, 12, 10) }),
              exercise({ name: "Rear Delt Fly", target: "20 kg - 2 x 12", sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Tricep Pushdowns", target: "30 kg - 2 x 12", sets: repeatSet(2, 12, 30) })
            ]
          }),
          day({
            id: "2026-07-04",
            dow: "Sat",
            dom: 4,
            month: "Jul",
            type: "chest",
            title: "Chest - Full Bracket",
            footer: "All four sets at 30 kg total. If this lands cleanly, the Week 10 gauntlet is 4 x 10 - and 35 kg total opens up next cycle.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 / 30 / 30 / 30 kg", primary: true, tag: "sets", sets: repeatSet(4, 8, 30) }),
              exercise({ name: "Machine Chest Press", target: "32.5 kg - 3 x 8", tag: "load", sets: repeatSet(3, 8, 32.5) }),
              exercise({ name: "Machine Pec Fly", target: "37.5 kg - 3 x 10", tag: "load", sets: repeatSet(3, 10, 37.5) }),
              exercise({ name: "Assisted Dips", target: "40 kg assist - 3 x failure", toFailure: true, sets: repeatSet(3, 0, 40) })
            ]
          })
        ]
      },
      {
        id: "w9",
        num: 9,
        title: "Week 9 - Deload",
        phase: "Deload",
        sub: "Planned recovery week",
        subtitle: "Planned recovery week",
        dateRange: "Jul 6-12",
        notice: "Deload week. Three weeks of loading on top of the Week 5 PRs require recovery before the Week 10 test. Volume drops 30-40%, loads drop 10-15%. You will feel like you're undertraining - that feeling is adaptation happening. Same split, reduced intensity.",
        days: [
          day({
            id: "2026-07-06",
            dow: "Mon",
            dom: 6,
            month: "Jul",
            type: "legs",
            title: "Legs & Core (Deload)",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "70 kg - 2 x 10", primary: true, sets: repeatSet(2, 10, 70) }),
              exercise({ name: "Smith Machine Squats", target: "27.5 kg - 2 x 10", sets: repeatSet(2, 10, 27.5) }),
              exercise({ name: "Seated Leg Curls", target: "32.5 kg - 2 x 12", sets: repeatSet(2, 12, 32.5) }),
              exercise({ name: "Seated Calf Raises", target: "27.5 kg - 3 x 15", sets: repeatSet(3, 15, 27.5) }),
              exercise({ name: "Abdominal Machine", target: "40 kg - 2 x 12", sets: repeatSet(2, 12, 40) })
            ]
          }),
          day({
            id: "2026-07-07",
            dow: "Tue",
            dom: 7,
            month: "Jul",
            type: "pull",
            title: "Back & Biceps (Deload)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "35 kg - 2 x 10", primary: true, sets: repeatSet(2, 10, 35) }),
              exercise({ name: "Seated Cable Row", target: "35 kg - 2 x 10", sets: repeatSet(2, 10, 35) }),
              exercise({ name: "High Cable Row / Face Pull", target: "32.5 kg - 2 x 12", sets: repeatSet(2, 12, 32.5) }),
              exercise({ name: "DB Bicep Curls", target: "12 kg - 2 x 12", sets: repeatSet(2, 12, 12) })
            ]
          }),
          day({
            id: "2026-07-08",
            dow: "Wed",
            dom: 8,
            month: "Jul",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. Sleep quality is the training stimulus this day.",
            exercises: []
          }),
          day({
            id: "2026-07-09",
            dow: "Thu",
            dom: 9,
            month: "Jul",
            type: "ham",
            title: "Hamstrings & Glutes (Deload)",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "27.5 kg - 2 x 10", primary: true, sets: repeatSet(2, 10, 27.5) }),
              exercise({ name: "High/Wide Leg Press", target: "65 kg - 2 x 12", sets: repeatSet(2, 12, 65) }),
              exercise({ name: "Lying Leg Curls", target: "35 kg - 2 x 12", sets: repeatSet(2, 12, 35) }),
              exercise({ name: "Walking Lunges", target: "12.5 kg - 2 x 10", sets: repeatSet(2, 10, 12.5) })
            ]
          }),
          day({
            id: "2026-07-10",
            dow: "Fri",
            dom: 10,
            month: "Jul",
            type: "rest",
            title: "Rest",
            footer: "No primer this week. Let the shoulders and chest recover ahead of the Week 10 gauntlet.",
            exercises: []
          }),
          day({
            id: "2026-07-11",
            dow: "Sat",
            dom: 11,
            month: "Jul",
            type: "chest",
            title: "Chest (Deload)",
            footer: "RPE 5-6 max. These are flush sets, not working sets.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "22.5 kg - 3 x 10 (easy)", primary: true, sets: repeatSet(3, 10, 22.5) }),
              exercise({ name: "Machine Chest Press", target: "22.5 kg - 2 x 10", sets: repeatSet(2, 10, 22.5) }),
              exercise({ name: "Machine Pec Fly", target: "27.5 kg - 2 x 12", sets: repeatSet(2, 12, 27.5) })
            ]
          })
        ]
      },
      {
        id: "w10",
        num: 10,
        title: "Week 10 - Test Week",
        phase: "Test",
        sub: "Second bracket assault",
        subtitle: "Second bracket assault",
        dateRange: "Jul 13-19",
        notice: "",
        days: [
          day({
            id: "2026-07-13",
            dow: "Mon",
            dom: 13,
            month: "Jul",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            footer: "Post-deload legs will feel fresh. 92.5 kg is the leg press target - a 7.5 kg PR over Jun 8. Don't hold back.",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "92.5 kg - 3 x 8", primary: true, tag: "PR attempt", sets: repeatSet(3, 8, 92.5) }),
              exercise({ name: "Smith Machine Squats", target: "40 kg - 3 x 10", tag: "PR attempt", sets: repeatSet(3, 10, 40) }),
              exercise({ name: "Seated Leg Curls", target: "45 kg - 3 x 12", sets: repeatSet(3, 12, 45) }),
              exercise({ name: "Seated Calf Raises", target: "40 kg - 4 x 20", tag: "PR attempt", sets: repeatSet(4, 20, 40) }),
              exercise({ name: "Abdominal Machine", target: "52.5 kg - 3 x 12", sets: repeatSet(3, 12, 52.5) })
            ]
          }),
          day({
            id: "2026-07-14",
            dow: "Tue",
            dom: 14,
            month: "Jul",
            type: "pull",
            title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "50 kg - 3 x 8", primary: true, tag: "PR attempt", sets: repeatSet(3, 8, 50) }),
              exercise({ name: "Seated Cable Row", target: "50 kg - 3 x 8", tag: "PR attempt", sets: repeatSet(3, 8, 50) }),
              exercise({ name: "High Cable Row / Face Pull", target: "45 kg - 3 x 10", tag: "PR attempt", sets: repeatSet(3, 10, 45) }),
              exercise({ name: "DB Bicep Curls", target: "20 kg total - 3 x 10", note: "10 kg per hand - matches the May 26 single-set PR for three full sets.", sets: repeatSet(3, 10, 20) })
            ]
          }),
          day({
            id: "2026-07-15",
            dow: "Wed",
            dom: 15,
            month: "Jul",
            type: "rest",
            title: "LISS + Core",
            footer: "30-40 min incline walk. Light core only. Recovery between the two test days.",
            exercises: []
          }),
          day({
            id: "2026-07-16",
            dow: "Thu",
            dom: 16,
            month: "Jul",
            type: "ham",
            title: "Hamstrings & Glutes",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "42.5 kg total - 3 x 8", primary: true, tag: "PR attempt", sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "High/Wide Leg Press", target: "87.5 kg - 3 x 8", tag: "PR attempt", sets: repeatSet(3, 8, 87.5) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 10", tag: "PR attempt", sets: repeatSet(3, 10, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg - 3 x 10", tag: "PR attempt", sets: repeatSet(3, 10, 20) }),
              exercise({ name: "Abdominal Machine", target: "52.5 kg - 3 sets", sets: repeatSet(3, 12, 52.5) })
            ]
          }),
          day({
            id: "2026-07-17",
            dow: "Fri",
            dom: 17,
            month: "Jul",
            type: "primer",
            title: "Push Primer",
            footer: "Keep this genuinely light. Saturday is the most important session of the mesocycle.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg - 2 x 10 (RPE 5-6)", sets: repeatSet(2, 10, 20) }),
              exercise({ name: "DB Shoulder Press", target: "16 kg - 2 x 10", sets: repeatSet(2, 10, 16) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", sets: repeatSet(2, 12, 7.5) }),
              exercise({ name: "Tricep Pushdowns", target: "27.5 kg - 2 x 12", sets: repeatSet(2, 12, 27.5) })
            ]
          }),
          day({
            id: "2026-07-18",
            dow: "Sat",
            dom: 18,
            month: "Jul",
            type: "chest",
            title: "Chest - 30 kg Gauntlet",
            footer: "The Week 10 moment: 4 x 10 at 15 kg/hand, all clean. Achieve it and the next cycle opens the 35 kg total (17.5 kg/hand) bracket. Condition: only attempt if Week 8 confirmed 4 x 8 cleanly.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 / 30 / 30 / 30 kg x 10", primary: true, tag: "PR target", sets: repeatSet(4, 10, 30) }),
              exercise({ name: "Machine Chest Press", target: "35 kg - 3 x 8", tag: "PR attempt", sets: repeatSet(3, 8, 35) }),
              exercise({ name: "Machine Pec Fly", target: "40 kg - 3 x 8", tag: "PR attempt", sets: repeatSet(3, 8, 40) }),
              exercise({ name: "Assisted Dips", target: "37.5 kg assist - 3 x failure", toFailure: true, sets: repeatSet(3, 0, 37.5) })
            ]
          })
        ]
      },
      {
        id: "w11",
        num: 11,
        title: "Week 11 - Recovery Bridge",
        phase: "Deload",
        sub: "Resume without catch-up",
        subtitle: "Resume without catch-up",
        dateRange: "Jul 20-26",
        notice: "The export shows pull, legs, and chest completed July 16-18 on three consecutive days. Monday through Wednesday are deliberate recovery, not missed workouts. Thursday is a low-volume hamstring re-entry after no full hamstring session since June 25; Saturday resets pressing technique below the July 18 gauntlet. Do not add catch-up work.",
        days: [
          day({
            id: "2026-07-20",
            dow: "Mon",
            dom: 20,
            month: "Jul",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest after the late Week 10 three-day training stack. Do not add a make-up leg session.",
            exercises: []
          }),
          day({
            id: "2026-07-21",
            dow: "Tue",
            dom: 21,
            month: "Jul",
            type: "rest",
            title: "Active Recovery",
            footer: "20-30 min easy walking and gentle mobility only. No lifting.",
            exercises: []
          }),
          day({
            id: "2026-07-22",
            dow: "Wed",
            dom: 22,
            month: "Jul",
            type: "rest",
            title: "Full Rest",
            subtitle: "Prepare for the hinge re-entry.",
            footer: "No catch-up lifting. Arrive fresh for the first hinge session in four weeks.",
            exercises: []
          }),
          day({
            id: "2026-07-23",
            dow: "Thu",
            dom: 23,
            month: "Jul",
            type: "ham",
            title: "Hamstrings & Glutes - Technique Re-entry",
            footer: "Keep every set at RPE 5-6 and stop if hinge position changes. This should make next week's full rebuild more repeatable.",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "30 kg total - 2 x 10", primary: true, tag: "re-entry", defaultRest: 150, note: "Use a controlled hinge and stop well before form changes.", sets: repeatSet(2, 10, 30) }),
              exercise({ name: "High/Wide Leg Press", target: "65 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 65) }),
              exercise({ name: "Lying Leg Curls", target: "35 kg - 2 x 12", defaultRest: 120, sets: repeatSet(2, 12, 35) }),
              exercise({ name: "Walking Lunges", target: "10 kg total - 1 x 10", sets: repeatSet(1, 10, 10) })
            ]
          }),
          day({
            id: "2026-07-24",
            dow: "Fri",
            dom: 24,
            month: "Jul",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest between the bridge sessions. No Friday primer.",
            exercises: []
          }),
          day({
            id: "2026-07-25",
            dow: "Sat",
            dom: 25,
            month: "Jul",
            type: "chest",
            title: "Chest - Technique Reset",
            footer: "Smooth reps only; no dips, failure work, or 30 kg attempts. Leave two or three reps in reserve.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 kg total - 2 x 8", primary: true, tag: "reset", defaultRest: 150, note: "12.5 kg per hand. Use this as technique work before 30 kg returns next week.", sets: repeatSet(2, 8, 25) }),
              exercise({ name: "Machine Chest Press", target: "25 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 25) }),
              exercise({ name: "Machine Pec Fly", target: "25 kg - 2 x 10", sets: repeatSet(2, 10, 25) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 1 x 12", sets: repeatSet(1, 12, 7.5) })
            ]
          }),
          day({
            id: "2026-07-26",
            dow: "Sun",
            dom: 26,
            month: "Jul",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. Begin the five-week progression on Monday; do not use Sunday for catch-up work.",
            exercises: []
          })
        ]
      },
      {
        id: "w12",
        num: 12,
        title: "Week 12 - Reset & Rebuild",
        phase: "Consolidate",
        sub: "Four-day recovery split",
        subtitle: "Four-day recovery split",
        dateRange: "Jul 27-Aug 2",
        notice: "The export showed the Week 10 lower-body sessions sliding late, hamstrings and the Friday primer being skipped, then the 30 kg incline test falling to 6 / 7 / 7 / 4. This block removes the primer and protects Wednesday and Friday for recovery. Use 2-3 minutes on primary lifts; do not compress missed sessions into back-to-back catch-up days.",
        days: [
          day({
            id: "2026-07-27",
            dow: "Mon",
            dom: 27,
            month: "Jul",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            footer: "Consolidate the Week 10 wins. Every target here was completed cleanly in the export; leave one or two reps in reserve.",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "95 kg - 3 x 8", primary: true, tag: "consolidate", defaultRest: 150, sets: repeatSet(3, 8, 95) }),
              exercise({ name: "Smith Machine Squats", target: "40 kg - 3 x 10", defaultRest: 150, sets: repeatSet(3, 10, 40) }),
              exercise({ name: "Seated Leg Curls", target: "45 kg - 3 x 12", defaultRest: 120, sets: repeatSet(3, 12, 45) }),
              exercise({ name: "Seated Calf Raises", target: "40 kg - 3 x 20", sets: repeatSet(3, 20, 40) }),
              exercise({ name: "Abdominal Machine", target: "55 kg - 3 x 12", sets: repeatSet(3, 12, 55) })
            ]
          }),
          day({
            id: "2026-07-28",
            dow: "Tue",
            dom: 28,
            month: "Jul",
            type: "pull",
            title: "Back & Biceps (Pull)",
            footer: "Repeat the clean Week 10 baseline before adding reps next week.",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "50 kg - 3 x 8", primary: true, tag: "consolidate", defaultRest: 120, sets: repeatSet(3, 8, 50) }),
              exercise({ name: "Seated Cable Row", target: "50 kg - 3 x 8", defaultRest: 120, sets: repeatSet(3, 8, 50) }),
              exercise({ name: "High Cable Row / Face Pull", target: "45 kg - 3 x 10", sets: repeatSet(3, 10, 45) }),
              exercise({ name: "DB Bicep Curls", target: "20 kg total - 3 x 10", note: "10 kg per hand or nearest available.", sets: repeatSet(3, 10, 20) })
            ]
          }),
          day({
            id: "2026-07-29",
            dow: "Wed",
            dom: 29,
            month: "Jul",
            type: "rest",
            title: "Active Recovery",
            subtitle: "Recover before the hinge session.",
            footer: "20-30 min easy walk plus gentle hip and shoulder mobility. No lifting and no missed-session catch-up.",
            exercises: []
          }),
          day({
            id: "2026-07-30",
            dow: "Thu",
            dom: 30,
            month: "Jul",
            type: "ham",
            title: "Hamstrings & Glutes - Rebuild",
            footer: "Build from the July 23 bridge session. Finish every planned set with clean hinge mechanics before progressing.",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "35 kg total - 3 x 10", primary: true, tag: "rebuild", defaultRest: 150, note: "Progress from the bridge load, but stop the set if hinge position changes.", sets: repeatSet(3, 10, 35) }),
              exercise({ name: "High/Wide Leg Press", target: "80 kg - 3 x 10", defaultRest: 120, sets: repeatSet(3, 10, 80) }),
              exercise({ name: "Lying Leg Curls", target: "45 kg - 3 x 10", defaultRest: 120, sets: repeatSet(3, 10, 45) }),
              exercise({ name: "Walking Lunges", target: "15 kg total - 2 x 10", sets: repeatSet(2, 10, 15) }),
              exercise({ name: "Abdominal Machine", target: "50 kg - 2 x 12", sets: repeatSet(2, 12, 50) })
            ]
          }),
          day({
            id: "2026-07-31",
            dow: "Fri",
            dom: 31,
            month: "Jul",
            type: "rest",
            title: "Full Rest",
            subtitle: "Protect Saturday performance.",
            footer: "Full rest. The Friday primer is removed so chest gets a true recovery day.",
            exercises: []
          }),
          day({
            id: "2026-08-01",
            dow: "Sat",
            dom: 1,
            month: "Aug",
            type: "chest",
            title: "Chest - 30 kg Rebuild",
            footer: "Use a full 3-minute rest on incline press. The goal is three clean sets of six plus a lighter back-off, not a rep max; the 35 kg bracket stays closed.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 3 x 6; 25 kg x 10 back-off", primary: true, tag: "rebuild", defaultRest: 180, note: "15 kg per hand for three clean work sets, then 12.5 kg per hand for the back-off. No forced reps.", sets: setList([[6, 30], [6, 30], [6, 30], [10, 25]]) }),
              exercise({ name: "Machine Chest Press", target: "35 kg - 3 x 8", defaultRest: 120, sets: repeatSet(3, 8, 35) }),
              exercise({ name: "Machine Pec Fly", target: "35 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 35) }),
              exercise({ name: "Assisted Dips", target: "40 kg assist - 2 x 8", note: "Keep one or two reps in reserve.", sets: repeatSet(2, 8, 40) }),
              exercise({ name: "DB Shoulder Press", target: "16 kg total - 2 x 10", sets: repeatSet(2, 10, 16) }),
              exercise({ name: "Cable Lateral Raises", target: "10 kg - 2 x 12", sets: repeatSet(2, 12, 10) })
            ]
          }),
          day({
            id: "2026-08-02",
            dow: "Sun",
            dom: 2,
            month: "Aug",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. Start the next training week on Monday; do not use Sunday for catch-up work.",
            exercises: []
          })
        ]
      },
      {
        id: "w13",
        num: 13,
        title: "Week 13 - Rep Build",
        phase: "Load",
        sub: "Add reps, not load",
        subtitle: "Add reps, not load",
        dateRange: "Aug 3-9",
        notice: "Keep the four-day split. This week adds one rep per working set on the proven lifts while hamstrings return to the June working range.",
        days: [
          day({
            id: "2026-08-03",
            dow: "Mon",
            dom: 3,
            month: "Aug",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "95 kg - 3 x 9", primary: true, tag: "reps", defaultRest: 150, sets: repeatSet(3, 9, 95) }),
              exercise({ name: "Smith Machine Squats", target: "40 kg - 3 x 11", defaultRest: 150, sets: repeatSet(3, 11, 40) }),
              exercise({ name: "Seated Leg Curls", target: "47.5 kg - 3 x 10", defaultRest: 120, sets: repeatSet(3, 10, 47.5) }),
              exercise({ name: "Seated Calf Raises", target: "42.5 kg - 3 x 15", sets: repeatSet(3, 15, 42.5) }),
              exercise({ name: "Abdominal Machine", target: "57.5 kg - 3 x 10", sets: repeatSet(3, 10, 57.5) })
            ]
          }),
          day({
            id: "2026-08-04",
            dow: "Tue",
            dom: 4,
            month: "Aug",
            type: "pull",
            title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "50 kg - 3 x 9", primary: true, tag: "reps", defaultRest: 120, sets: repeatSet(3, 9, 50) }),
              exercise({ name: "Seated Cable Row", target: "50 kg - 3 x 9", defaultRest: 120, sets: repeatSet(3, 9, 50) }),
              exercise({ name: "High Cable Row / Face Pull", target: "45 kg - 3 x 11", sets: repeatSet(3, 11, 45) }),
              exercise({ name: "DB Bicep Curls", target: "20 kg total - 3 x 11", note: "10 kg per hand or nearest available.", sets: repeatSet(3, 11, 20) })
            ]
          }),
          day({
            id: "2026-08-05",
            dow: "Wed",
            dom: 5,
            month: "Aug",
            type: "rest",
            title: "Active Recovery",
            footer: "20-30 min easy walk and mobility only. Keep fatigue low enough to make Thursday repeatable.",
            exercises: []
          }),
          day({
            id: "2026-08-06",
            dow: "Thu",
            dom: 6,
            month: "Aug",
            type: "ham",
            title: "Hamstrings & Glutes",
            footer: "Return to the last fully completed hinge and leg-press loads. No load jump unless Week 12 was complete.",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "37.5 kg total - 3 x 10", primary: true, tag: "reclaim", defaultRest: 150, sets: repeatSet(3, 10, 37.5) }),
              exercise({ name: "High/Wide Leg Press", target: "82.5 kg - 3 x 10", defaultRest: 120, sets: repeatSet(3, 10, 82.5) }),
              exercise({ name: "Lying Leg Curls", target: "45 kg - 3 x 11", defaultRest: 120, sets: repeatSet(3, 11, 45) }),
              exercise({ name: "Walking Lunges", target: "17.5 kg total - 3 x 10", sets: repeatSet(3, 10, 17.5) }),
              exercise({ name: "Abdominal Machine", target: "52.5 kg - 2 x 12", sets: repeatSet(2, 12, 52.5) })
            ]
          }),
          day({
            id: "2026-08-07",
            dow: "Fri",
            dom: 7,
            month: "Aug",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. Eat, hydrate, and arrive at Saturday without residual pressing fatigue.",
            exercises: []
          }),
          day({
            id: "2026-08-08",
            dow: "Sat",
            dom: 8,
            month: "Aug",
            type: "chest",
            title: "Chest - Rep Build",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 3 x 7; 25 kg x 10 back-off", primary: true, tag: "reps", defaultRest: 180, note: "Only add the rep if Week 12 completed all three 30 kg sets cleanly.", sets: setList([[7, 30], [7, 30], [7, 30], [10, 25]]) }),
              exercise({ name: "Machine Chest Press", target: "35 kg - 3 x 9", defaultRest: 120, sets: repeatSet(3, 9, 35) }),
              exercise({ name: "Machine Pec Fly", target: "35 kg - 2 x 11", defaultRest: 120, sets: repeatSet(2, 11, 35) }),
              exercise({ name: "Assisted Dips", target: "40 kg assist - 2 x 9", note: "Keep one or two reps in reserve.", sets: repeatSet(2, 9, 40) }),
              exercise({ name: "DB Shoulder Press", target: "18 kg total - 2 x 8", sets: repeatSet(2, 8, 18) }),
              exercise({ name: "Cable Lateral Raises", target: "10 kg - 2 x 13", sets: repeatSet(2, 13, 10) })
            ]
          }),
          day({
            id: "2026-08-09",
            dow: "Sun",
            dom: 9,
            month: "Aug",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. No make-up lifting.",
            exercises: []
          })
        ]
      },
      {
        id: "w14",
        num: 14,
        title: "Week 14 - Load Week",
        phase: "Load +",
        sub: "Finish the top of each rep range",
        subtitle: "Finish the top of each rep range",
        dateRange: "Aug 10-16",
        notice: "This is the peak accumulation week. Earn each target from Week 13; repeat the prior week on any exercise that missed a set.",
        days: [
          day({
            id: "2026-08-10",
            dow: "Mon",
            dom: 10,
            month: "Aug",
            type: "legs",
            title: "Quad-Dominant Legs & Core",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "95 kg - 3 x 10", primary: true, tag: "rep PR", defaultRest: 150, sets: repeatSet(3, 10, 95) }),
              exercise({ name: "Smith Machine Squats", target: "40 kg - 3 x 12", tag: "rep PR", defaultRest: 150, sets: repeatSet(3, 12, 40) }),
              exercise({ name: "Seated Leg Curls", target: "47.5 kg - 3 x 12", defaultRest: 120, sets: repeatSet(3, 12, 47.5) }),
              exercise({ name: "Seated Calf Raises", target: "42.5 kg - 3 x 20", sets: repeatSet(3, 20, 42.5) }),
              exercise({ name: "Abdominal Machine", target: "57.5 kg - 3 x 12", sets: repeatSet(3, 12, 57.5) })
            ]
          }),
          day({
            id: "2026-08-11",
            dow: "Tue",
            dom: 11,
            month: "Aug",
            type: "pull",
            title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "50 kg - 3 x 10", primary: true, tag: "rep PR", defaultRest: 120, sets: repeatSet(3, 10, 50) }),
              exercise({ name: "Seated Cable Row", target: "50 kg - 3 x 10", tag: "rep PR", defaultRest: 120, sets: repeatSet(3, 10, 50) }),
              exercise({ name: "High Cable Row / Face Pull", target: "45 kg - 3 x 12", sets: repeatSet(3, 12, 45) }),
              exercise({ name: "DB Bicep Curls", target: "20 kg total - 3 x 12", note: "10 kg per hand. Own twelve before changing dumbbells.", sets: repeatSet(3, 12, 20) })
            ]
          }),
          day({
            id: "2026-08-12",
            dow: "Wed",
            dom: 12,
            month: "Aug",
            type: "rest",
            title: "Active Recovery",
            footer: "Easy walking and mobility only. Accumulated fatigue should be noticeable but not disruptive.",
            exercises: []
          }),
          day({
            id: "2026-08-13",
            dow: "Thu",
            dom: 13,
            month: "Aug",
            type: "ham",
            title: "Hamstrings & Glutes - Load",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "40 kg total - 3 x 10", primary: true, tag: "load", defaultRest: 150, note: "Reclaim the last fully completed June load before testing 42.5 kg.", sets: repeatSet(3, 10, 40) }),
              exercise({ name: "High/Wide Leg Press", target: "85 kg - 3 x 10", tag: "load", defaultRest: 120, sets: repeatSet(3, 10, 85) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 8", defaultRest: 120, note: "June 25 was 10 / 8 / 6. Eight clean reps across all sets is the only goal.", sets: repeatSet(3, 8, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 3 x 10", sets: repeatSet(3, 10, 20) }),
              exercise({ name: "Abdominal Machine", target: "55 kg - 3 x 12", sets: repeatSet(3, 12, 55) })
            ]
          }),
          day({
            id: "2026-08-14",
            dow: "Fri",
            dom: 14,
            month: "Aug",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest before the peak chest session. No primer and no make-up work.",
            exercises: []
          }),
          day({
            id: "2026-08-15",
            dow: "Sat",
            dom: 15,
            month: "Aug",
            type: "chest",
            title: "Chest - Eight-Rep Bracket",
            footer: "Three clean work sets of eight at 30 kg plus the back-off is the accumulation target. Stop with one rep in reserve; Week 16 is the test.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 3 x 8; 25 kg x 10 back-off", primary: true, tag: "rep PR", defaultRest: 180, sets: setList([[8, 30], [8, 30], [8, 30], [10, 25]]) }),
              exercise({ name: "Machine Chest Press", target: "35 kg - 3 x 10", defaultRest: 120, sets: repeatSet(3, 10, 35) }),
              exercise({ name: "Machine Pec Fly", target: "35 kg - 2 x 12", defaultRest: 120, sets: repeatSet(2, 12, 35) }),
              exercise({ name: "Assisted Dips", target: "40 kg assist - 2 x 10", note: "Controlled reps, one or two left in reserve.", sets: repeatSet(2, 10, 40) }),
              exercise({ name: "DB Shoulder Press", target: "18 kg total - 2 x 10", sets: repeatSet(2, 10, 18) }),
              exercise({ name: "Cable Lateral Raises", target: "10 kg - 2 x 15", sets: repeatSet(2, 15, 10) })
            ]
          }),
          day({
            id: "2026-08-16",
            dow: "Sun",
            dom: 16,
            month: "Aug",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest before the deload week.",
            exercises: []
          })
        ]
      },
      {
        id: "w15",
        num: 15,
        title: "Week 15 - Deload",
        phase: "Deload",
        sub: "Absorb three weeks of work",
        subtitle: "Absorb three weeks of work",
        dateRange: "Aug 17-23",
        notice: "Planned deload: roughly one-third fewer sets and 15-25% less load. Keep the same four-day rhythm so recovery does not turn into schedule drift.",
        days: [
          day({
            id: "2026-08-17",
            dow: "Mon",
            dom: 17,
            month: "Aug",
            type: "legs",
            title: "Legs & Core (Deload)",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "75 kg - 2 x 10", primary: true, defaultRest: 120, sets: repeatSet(2, 10, 75) }),
              exercise({ name: "Smith Machine Squats", target: "30 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 30) }),
              exercise({ name: "Seated Leg Curls", target: "35 kg - 2 x 12", sets: repeatSet(2, 12, 35) }),
              exercise({ name: "Seated Calf Raises", target: "30 kg - 2 x 15", sets: repeatSet(2, 15, 30) }),
              exercise({ name: "Abdominal Machine", target: "45 kg - 2 x 12", sets: repeatSet(2, 12, 45) })
            ]
          }),
          day({
            id: "2026-08-18",
            dow: "Tue",
            dom: 18,
            month: "Aug",
            type: "pull",
            title: "Back & Biceps (Deload)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "40 kg - 2 x 10", primary: true, defaultRest: 120, sets: repeatSet(2, 10, 40) }),
              exercise({ name: "Seated Cable Row", target: "40 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 40) }),
              exercise({ name: "High Cable Row / Face Pull", target: "35 kg - 2 x 12", sets: repeatSet(2, 12, 35) }),
              exercise({ name: "DB Bicep Curls", target: "16 kg total - 2 x 10", note: "8 kg per hand or nearest available.", sets: repeatSet(2, 10, 16) })
            ]
          }),
          day({
            id: "2026-08-19",
            dow: "Wed",
            dom: 19,
            month: "Aug",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. Skip optional cardio this week if sleep or soreness is off baseline.",
            exercises: []
          }),
          day({
            id: "2026-08-20",
            dow: "Thu",
            dom: 20,
            month: "Aug",
            type: "ham",
            title: "Hamstrings & Glutes (Deload)",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "30 kg total - 2 x 10", primary: true, defaultRest: 120, sets: repeatSet(2, 10, 30) }),
              exercise({ name: "High/Wide Leg Press", target: "65 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 65) }),
              exercise({ name: "Lying Leg Curls", target: "35 kg - 2 x 12", sets: repeatSet(2, 12, 35) }),
              exercise({ name: "Walking Lunges", target: "10 kg total - 1 x 10", sets: repeatSet(1, 10, 10) })
            ]
          }),
          day({
            id: "2026-08-21",
            dow: "Fri",
            dom: 21,
            month: "Aug",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. Keep Saturday easy too; the goal is to leave the gym fresher than you entered.",
            exercises: []
          }),
          day({
            id: "2026-08-22",
            dow: "Sat",
            dom: 22,
            month: "Aug",
            type: "chest",
            title: "Chest (Deload)",
            footer: "RPE 5-6 only. No dips and no failure work.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 kg total - 2 x 8", primary: true, defaultRest: 120, sets: repeatSet(2, 8, 25) }),
              exercise({ name: "Machine Chest Press", target: "25 kg - 2 x 10", sets: repeatSet(2, 10, 25) }),
              exercise({ name: "Machine Pec Fly", target: "25 kg - 2 x 10", sets: repeatSet(2, 10, 25) }),
              exercise({ name: "DB Shoulder Press", target: "16 kg total - 1 x 10", sets: repeatSet(1, 10, 16) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 1 x 12", sets: repeatSet(1, 12, 7.5) })
            ]
          }),
          day({
            id: "2026-08-23",
            dow: "Sun",
            dom: 23,
            month: "Aug",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. Let the deload finish before test week begins.",
            exercises: []
          })
        ]
      },
      {
        id: "w16",
        num: 16,
        title: "Week 16 - Test Week",
        phase: "Test",
        sub: "Controlled PRs, no gauntlets",
        subtitle: "Controlled PRs, no gauntlets",
        dateRange: "Aug 24-30",
        notice: "Test the progress built in Weeks 12-14 without repeating Week 10's fatigue stack. Wednesday and Friday remain protected recovery days, and the incline target is 4 x 8 at 30 kg - not 35 kg.",
        days: [
          day({
            id: "2026-08-24",
            dow: "Mon",
            dom: 24,
            month: "Aug",
            type: "legs",
            title: "Quad-Dominant Legs & Core - Test",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "97.5 kg - 3 x 8", primary: true, tag: "PR attempt", defaultRest: 180, note: "Attempt only if Week 14 reached 95 kg for 3 x 10.", sets: repeatSet(3, 8, 97.5) }),
              exercise({ name: "Smith Machine Squats", target: "42.5 kg - 3 x 8", tag: "PR attempt", defaultRest: 150, sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "Seated Leg Curls", target: "50 kg - 3 x 10", tag: "PR attempt", defaultRest: 120, sets: repeatSet(3, 10, 50) }),
              exercise({ name: "Seated Calf Raises", target: "45 kg - 3 x 15", tag: "PR attempt", sets: repeatSet(3, 15, 45) }),
              exercise({ name: "Abdominal Machine", target: "60 kg - 3 x 10", tag: "PR attempt", sets: repeatSet(3, 10, 60) })
            ]
          }),
          day({
            id: "2026-08-25",
            dow: "Tue",
            dom: 25,
            month: "Aug",
            type: "pull",
            title: "Back & Biceps (Pull) - Test",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "52.5 kg - 3 x 8", primary: true, tag: "PR attempt", defaultRest: 150, sets: repeatSet(3, 8, 52.5) }),
              exercise({ name: "Seated Cable Row", target: "52.5 kg - 3 x 8", tag: "PR attempt", defaultRest: 150, sets: repeatSet(3, 8, 52.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "47.5 kg - 3 x 10", tag: "PR attempt", defaultRest: 120, sets: repeatSet(3, 10, 47.5) }),
              exercise({ name: "DB Bicep Curls", target: "22.5 kg total - 3 x 8", tag: "PR attempt", note: "Use the nearest available matched pair; repeat 20 kg x 12 if the next pair is too large.", sets: repeatSet(3, 8, 22.5) })
            ]
          }),
          day({
            id: "2026-08-26",
            dow: "Wed",
            dom: 26,
            month: "Aug",
            type: "rest",
            title: "Active Recovery",
            footer: "20-30 min easy walk and mobility. Do not move Thursday's session forward.",
            exercises: []
          }),
          day({
            id: "2026-08-27",
            dow: "Thu",
            dom: 27,
            month: "Aug",
            type: "ham",
            title: "Hamstrings & Glutes - Test",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "42.5 kg total - 3 x 8", primary: true, tag: "PR attempt", defaultRest: 180, sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "High/Wide Leg Press", target: "87.5 kg - 3 x 8", tag: "PR attempt", defaultRest: 150, sets: repeatSet(3, 8, 87.5) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 10", tag: "PR attempt", defaultRest: 120, sets: repeatSet(3, 10, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 2 x 12", tag: "rep PR", sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Abdominal Machine", target: "57.5 kg - 2 x 10", sets: repeatSet(2, 10, 57.5) })
            ]
          }),
          day({
            id: "2026-08-28",
            dow: "Fri",
            dom: 28,
            month: "Aug",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. Saturday's chest result matters more than checking a fifth-session box.",
            exercises: []
          }),
          day({
            id: "2026-08-29",
            dow: "Sat",
            dom: 29,
            month: "Aug",
            type: "chest",
            title: "Chest - Controlled Test",
            footer: "Target 4 x 8 at 30 kg with three-minute rests. Only a future clean 4 x 10 opens the 35 kg total bracket.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 4 x 8", primary: true, tag: "PR target", defaultRest: 180, note: "Attempt only if Week 14 completed all three 30 kg work sets cleanly. No forced reps.", sets: repeatSet(4, 8, 30) }),
              exercise({ name: "Machine Chest Press", target: "37.5 kg - 3 x 8", tag: "PR attempt", defaultRest: 150, sets: repeatSet(3, 8, 37.5) }),
              exercise({ name: "Machine Pec Fly", target: "40 kg - 2 x 8", defaultRest: 120, sets: repeatSet(2, 8, 40) }),
              exercise({ name: "Assisted Dips", target: "35 kg assist - 2 x 8", tag: "rep PR", note: "Keep one rep in reserve; shoulder comfort is the gate.", sets: repeatSet(2, 8, 35) }),
              exercise({ name: "DB Shoulder Press", target: "20 kg total - 2 x 8", tag: "rep PR", sets: repeatSet(2, 8, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "12.5 kg - 2 x 10", tag: "rep PR", sets: repeatSet(2, 10, 12.5) })
            ]
          }),
          day({
            id: "2026-08-30",
            dow: "Sun",
            dom: 30,
            month: "Aug",
            type: "rest",
            title: "Cycle Complete / Full Rest",
            footer: "Full rest. Export the completed block before programming the next cycle.",
            exercises: []
          })
        ]
      }
    ]
  };
}());
