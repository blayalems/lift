// Voice cue on rest end — uses SpeechSynthesis API.
// Gated by state.settings.voiceRestCue (boolean, default false).
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  function speak(text, opts) {
    if (!supported()) return;
    try {
      // Cancel any queued speech so we never stack utterances.
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text || ""));
      u.rate = (opts && opts.rate) || 1.0;
      u.pitch = (opts && opts.pitch) || 1.0;
      u.volume = (opts && opts.volume) != null ? opts.volume : 1.0;
      u.lang = (opts && opts.lang) || "en-US";
      window.speechSynthesis.speak(u);
    } catch (err) {
      // Best-effort — voice is non-essential.
    }
  }

  function speakRestDone(ctx) {
    if (!ctx || !ctx.state || !ctx.state.settings || !ctx.state.settings.voiceRestCue) return;
    if (!supported()) return;
    var lines = [
      "Rest complete. Next set.",
      "Time. Hit it.",
      "Rest done. Lift.",
      "Let's go. Next set up."
    ];
    speak(lines[Math.floor(Math.random() * lines.length)], { rate: 1.05 });
  }

  function speakCountdown(seconds) {
    if (!supported()) return;
    speak(String(seconds), { rate: 1.1, pitch: 1.05 });
  }

  function testVoice(ctx) {
    if (!supported()) {
      if (ctx && typeof ctx.toast === "function") ctx.toast("Speech is not supported in this browser.");
      return;
    }
    speak("Voice cues are on. Lift smart.", { rate: 1.0 });
  }

  root.voice = {
    supported: supported,
    speak: speak,
    speakRestDone: speakRestDone,
    speakCountdown: speakCountdown,
    testVoice: testVoice
  };
})();
