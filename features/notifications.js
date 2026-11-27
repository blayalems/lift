(function () {
  "use strict";

  window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  var TAG = "lift-workout";
  var pendingPermission = null;
  var cleanupRationale = null;

  function isSupported() {
    if (typeof window === "undefined" || typeof navigator === "undefined" || typeof location === "undefined") {
      return false;
    }
    if (window.LIFT_IS_NATIVE) return false;
    return !!(
      "serviceWorker" in navigator &&
      navigator.serviceWorker &&
      "Notification" in window &&
      window.Notification &&
      String(location.protocol || "").indexOf("http") === 0
    );
  }

  function requestNotificationPermission() {
    if (typeof window === "undefined" || !window.Notification || typeof window.Notification.requestPermission !== "function") {
      return Promise.resolve("denied");
    }
    return new Promise(function (resolve) {
      var settled = false;
      function finish(permission) {
        if (settled) return;
        settled = true;
        resolve(permission || window.Notification.permission || "default");
      }
      try {
        var result = window.Notification.requestPermission(finish);
        if (result && typeof result.then === "function") {
          result.then(finish, function () { finish("default"); });
        } else if (typeof result === "string") {
          finish(result);
        } else if (window.Notification.requestPermission.length === 0) {
          finish(window.Notification.permission || "default");
        }
      } catch (err) {
        finish("default");
      }
    });
  }

  function ensurePermission(ctx) {
    if (!isSupported()) return Promise.resolve("denied");
    var settings = ctx && ctx.state && ctx.state.settings;
    var currentPerm = window.Notification.permission || "default";
    if (settings && settings.workoutNotifications === false) return Promise.resolve(currentPerm);
    if (settings && settings.notifSkipped && currentPerm === "default") return Promise.resolve("default");
    if (currentPerm === "granted" || currentPerm === "denied") {
      return Promise.resolve(currentPerm);
    }
    if (pendingPermission) return pendingPermission;

    pendingPermission = showPermissionRationale(ctx).then(function (choice) {
      if (choice !== "allow") {
        setOptIn(ctx, false, true);
        return (window.Notification && window.Notification.permission) || "default";
      }
      return requestNotificationPermission().then(function (permission) {
        setOptIn(ctx, permission === "granted", permission !== "granted");
        return permission;
      });
    }).catch(function () {
      setOptIn(ctx, false, true);
      return "default";
    }).finally(function () {
      pendingPermission = null;
    });

    return pendingPermission;
  }

  function show(snapshot) {
    if (!canPost()) return Promise.resolve(false);
    return post("LIFT_NOTIF_SHOW", buildPayload(snapshot));
  }

  function update(snapshot) {
    if (!canPost()) return Promise.resolve(false);
    return post("LIFT_NOTIF_UPDATE", buildPayload(snapshot));
  }

  function clear() {
    if (!isSupported()) return Promise.resolve(false);
    return post("LIFT_NOTIF_CLEAR", { tag: TAG });
  }

  function canPost() {
    return isSupported() && window.Notification.permission === "granted";
  }

  function post(type, payload) {
    var sw = typeof navigator !== "undefined" ? navigator.serviceWorker : null;
    if (!sw || !sw.ready || typeof sw.ready.then !== "function") {
      return Promise.resolve(false);
    }
    return sw.ready.then(function (registration) {
      var worker = sw.controller || (registration && (registration.active || registration.waiting || registration.installing));
      if (!worker || typeof worker.postMessage !== "function") return false;
      worker.postMessage({ type: type, payload: payload });
      return true;
    }).catch(function () {
      return false;
    });
  }

  function buildPayload(snapshot) {
    var snap = snapshot || {};
    var setText = snap.setText || buildSetText(snap);
    var actions = [];
    var title = "Lift";
    var body = "";

    var exProgress = (snap.totalExercises > 0)
      ? "Ex " + snap.currentExercise + "/" + snap.totalExercises + " · "
      : "";
    var setProgress = (snap.totalSets > 0)
      ? " · Set " + snap.setIndex + "/" + snap.totalSets
      : "";
    var elapsed = (snap.elapsedMin > 0) ? " · " + snap.elapsedMin + " min" : "";

    if (snap.phase === "resting") {
      title = "Lift — Rest " + (snap.restLabel || formatSeconds(snap.restRemainingSec));
      body = exProgress + (snap.exName || "next set") + setProgress;
      if (snap.weightText && snap.repsText) {
        body += " · " + snap.weightText + " " + (snap.unitLabel || "") + " × " + snap.repsText;
      }
      actions = [
        { action: "minus-15", title: "-15s" },
        { action: "skip", title: "Skip rest" },
        { action: "plus-15", title: "+15s" }
      ];
    } else if (snap.phase === "rest-done") {
      title = "Lift — Rest done ✓";
      body = exProgress + (snap.exName || "next set") + setProgress;
      if (snap.weightText && snap.repsText) {
        body += " · " + snap.weightText + " " + (snap.unitLabel || "") + " × " + snap.repsText + " — ready!";
      }
      actions = [
        { action: "logged", title: "Logged it" },
        { action: "finish", title: "Finish" }
      ];
    } else if (snap.phase === "set-up-next") {
      title = "Lift — " + (snap.dayTitle || "Workout");
      body = exProgress + (snap.exName ? setText : "Workout running") + elapsed;
      actions = [{ action: "finish", title: "Finish workout" }];
    } else {
      title = "Lift";
      body = snap.dayTitle || "Workout";
    }

    return {
      tag: TAG,
      title: title,
      body: body,
      actions: actions,
      data: { snap: snap, ts: Date.now() }
    };
  }

  function buildSetText(snap) {
    var bits = [];
    if (snap.exName) bits.push(snap.exName);
    var target = "";
    if (snap.weightText) {
      target += snap.weightText + " " + (snap.unitLabel || "");
    }
    if (snap.repsText) {
      target += (target ? " x " : "") + snap.repsText;
    } else if (snap.reps != null) {
      target += (target ? " x " : "") + (Number(snap.reps) > 0 ? snap.reps : "failure");
    }
    if (target) bits.push(target);
    return bits.join(" - ");
  }

  function formatSeconds(value) {
    var total = Math.max(0, Math.floor(Number(value) || 0));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function showPermissionRationale(ctx) {
    if (typeof cleanupRationale === "function") {
      cleanupRationale("skip");
    }
    var overlay = typeof document !== "undefined" ? document.getElementById("notification-permission") : null;
    if (!overlay) return Promise.resolve("allow");

    overlay.innerHTML = "";

    var card = document.createElement("div");
    card.className = "notif-permission-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "notif-title");

    var iconWrapper = document.createElement("div");
    iconWrapper.className = "notif-permission-icon";
    iconWrapper.setAttribute("aria-hidden", "true");
    iconWrapper.appendChild(bellIconElement());

    var title = document.createElement("h2");
    title.id = "notif-title";
    title.textContent = "Keep your workout live";

    var text = document.createElement("p");
    text.textContent = "Lift can show the current set, rest countdown, and quick actions in the Android notification shade while the workout is running.";

    var actions = document.createElement("div");
    actions.className = "notif-permission-actions";

    var allowBtn = document.createElement("button");
    allowBtn.className = "action-btn";
    allowBtn.setAttribute("data-notif-permission", "allow");
    allowBtn.textContent = "Allow notifications";

    var skipBtn = document.createElement("button");
    skipBtn.className = "action-btn secondary";
    skipBtn.setAttribute("data-notif-permission", "skip");
    skipBtn.textContent = "Skip for now";

    actions.appendChild(allowBtn);
    actions.appendChild(skipBtn);

    card.appendChild(iconWrapper);
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(actions);

    overlay.appendChild(card);
    overlay.dataset.open = "true";

    return new Promise(function (resolve) {
      var settled = false;
      function finish(choice) {
        if (settled) return;
        settled = true;
        overlay.removeEventListener("click", onClick);
        if (typeof document !== "undefined") document.removeEventListener("keydown", onKeydown);
        overlay.dataset.open = "false";
        if (cleanupRationale === finish) cleanupRationale = null;
        resolve(choice || "skip");
      }
      function onClick(event) {
        if (event.target === overlay) {
          finish("skip");
          return;
        }
        var button = event.target && event.target.closest ? event.target.closest("[data-notif-permission]") : null;
        if (!button) return;
        finish(button.dataset.notifPermission || "skip");
      }
      function onKeydown(event) {
        if (event.key === "Escape") {
          if (typeof event.preventDefault === "function") event.preventDefault();
          finish("skip");
        }
      }
      cleanupRationale = finish;
      overlay.addEventListener("click", onClick);
      if (typeof document !== "undefined") document.addEventListener("keydown", onKeydown);
      if (typeof allowBtn.focus === "function") allowBtn.focus();
    });
  }

  function setOptIn(ctx, enabled, skipped) {
    if (!ctx || !ctx.state || !ctx.state.settings) return;
    ctx.state.settings.workoutNotifications = !!enabled;
    ctx.state.settings.notifSkipped = !!skipped;
    if (typeof ctx.saveState === "function") ctx.saveState();
  }

  function bellIconElement() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    var path1 = document.createElementNS(ns, "path");
    path1.setAttribute("d", "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9");

    var path2 = document.createElementNS(ns, "path");
    path2.setAttribute("d", "M10 21h4");

    svg.appendChild(path1);
    svg.appendChild(path2);

    return svg;
  }

  window.LIFT_FEATURES.notifications = {
    ensurePermission: ensurePermission,
    show: show,
    update: update,
    clear: clear,
    isSupported: isSupported,
    buildPayload: buildPayload
  };

  if (typeof module !== "undefined" && module.exports) module.exports = window.LIFT_FEATURES.notifications;
})();
