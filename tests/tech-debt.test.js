const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("tech-debt hygiene and accessibility contracts", () => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

  test("every path in sw.js APP_SHELL resolves to an existing file on disk", () => {
    const worker = read("sw.js");
    const context = { self: { addEventListener: () => {} } };
    vm.runInNewContext(`${worker}\nthis.__test = { APP_SHELL, patchAppScriptText };`, context);
    const shell = context.__test.APP_SHELL;
    expect(Array.isArray(shell)).toBe(true);
    expect(shell.length).toBeGreaterThan(10);

    shell
      .filter((entry) => entry !== "./")
      .forEach((entry) => {
        const relative = entry.replace(/^\.\//, "");
        expect(fs.existsSync(path.join(root, relative))).toBe(true);
      });
  });

  test("sw.js removes dead legacy patching and runtime CSS hotfix injection", () => {
    const worker = read("sw.js");
    expect(worker).not.toContain("legacyPatchAppScriptText");
    expect(worker).not.toContain("replaceFunction");
    expect(worker).not.toContain("UI_LAYER_FIX_STYLE");
    expect(worker).not.toContain("lift-ui-layer-hotfix");
    expect(worker).not.toContain("patchIndexResponse");
  });

  test("app.js removes dead helpers while keeping tested merge exports", () => {
    const appSource = read("app.js");
    expect(appSource).not.toContain("baselineForExercise");
    expect(appSource).not.toContain("maxLoggedWeight");
    expect(appSource).not.toContain("mergeBodyweight");

    const makeCtxMatch = appSource.match(/function makeCtx\(\) \{[\s\S]*?\n  \}/);
    expect(makeCtxMatch).toBeTruthy();
    expect(makeCtxMatch[0].match(/\ballDays\s*:/g)).toHaveLength(1);

    const exported = require("../app.js");
    expect(typeof exported.mergeMeasurements).toBe("function");
    expect(typeof exported.mergeDateIds).toBe("function");
  });

  describe("healthkit export hygiene", () => {
    let healthkit;

    beforeEach(() => {
      jest.resetModules();
      window.LIFT_FEATURES = {};
      delete window.LIFT_APP_VERSION;
      require("../features/healthkit.js");
      healthkit = window.LIFT_FEATURES.healthkit;
    });

    test("appleHealthCsv uses RFC 4180 CSV escaping for commas, quotes, and newlines", () => {
      const ctx = {
        state: {
          days: {
            "2026-08-10": {
              startedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
              finishedAt: Date.UTC(2026, 7, 10, 9, 0, 0),
              completed: { "0.0": { weight: 100, reps: 10 } }
            },
            "2026-08-11": {
              startedAt: Date.UTC(2026, 7, 11, 8, 0, 0),
              finishedAt: Date.UTC(2026, 7, 11, 8, 45, 0),
              completed: { "0.0": { weight: 50, reps: 10 } }
            }
          }
        },
        allDays: () => [
          { day: { id: "2026-08-10", title: 'Legs, "Heavy"\nRamp' } },
          { day: { id: "2026-08-11", title: "Pull Day" } }
        ]
      };

      const csv = healthkit.appleHealthCsv(ctx);
      expect(csv).toContain('2026-08-10T08:00:00Z,2026-08-10T09:00:00Z,Strength Training,3600,1000,"Legs, ""Heavy""\nRamp"');
      expect(csv).toContain("2026-08-11T08:00:00Z,2026-08-11T08:45:00Z,Strength Training,2700,500,Pull Day");
      expect(csv).not.toContain("Legs; ");
    });

    test("JSON exports resolve ctx.appVersion -> window.LIFT_APP_VERSION -> 2.0.0 without stale 1.4.0", () => {
      const baseState = {
        days: {
          "2026-08-10": {
            startedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
            finishedAt: Date.UTC(2026, 7, 10, 9, 0, 0),
            completed: {}
          }
        }
      };
      const allDays = () => [{ day: { id: "2026-08-10", title: "Legs", subtitle: "Ramp" } }];

      const fallbackFit = JSON.parse(healthkit.googleFitJson({ state: baseState, allDays }));
      const fallbackStrava = JSON.parse(healthkit.stravaPseudoTcx({ state: baseState, allDays }));
      const fallbackGeneric = JSON.parse(healthkit.genericJson({ state: baseState }));
      expect(fallbackFit.sessions[0].application.version).toBe("2.0.0");
      expect(fallbackStrava.version).toBe("2.0.0");
      expect(fallbackGeneric.version).toBe("2.0.0");

      const ctxFit = JSON.parse(healthkit.googleFitJson({ state: baseState, allDays, appVersion: "2.0.1" }));
      expect(ctxFit.sessions[0].application.version).toBe("2.0.1");

      const source = read("features", "healthkit.js");
      expect(source).not.toContain('"1.4.0"');
      expect(source).not.toContain('mime === "text/csv"');
      expect(source.match(/saveBackupFile/g)).toHaveLength(2);
    });
  });

  describe("form label and id accessibility pairing", () => {
    function assertControlsPaired(html) {
      const container = document.createElement("div");
      container.innerHTML = html;
      const controls = Array.from(container.querySelectorAll("input, select, textarea"));
      expect(controls.length).toBeGreaterThan(0);

      const seenIds = new Set();
      controls.forEach((control) => {
        const id = control.getAttribute("id");
        expect(id).toBeTruthy();
        expect(seenIds.has(id)).toBe(false);
        seenIds.add(id);
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label).not.toBeNull();
      });
    }

    beforeEach(() => {
      jest.resetModules();
      window.LIFT_FEATURES = {};
      require("../features/records.js");
      require("../features/body.js");
      require("../features/cardio.js");
      require("../features/measurements.js");
      require("../features/steps.js");
    });

    test("cardio.renderCardio pairs every form control with a matching label", () => {
      const html = window.LIFT_FEATURES.cardio.renderCardio({
        state: { activeDayId: "2026-08-10", days: {}, cardio: {} },
        getDay: () => ({ id: "2026-08-10", type: "legs" }),
        todayId: () => "2026-08-10",
        escapeHtml: (v) => String(v == null ? "" : v)
      });
      assertControlsPaired(html);
      expect(html).toContain("data-cardio-distance");
      expect(html).toContain("data-cardio-skip-reason");
    });

    test("measurements.renderMeasurements and body.renderDashboard pair every form control without id collisions", () => {
      const ctx = {
        state: { settings: { units: "kg" }, measurements: [], progressPhotos: [], profile: {} },
        todayId: () => "2026-08-10",
        escapeHtml: (v) => String(v == null ? "" : v),
        allDays: () => []
      };
      const bodyHtml = window.LIFT_FEATURES.body.renderDashboard(ctx);
      assertControlsPaired(bodyHtml);
      expect(bodyHtml).toContain("data-profile-height");
      expect(bodyHtml).toContain("data-profile-goal");
      expect(bodyHtml).toContain("data-profile-statement");

      const measurementsHtml = window.LIFT_FEATURES.measurements.renderMeasurements(ctx);
      assertControlsPaired(measurementsHtml);
      expect(measurementsHtml).toContain("data-m-date");
      expect(measurementsHtml).toContain("data-m-field=");
      expect(measurementsHtml).toContain("data-m-note=");
    });

    test("steps.renderSteps pairs every form control with a matching label", () => {
      const html = window.LIFT_FEATURES.steps.renderSteps({
        state: { steps: {} },
        todayId: () => "2026-08-10",
        escapeHtml: (v) => String(v == null ? "" : v),
        icon: () => "<svg></svg>"
      });
      assertControlsPaired(html);
      expect(html).toContain("data-steps-date");
      expect(html).toContain("data-steps-count");
    });
  });
});
