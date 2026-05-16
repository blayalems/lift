// Exercise form video links.
// Maps exercise names to a curated YouTube search query; opens externally.
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  // Canonical form-video hints for the most common cycle lifts. Anything not
  // listed falls back to a search for the exercise name.
  var HINTS = {
    "Back Squat": "back squat form jeff nippard",
    "Front Squat": "front squat form squat university",
    "Bench Press": "bench press form jeff nippard",
    "Incline Bench": "incline bench press form alan thrall",
    "Deadlift": "conventional deadlift form alan thrall",
    "Romanian Deadlift": "romanian deadlift rdl form jeff nippard",
    "Pull Up": "pull up form jeff nippard",
    "Chin Up": "chin up form jeff nippard",
    "Row": "barbell row form alan thrall",
    "Overhead Press": "overhead press form alan thrall",
    "Hip Thrust": "hip thrust form bret contreras",
    "Lunges": "walking lunges form athlean x",
    "Hamstring Curl": "lying hamstring curl form",
    "Calf Raise": "standing calf raise form",
    "Lat Pulldown": "lat pulldown form jeff nippard",
    "Bicep Curl": "dumbbell curl form jeff nippard",
    "Tricep Extension": "tricep extension form",
    "Plank": "plank form athlean x"
  };

  function findHint(name) {
    if (!name) return null;
    if (HINTS[name]) return HINTS[name];
    // Loose match: any hint whose key appears in the exercise name.
    var keys = Object.keys(HINTS);
    for (var i = 0; i < keys.length; i += 1) {
      if (name.toLowerCase().indexOf(keys[i].toLowerCase()) >= 0) return HINTS[keys[i]];
    }
    return null;
  }

  function videoUrl(name) {
    var hint = findHint(name) || (name + " proper form");
    return "https://www.youtube.com/results?search_query=" + encodeURIComponent(hint);
  }

  function openForFormVideo(ctx, name) {
    var url = videoUrl(name);
    try {
      window.open(url, "_blank", "noopener");
    } catch (err) {}
    if (ctx && ctx.toast) ctx.toast("Opening form video search...");
  }

  function chipHtml(ctx, name) {
    return '<button class="tool-btn form-link" data-action="form-video" data-name="' + ctx.escapeHtml(name) + '">' +
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 16.5l6-4.5-6-4.5v9zm12-4.5c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z"/></svg>' +
      ' Form</button>';
  }

  root.forms = {
    HINTS: HINTS,
    findHint: findHint,
    videoUrl: videoUrl,
    openForFormVideo: openForFormVideo,
    chipHtml: chipHtml
  };
})();
