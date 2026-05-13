(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var sensor = null;
  var lastMag = 0;
  var lastStepTs = 0;

  function renderSteps(ctx) {
    var date = ctx.todayId();
    var row = (ctx.state.steps || {})[date] || { count: 0, source: "manual" };
    return '<div class="sheet-grid"><div class="overview-card"><strong>Move ring source</strong><p>PWA step counting only works while the app is open and the phone is moving in-pocket. Manual entry is the reliable fallback.</p></div><div class="metric-grid"><div class="metric-card"><div class="label">Today</div><div class="value">' + row.count + '</div></div><div class="metric-card"><div class="label">Source</div><div class="value">' + ctx.escapeHtml(row.source || "manual") + '</div></div></div><div class="sheet-actions"><button class="action-btn" data-action="steps-enable">' + ctx.icon("play") + 'Enable counter</button><button class="action-btn secondary" data-action="steps-stop">Stop</button></div><div class="field-block"><label>Date</label><input type="date" data-steps-date value="' + date + '"></div><div class="field-block"><label>Manual steps</label><input type="number" min="0" step="100" data-steps-count value="' + row.count + '"></div><div class="sheet-actions"><button class="action-btn secondary" data-action="steps-manual">Save manual steps</button></div></div>';
  }

  function addManual(ctx, date, count) {
    ctx.state.steps = ctx.state.steps || {};
    ctx.state.steps[date] = { count: Math.max(0, Math.round(Number(count || 0))), source: "manual", lastSampleTs: Date.now() };
    if (ctx.saveState) ctx.saveState();
  }

  function bump(ctx, count) {
    var date = ctx.todayId();
    ctx.state.steps = ctx.state.steps || {};
    var row = ctx.state.steps[date] || { count: 0, source: "sensor" };
    row.count = Number(row.count || 0) + count;
    row.source = "sensor";
    row.lastSampleTs = Date.now();
    ctx.state.steps[date] = row;
    if (ctx.saveState) ctx.saveState();
  }

  function startSensor(ctx) {
    try {
      if ("Accelerometer" in window) {
        sensor = new Accelerometer({ frequency: 20 });
        sensor.addEventListener("reading", function () {
          processReading(ctx, sensor.x, sensor.y, sensor.z);
        });
        sensor.start();
        ctx.toast("Step counter enabled while app stays open.");
        return;
      }
    } catch (err) {}
    if (window.DeviceMotionEvent) {
      window.addEventListener("devicemotion", motionListener(ctx));
      ctx.toast("Motion counter enabled while app stays open.");
    } else {
      ctx.toast("Motion sensors are unavailable. Use manual steps.");
    }
  }

  function motionListener(ctx) {
    return function (event) {
      var a = event.accelerationIncludingGravity || {};
      processReading(ctx, a.x || 0, a.y || 0, a.z || 0);
    };
  }

  function processReading(ctx, x, y, z) {
    var mag = Math.sqrt(x * x + y * y + z * z);
    var now = Date.now();
    if (Math.abs(mag - lastMag) > 3.2 && now - lastStepTs > 320) {
      bump(ctx, 1);
      lastStepTs = now;
    }
    lastMag = mag;
  }

  function stopSensor(ctx) {
    try { if (sensor) sensor.stop(); } catch (err) {}
    sensor = null;
    ctx.toast("Step counter stopped.");
  }

  root.steps = {
    renderSteps: renderSteps,
    startSensor: startSensor,
    stopSensor: stopSensor,
    addManual: addManual
  };
})();
