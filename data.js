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
      weightMode: cfg.weightMode || null,
      loadDirection: cfg.loadDirection || null,
      incrementKg: cfg.incrementKg || null,
      repRange: cfg.repRange || null,
      muscleGroups: cfg.muscleGroups || null,
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

  function enrichExerciseMetadata(item) {
    var name = String(item.name || "").toLowerCase();
    if (!item.weightMode) {
      if (/cable lateral raise/.test(name)) item.weightMode = "per_side";
      else if (/\bdb\b|dumbbell/.test(name)) item.weightMode = "total";
      else item.weightMode = "machine_total";
    }
    if (/assisted/.test(name)) item.loadDirection = "lower";
    if (!item.incrementKg) {
      item.incrementKg = /lateral raise|rear delt|curl/.test(name) ? 1 : /\bdb\b|dumbbell/.test(name) ? 2 : 2.5;
    }
    if (!item.repRange) {
      var reps = (item.sets || []).map(function (set) { return Number(set.reps || 0); }).filter(function (value) { return value > 0; });
      var top = reps.length ? Math.max.apply(null, reps) : 12;
      item.repRange = [Math.max(1, top - 2), top];
    }
    if (/incline.*press/.test(name)) item.muscleGroups = { upperChest: 1, chest: 0.5, triceps: 0.35 };
    else if (/one-arm cable pulldown|lat pulldown/.test(name)) item.muscleGroups = { lats: 1, biceps: 0.5 };
    else if (/cable lateral raise/.test(name)) item.muscleGroups = { sideDelts: 1 };
    else if (/abdominal machine|hanging knee raise/.test(name)) item.muscleGroups = { abs: 1 };
    else if (/romanian deadlift/.test(name)) item.muscleGroups = { hamstrings: 1, glutes: 0.75, spinalErectors: 0.5 };
    else if (/back extension/.test(name)) item.muscleGroups = { spinalErectors: 1, glutes: 0.5, hamstrings: 0.5 };
    return item;
  }

  function addSpecialization(plan) {
    (plan.weeks || []).forEach(function (week) {
      (week.days || []).forEach(function (trainingDay) {
        (trainingDay.exercises || []).forEach(enrichExerciseMetadata);
      });
      if (Number(week.num) < 14) return;
      var phase = String(week.phase || "").toLowerCase();
      var deload = phase === "deload";
      var reentry = phase === "reentry";
      var light = deload || reentry;
      var specTag = reentry ? "reentry" : deload ? "deload" : null;
      var tuesday = (week.days || []).find(function (trainingDay) { return trainingDay.dow === "Tue"; });
      if (tuesday && tuesday.type !== "rest" && !tuesday.exercises.some(function (item) { return item.name === "45 Degree Back Extension"; })) {
        tuesday.exercises.push(enrichExerciseMetadata(exercise({
          name: "45 Degree Back Extension",
          target: light ? "Bodyweight - 1 x 12 easy" : "10 kg - 2 x 12",
          tag: specTag || "lower-back volume",
          defaultRest: 90,
          weightMode: "total",
          incrementKg: 2.5,
          repRange: [10, 15],
          muscleGroups: { spinalErectors: 1, glutes: 0.5, hamstrings: 0.5 },
          note: "Controlled spinal-erector work. Stop before fatigue changes position; this sits 48 hours before Thursday hinges.",
          sets: repeatSet(light ? 1 : 2, 12, light ? 0 : 10)
        })));
      }
      var saturday = (week.days || []).find(function (trainingDay) { return trainingDay.dow === "Sat"; });
      if (saturday && saturday.type !== "rest" && !saturday.exercises.some(function (item) { return item.name === "Hanging Knee Raise"; })) {
        saturday.exercises.push(enrichExerciseMetadata(exercise({
          name: "Hanging Knee Raise",
          target: light ? "1 x 10 controlled" : "2 x 10-15",
          tag: specTag || "ab volume",
          defaultRest: 60,
          weightMode: "bodyweight",
          repRange: [10, 15],
          muscleGroups: { abs: 1 },
          note: "Posterior pelvic tilt, controlled range. Add reps before load.",
          sets: repeatSet(light ? 1 : 2, 10, 0)
        })));
      }
    });
  }

  window.LIFT_PLAN = {
    meta: {
      title: "Lem Progressive Overload Plan",
      athlete: "Lem",
      dateRange: "May 12, 2026-January 31, 2027",
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
        notice: "Six training days fill the missing week, with Sunday as the only full rest day. Because the export shows pull, legs, and chest completed July 16-18 on three consecutive days, every bridge session stays low-volume and submaximal: technique work Monday and Tuesday, upper-chest and side-delt technique Wednesday, posterior-chain re-entry Thursday, a light primer Friday, and a chest reset Saturday.",
        days: [
          day({
            id: "2026-07-20",
            dow: "Mon",
            dom: 20,
            month: "Jul",
            type: "legs",
            title: "Legs & Core - Technique",
            footer: "Use RPE 5-6 after the late Week 10 training stack. Smooth reps only.",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "75 kg - 2 x 10", primary: true, tag: "reset", defaultRest: 120, sets: repeatSet(2, 10, 75) }),
              exercise({ name: "Smith Machine Squats", target: "30 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 30) }),
              exercise({ name: "Seated Leg Curls", target: "35 kg - 2 x 12", sets: repeatSet(2, 12, 35) }),
              exercise({ name: "Seated Calf Raises", target: "30 kg - 2 x 15", sets: repeatSet(2, 15, 30) }),
              exercise({ name: "Abdominal Machine", target: "40 kg - 2 x 12", sets: repeatSet(2, 12, 40) })
            ]
          }),
          day({
            id: "2026-07-21",
            dow: "Tue",
            dom: 21,
            month: "Jul",
            type: "pull",
            title: "Back & Biceps - Technique",
            footer: "Keep two or three reps in reserve on every set. This is a reset, not another test day.",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "40 kg - 2 x 10", primary: true, tag: "reset", defaultRest: 120, sets: repeatSet(2, 10, 40) }),
              exercise({ name: "Seated Cable Row", target: "40 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 40) }),
              exercise({ name: "High Cable Row / Face Pull", target: "35 kg - 2 x 12", sets: repeatSet(2, 12, 35) }),
              exercise({ name: "DB Bicep Curls", target: "16 kg total - 2 x 10", sets: repeatSet(2, 10, 16) })
            ]
          }),
          day({
            id: "2026-07-22",
            dow: "Wed",
            dom: 22,
            month: "Jul",
            type: "primer",
            title: "Upper Chest & Side Delts - Technique",
            subtitle: "Second upper-chest exposure, low fatigue.",
            footer: "Stay at RPE 5-6. This is technique volume for the muscles that need more work, not a second chest test.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 8", primary: true, tag: "technique", defaultRest: 120, sets: repeatSet(2, 8, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 2 x 12", sets: repeatSet(2, 12, 5) })
            ]
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
            type: "primer",
            title: "Lats & Rear Delts - Technique",
            footer: "Use controlled contractions and leave three reps in reserve. Do not turn Friday into a heavy pull day.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "20 kg - 2 x 10 / side", primary: true, tag: "technique", defaultRest: 120, sets: repeatSet(2, 10, 20) }),
              exercise({ name: "Rear Delt Fly", target: "15 kg - 2 x 12", sets: repeatSet(2, 12, 15) }),
              exercise({ name: "DB Bicep Curls", target: "16 kg total - 1 x 10", tag: "arms", sets: repeatSet(1, 10, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "22.5 kg - 1 x 12", tag: "arms", sets: repeatSet(1, 12, 22.5) })
            ]
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
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 2 x 12", sets: repeatSet(2, 12, 5) })
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
        sub: "Six-day split, four progressive days",
        subtitle: "Six-day split, four progressive days",
        dateRange: "Jul 27-Aug 2",
        notice: "Train Monday through Saturday and keep Sunday as the only full rest day. The four progression sessions remain Monday, Tuesday, Thursday, and Saturday; Wednesday adds upper-chest and side-delt volume, while Friday adds lats, rear delts, and brief direct arm work. Keep both secondary days submaximal and use 2-3 minutes on primary lifts.",
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
            type: "primer",
            title: "Upper Chest & Side Delts",
            subtitle: "Second weekly upper-chest exposure.",
            footer: "Use controlled reps and keep two or three reps in reserve. Saturday remains the heavier chest day.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 10", primary: true, tag: "volume", defaultRest: 120, sets: repeatSet(2, 10, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", sets: repeatSet(2, 12, 7.5) })
            ]
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
            type: "primer",
            title: "Lats, Rear Delts & Arms",
            subtitle: "Second pull exposure plus brief arm work.",
            footer: "Keep the back work controlled and stop the brief arm sets with one or two reps in reserve.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "20 kg - 2 x 10 / side", primary: true, tag: "lat volume", defaultRest: 120, sets: repeatSet(2, 10, 20) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 12", sets: repeatSet(2, 12, 17.5) }),
              exercise({ name: "DB Bicep Curls", target: "16 kg total - 1 x 12", tag: "arms", sets: repeatSet(1, 12, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "25 kg - 1 x 12", tag: "arms", sets: repeatSet(1, 12, 25) })
            ]
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
        notice: "Keep the six-day rhythm with Sunday fully off. Add reps on the four main days, then progress Wednesday upper-chest/delts and Friday lats/rear-delts with brief direct arm work only while those sessions stay at RPE 6-7.",
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
            type: "primer",
            title: "Upper Chest & Side Delts",
            footer: "Add reps, not strain. Keep two reps in reserve so Thursday remains repeatable.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 11", primary: true, tag: "volume", defaultRest: 120, sets: repeatSet(2, 11, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 13", sets: repeatSet(2, 13, 7.5) })
            ]
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
            type: "primer",
            title: "Lats, Rear Delts & Arms",
            footer: "Second pull exposure plus brief direct arm work. No grinding reps and no failure work before Saturday chest.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "20 kg - 2 x 11 / side", primary: true, tag: "lat volume", defaultRest: 120, sets: repeatSet(2, 11, 20) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 13", sets: repeatSet(2, 13, 17.5) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 13", tag: "arms", sets: repeatSet(1, 13, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "25 kg - 1 x 13", tag: "arms", sets: repeatSet(1, 13, 25) })
            ]
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
        notice: "This is the peak six-day accumulation week. Earn each target from Week 13 and repeat the prior prescription on any exercise that missed a set. Wednesday emphasizes upper chest and delts; Friday emphasizes lats and rear delts with brief direct arm work and no failure work.",
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
            type: "primer",
            title: "Upper Chest & Side Delts - Peak Volume",
            footer: "Peak volume, not peak effort. Keep one or two clean reps in reserve on every set.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 12", primary: true, tag: "volume", defaultRest: 120, sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 15", tag: "delt volume", sets: repeatSet(2, 15, 7.5) })
            ]
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
            type: "primer",
            title: "Lats, Rear Delts & Arms",
            footer: "Keep every rep controlled. Stop the brief arm sets one rep short of failure so Saturday pressing stays clean.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "20 kg - 2 x 12 / side", primary: true, tag: "lat volume", defaultRest: 120, sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 15", sets: repeatSet(2, 15, 17.5) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 15", tag: "arms", sets: repeatSet(1, 15, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "25 kg - 1 x 15", tag: "arms", sets: repeatSet(1, 15, 25) })
            ]
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
        notice: "Planned six-day deload: keep Monday through Saturday training and Sunday fully off, but cut the secondary days and main sessions to roughly half volume at easy loads. Every set should finish with at least three reps in reserve.",
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
            type: "primer",
            title: "Upper Chest & Delts (Deload)",
            footer: "Technique only at RPE 5. Keep the session short and leave the gym fresher than you entered.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 1 x 10", primary: true, defaultRest: 120, sets: repeatSet(1, 10, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 1 x 12", sets: repeatSet(1, 12, 5) })
            ]
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
            type: "primer",
            title: "Lats, Rear Delts & Arms (Deload)",
            footer: "One easy pass through each movement. No pump chasing and no failure work.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "15 kg - 1 x 10 / side", primary: true, defaultRest: 120, sets: repeatSet(1, 10, 15) }),
              exercise({ name: "Rear Delt Fly", target: "15 kg - 1 x 12", sets: repeatSet(1, 12, 15) }),
              exercise({ name: "Incline DB Curls", target: "12 kg total - 1 x 12", tag: "arms", sets: repeatSet(1, 12, 12) }),
              exercise({ name: "Tricep Pushdowns", target: "20 kg - 1 x 12", tag: "arms", sets: repeatSet(1, 12, 20) })
            ]
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
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 1 x 12", sets: repeatSet(1, 12, 5) })
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
        title: "Week 16 - Controlled Baseline",
        phase: "Test",
        sub: "Record clean working baselines",
        subtitle: "Record clean working baselines",
        dateRange: "Aug 24-30",
        notice: "Record controlled baselines from the progress built in Weeks 12-14 without repeating Week 10's fatigue stack. Every test load is conditional on completing the Week 14 target cleanly; otherwise repeat the last fully completed load. Keep Wednesday and Friday at RPE 5-6, and use Week 16 results as the loads to consolidate in Week 17. The incline target remains 4 x 8 at 30 kg - not 35 kg.",
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
            type: "primer",
            title: "Upper Chest & Delts - Test Primer",
            footer: "Technique-only volume. Finish every set with at least three reps in reserve and do not move Thursday forward.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 1 x 8", primary: true, defaultRest: 120, sets: repeatSet(1, 8, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 1 x 12", sets: repeatSet(1, 12, 5) })
            ]
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
            type: "primer",
            title: "Lats, Rear Delts & Arms - Test Primer",
            footer: "Easy quality reps only. Saturday's chest result matters more than Friday load or pump.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "15 kg - 1 x 8 / side", primary: true, defaultRest: 120, sets: repeatSet(1, 8, 15) }),
              exercise({ name: "Rear Delt Fly", target: "15 kg - 1 x 10", sets: repeatSet(1, 10, 15) }),
              exercise({ name: "Incline DB Curls", target: "12 kg total - 1 x 10", tag: "arms", sets: repeatSet(1, 10, 12) }),
              exercise({ name: "Tricep Pushdowns", target: "20 kg - 1 x 10", tag: "arms", sets: repeatSet(1, 10, 20) })
            ]
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
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 1 x 12", sets: repeatSet(1, 12, 7.5) })
            ]
          }),
          day({
            id: "2026-08-30",
            dow: "Sun",
            dom: 30,
            month: "Aug",
            type: "rest",
            title: "Block Transition / Full Rest",
            footer: "Full rest. Record Week 16 outcomes; Week 17 begins by repeating the last clean loads.",
            exercises: []
          })
        ]
      },
      {
        id: "w17",
        num: 17,
        title: "Week 17 - Post-Test Consolidation",
        phase: "Consolidate",
        sub: "Own the clean baseline",
        subtitle: "Own the clean baseline",
        dateRange: "Aug 31-Sep 6",
        notice: "Repeat the Week 16 load only when every prescribed rep was clean. If a baseline attempt missed, use the last fully completed load and keep the listed reps. Do not increase load this week; Wednesday and Friday remain short priority sessions and Sunday is fully off.",
        days: [
          day({
            id: "2026-08-31",
            dow: "Mon",
            dom: 31,
            month: "Aug",
            type: "legs",
            title: "Legs & Core - Consolidate",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "97.5 kg - 3 x 8", primary: true, tag: "consolidate", defaultRest: 180, sets: repeatSet(3, 8, 97.5) }),
              exercise({ name: "Smith Machine Squats", target: "42.5 kg - 3 x 8", defaultRest: 150, sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "Seated Leg Curls", target: "50 kg - 3 x 10", defaultRest: 120, sets: repeatSet(3, 10, 50) }),
              exercise({ name: "Seated Calf Raises", target: "45 kg - 3 x 15", defaultRest: 90, sets: repeatSet(3, 15, 45) }),
              exercise({ name: "Abdominal Machine", target: "60 kg - 3 x 10", defaultRest: 90, sets: repeatSet(3, 10, 60) })
            ]
          }),
          day({
            id: "2026-09-01",
            dow: "Tue",
            dom: 1,
            month: "Sep",
            type: "pull",
            title: "Back & Biceps - Consolidate",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "52.5 kg - 3 x 8", primary: true, tag: "consolidate", defaultRest: 150, sets: repeatSet(3, 8, 52.5) }),
              exercise({ name: "Seated Cable Row", target: "52.5 kg - 3 x 8", defaultRest: 150, sets: repeatSet(3, 8, 52.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "47.5 kg - 3 x 10", defaultRest: 120, sets: repeatSet(3, 10, 47.5) }),
              exercise({ name: "DB Bicep Curls", target: "22.5 kg total - 3 x 8", defaultRest: 90, sets: repeatSet(3, 8, 22.5) })
            ]
          }),
          day({
            id: "2026-09-02",
            dow: "Wed",
            dom: 2,
            month: "Sep",
            type: "primer",
            title: "Upper Chest & Side Delts",
            footer: "RPE 6 with three reps in reserve. Saturday remains the heavier upper-chest session.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 10", primary: true, tag: "volume", defaultRest: 120, sets: repeatSet(2, 10, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", defaultRest: 75, sets: repeatSet(2, 12, 7.5) })
            ]
          }),
          day({
            id: "2026-09-03",
            dow: "Thu",
            dom: 3,
            month: "Sep",
            type: "ham",
            title: "Hamstrings & Glutes - Consolidate",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "42.5 kg total - 3 x 8", primary: true, tag: "consolidate", defaultRest: 180, sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "High/Wide Leg Press", target: "87.5 kg - 3 x 8", defaultRest: 150, sets: repeatSet(3, 8, 87.5) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 10", defaultRest: 120, sets: repeatSet(3, 10, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 2 x 12", defaultRest: 120, sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Abdominal Machine", target: "57.5 kg - 2 x 10", defaultRest: 90, sets: repeatSet(2, 10, 57.5) })
            ]
          }),
          day({
            id: "2026-09-04",
            dow: "Fri",
            dom: 4,
            month: "Sep",
            type: "primer",
            title: "Lats, Rear Delts & Arms",
            footer: "RPE 6-7. Use one focused set each for biceps and triceps, stopping one or two reps short of failure before Saturday.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "20 kg - 2 x 10 / side", primary: true, tag: "lat volume", defaultRest: 120, sets: repeatSet(2, 10, 20) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 12", defaultRest: 90, sets: repeatSet(2, 12, 17.5) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 12", tag: "arms", defaultRest: 90, sets: repeatSet(1, 12, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "25 kg - 1 x 12", tag: "arms", defaultRest: 90, sets: repeatSet(1, 12, 25) })
            ]
          }),
          day({
            id: "2026-09-05",
            dow: "Sat",
            dom: 5,
            month: "Sep",
            type: "chest",
            title: "Chest - Own the Baseline",
            footer: "Repeat the Week 16 result cleanly. Do not add load or forced reps.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 4 x 8", primary: true, tag: "consolidate", defaultRest: 180, sets: repeatSet(4, 8, 30) }),
              exercise({ name: "Machine Chest Press", target: "37.5 kg - 3 x 8", defaultRest: 150, sets: repeatSet(3, 8, 37.5) }),
              exercise({ name: "Machine Pec Fly", target: "40 kg - 2 x 8", defaultRest: 120, sets: repeatSet(2, 8, 40) }),
              exercise({ name: "Assisted Dips", target: "35 kg assist - 2 x 8", defaultRest: 120, sets: repeatSet(2, 8, 35) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", defaultRest: 75, sets: repeatSet(2, 12, 7.5) })
            ]
          }),
          day({
            id: "2026-09-06",
            dow: "Sun",
            dom: 6,
            month: "Sep",
            type: "rest",
            title: "Full Rest",
            footer: "Full rest. No catch-up training.",
            exercises: []
          })
        ]
      },
      {
        id: "w18",
        num: 18,
        title: "Week 18 - Rep Build",
        phase: "Load",
        sub: "Add one rep, keep load",
        subtitle: "Add one rep, keep load",
        dateRange: "Sep 7-13",
        notice: "Add only the listed rep after Week 17 was clean; otherwise repeat Week 17. Keep every load unchanged and avoid failure work so six-day frequency remains sustainable.",
        days: [
          day({
            id: "2026-09-07", dow: "Mon", dom: 7, month: "Sep", type: "legs", title: "Legs & Core - Rep Build",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "97.5 kg - 3 x 9", primary: true, tag: "reps", defaultRest: 180, sets: repeatSet(3, 9, 97.5) }),
              exercise({ name: "Smith Machine Squats", target: "42.5 kg - 3 x 9", defaultRest: 150, sets: repeatSet(3, 9, 42.5) }),
              exercise({ name: "Seated Leg Curls", target: "50 kg - 3 x 11", defaultRest: 120, sets: repeatSet(3, 11, 50) }),
              exercise({ name: "Seated Calf Raises", target: "45 kg - 3 x 18", defaultRest: 90, sets: repeatSet(3, 18, 45) }),
              exercise({ name: "Abdominal Machine", target: "60 kg - 3 x 11", defaultRest: 90, sets: repeatSet(3, 11, 60) })
            ]
          }),
          day({
            id: "2026-09-08", dow: "Tue", dom: 8, month: "Sep", type: "pull", title: "Back & Biceps - Rep Build",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "52.5 kg - 3 x 9", primary: true, tag: "reps", defaultRest: 150, sets: repeatSet(3, 9, 52.5) }),
              exercise({ name: "Seated Cable Row", target: "52.5 kg - 3 x 9", defaultRest: 150, sets: repeatSet(3, 9, 52.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "47.5 kg - 3 x 11", defaultRest: 120, sets: repeatSet(3, 11, 47.5) }),
              exercise({ name: "DB Bicep Curls", target: "22.5 kg total - 3 x 9", defaultRest: 90, sets: repeatSet(3, 9, 22.5) })
            ]
          }),
          day({
            id: "2026-09-09", dow: "Wed", dom: 9, month: "Sep", type: "primer", title: "Upper Chest & Side Delts - Rep Build",
            footer: "Add reps, not strain. Keep three reps in reserve.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 11", primary: true, tag: "volume", defaultRest: 120, sets: repeatSet(2, 11, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 13", defaultRest: 75, sets: repeatSet(2, 13, 7.5) })
            ]
          }),
          day({
            id: "2026-09-10", dow: "Thu", dom: 10, month: "Sep", type: "ham", title: "Hamstrings & Glutes - Rep Build",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "42.5 kg total - 3 x 9", primary: true, tag: "reps", defaultRest: 180, sets: repeatSet(3, 9, 42.5) }),
              exercise({ name: "High/Wide Leg Press", target: "87.5 kg - 3 x 9", defaultRest: 150, sets: repeatSet(3, 9, 87.5) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 11", defaultRest: 120, sets: repeatSet(3, 11, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 2 x 12", defaultRest: 120, sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Abdominal Machine", target: "57.5 kg - 2 x 11", defaultRest: 90, sets: repeatSet(2, 11, 57.5) })
            ]
          }),
          day({
            id: "2026-09-11", dow: "Fri", dom: 11, month: "Sep", type: "primer", title: "Lats, Rear Delts & Arms",
            footer: "Progress reps while keeping the session submaximal. No failure before Saturday.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "20 kg - 2 x 11 / side", primary: true, tag: "lat volume", defaultRest: 120, sets: repeatSet(2, 11, 20) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 13", defaultRest: 90, sets: repeatSet(2, 13, 17.5) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 13", tag: "arms", defaultRest: 90, sets: repeatSet(1, 13, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "25 kg - 1 x 13", tag: "arms", defaultRest: 90, sets: repeatSet(1, 13, 25) })
            ]
          }),
          day({
            id: "2026-09-12", dow: "Sat", dom: 12, month: "Sep", type: "chest", title: "Chest - Rep Build",
            footer: "Add one rep per set only if Week 17 was clean. Use three-minute rests on incline press.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 4 x 9", primary: true, tag: "reps", defaultRest: 180, sets: repeatSet(4, 9, 30) }),
              exercise({ name: "Machine Chest Press", target: "37.5 kg - 3 x 9", defaultRest: 150, sets: repeatSet(3, 9, 37.5) }),
              exercise({ name: "Machine Pec Fly", target: "40 kg - 2 x 9", defaultRest: 120, sets: repeatSet(2, 9, 40) }),
              exercise({ name: "Assisted Dips", target: "35 kg assist - 2 x 9", defaultRest: 120, sets: repeatSet(2, 9, 35) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 13", defaultRest: 75, sets: repeatSet(2, 13, 7.5) })
            ]
          }),
          day({ id: "2026-09-13", dow: "Sun", dom: 13, month: "Sep", type: "rest", title: "Full Rest", footer: "Full rest. No catch-up training.", exercises: [] })
        ]
      },
      {
        id: "w19",
        num: 19,
        title: "Week 19 - Top of the Range",
        phase: "Load +",
        sub: "Finish clean, no forced reps",
        subtitle: "Finish clean, no forced reps",
        dateRange: "Sep 14-20",
        notice: "Use the same loads for a third week and finish the rep range. Only progress an exercise when Week 18 was complete; otherwise repeat Week 18. The 30 kg incline bracket opens to 35 kg only after all four sets of ten are clean.",
        days: [
          day({
            id: "2026-09-14", dow: "Mon", dom: 14, month: "Sep", type: "legs", title: "Legs & Core - Top Reps",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "97.5 kg - 3 x 10", primary: true, tag: "rep PR", defaultRest: 180, sets: repeatSet(3, 10, 97.5) }),
              exercise({ name: "Smith Machine Squats", target: "42.5 kg - 3 x 10", defaultRest: 150, sets: repeatSet(3, 10, 42.5) }),
              exercise({ name: "Seated Leg Curls", target: "50 kg - 3 x 12", defaultRest: 120, sets: repeatSet(3, 12, 50) }),
              exercise({ name: "Seated Calf Raises", target: "45 kg - 3 x 20", defaultRest: 90, sets: repeatSet(3, 20, 45) }),
              exercise({ name: "Abdominal Machine", target: "60 kg - 3 x 12", defaultRest: 90, sets: repeatSet(3, 12, 60) })
            ]
          }),
          day({
            id: "2026-09-15", dow: "Tue", dom: 15, month: "Sep", type: "pull", title: "Back & Biceps - Top Reps",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "52.5 kg - 3 x 10", primary: true, tag: "rep PR", defaultRest: 150, sets: repeatSet(3, 10, 52.5) }),
              exercise({ name: "Seated Cable Row", target: "52.5 kg - 3 x 10", defaultRest: 150, sets: repeatSet(3, 10, 52.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "47.5 kg - 3 x 12", defaultRest: 120, sets: repeatSet(3, 12, 47.5) }),
              exercise({ name: "DB Bicep Curls", target: "22.5 kg total - 3 x 10", defaultRest: 90, sets: repeatSet(3, 10, 22.5) })
            ]
          }),
          day({
            id: "2026-09-16", dow: "Wed", dom: 16, month: "Sep", type: "primer", title: "Upper Chest & Side Delts - Top Reps",
            footer: "RPE 6-7 only. Saturday owns the milestone work.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 12", primary: true, tag: "volume", defaultRest: 120, sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 15", defaultRest: 75, sets: repeatSet(2, 15, 7.5) })
            ]
          }),
          day({
            id: "2026-09-17", dow: "Thu", dom: 17, month: "Sep", type: "ham", title: "Hamstrings & Glutes - Top Reps",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "42.5 kg total - 3 x 10", primary: true, tag: "rep PR", defaultRest: 180, sets: repeatSet(3, 10, 42.5) }),
              exercise({ name: "High/Wide Leg Press", target: "87.5 kg - 3 x 10", defaultRest: 150, sets: repeatSet(3, 10, 87.5) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 12", defaultRest: 120, sets: repeatSet(3, 12, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 2 x 12", defaultRest: 120, sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Abdominal Machine", target: "57.5 kg - 2 x 12", defaultRest: 90, sets: repeatSet(2, 12, 57.5) })
            ]
          }),
          day({
            id: "2026-09-18", dow: "Fri", dom: 18, month: "Sep", type: "primer", title: "Lats, Rear Delts & Arms",
            footer: "Keep the session submaximal and stop every set before failure so Saturday remains protected.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "20 kg - 2 x 12 / side", primary: true, tag: "lat volume", defaultRest: 120, sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 15", defaultRest: 90, sets: repeatSet(2, 15, 17.5) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 15", tag: "arms", defaultRest: 90, sets: repeatSet(1, 15, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "25 kg - 1 x 15", tag: "arms", defaultRest: 90, sets: repeatSet(1, 15, 25) })
            ]
          }),
          day({
            id: "2026-09-19", dow: "Sat", dom: 19, month: "Sep", type: "chest", title: "Chest - 30 kg Milestone",
            footer: "Four clean sets of ten, not a grinder, complete the 30 kg bracket. Do not try 35 kg today.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 4 x 10", primary: true, tag: "PR target", defaultRest: 180, note: "Attempt only if Week 18 completed all four sets of nine cleanly. No forced reps.", sets: repeatSet(4, 10, 30) }),
              exercise({ name: "Machine Chest Press", target: "37.5 kg - 3 x 10", defaultRest: 150, sets: repeatSet(3, 10, 37.5) }),
              exercise({ name: "Machine Pec Fly", target: "40 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 40) }),
              exercise({ name: "Assisted Dips", target: "35 kg assist - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 35) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 15", defaultRest: 75, sets: repeatSet(2, 15, 7.5) })
            ]
          }),
          day({ id: "2026-09-20", dow: "Sun", dom: 20, month: "Sep", type: "rest", title: "Full Rest", footer: "Full rest before the deload week.", exercises: [] })
        ]
      },
      {
        id: "w20",
        num: 20,
        title: "Week 20 - Deload & Reset",
        phase: "Deload",
        sub: "Keep frequency, shed fatigue",
        subtitle: "Keep frequency, shed fatigue",
        dateRange: "Sep 21-27",
        notice: "Keep the six-day schedule but cut volume to 40 easy sets, including brief core and back-extension work. Use RPE 5-6, finish every set with at least three reps in reserve, and make no PR attempts. Sunday is the only training-free day.",
        days: [
          day({
            id: "2026-09-21", dow: "Mon", dom: 21, month: "Sep", type: "legs", title: "Legs & Core (Deload)",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "80 kg - 2 x 10", primary: true, defaultRest: 120, sets: repeatSet(2, 10, 80) }),
              exercise({ name: "Smith Machine Squats", target: "32.5 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 32.5) }),
              exercise({ name: "Seated Leg Curls", target: "40 kg - 2 x 12", defaultRest: 90, sets: repeatSet(2, 12, 40) }),
              exercise({ name: "Seated Calf Raises", target: "35 kg - 2 x 15", defaultRest: 90, sets: repeatSet(2, 15, 35) }),
              exercise({ name: "Abdominal Machine", target: "45 kg - 2 x 12", defaultRest: 90, sets: repeatSet(2, 12, 45) })
            ]
          }),
          day({
            id: "2026-09-22", dow: "Tue", dom: 22, month: "Sep", type: "pull", title: "Back & Biceps (Deload)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "42.5 kg - 2 x 10", primary: true, defaultRest: 120, sets: repeatSet(2, 10, 42.5) }),
              exercise({ name: "Seated Cable Row", target: "42.5 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 42.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "37.5 kg - 2 x 12", defaultRest: 90, sets: repeatSet(2, 12, 37.5) }),
              exercise({ name: "DB Bicep Curls", target: "16 kg total - 2 x 10", defaultRest: 90, sets: repeatSet(2, 10, 16) })
            ]
          }),
          day({
            id: "2026-09-23", dow: "Wed", dom: 23, month: "Sep", type: "primer", title: "Upper Chest & Side Delts (Deload)",
            footer: "One easy technique set each. Leave fresher than you arrived.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 1 x 10", primary: true, defaultRest: 120, sets: repeatSet(1, 10, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 1 x 12", defaultRest: 75, sets: repeatSet(1, 12, 5) })
            ]
          }),
          day({
            id: "2026-09-24", dow: "Thu", dom: 24, month: "Sep", type: "ham", title: "Hamstrings & Glutes (Deload)",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "32.5 kg total - 2 x 10", primary: true, defaultRest: 120, sets: repeatSet(2, 10, 32.5) }),
              exercise({ name: "High/Wide Leg Press", target: "70 kg - 2 x 10", defaultRest: 120, sets: repeatSet(2, 10, 70) }),
              exercise({ name: "Lying Leg Curls", target: "40 kg - 2 x 12", defaultRest: 90, sets: repeatSet(2, 12, 40) }),
              exercise({ name: "Walking Lunges", target: "10 kg total - 1 x 10", defaultRest: 90, sets: repeatSet(1, 10, 10) })
            ]
          }),
          day({
            id: "2026-09-25", dow: "Fri", dom: 25, month: "Sep", type: "primer", title: "Lats, Rear Delts & Arms (Deload)",
            footer: "One easy pass only. No pump chasing.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "15 kg - 1 x 10 / side", primary: true, defaultRest: 120, sets: repeatSet(1, 10, 15) }),
              exercise({ name: "Rear Delt Fly", target: "15 kg - 1 x 12", defaultRest: 90, sets: repeatSet(1, 12, 15) }),
              exercise({ name: "Incline DB Curls", target: "12 kg total - 1 x 10", tag: "arms", defaultRest: 90, sets: repeatSet(1, 10, 12) }),
              exercise({ name: "Tricep Pushdowns", target: "20 kg - 1 x 12", tag: "arms", defaultRest: 90, sets: repeatSet(1, 12, 20) })
            ]
          }),
          day({
            id: "2026-09-26", dow: "Sat", dom: 26, month: "Sep", type: "chest", title: "Chest (Deload)",
            footer: "RPE 5-6. No dips, failure sets, or 35 kg attempt.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 kg total - 2 x 8", primary: true, defaultRest: 120, sets: repeatSet(2, 8, 25) }),
              exercise({ name: "Machine Chest Press", target: "27.5 kg - 2 x 10", defaultRest: 90, sets: repeatSet(2, 10, 27.5) }),
              exercise({ name: "Machine Pec Fly", target: "27.5 kg - 2 x 10", defaultRest: 90, sets: repeatSet(2, 10, 27.5) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 1 x 12", defaultRest: 75, sets: repeatSet(1, 12, 5) })
            ]
          }),
          day({
            id: "2026-09-27", dow: "Sun", dom: 27, month: "Sep", type: "rest", title: "Cycle Complete / Full Rest",
            footer: "Full rest. Export Weeks 14-20 results before programming the next block.", exercises: []
          })
        ]
      },
      {
        id: "w21",
        num: 21,
        title: "Week 21 - Gym Reentry Ramp",
        phase: "Reentry",
        sub: "Compressed Fri/Sat full-body reentry, 3+ RIR",
        subtitle: "Compressed Fri/Sat full-body reentry, 3+ RIR",
        dateRange: "Nov 23-29",
        notice: "Membership renewed Friday Nov 27 - Week 21 is compressed into two complementary full-body reentry sessions (Full Body A on Friday, Full Body B on Saturday) at roughly 70-75% of your August working peaks. Leave 3+ reps in reserve on every set so quads and back get 72 hours before Week 22 starts Monday.",
        days: [
          day({
            id: "2026-11-23", dow: "Mon", dom: 23, month: "Nov", type: "rest", title: "Off / Pre-Renewal", footer: "Gym membership renewed Friday Nov 27. Reentry week compressed into Friday & Saturday.", exercises: []
          }),
          day({
            id: "2026-11-24", dow: "Tue", dom: 24, month: "Nov", type: "rest", title: "Off / Pre-Renewal", footer: "Gym membership renewed Friday Nov 27. Reentry week compressed into Friday & Saturday.", exercises: []
          }),
          day({
            id: "2026-11-25", dow: "Wed", dom: 25, month: "Nov", type: "rest", title: "Off / Pre-Renewal", footer: "Gym membership renewed Friday Nov 27. Reentry week compressed into Friday & Saturday.", exercises: []
          }),
          day({
            id: "2026-11-26", dow: "Thu", dom: 26, month: "Nov", type: "rest", title: "Off / Pre-Renewal", footer: "Gym membership renewed Friday Nov 27. Reentry week compressed into Friday & Saturday.", exercises: []
          }),
          day({
            id: "2026-11-27", dow: "Fri", dom: 27, month: "Nov", type: "legs", title: "Full Body A - Reentry (Quads, Pull & Upper Chest)", warmup: "Bodyweight squats x 12 - Leg swings x 10/side - Band pull-aparts x 15 - Leg press 40 kg x 1 x 10", footer: "Full Body A: quad-dominant legs, vertical & horizontal pull, light upper-chest primer, calves, biceps & abs. Leave 3+ RIR so Saturday Full Body B and Monday Week 22 feel fresh.",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "75 kg - 2 x 10", primary: true, tag: "reentry", defaultRest: 150, repRange: [8,10], note: "75% of August working peak. Smooth 3-sec descent; 72h recovery before Monday Week 22 legs.", sets: repeatSet(2, 10, 75) }),
              exercise({ name: "Lat Pulldown", target: "37.5 kg - 2 x 10", tag: "reentry", defaultRest: 120, repRange: [8,10], note: "Vertical pull groove; smooth scapular depression.", sets: repeatSet(2, 10, 37.5) }),
              exercise({ name: "Incline DB Press", target: "16 kg total - 2 x 10", tag: "reentry", defaultRest: 120, repRange: [10,12], note: "8 kg per hand. Easy upper-chest primer ahead of Saturday's 20 kg press.", sets: repeatSet(2, 10, 16) }),
              exercise({ name: "Seated Cable Row", target: "37.5 kg - 2 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 10, 37.5) }),
              exercise({ name: "Seated Leg Curls", target: "35 kg - 2 x 12", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 12, 35) }),
              exercise({ name: "Seated Calf Raises", target: "30 kg - 2 x 16", defaultRest: 90, repRange: [16,20], sets: repeatSet(2, 16, 30) }),
              exercise({ name: "DB Bicep Curls", target: "14 kg total - 1 x 12", tag: "arms", defaultRest: 90, repRange: [10,12], note: "7 kg per hand. Smooth curls, no swing.", sets: repeatSet(1, 12, 14) }),
              exercise({ name: "Abdominal Machine", target: "45 kg - 1 x 12", defaultRest: 90, repRange: [10,12], note: "One crisp core set; Hanging Knee Raise follows Saturday.", sets: repeatSet(1, 12, 45) })
            ]
          }),
          day({
            id: "2026-11-28", dow: "Sat", dom: 28, month: "Nov", type: "chest", title: "Full Body B - Reentry (Chest, Hinge, Delts & Arms)", warmup: "Band dislocates x 12 - Glute bridges x 12 - Bodyweight good mornings x 10 - Light Incline DB 12 kg x 1 x 10", footer: "Full Body B: chest press, hip hinge, light unilateral legs, rear/side delts, triceps, erectors & abs. No Assisted Dips this week; leave 3+ RIR so Week 22 Monday legs feel fresh.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 3 x 8", primary: true, tag: "reentry", defaultRest: 150, repRange: [8,10], note: "10 kg per hand for 3 smooth sets of 8. Prime upper chest cleanly.", sets: repeatSet(3, 8, 20) }),
              exercise({ name: "DB Romanian Deadlift", target: "30 kg total - 2 x 10", tag: "reentry", defaultRest: 150, repRange: [8,10], note: "15 kg per hand. Clean hamstring tension; stop with 3+ RIR to keep lower back fresh.", sets: repeatSet(2, 10, 30) }),
              exercise({ name: "Machine Chest Press", target: "25 kg - 2 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 10, 25) }),
              exercise({ name: "High Cable Row / Face Pull", target: "32.5 kg - 2 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 12, 32.5) }),
              exercise({ name: "Walking Lunges", target: "14 kg total - 1 x 10", defaultRest: 90, repRange: [8,10], note: "7 kg per hand. One light unilateral glute/quad groove set so Monday stays fresh.", sets: repeatSet(1, 10, 14) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 2 x 12", defaultRest: 75, repRange: [12,15], sets: repeatSet(2, 12, 5) }),
              exercise({ name: "Tricep Pushdowns", target: "25 kg - 1 x 12", tag: "arms", defaultRest: 90, repRange: [10,12], note: "One crisp set after pressing; stop 3 reps short of failure.", sets: repeatSet(1, 12, 25) }),
              exercise({ name: "45 Degree Back Extension", target: "Bodyweight - 1 x 12 easy", tag: "reentry", defaultRest: 90, weightMode: "total", incrementKg: 2.5, repRange: [10,15], muscleGroups: { spinalErectors: 1, glutes: 0.5, hamstrings: 0.5 }, note: "One easy bodyweight groove set to wake up spinal erectors without fatigue.", sets: repeatSet(1, 12, 0) })
            ]
          }),
          day({
            id: "2026-11-29", dow: "Sun", dom: 29, month: "Nov", type: "rest", title: "Full Rest", footer: "Full rest. Sleep and protein support Week 22 full-volume return on Monday.", exercises: []
          })
        ]
      },
      {
        id: "w22",
        num: 22,
        title: "Week 22 - Full Volume Return",
        phase: "Consolidate",
        sub: "Restore working sets at ~85% peak",
        subtitle: "Restore working sets at ~85% peak",
        dateRange: "Nov 30-Dec 6",
        notice: "Restore full working-set counts at ~85% of your August working peaks. Keep 2-3 reps in reserve while work capacity returns, and reintroduce gentle Assisted Dips on Saturday only if shoulders feel completely smooth.",
        days: [
          day({
            id: "2026-11-30", dow: "Mon", dom: 30, month: "Nov", type: "legs", title: "Quad-Dominant Legs & Core",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "85 kg - 3 x 10", primary: true, tag: "consolidate", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 85) }),
              exercise({ name: "Smith Machine Squats", target: "35 kg - 3 x 10", defaultRest: 150, repRange: [10,12], sets: repeatSet(3, 10, 35) }),
              exercise({ name: "Seated Leg Curls", target: "42.5 kg - 3 x 12", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 12, 42.5) }),
              exercise({ name: "Seated Calf Raises", target: "35 kg - 3 x 18", defaultRest: 90, repRange: [16,20], sets: repeatSet(3, 18, 35) }),
              exercise({ name: "Abdominal Machine", target: "50 kg - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 50) })
            ]
          }),
          day({
            id: "2026-12-01", dow: "Tue", dom: 1, month: "Dec", type: "pull", title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "42.5 kg - 3 x 10", primary: true, tag: "consolidate", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 42.5) }),
              exercise({ name: "Seated Cable Row", target: "42.5 kg - 3 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 10, 42.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "37.5 kg - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 37.5) }),
              exercise({ name: "DB Bicep Curls", target: "16 kg total - 3 x 12", defaultRest: 90, repRange: [10,12], note: "8 kg per hand.", sets: repeatSet(3, 12, 16) })
            ]
          }),
          day({
            id: "2026-12-02", dow: "Wed", dom: 2, month: "Dec", type: "primer", title: "Upper Chest & Side Delts", footer: "Controlled primer volume with 2-3 RIR.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "18 kg total - 2 x 10", primary: true, tag: "volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 10, 18) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 2 x 15", defaultRest: 75, repRange: [12,15], sets: repeatSet(2, 15, 5) })
            ]
          }),
          day({
            id: "2026-12-03", dow: "Thu", dom: 3, month: "Dec", type: "ham", title: "Hamstrings & Glutes",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "35 kg total - 3 x 10", primary: true, tag: "consolidate", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 35) }),
              exercise({ name: "High/Wide Leg Press", target: "75 kg - 3 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 10, 75) }),
              exercise({ name: "Lying Leg Curls", target: "42.5 kg - 3 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "Walking Lunges", target: "16 kg total - 3 x 10", defaultRest: 90, repRange: [8,10], sets: repeatSet(3, 10, 16) }),
              exercise({ name: "Abdominal Machine", target: "50 kg - 3 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 10, 50) })
            ]
          }),
          day({
            id: "2026-12-04", dow: "Fri", dom: 4, month: "Dec", type: "primer", title: "Lats, Rear Delts & Arms", footer: "Full primer volume restored; stay 2 reps short of failure.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "17.5 kg - 2 x 10 / side", primary: true, tag: "lat volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 10, 17.5) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 12", defaultRest: 90, repRange: [12,15], sets: repeatSet(2, 12, 17.5) }),
              exercise({ name: "Incline DB Curls", target: "14 kg total - 1 x 12", tag: "arms", defaultRest: 90, repRange: [12,15], sets: repeatSet(1, 12, 14) }),
              exercise({ name: "Tricep Pushdowns", target: "30 kg - 1 x 12", tag: "arms", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 12, 30) })
            ]
          }),
          day({
            id: "2026-12-05", dow: "Sat", dom: 5, month: "Dec", type: "chest", title: "Chest - Volume Return", footer: "Gentle return to Assisted Dips at 40 kg assist. Stop immediately if any shoulder pinch appears.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 kg total - 3 x 8", primary: true, tag: "consolidate", defaultRest: 150, repRange: [8,10], note: "12.5 kg per hand for 3 clean sets of 8.", sets: repeatSet(3, 8, 25) }),
              exercise({ name: "Machine Chest Press", target: "30 kg - 3 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 8, 30) }),
              exercise({ name: "Machine Pec Fly", target: "30 kg - 2 x 10", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 10, 30) }),
              exercise({ name: "Assisted Dips", target: "40 kg assist - 2 x 8", defaultRest: 120, repRange: [8,10], note: "Controlled depth, 2-3 RIR.", sets: repeatSet(2, 8, 40) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 2 x 15", defaultRest: 75, repRange: [12,15], sets: repeatSet(2, 15, 5) })
            ]
          }),
          day({
            id: "2026-12-06", dow: "Sun", dom: 6, month: "Dec", type: "rest", title: "Full Rest", footer: "Full rest before Week 23 strength recapture.", exercises: []
          })
        ]
      },
      {
        id: "w23",
        num: 23,
        title: "Week 23 - Strength Recapture",
        phase: "Load",
        sub: "Approach pre-break working loads",
        subtitle: "Approach pre-break working loads",
        dateRange: "Dec 7-13",
        notice: "Step into ~92-95% of your August working peaks with full four-set pressing on Saturday. Keep 2 reps in reserve; Week 24 matches your August PR bracket.",
        days: [
          day({
            id: "2026-12-07", dow: "Mon", dom: 7, month: "Dec", type: "legs", title: "Quad-Dominant Legs & Core - Load",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "92.5 kg - 3 x 9", primary: true, tag: "load", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 92.5) }),
              exercise({ name: "Smith Machine Squats", target: "37.5 kg - 3 x 10", defaultRest: 150, repRange: [10,12], sets: repeatSet(3, 10, 37.5) }),
              exercise({ name: "Seated Leg Curls", target: "47.5 kg - 3 x 10", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 10, 47.5) }),
              exercise({ name: "Seated Calf Raises", target: "40 kg - 3 x 18", defaultRest: 90, repRange: [16,20], sets: repeatSet(3, 18, 40) }),
              exercise({ name: "Abdominal Machine", target: "55 kg - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 55) })
            ]
          }),
          day({
            id: "2026-12-08", dow: "Tue", dom: 8, month: "Dec", type: "pull", title: "Back & Biceps - Load",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "47.5 kg - 3 x 9", primary: true, tag: "load", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 47.5) }),
              exercise({ name: "Seated Cable Row", target: "47.5 kg - 3 x 9", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 9, 47.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "42.5 kg - 3 x 11", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 11, 42.5) }),
              exercise({ name: "DB Bicep Curls", target: "18 kg total - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 18) })
            ]
          }),
          day({
            id: "2026-12-09", dow: "Wed", dom: 9, month: "Dec", type: "primer", title: "Upper Chest & Side Delts", footer: "Keep 2-3 RIR; step cable lateral raises to 7.5 kg.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 10", primary: true, tag: "volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 10, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", defaultRest: 75, repRange: [12,15], sets: repeatSet(2, 12, 7.5) })
            ]
          }),
          day({
            id: "2026-12-10", dow: "Thu", dom: 10, month: "Dec", type: "ham", title: "Hamstrings & Glutes - Load",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "37.5 kg total - 3 x 9", primary: true, tag: "load", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 37.5) }),
              exercise({ name: "High/Wide Leg Press", target: "85 kg - 3 x 9", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 9, 85) }),
              exercise({ name: "Lying Leg Curls", target: "47.5 kg - 3 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 8, 47.5) }),
              exercise({ name: "Walking Lunges", target: "18 kg total - 3 x 10", defaultRest: 90, repRange: [8,10], sets: repeatSet(3, 10, 18) }),
              exercise({ name: "Abdominal Machine", target: "55 kg - 3 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 10, 55) })
            ]
          }),
          day({
            id: "2026-12-11", dow: "Fri", dom: 11, month: "Dec", type: "primer", title: "Lats, Rear Delts & Arms", footer: "Controlled reps, no failure work before Saturday chest.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "17.5 kg - 2 x 12 / side", primary: true, tag: "lat volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 12, 17.5) }),
              exercise({ name: "Rear Delt Fly", target: "17.5 kg - 2 x 14", defaultRest: 90, repRange: [12,15], sets: repeatSet(2, 14, 17.5) }),
              exercise({ name: "Incline DB Curls", target: "14 kg total - 1 x 14", tag: "arms", defaultRest: 90, repRange: [12,15], sets: repeatSet(1, 14, 14) }),
              exercise({ name: "Tricep Pushdowns", target: "32.5 kg - 1 x 12", tag: "arms", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 12, 32.5) })
            ]
          }),
          day({
            id: "2026-12-12", dow: "Sat", dom: 12, month: "Dec", type: "chest", title: "Chest - Strength Recapture", footer: "Four clean working sets at 25 kg total (12.5 kg/hand) with full 3-minute rests.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 kg total - 4 x 8", primary: true, tag: "load", defaultRest: 180, repRange: [8,10], note: "12.5 kg per hand across all four sets.", sets: repeatSet(4, 8, 25) }),
              exercise({ name: "Machine Chest Press", target: "32.5 kg - 3 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 8, 32.5) }),
              exercise({ name: "Machine Pec Fly", target: "32.5 kg - 2 x 11", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 11, 32.5) }),
              exercise({ name: "Assisted Dips", target: "40 kg assist - 2 x 9", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 9, 40) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", defaultRest: 75, repRange: [12,15], sets: repeatSet(2, 12, 7.5) })
            ]
          }),
          day({
            id: "2026-12-13", dow: "Sun", dom: 13, month: "Dec", type: "rest", title: "Full Rest", footer: "Full rest before matching August peaks in Week 24.", exercises: []
          })
        ]
      },
      {
        id: "w24",
        num: 24,
        title: "Week 24 - Match Pre-Break Peaks",
        phase: "Load +",
        sub: "Own your August PR bracket cleanly",
        subtitle: "Own your August PR bracket cleanly",
        dateRange: "Dec 14-20",
        notice: "Match your August working peaks cleanly with 1-2 reps in reserve. Own the groove across every lift and save 2027 load jumps for January after the holiday deload.",
        days: [
          day({
            id: "2026-12-14", dow: "Mon", dom: 14, month: "Dec", type: "legs", title: "Quad-Dominant Legs & Core",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "100 kg - 3 x 9", primary: true, tag: "reps", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 100) }),
              exercise({ name: "Smith Machine Squats", target: "40 kg - 3 x 11", defaultRest: 150, repRange: [10,12], sets: repeatSet(3, 11, 40) }),
              exercise({ name: "Seated Leg Curls", target: "50 kg - 3 x 11", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 11, 50) }),
              exercise({ name: "Seated Calf Raises", target: "42.5 kg - 3 x 19", defaultRest: 90, repRange: [16,20], sets: repeatSet(3, 19, 42.5) }),
              exercise({ name: "Abdominal Machine", target: "60 kg - 3 x 11", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 11, 60) })
            ]
          }),
          day({
            id: "2026-12-15", dow: "Tue", dom: 15, month: "Dec", type: "pull", title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "50 kg - 3 x 9", primary: true, tag: "reps", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 50) }),
              exercise({ name: "Seated Cable Row", target: "50 kg - 3 x 9", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 9, 50) }),
              exercise({ name: "High Cable Row / Face Pull", target: "45 kg - 3 x 11", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 11, 45) }),
              exercise({ name: "DB Bicep Curls", target: "20 kg total - 3 x 11", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 11, 20) })
            ]
          }),
          day({
            id: "2026-12-16", dow: "Wed", dom: 16, month: "Dec", type: "primer", title: "Upper Chest & Side Delts", footer: "Keep 1-2 RIR so Thursday hinges stay crisp.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 11", primary: true, tag: "volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 11, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", defaultRest: 75, repRange: [12,15], sets: repeatSet(2, 12, 7.5) })
            ]
          }),
          day({
            id: "2026-12-17", dow: "Thu", dom: 17, month: "Dec", type: "ham", title: "Hamstrings & Glutes",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "40 kg total - 3 x 9", primary: true, tag: "reps", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 40) }),
              exercise({ name: "High/Wide Leg Press", target: "90 kg - 3 x 9", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 9, 90) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 8, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 3 x 10", defaultRest: 90, repRange: [8,10], sets: repeatSet(3, 10, 20) }),
              exercise({ name: "Abdominal Machine", target: "60 kg - 3 x 11", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 11, 60) })
            ]
          }),
          day({
            id: "2026-12-18", dow: "Fri", dom: 18, month: "Dec", type: "primer", title: "Lats, Rear Delts & Arms", footer: "Controlled volume; stop arm sets with 1-2 RIR before Saturday.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "20 kg - 2 x 11 / side", primary: true, tag: "lat volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 11, 20) }),
              exercise({ name: "Rear Delt Fly", target: "20 kg - 2 x 12", defaultRest: 90, repRange: [12,15], sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 14", tag: "arms", defaultRest: 90, repRange: [12,15], sets: repeatSet(1, 14, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "35 kg - 1 x 12", tag: "arms", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 12, 35) })
            ]
          }),
          day({
            id: "2026-12-19", dow: "Sat", dom: 19, month: "Dec", type: "chest", title: "Chest - Pre-Break Peak Match", footer: "Own 4 x 9 at 25 kg total (12.5 kg/hand) with 1-2 RIR.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 kg total - 4 x 9", primary: true, tag: "reps", defaultRest: 180, repRange: [8,10], sets: repeatSet(4, 9, 25) }),
              exercise({ name: "Machine Chest Press", target: "35 kg - 3 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 8, 35) }),
              exercise({ name: "Machine Pec Fly", target: "35 kg - 2 x 11", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 11, 35) }),
              exercise({ name: "Assisted Dips", target: "40 kg assist - 2 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 10, 40) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 12", defaultRest: 75, repRange: [12,15], sets: repeatSet(2, 12, 7.5) })
            ]
          }),
          day({
            id: "2026-12-20", dow: "Sun", dom: 20, month: "Dec", type: "rest", title: "Full Rest", footer: "Full rest before Christmas-week deload.", exercises: []
          })
        ]
      },
      {
        id: "w25",
        num: 25,
        title: "Week 25 - Holiday Deload",
        phase: "Deload",
        sub: "Shed fatigue across Christmas week",
        subtitle: "Shed fatigue across Christmas week",
        dateRange: "Dec 21-27",
        notice: "Planned Christmas-week deload: train at ~80% of Week 24 loads with 2 easy sets on main lifts and 1 easy set on primers (RPE 5-6, 3+ RIR). No dips, no failure work, and keep Friday Dec 25 ultra-brief and flexible.",
        days: [
          day({
            id: "2026-12-21", dow: "Mon", dom: 21, month: "Dec", type: "legs", title: "Legs & Core (Deload)",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "80 kg - 2 x 8", primary: true, defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 80) }),
              exercise({ name: "Smith Machine Squats", target: "32.5 kg - 2 x 10", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 10, 32.5) }),
              exercise({ name: "Seated Leg Curls", target: "40 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 40) }),
              exercise({ name: "Seated Calf Raises", target: "35 kg - 2 x 15", defaultRest: 90, repRange: [15,18], sets: repeatSet(2, 15, 35) }),
              exercise({ name: "Abdominal Machine", target: "47.5 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 47.5) })
            ]
          }),
          day({
            id: "2026-12-22", dow: "Tue", dom: 22, month: "Dec", type: "pull", title: "Back & Biceps (Deload)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "40 kg - 2 x 8", primary: true, defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 40) }),
              exercise({ name: "Seated Cable Row", target: "40 kg - 2 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 40) }),
              exercise({ name: "High Cable Row / Face Pull", target: "35 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 35) }),
              exercise({ name: "DB Bicep Curls", target: "16 kg total - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 16) })
            ]
          }),
          day({
            id: "2026-12-23", dow: "Wed", dom: 23, month: "Dec", type: "primer", title: "Upper Chest & Side Delts (Deload)", footer: "One easy pass at RPE 5-6 with 3+ RIR.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "16 kg total - 1 x 10", primary: true, defaultRest: 120, repRange: [10,12], sets: repeatSet(1, 10, 16) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 1 x 12", defaultRest: 75, repRange: [12,15], sets: repeatSet(1, 12, 5) })
            ]
          }),
          day({
            id: "2026-12-24", dow: "Thu", dom: 24, month: "Dec", type: "ham", title: "Hamstrings & Glutes (Deload)",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "32 kg total - 2 x 8", primary: true, defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 32) }),
              exercise({ name: "High/Wide Leg Press", target: "72.5 kg - 2 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 72.5) }),
              exercise({ name: "Lying Leg Curls", target: "40 kg - 2 x 8", defaultRest: 90, repRange: [8,10], sets: repeatSet(2, 8, 40) }),
              exercise({ name: "Walking Lunges", target: "16 kg total - 1 x 10", defaultRest: 90, repRange: [8,10], sets: repeatSet(1, 10, 16) })
            ]
          }),
          day({
            id: "2026-12-25", dow: "Fri", dom: 25, month: "Dec", type: "primer", title: "Christmas Day Quick Primer (Deload)", subtitle: "Ultra-brief 1-set pass — flexible for Christmas Day.", footer: "Holiday flexibility: 1 easy set per exercise (RPE 5-6, 3+ RIR). Shift or skip guilt-free for family plans.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "15 kg - 1 x 10 / side", primary: true, defaultRest: 120, repRange: [10,12], sets: repeatSet(1, 10, 15) }),
              exercise({ name: "Rear Delt Fly", target: "15 kg - 1 x 12", defaultRest: 90, repRange: [12,15], sets: repeatSet(1, 12, 15) }),
              exercise({ name: "Incline DB Curls", target: "12 kg total - 1 x 12", tag: "arms", defaultRest: 90, repRange: [12,15], sets: repeatSet(1, 12, 12) }),
              exercise({ name: "Tricep Pushdowns", target: "27.5 kg - 1 x 10", tag: "arms", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 10, 27.5) })
            ]
          }),
          day({
            id: "2026-12-26", dow: "Sat", dom: 26, month: "Dec", type: "chest", title: "Chest (Deload)", footer: "RPE 5-6, 3+ RIR. No dips and no failure sets.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 8", primary: true, defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 20) }),
              exercise({ name: "Machine Chest Press", target: "27.5 kg - 2 x 8", defaultRest: 90, repRange: [8,10], sets: repeatSet(2, 8, 27.5) }),
              exercise({ name: "Machine Pec Fly", target: "27.5 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 27.5) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 1 x 12", defaultRest: 75, repRange: [12,15], sets: repeatSet(1, 12, 5) })
            ]
          }),
          day({
            id: "2026-12-27", dow: "Sun", dom: 27, month: "Dec", type: "rest", title: "Full Rest", footer: "Full rest before New Year consolidation.", exercises: []
          })
        ]
      },
      {
        id: "w26",
        num: 26,
        title: "Week 26 - New Year Consolidation",
        phase: "Consolidate",
        sub: "Lock in pre-break loads cleanly",
        subtitle: "Lock in pre-break loads cleanly",
        dateRange: "Dec 28-Jan 3",
        notice: "Lock in your pre-break working weights at the top of the rep range. Completing 4 x 10 cleanly at 25 kg on Saturday earns the 30 kg Incline DB test in Week 27.",
        days: [
          day({
            id: "2026-12-28", dow: "Mon", dom: 28, month: "Dec", type: "legs", title: "Quad-Dominant Legs & Core",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "100 kg - 3 x 10", primary: true, tag: "consolidate", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 100) }),
              exercise({ name: "Smith Machine Squats", target: "40 kg - 3 x 12", defaultRest: 150, repRange: [10,12], sets: repeatSet(3, 12, 40) }),
              exercise({ name: "Seated Leg Curls", target: "50 kg - 3 x 12", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 12, 50) }),
              exercise({ name: "Seated Calf Raises", target: "42.5 kg - 3 x 20", defaultRest: 90, repRange: [16,20], sets: repeatSet(3, 20, 42.5) }),
              exercise({ name: "Abdominal Machine", target: "60 kg - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 60) })
            ]
          }),
          day({
            id: "2026-12-29", dow: "Tue", dom: 29, month: "Dec", type: "pull", title: "Back & Biceps (Pull)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "50 kg - 3 x 10", primary: true, tag: "consolidate", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 50) }),
              exercise({ name: "Seated Cable Row", target: "50 kg - 3 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 10, 50) }),
              exercise({ name: "High Cable Row / Face Pull", target: "45 kg - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 45) }),
              exercise({ name: "DB Bicep Curls", target: "20 kg total - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 20) })
            ]
          }),
          day({
            id: "2026-12-30", dow: "Wed", dom: 30, month: "Dec", type: "primer", title: "Upper Chest & Side Delts", footer: "Controlled reps; keep 2 RIR before Saturday chest.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "20 kg total - 2 x 12", primary: true, tag: "volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 14", defaultRest: 75, repRange: [12,15], sets: repeatSet(2, 14, 7.5) })
            ]
          }),
          day({
            id: "2026-12-31", dow: "Thu", dom: 31, month: "Dec", type: "ham", title: "Hamstrings & Glutes",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "40 kg total - 3 x 10", primary: true, tag: "consolidate", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 40) }),
              exercise({ name: "High/Wide Leg Press", target: "90 kg - 3 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 10, 90) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 9", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 9, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 3 x 10", defaultRest: 90, repRange: [8,10], sets: repeatSet(3, 10, 20) }),
              exercise({ name: "Abdominal Machine", target: "60 kg - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 60) })
            ]
          }),
          day({
            id: "2027-01-01", dow: "Fri", dom: 1, month: "Jan", type: "primer", title: "Lats, Rear Delts & Arms", footer: "First session of 2027 — stay submaximal so Saturday stays fresh.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "20 kg - 2 x 12 / side", primary: true, tag: "lat volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Rear Delt Fly", target: "20 kg - 2 x 12", defaultRest: 90, repRange: [12,15], sets: repeatSet(2, 12, 20) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 15", tag: "arms", defaultRest: 90, repRange: [12,15], sets: repeatSet(1, 15, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "35 kg - 1 x 12", tag: "arms", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 12, 35) })
            ]
          }),
          day({
            id: "2027-01-02", dow: "Sat", dom: 2, month: "Jan", type: "chest", title: "Chest - Earn the 30 kg Test", footer: "Four clean sets of 10 at 25 kg total (12.5 kg/hand) earn the 30 kg Incline DB test next week.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 kg total - 4 x 10", primary: true, tag: "consolidate", defaultRest: 180, repRange: [8,10], sets: repeatSet(4, 10, 25) }),
              exercise({ name: "Machine Chest Press", target: "35 kg - 3 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 10, 35) }),
              exercise({ name: "Machine Pec Fly", target: "35 kg - 2 x 12", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 12, 35) }),
              exercise({ name: "Assisted Dips", target: "37.5 kg assist - 2 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 10, 37.5) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 14", defaultRest: 75, repRange: [12,15], sets: repeatSet(2, 14, 7.5) })
            ]
          }),
          day({
            id: "2027-01-03", dow: "Sun", dom: 3, month: "Jan", type: "rest", title: "Full Rest", footer: "Full rest before Week 27 January load progression.", exercises: []
          })
        ]
      },
      {
        id: "w27",
        num: 27,
        title: "Week 27 - January Load",
        phase: "Load",
        sub: "First new-load push of 2027",
        subtitle: "First new-load push of 2027",
        dateRange: "Jan 4-10",
        notice: "First new-load push of 2027. Step past your August working peaks only where Week 26 completed all sets cleanly with 1-2 RIR; otherwise hold Week 26 weights.",
        days: [
          day({
            id: "2027-01-04", dow: "Mon", dom: 4, month: "Jan", type: "legs", title: "Quad-Dominant Legs & Core - Load",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "102.5 kg - 3 x 8", primary: true, tag: "load", defaultRest: 180, repRange: [8,10], sets: repeatSet(3, 8, 102.5) }),
              exercise({ name: "Smith Machine Squats", target: "42.5 kg - 3 x 8", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "Seated Leg Curls", target: "52.5 kg - 3 x 10", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 10, 52.5) }),
              exercise({ name: "Seated Calf Raises", target: "45 kg - 3 x 16", defaultRest: 90, repRange: [16,20], sets: repeatSet(3, 16, 45) }),
              exercise({ name: "Abdominal Machine", target: "62.5 kg - 3 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 10, 62.5) })
            ]
          }),
          day({
            id: "2027-01-05", dow: "Tue", dom: 5, month: "Jan", type: "pull", title: "Back & Biceps - Load",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "52.5 kg - 3 x 8", primary: true, tag: "load", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 8, 52.5) }),
              exercise({ name: "Seated Cable Row", target: "52.5 kg - 3 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 8, 52.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "47.5 kg - 3 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 10, 47.5) }),
              exercise({ name: "DB Bicep Curls", target: "20 kg total - 3 x 11", defaultRest: 90, repRange: [11,13], sets: repeatSet(3, 11, 20) })
            ]
          }),
          day({
            id: "2027-01-06", dow: "Wed", dom: 6, month: "Jan", type: "primer", title: "Upper Chest & Side Delts - Load", footer: "Crisp technique; protect shoulders ahead of Saturday's 30 kg test.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "22 kg total - 2 x 10", primary: true, tag: "volume", defaultRest: 120, repRange: [10,12], note: "11 kg per hand (or 10 kg/hand x 12 if 11s are unavailable).", sets: repeatSet(2, 10, 22) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 13", defaultRest: 75, repRange: [13,15], sets: repeatSet(2, 13, 7.5) })
            ]
          }),
          day({
            id: "2027-01-07", dow: "Thu", dom: 7, month: "Jan", type: "ham", title: "Hamstrings & Glutes - Load",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "42.5 kg total - 3 x 8", primary: true, tag: "load", defaultRest: 180, repRange: [8,10], sets: repeatSet(3, 8, 42.5) }),
              exercise({ name: "High/Wide Leg Press", target: "92.5 kg - 3 x 8", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 8, 92.5) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 10", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 10, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 3 x 10", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 10, 20) }),
              exercise({ name: "Abdominal Machine", target: "62.5 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 62.5) })
            ]
          }),
          day({
            id: "2027-01-08", dow: "Fri", dom: 8, month: "Jan", type: "primer", title: "Lats, Rear Delts & Arms - Load", footer: "Controlled reps; leave 2 RIR before Saturday chest.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "22.5 kg - 2 x 10 / side", primary: true, tag: "lat volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 10, 22.5) }),
              exercise({ name: "Rear Delt Fly", target: "20 kg - 2 x 13", defaultRest: 90, repRange: [13,15], sets: repeatSet(2, 13, 20) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 13", tag: "arms", defaultRest: 90, repRange: [13,15], sets: repeatSet(1, 13, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "37.5 kg - 1 x 10", tag: "arms", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 10, 37.5) })
            ]
          }),
          day({
            id: "2027-01-09", dow: "Sat", dom: 9, month: "Jan", type: "chest", title: "Chest - 30 kg Return Test", footer: "Full 3-minute rests on 30 kg Incline DB Press (15 kg/hand). Earn 4 x 8 cleanly before building reps.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 4 x 8", primary: true, tag: "PR attempt", defaultRest: 180, repRange: [8,10], note: "15 kg per hand. Attempt only if Week 26 hit 4 x 10 at 25 kg.", sets: repeatSet(4, 8, 30) }),
              exercise({ name: "Machine Chest Press", target: "37.5 kg - 3 x 8", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 8, 37.5) }),
              exercise({ name: "Machine Pec Fly", target: "37.5 kg - 2 x 10", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 10, 37.5) }),
              exercise({ name: "Assisted Dips", target: "35 kg assist - 2 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 10, 35) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 13", defaultRest: 75, repRange: [13,15], sets: repeatSet(2, 13, 7.5) })
            ]
          }),
          day({
            id: "2027-01-10", dow: "Sun", dom: 10, month: "Jan", type: "rest", title: "Full Rest", footer: "Full rest before Week 28 rep build.", exercises: []
          })
        ]
      },
      {
        id: "w28",
        num: 28,
        title: "Week 28 - January Rep Build",
        phase: "Load +",
        sub: "Add one clean rep at 2027 loads",
        subtitle: "Add one clean rep at 2027 loads",
        dateRange: "Jan 11-17",
        notice: "Fixed-load rep build: keep every Week 27 load steady and add one clean rep per set with 1-2 RIR. Save top-of-range milestone reps for Week 29.",
        days: [
          day({
            id: "2027-01-11", dow: "Mon", dom: 11, month: "Jan", type: "legs", title: "Quad-Dominant Legs & Core - Rep Build",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "102.5 kg - 3 x 9", primary: true, tag: "reps", defaultRest: 180, repRange: [8,10], sets: repeatSet(3, 9, 102.5) }),
              exercise({ name: "Smith Machine Squats", target: "42.5 kg - 3 x 9", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 42.5) }),
              exercise({ name: "Seated Leg Curls", target: "52.5 kg - 3 x 11", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 11, 52.5) }),
              exercise({ name: "Seated Calf Raises", target: "45 kg - 3 x 18", defaultRest: 90, repRange: [16,20], sets: repeatSet(3, 18, 45) }),
              exercise({ name: "Abdominal Machine", target: "62.5 kg - 3 x 11", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 11, 62.5) })
            ]
          }),
          day({
            id: "2027-01-12", dow: "Tue", dom: 12, month: "Jan", type: "pull", title: "Back & Biceps - Rep Build",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "52.5 kg - 3 x 9", primary: true, tag: "reps", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 52.5) }),
              exercise({ name: "Seated Cable Row", target: "52.5 kg - 3 x 9", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 9, 52.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "47.5 kg - 3 x 11", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 11, 47.5) }),
              exercise({ name: "DB Bicep Curls", target: "20 kg total - 3 x 12", defaultRest: 90, repRange: [11,13], sets: repeatSet(3, 12, 20) })
            ]
          }),
          day({
            id: "2027-01-13", dow: "Wed", dom: 13, month: "Jan", type: "primer", title: "Upper Chest & Side Delts - Rep Build", footer: "Add reps, not strain; keep 2 RIR.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "22 kg total - 2 x 11", primary: true, tag: "volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 11, 22) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 14", defaultRest: 75, repRange: [13,15], sets: repeatSet(2, 14, 7.5) })
            ]
          }),
          day({
            id: "2027-01-14", dow: "Thu", dom: 14, month: "Jan", type: "ham", title: "Hamstrings & Glutes - Rep Build",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "42.5 kg total - 3 x 9", primary: true, tag: "reps", defaultRest: 180, repRange: [8,10], sets: repeatSet(3, 9, 42.5) }),
              exercise({ name: "High/Wide Leg Press", target: "92.5 kg - 3 x 9", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 92.5) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 11", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 11, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 3 x 11", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 11, 20) }),
              exercise({ name: "Abdominal Machine", target: "62.5 kg - 2 x 11", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 11, 62.5) })
            ]
          }),
          day({
            id: "2027-01-15", dow: "Fri", dom: 15, month: "Jan", type: "primer", title: "Lats, Rear Delts & Arms - Rep Build", footer: "No failure work ahead of Saturday pressing.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "22.5 kg - 2 x 11 / side", primary: true, tag: "lat volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 11, 22.5) }),
              exercise({ name: "Rear Delt Fly", target: "20 kg - 2 x 14", defaultRest: 90, repRange: [13,15], sets: repeatSet(2, 14, 20) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 14", tag: "arms", defaultRest: 90, repRange: [13,15], sets: repeatSet(1, 14, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "37.5 kg - 1 x 11", tag: "arms", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 11, 37.5) })
            ]
          }),
          day({
            id: "2027-01-16", dow: "Sat", dom: 16, month: "Jan", type: "chest", title: "Chest - Rep Build", footer: "Add one clean rep per set at 30 kg with full 3-minute rests.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 4 x 9", primary: true, tag: "reps", defaultRest: 180, repRange: [8,10], sets: repeatSet(4, 9, 30) }),
              exercise({ name: "Machine Chest Press", target: "37.5 kg - 3 x 9", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 9, 37.5) }),
              exercise({ name: "Machine Pec Fly", target: "37.5 kg - 2 x 11", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 11, 37.5) }),
              exercise({ name: "Assisted Dips", target: "32.5 kg assist - 2 x 9", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 9, 32.5) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 14", defaultRest: 75, repRange: [13,15], sets: repeatSet(2, 14, 7.5) })
            ]
          }),
          day({
            id: "2027-01-17", dow: "Sun", dom: 17, month: "Jan", type: "rest", title: "Full Rest", footer: "Full rest before Week 29 January peak and test.", exercises: []
          })
        ]
      },
      {
        id: "w29",
        num: 29,
        title: "Week 29 - January Peak & Test",
        phase: "Test",
        sub: "Top of rep range — earn clean PRs",
        subtitle: "Top of rep range — earn clean PRs",
        dateRange: "Jan 18-24",
        notice: "Top-of-range test week: hit the upper end of each rep range cleanly with 1-2 reps in reserve to lock in your January PRs before next week's deload. Clean 4 x 10 at 30 kg on Saturday completes the 30 kg bracket.",
        days: [
          day({
            id: "2027-01-18", dow: "Mon", dom: 18, month: "Jan", type: "legs", title: "Quad-Dominant Legs & Core - Test",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "102.5 kg - 3 x 10", primary: true, tag: "rep PR", defaultRest: 180, repRange: [8,10], sets: repeatSet(3, 10, 102.5) }),
              exercise({ name: "Smith Machine Squats", target: "42.5 kg - 3 x 10", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 42.5) }),
              exercise({ name: "Seated Leg Curls", target: "52.5 kg - 3 x 12", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 12, 52.5) }),
              exercise({ name: "Seated Calf Raises", target: "45 kg - 3 x 20", defaultRest: 90, repRange: [18,20], sets: repeatSet(3, 20, 45) }),
              exercise({ name: "Abdominal Machine", target: "62.5 kg - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 62.5) })
            ]
          }),
          day({
            id: "2027-01-19", dow: "Tue", dom: 19, month: "Jan", type: "pull", title: "Back & Biceps - Test",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "52.5 kg - 3 x 10", primary: true, tag: "rep PR", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 52.5) }),
              exercise({ name: "Seated Cable Row", target: "52.5 kg - 3 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(3, 10, 52.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "47.5 kg - 3 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(3, 12, 47.5) }),
              exercise({ name: "DB Bicep Curls", target: "20 kg total - 3 x 13", defaultRest: 90, repRange: [11,13], sets: repeatSet(3, 13, 20) })
            ]
          }),
          day({
            id: "2027-01-20", dow: "Wed", dom: 20, month: "Jan", type: "primer", title: "Upper Chest & Side Delts - Test Primer", footer: "Keep RPE 6-7 so Saturday owns the 30 kg milestone.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "22 kg total - 2 x 12", primary: true, tag: "volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 12, 22) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 15", defaultRest: 75, repRange: [13,15], sets: repeatSet(2, 15, 7.5) })
            ]
          }),
          day({
            id: "2027-01-21", dow: "Thu", dom: 21, month: "Jan", type: "ham", title: "Hamstrings & Glutes - Test",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "42.5 kg total - 3 x 10", primary: true, tag: "rep PR", defaultRest: 180, repRange: [8,10], sets: repeatSet(3, 10, 42.5) }),
              exercise({ name: "High/Wide Leg Press", target: "92.5 kg - 3 x 10", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 92.5) }),
              exercise({ name: "Lying Leg Curls", target: "50 kg - 3 x 12", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 12, 50) }),
              exercise({ name: "Walking Lunges", target: "20 kg total - 3 x 12", defaultRest: 120, repRange: [10,12], sets: repeatSet(3, 12, 20) }),
              exercise({ name: "Abdominal Machine", target: "62.5 kg - 2 x 12", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 12, 62.5) })
            ]
          }),
          day({
            id: "2027-01-22", dow: "Fri", dom: 22, month: "Jan", type: "primer", title: "Lats, Rear Delts & Arms - Test Primer", footer: "Finish top reps cleanly before failure so Saturday pressing stays crisp.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "22.5 kg - 2 x 12 / side", primary: true, tag: "lat volume", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 12, 22.5) }),
              exercise({ name: "Rear Delt Fly", target: "20 kg - 2 x 15", defaultRest: 90, repRange: [13,15], sets: repeatSet(2, 15, 20) }),
              exercise({ name: "Incline DB Curls", target: "16 kg total - 1 x 15", tag: "arms", defaultRest: 90, repRange: [13,15], sets: repeatSet(1, 15, 16) }),
              exercise({ name: "Tricep Pushdowns", target: "37.5 kg - 1 x 12", tag: "arms", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 12, 37.5) })
            ]
          }),
          day({
            id: "2027-01-23", dow: "Sat", dom: 23, month: "Jan", type: "chest", title: "Chest - 30 kg Milestone", footer: "Four clean sets of 10 at 30 kg total (15 kg/hand) earn the 35 kg bracket in February. Leave 1-2 RIR.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "30 kg total - 4 x 10", primary: true, tag: "PR target", defaultRest: 180, repRange: [8,10], note: "Attempt only if Week 28 hit 4 x 9 cleanly. No forced reps.", sets: repeatSet(4, 10, 30) }),
              exercise({ name: "Machine Chest Press", target: "37.5 kg - 3 x 10", defaultRest: 150, repRange: [8,10], sets: repeatSet(3, 10, 37.5) }),
              exercise({ name: "Machine Pec Fly", target: "37.5 kg - 2 x 12", defaultRest: 120, repRange: [10,12], sets: repeatSet(2, 12, 37.5) }),
              exercise({ name: "Assisted Dips", target: "32.5 kg assist - 2 x 10", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 10, 32.5) }),
              exercise({ name: "Cable Lateral Raises", target: "7.5 kg - 2 x 15", defaultRest: 75, repRange: [13,15], sets: repeatSet(2, 15, 7.5) })
            ]
          }),
          day({
            id: "2027-01-24", dow: "Sun", dom: 24, month: "Jan", type: "rest", title: "Full Rest", footer: "Full rest before the January cycle reset deload.", exercises: []
          })
        ]
      },
      {
        id: "w30",
        num: 30,
        title: "Week 30 - January Cycle Reset",
        phase: "Deload",
        sub: "Shed fatigue & export results",
        subtitle: "Shed fatigue & export results",
        dateRange: "Jan 25-31",
        notice: "End-of-cycle deload: keep all six sessions brief with 2 easy sets on main lifts and 1 easy set on primers at ~80% of Week 29 loads (RPE 5-6, 3+ RIR). No dips and no PR attempts; export your results on Sunday before the rolling February 2027 block starts.",
        days: [
          day({
            id: "2027-01-25", dow: "Mon", dom: 25, month: "Jan", type: "legs", title: "Legs & Core (Deload)",
            exercises: [
              exercise({ name: "Machine Leg Press", target: "82.5 kg - 2 x 8", primary: true, defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 82.5) }),
              exercise({ name: "Smith Machine Squats", target: "35 kg - 2 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 35) }),
              exercise({ name: "Seated Leg Curls", target: "42.5 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 42.5) }),
              exercise({ name: "Seated Calf Raises", target: "35 kg - 2 x 15", defaultRest: 90, repRange: [15,18], sets: repeatSet(2, 15, 35) }),
              exercise({ name: "Abdominal Machine", target: "50 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 50) })
            ]
          }),
          day({
            id: "2027-01-26", dow: "Tue", dom: 26, month: "Jan", type: "pull", title: "Back & Biceps (Deload)",
            exercises: [
              exercise({ name: "Lat Pulldown", target: "42.5 kg - 2 x 8", primary: true, defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 42.5) }),
              exercise({ name: "Seated Cable Row", target: "42.5 kg - 2 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 42.5) }),
              exercise({ name: "High Cable Row / Face Pull", target: "37.5 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 37.5) }),
              exercise({ name: "DB Bicep Curls", target: "16 kg total - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 16) })
            ]
          }),
          day({
            id: "2027-01-27", dow: "Wed", dom: 27, month: "Jan", type: "primer", title: "Upper Chest & Side Delts (Deload)", footer: "One easy technique pass each. Leave fresher than you arrived.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "18 kg total - 1 x 10", primary: true, defaultRest: 120, repRange: [10,12], sets: repeatSet(1, 10, 18) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 1 x 13", defaultRest: 75, repRange: [13,15], sets: repeatSet(1, 13, 5) })
            ]
          }),
          day({
            id: "2027-01-28", dow: "Thu", dom: 28, month: "Jan", type: "ham", title: "Hamstrings & Glutes (Deload)",
            exercises: [
              exercise({ name: "DB Romanian Deadlift", target: "35 kg total - 2 x 8", primary: true, defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 35) }),
              exercise({ name: "High/Wide Leg Press", target: "75 kg - 2 x 8", defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 75) }),
              exercise({ name: "Lying Leg Curls", target: "40 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 40) }),
              exercise({ name: "Walking Lunges", target: "16 kg total - 1 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 10, 16) })
            ]
          }),
          day({
            id: "2027-01-29", dow: "Fri", dom: 29, month: "Jan", type: "primer", title: "Lats, Rear Delts & Arms (Deload)", footer: "One easy pass only. No pump chasing.",
            exercises: [
              exercise({ name: "One-Arm Cable Pulldown", target: "17.5 kg - 1 x 10 / side", primary: true, defaultRest: 120, repRange: [10,12], sets: repeatSet(1, 10, 17.5) }),
              exercise({ name: "Rear Delt Fly", target: "15 kg - 1 x 13", defaultRest: 90, repRange: [13,15], sets: repeatSet(1, 13, 15) }),
              exercise({ name: "Incline DB Curls", target: "12 kg total - 1 x 12", tag: "arms", defaultRest: 90, repRange: [12,15], sets: repeatSet(1, 12, 12) }),
              exercise({ name: "Tricep Pushdowns", target: "30 kg - 1 x 10", tag: "arms", defaultRest: 90, repRange: [10,12], sets: repeatSet(1, 10, 30) })
            ]
          }),
          day({
            id: "2027-01-30", dow: "Sat", dom: 30, month: "Jan", type: "chest", title: "Chest (Deload)", footer: "RPE 5-6, 3+ RIR. No dips and no failure work.",
            exercises: [
              exercise({ name: "Incline DB Press", target: "25 kg total - 2 x 8", primary: true, defaultRest: 120, repRange: [8,10], sets: repeatSet(2, 8, 25) }),
              exercise({ name: "Machine Chest Press", target: "30 kg - 2 x 8", defaultRest: 90, repRange: [8,10], sets: repeatSet(2, 8, 30) }),
              exercise({ name: "Machine Pec Fly", target: "30 kg - 2 x 10", defaultRest: 90, repRange: [10,12], sets: repeatSet(2, 10, 30) }),
              exercise({ name: "Cable Lateral Raises", target: "5 kg - 1 x 13", defaultRest: 75, repRange: [13,15], sets: repeatSet(1, 13, 5) })
            ]
          }),
          day({
            id: "2027-01-31", dow: "Sun", dom: 31, month: "Jan", type: "rest", title: "Cycle Complete / Full Rest", footer: "Full rest. Export your November 2026-January 2027 results backup before the rolling February 2027 block starts.", exercises: []
          })
        ]
      }
    ]
  };
  addSpecialization(window.LIFT_PLAN);
}());
