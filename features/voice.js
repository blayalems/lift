// Voice cue on rest end — uses SpeechSynthesis API.
// Gated by state.settings.voiceRestCue (boolean, default false).
(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  function supported() {
    return typeof window !== "undefined" &&
      !!window.speechSynthesis &&
      typeof window.speechSynthesis.speak === "function" &&
      typeof window.SpeechSynthesisUtterance === "function";
  }

  function speak(text, opts) {
    if (!supported()) return false;
    var message = String(text == null ? "" : text).trim();
    if (!message) return false;
    try {
      // Cancel any queued speech so we never stack utterances.
      if (typeof window.speechSynthesis.cancel === "function") {
        window.speechSynthesis.cancel();
      }
      var u = new window.SpeechSynthesisUtterance(message);
      var rate = Number(opts && opts.rate);
      var pitch = Number(opts && opts.pitch);
      var volume = (opts && opts.volume != null) ? Number(opts.volume) : 1.0;
      u.rate = Number.isFinite(rate) && rate > 0 ? rate : 1.0;
      u.pitch = Number.isFinite(pitch) && pitch >= 0 ? pitch : 1.0;
      u.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1.0;
      u.lang = (opts && opts.lang) || "en-US";
      u.onerror = function () {};
      window.speechSynthesis.speak(u);
      return true;
    } catch (err) {
      // Best-effort — voice is non-essential.
      return false;
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
    if (!supported()) return;
    speak("Voice cues are on. Lift smart.", { rate: 1.0 });
  }

  root.voice = {
    supported: supported,
    speak: speak,
    speakRestDone: speakRestDone,
    speakCountdown: speakCountdown,
    testVoice: testVoice
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.voice;
})();
