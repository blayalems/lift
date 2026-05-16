// Workout templates marketplace browser.
// Curated list of templates that can seed a Library entry. Templates are
// static JSON living in this file so the browser works fully offline.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  var TEMPLATES = [
    {
      id: "smolov-jr",
      title: "Smolov Jr. Bench",
      vibe: "strength",
      duration: "3 weeks",
      sessions: "4 / week",
      summary: "Russian bench specialization. High frequency, high intensity, short rest brackets.",
      tags: ["powerlifting", "advanced"],
      blocks: [
        { day: "Mon", focus: "6x6 @70%" },
        { day: "Wed", focus: "7x5 @75%" },
        { day: "Fri", focus: "8x4 @80%" },
        { day: "Sat", focus: "10x3 @85%" }
      ]
    },
    {
      id: "ppl-hypertrophy",
      title: "Push / Pull / Legs",
      vibe: "hypertrophy",
      duration: "Ongoing",
      sessions: "6 / week",
      summary: "Six-day split favoring volume over intensity. Two cycles per week.",
      tags: ["bodybuilding", "intermediate"],
      blocks: [
        { day: "Push", focus: "Chest, shoulders, triceps" },
        { day: "Pull", focus: "Back, biceps, rear delts" },
        { day: "Legs", focus: "Quads, hams, glutes" }
      ]
    },
    {
      id: "5x5",
      title: "StrongLifts 5x5",
      vibe: "strength",
      duration: "12 weeks",
      sessions: "3 / week",
      summary: "Linear progression on five compound lifts. Add 2.5 kg per session.",
      tags: ["beginner", "barbell"],
      blocks: [
        { day: "A", focus: "Squat / Bench / Row" },
        { day: "B", focus: "Squat / OHP / Deadlift" }
      ]
    },
    {
      id: "z2-base",
      title: "Zone 2 Base Builder",
      vibe: "endurance",
      duration: "8 weeks",
      sessions: "4 / week",
      summary: "Aerobic base block. Long easy efforts, one tempo, one VO2 session.",
      tags: ["endurance", "conditioning"],
      blocks: [
        { day: "Mon", focus: "60 min Z2" },
        { day: "Wed", focus: "20 min tempo" },
        { day: "Fri", focus: "8x90s VO2" },
        { day: "Sun", focus: "90 min Z2 long" }
      ]
    },
    {
      id: "mobility-am",
      title: "Morning Mobility 15",
      vibe: "mobility",
      duration: "Daily",
      sessions: "Daily",
      summary: "Fifteen-minute joint prep loop. Hip 90/90, t-spine, scap, ankle.",
      tags: ["mobility", "warmup"],
      blocks: [
        { day: "Daily", focus: "8 stations x 90s" }
      ]
    },
    {
      id: "rest-day-walk",
      title: "Active Recovery Walk",
      vibe: "quick",
      duration: "Drop-in",
      sessions: "As needed",
      summary: "30-45 min easy walk + 3 mobility stations. Use on heavy-soreness days.",
      tags: ["walk", "recovery"],
      blocks: [
        { day: "Walk", focus: "Easy pace, nose breathing" }
      ]
    },
    {
      id: "wendler-531",
      title: "Wendler 5/3/1 BBB",
      vibe: "strength",
      duration: "12 weeks",
      sessions: "4 / week",
      summary: "Slow main-lift progression plus 5x10 supplementary volume.",
      tags: ["powerlifting", "intermediate"],
      blocks: [
        { day: "Week 1", focus: "5/5/5+" },
        { day: "Week 2", focus: "3/3/3+" },
        { day: "Week 3", focus: "5/3/1+" },
        { day: "Week 4", focus: "Deload" }
      ]
    },
    {
      id: "lunchtime-20",
      title: "Lunchtime 20",
      vibe: "quick",
      duration: "Drop-in",
      sessions: "Any",
      summary: "Twenty-minute kettlebell complex when the day got eaten.",
      tags: ["kettlebell", "short"],
      blocks: [
        { day: "Loop", focus: "Swing / clean / press x 5 rounds" }
      ]
    }
  ];

  function templateCard(t) {
    var initials = t.title.split(" ").map(function (w) { return w[0]; }).slice(0, 2).join("");
    var tags = (t.tags || []).slice(0, 3).map(function (g) { return '<span class="tag">' + g + '</span>'; }).join("");
    return '<button class="market-card" data-vibe="' + t.vibe + '" data-action="market-open" data-id="' + t.id + '">' +
      '<div class="market-thumb">' + initials.toUpperCase() + '</div>' +
      '<div class="market-meta">' +
      '<strong>' + t.title + '</strong>' +
      '<span>' + t.summary + '</span>' +
      '<div class="market-tags">' +
      '<span class="tag" style="background:var(--md-secondary-container);color:var(--md-on-secondary-container)">' + t.duration + '</span>' +
      '<span class="tag" style="background:var(--md-primary-container);color:var(--md-on-primary-container)">' + t.sessions + '</span>' +
      tags +
      '</div>' +
      '</div></button>';
  }

  function renderMarketplace(ctx) {
    var filter = (ctx.runtime && ctx.runtime.marketFilter) || "all";
    var vibes = ["all", "strength", "hypertrophy", "endurance", "mobility", "quick"];
    var html = '<div class="sheet-grid">';
    html += '<div class="overview-card"><strong>Templates marketplace</strong>' +
      '<p>Browse curated plans. Tap one to preview and import into your Library. Everything ships with the app — no network call.</p></div>';

    html += '<div class="segmented" style="overflow-x:auto;flex-wrap:nowrap">';
    vibes.forEach(function (v) {
      html += '<button data-action="market-filter" data-vibe="' + v + '" data-active="' + (filter === v) + '">' +
        v.charAt(0).toUpperCase() + v.slice(1) +
        '</button>';
    });
    html += '</div>';

    var filtered = filter === "all" ? TEMPLATES : TEMPLATES.filter(function (t) { return t.vibe === filter; });
    html += '<div class="market-list">' + filtered.map(templateCard).join("") + '</div>';

    if (ctx.runtime && ctx.runtime.marketSelected) {
      var sel = TEMPLATES.find(function (t) { return t.id === ctx.runtime.marketSelected; });
      if (sel) html += templateDetail(sel);
    }

    html += '</div>';
    return html;
  }

  function templateDetail(t) {
    var blocks = (t.blocks || []).map(function (b) {
      return '<tr><td><strong>' + b.day + '</strong></td><td>' + b.focus + '</td></tr>';
    }).join("");
    return '<div class="overview-card" style="background:var(--md-primary-container);color:var(--md-on-primary-container);border:0">' +
      '<strong>' + t.title + '</strong>' +
      '<p style="color:inherit;opacity:.85">' + t.summary + '</p>' +
      '<table class="mini-table" style="margin-top:8px">' +
      '<thead><tr><th style="color:inherit;opacity:.7">Day</th><th style="color:inherit;opacity:.7">Focus</th></tr></thead>' +
      '<tbody>' + blocks + '</tbody>' +
      '</table>' +
      '<div class="sheet-actions" style="margin-top:14px">' +
      '<button class="action-btn" data-action="market-import" data-id="' + t.id + '">Import to Library</button>' +
      '<button class="action-btn secondary" data-action="market-close">Close</button>' +
      '</div></div>';
  }

  function importTemplate(ctx, id) {
    var t = TEMPLATES.find(function (x) { return x.id === id; });
    if (!t) return;
    var s = ctx.state;
    s.library = s.library || [];
    if (s.library.find(function (l) { return l.id === t.id; })) {
      if (ctx.toast) ctx.toast("Already in your Library.");
      return;
    }
    s.library.push({
      id: t.id,
      title: t.title,
      vibe: t.vibe,
      summary: t.summary,
      blocks: t.blocks,
      tags: t.tags,
      importedAt: Date.now()
    });
    if (ctx.saveState) ctx.saveState();
    if (ctx.toast) ctx.toast("Imported \"" + t.title + "\" to Library.");
  }

  root.marketplace = {
    TEMPLATES: TEMPLATES,
    renderMarketplace: renderMarketplace,
    importTemplate: importTemplate
  };
})();
