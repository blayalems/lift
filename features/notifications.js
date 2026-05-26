(function () {
  "use strict";

  window.LIFT_FEATURES = window.LIFT_FEATURES || {};

  var TAG = "lift-workout";
  var pendingPermission = null;

  function isSupported() {
    return !!(
      "serviceWorker" in navigator &&
      "Notification" in window &&
      location.protocol.indexOf("http") === 0
    );
  }

  function ensurePermission(ctx) {
    if (!isSupported()) return Promise.resolve("denied");
    var settings = ctx && ctx.state && ctx.state.settings;
    if (settings && settings.workoutNotifications === false) return Promise.resolve(Notification.permission);
    if (settings && settings.notifSkipped && Notification.permission === "default") return Promise.resolve("default");
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      return Promise.resolve(Notification.permission);
    }
    if (pendingPermission) return pendingPermission;

    pendingPermission = showPermissionRationale(ctx).then(function (choice) {
      if (choice !== "allow") {
        setOptIn(ctx, false, true);
        return Notification.permission;
      }
      try {
        return Notification.requestPermission().then(function (permission) {
          setOptIn(ctx, permission === "granted", permission !== "granted");
          return permission;
        });
      } catch (err) {
        setOptIn(ctx, false, true);
        return "default";
      }
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
    return isSupported() && Notification.permission === "granted";
  }

  function post(type, payload) {
    return navigator.serviceWorker.ready.then(function (registration) {
      var worker = navigator.serviceWorker.controller || registration.active || registration.waiting || registration.installing;
      if (!worker) return false;
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
    var overlay = document.getElementById("notification-permission");
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
      function onClick(event) {
        var button = event.target.closest("[data-notif-permission]");
        if (!button) return;
        overlay.removeEventListener("click", onClick);
        overlay.dataset.open = "false";
        resolve(button.dataset.notifPermission || "skip");
      }
      overlay.addEventListener("click", onClick);
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
})();
