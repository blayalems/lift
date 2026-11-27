const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

describe("release metadata and service-worker patching", () => {
  const root = path.join(__dirname, "..");
  const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const workerSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const gradleSource = fs.readFileSync(path.join(root, "android", "app", "build.gradle.kts"), "utf8");
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8"));
  const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

  test("keeps every runtime version source synchronized", () => {
    const appVersion = appSource.match(/var APP_VERSION = "([^"]+)";/)[1];
    const workerVersion = workerSource.match(/const APP_VERSION = "([^"]+)";/)[1];
    const androidVersion = gradleSource.match(/versionName = "([^"]+)"/)[1];

    expect(appVersion).toBe("1.9.1");
    expect(workerVersion).toBe(appVersion);
    expect(androidVersion).toBe(appVersion);
    expect(metadata.version).toBe(appVersion);
    expect(packageMetadata.version).toBe(appVersion);
    expect(metadata.build).toBe("2026-11-27");
    expect(gradleSource).toContain("versionCode = 25");
    expect(workerSource).toContain('const CACHE_VERSION = "lift-v22";');
  });

  test("does not reintroduce the always-visible idle rest timer", () => {
    const context = { self: { addEventListener: () => {} } };
    vm.runInNewContext(`${workerSource}\nthis.__liftTest = { patchAppScriptText };`, context);
    const patched = context.__liftTest.patchAppScriptText(appSource);
    const start = patched.indexOf("  function renderRestFab(");
    const end = patched.indexOf("  function renderSheet(", start);
    const restBlock = patched.slice(start, end);

    expect(patched).toContain('var APP_VERSION = "1.9.1";');
    expect(restBlock).toContain("remaining < duration");
    expect(restBlock).not.toContain("remaining > 0");
  });
});
