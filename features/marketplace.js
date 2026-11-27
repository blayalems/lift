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

  function esc(ctx, value) {
    if (ctx && typeof ctx.escapeHtml === "function") return ctx.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch];
    });
  }

  function templateCard(ctx, t) {
    var initials = String(t.title || "").split(" ").map(function (w) { return w[0] || ""; }).slice(0, 2).join("");
    var tags = (t.tags || []).slice(0, 3).map(function (g) { return '<span class="tag">' + esc(ctx, g) + '</span>'; }).join("");
    return '<button class="market-card" data-vibe="' + esc(ctx, t.vibe) + '" data-action="market-open" data-id="' + esc(ctx, t.id) + '">' +
      '<div class="market-thumb">' + esc(ctx, initials.toUpperCase()) + '</div>' +
      '<div class="market-meta">' +
      '<strong>' + esc(ctx, t.title) + '</strong>' +
      '<span>' + esc(ctx, t.summary) + '</span>' +
      '<div class="market-tags">' +
      '<span class="tag market-tag-duration">' + esc(ctx, t.duration) + '</span>' +
      '<span class="tag market-tag-sessions">' + esc(ctx, t.sessions) + '</span>' +
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

    html += '<div class="segmented market-filter-strip" role="tablist" aria-label="Filter workout templates">';
    vibes.forEach(function (v) {
      var active = filter === v;
      html += '<button role="tab" aria-selected="' + active + '" data-action="market-filter" data-vibe="' + esc(ctx, v) + '" data-active="' + active + '">' +
        esc(ctx, v.charAt(0).toUpperCase() + v.slice(1)) +
        '</button>';
    });
    html += '</div>';

    var filtered = filter === "all" ? TEMPLATES : TEMPLATES.filter(function (t) { return t.vibe === filter; });
    html += '<div class="market-list">' + filtered.map(function (t) { return templateCard(ctx, t); }).join("") + '</div>';

    if (ctx.runtime && ctx.runtime.marketSelected) {
      var sel = TEMPLATES.find(function (t) { return t.id === ctx.runtime.marketSelected; });
      if (sel) html += templateDetail(ctx, sel);
    }

    html += '</div>';
    return html;
  }

  function templateDetail(ctx, t) {
    var blocks = (t.blocks || []).map(function (b) {
      return '<tr><td><strong>' + esc(ctx, b.day) + '</strong></td><td>' + esc(ctx, b.focus) + '</td></tr>';
    }).join("");
    return '<div class="overview-card market-detail">' +
      '<strong>' + esc(ctx, t.title) + '</strong>' +
      '<p class="market-detail-summary">' + esc(ctx, t.summary) + '</p>' +
      '<table class="mini-table market-detail-table">' +
      '<thead><tr><th>Day</th><th>Focus</th></tr></thead>' +
      '<tbody>' + blocks + '</tbody>' +
      '</table>' +
      '<div class="sheet-actions market-detail-actions">' +
      '<button class="action-btn" data-action="market-import" data-id="' + esc(ctx, t.id) + '">Import to Library</button>' +
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
