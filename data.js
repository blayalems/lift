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
      dateRange: "May 13-June 14, 2026",
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
      }
    ]
  };
}());
