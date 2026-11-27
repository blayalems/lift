const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("PWA and Android durability contracts", () => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

  test("loads every new offline feature before the app entry point", () => {
    const index = read("index.html");
    const appPosition = index.indexOf('<script src="./app.js"></script>');
    ["state", "history", "persistence", "progression", "volume", "cardio", "nutrition", "body", "program", "reentry", "quotes", "engagement", "coach"].forEach((name) => {
      const script = `<script src="./features/${name}.js"></script>`;
      expect(index).toContain(script);
      expect(index.indexOf(script)).toBeLessThan(appPosition);
    });
  });

  test("precaches the complete adaptive companion for offline use", () => {
    const worker = read("sw.js");
    ["state", "history", "persistence", "progression", "volume", "cardio", "nutrition", "body", "program", "reentry", "quotes", "engagement", "coach"].forEach((name) => {
      expect(worker).toContain(`"./features/${name}.js"`);
    });
    expect(worker).toContain("throw new Error(`Precache failed for ${path}: ${response.status}`)");
    expect(worker).not.toContain("Keep install resilient if a static asset is missing");
  });

  test("service-worker version patching cannot replace newer whole functions", () => {
    const worker = read("sw.js");
    const app = read("app.js");
    const context = { self: { addEventListener: () => {} } };
    vm.runInNewContext(`${worker}\nthis.__test = { patchAppScriptText };`, context);
    const patched = context.__test.patchAppScriptText(app);
    expect(patched).toContain('runtime.historyDate = typeof options === "string"');
    expect(patched).toContain('sheet.setAttribute("aria-labelledby", "sheet-title")');
  });

  test("keeps the existing storage key while using explicit v4 migration", () => {
    const app = read("app.js");
    const state = read("features", "state.js");
    expect(app).toContain('var STORE_KEY = "lift.v3.state";');
    expect(state).toContain("var SCHEMA_VERSION = 4;");
  });

  test("recovers the newest durable generation before startup renders", () => {
    const app = read("app.js");
    expect(app).toContain("async function recoverDurableSnapshot()");
    expect(app).toContain("await persistence.latestValidSnapshot(false)");
    expect(app).toContain("await recoverDurableSnapshot();");
    expect(app).toContain('await persistence.forceSnapshot(state, "startup")');
  });

  test("reset clears every recovery layer and planned-set logging keeps drafted RIR", () => {
    const app = read("app.js");
    expect(app).toContain("await persistence.clearAll()");
    expect(app).toContain("localStorage.removeItem(V2_STORE_KEY)");
    expect(app).toContain("localStorage.removeItem(V1_STORE_KEY)");
    expect(app).toContain("rir: draft.rir == null ? null");
  });

  test("Android backs up only the validated app-private state mirror", () => {
    const manifest = read("android", "app", "src", "main", "AndroidManifest.xml");
    const legacyRules = read("android", "app", "src", "main", "res", "xml", "backup_rules.xml");
    const modernRules = read("android", "app", "src", "main", "res", "xml", "data_extraction_rules.xml");
    const bridge = read("android", "app", "src", "main", "kotlin", "io", "github", "blayalems", "lift", "LiftBridge.kt");

    expect(manifest).toContain('android:allowBackup="true"');
    expect(manifest).toContain('android:fullBackupContent="@xml/backup_rules"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(legacyRules).toContain('path="lift_state.json"');
    expect(modernRules.match(/path="lift_state\.json"/g)).toHaveLength(2);
    expect(bridge).toContain("fun saveStateMirror(json: String): Boolean");
    expect(bridge).toContain("fun loadStateMirror(): String");
    expect(bridge).toContain("fun clearStateMirror(): Boolean");
    expect(bridge).toContain("AtomicFile(File(context.filesDir, STATE_MIRROR_FILE))");
  });

  test("core companion modules contain no silent upload implementation", () => {
    ["state", "history", "persistence", "progression", "volume", "cardio", "nutrition", "body", "program", "reentry", "quotes", "engagement", "coach"].forEach((name) => {
      expect(read("features", `${name}.js`)).not.toMatch(/\bfetch\s*\(/);
    });
  });

  test("modal keyboard and narrow-screen safeguards remain present", () => {
    const app = read("app.js");
    const index = read("index.html");
    expect(app).toContain('if (event.key === "Escape")');
    expect(app).toContain('if (event.key !== "Tab" || runtime.sheetMode === "page") return;');
    expect(app).toContain('sheet.setAttribute("role", mode === "page" ? "region" : "dialog")');
    expect(index).toContain("cal-status-mark");
    expect(index).toContain('aria-modal="true" role="dialog"');
    expect(index).toContain(".rir-control");
    expect(index).toContain("@media (max-width: 359px)");
  });
});
