const fs = require("node:fs");
const path = require("node:path");

describe("Material 3 Expressive Android widgets & PWA gadgets", () => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

  const xmlFiles = [
    ["android", "app", "src", "main", "res", "layout", "lift_widget.xml"],
    ["android", "app", "src", "main", "res", "xml", "lift_widget_info.xml"],
    ["android", "app", "src", "main", "res", "drawable", "widget_background.xml"],
    ["android", "app", "src", "main", "res", "drawable", "widget_rail.xml"],
    ["android", "app", "src", "main", "res", "drawable", "widget_chip_bg.xml"],
    ["android", "app", "src", "main", "res", "drawable", "widget_cta_pill.xml"],
    ["android", "app", "src", "main", "res", "drawable-v31", "widget_background.xml"],
    ["android", "app", "src", "main", "res", "drawable-v31", "widget_rail.xml"],
    ["android", "app", "src", "main", "res", "drawable-v31", "widget_chip_bg.xml"],
    ["android", "app", "src", "main", "res", "drawable-v31", "widget_cta_pill.xml"],
    ["android", "app", "src", "main", "res", "values", "colors.xml"],
    ["android", "app", "src", "main", "res", "values-night", "colors.xml"],
    ["android", "app", "src", "main", "res", "values-v31", "colors.xml"],
    ["android", "app", "src", "main", "res", "values", "strings.xml"],
  ];

  function assertValidXml(xmlText, label) {
    expect(xmlText.trimStart().startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const parseErr = doc.querySelector("parsererror");
    expect({ file: label, error: parseErr ? parseErr.textContent : null }).toEqual({
      file: label,
      error: null,
    });
    return doc;
  }

  test("all widget Android XML files exist and parse as well-formed XML", () => {
    xmlFiles.forEach((parts) => {
      const fullPath = path.join(root, ...parts);
      expect(fs.existsSync(fullPath)).toBe(true);
      const doc = assertValidXml(fs.readFileSync(fullPath, "utf8"), parts.join("/"));
      expect(doc.documentElement).not.toBeNull();
    });
  });

  test("lift_widget_info.xml supports home_screen and keyguard in a 4x2 M3E footprint", () => {
    const info = read("android", "app", "src", "main", "res", "xml", "lift_widget_info.xml");
    expect(info).toContain('android:widgetCategory="home_screen|keyguard"');
    expect(info).toContain('android:targetCellWidth="4"');
    expect(info).toContain('android:targetCellHeight="2"');
    expect(info).toContain('android:updatePeriodMillis="0"');
    expect(info).toContain('android:resizeMode="horizontal|vertical"');
    expect(info).toContain('android:previewLayout="@layout/lift_widget"');
    expect(info).toContain('android:initialLayout="@layout/lift_widget"');
  });

  test("lift_widget.xml implements the 3-layer layout with required IDs", () => {
    const layout = read("android", "app", "src", "main", "res", "layout", "lift_widget.xml");
    [
      "@+id/widget_root",
      "@+id/widget_title",
      "@+id/widget_chip",
      "@+id/widget_status",
      "@+id/widget_chronometer",
      "@+id/widget_detail",
      "@+id/widget_cta",
      "@drawable/widget_background",
      "@drawable/widget_rail",
      "@drawable/widget_chip_bg",
      "@drawable/widget_cta_pill",
    ].forEach((token) => {
      expect(layout).toContain(token);
    });
  });

  test("dynamic Material You tokens and day/night tonal fallbacks are configured cleanly", () => {
    const v31 = read("android", "app", "src", "main", "res", "values-v31", "colors.xml");
    const day = read("android", "app", "src", "main", "res", "values", "colors.xml");
    const night = read("android", "app", "src", "main", "res", "values-night", "colors.xml");

    expect(v31).toContain("@android:color/system_accent1_");
    expect(v31).toContain("@android:color/system_accent2_");
    expect(v31).toContain("@android:color/system_neutral1_");
    expect(v31).toContain("@android:color/system_neutral2_");

    [
      "widget_background",
      "widget_background_high",
      "widget_outline",
      "widget_accent",
      "widget_on_accent",
      "widget_chip_bg",
      "widget_on_chip",
      "widget_on_surface",
      "widget_on_surface_variant",
    ].forEach((colorName) => {
      expect(day).toContain(`name="${colorName}"`);
      expect(night).toContain(`name="${colorName}"`);
      expect(v31).toContain(`name="${colorName}"`);
    });

    // drawable-v31 shapes must reference non-night-shadowed dynamic aliases so dark mode keeps Material You colors
    const v31Bg = read("android", "app", "src", "main", "res", "drawable-v31", "widget_background.xml");
    const v31Cta = read("android", "app", "src", "main", "res", "drawable-v31", "widget_cta_pill.xml");
    const v31Chip = read("android", "app", "src", "main", "res", "drawable-v31", "widget_chip_bg.xml");
    expect(v31Bg).toContain("@android:dimen/system_app_widget_background_radius");
    expect(v31Bg).toContain("@color/widget_v31_background");
    expect(v31Cta).toContain("@color/widget_v31_cta_bg");
    expect(v31Chip).toContain("@color/widget_v31_chip_bg");
  });

  test("LiftWidgetProvider.kt enforces Android 17 zero-bitmap cap, rate-limited previews, and updateEngagement", () => {
    const provider = read(
      "android",
      "app",
      "src",
      "main",
      "kotlin",
      "io",
      "github",
      "blayalems",
      "lift",
      "LiftWidgetProvider.kt",
    );

    // Zero bitmaps in RemoteViews (Android 17 widget memory cap)
    expect(provider).not.toMatch(/\bBitmap\b|\bBitmapFactory\b|setImageViewBitmap|Canvas\(/);

    // Required signature for @android-17 LiftBridge integration
    expect(provider).toMatch(/fun updateEngagement\(\s*context:\s*Context,\s*payload:\s*JSONObject\?\s*\)/);

    // Engagement persistence without clearing on workout finish
    expect(provider).toContain('PREFS_KEY_ENGAGEMENT = "engagement"');
    const updateAllStart = provider.indexOf("private fun updateAll(");
    const updateAllEnd = provider.indexOf("private fun updateGeneratedPreview(");
    const updateAllBlock = provider.slice(updateAllStart, updateAllEnd);
    expect(updateAllBlock).not.toContain("remove(PREFS_KEY_ENGAGEMENT)");

    // Rate-limited setWidgetPreview on API 35+ for both home screen and keyguard
    expect(provider).toContain("PREFS_KEY_PREVIEW_MS");
    expect(provider).toContain("35L * 60L * 1000L");
    expect(provider).toContain("Build.VERSION_CODES.VANILLA_ICE_CREAM");
    expect(provider).toContain("runCatching");
    expect(provider).toContain("AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN");
    expect(provider).toContain("AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD");

    // 1-tap CTA pill handles both idle/open and resting Skip rest via EXTRA_NOTIF_ACTION "skip"
    expect(provider).toContain("R.id.widget_cta");
    expect(provider).toContain("R.id.widget_chip");
    expect(provider).toContain("MainActivity.EXTRA_NOTIF_ACTION");
    expect(provider).toContain('"skip"');
  });

  test("index.html includes M3 Expressive tokens, v2 gadget classes, and preserves scripts cleanly", () => {
    const html = read("index.html");
    const marker = "/* === V2 MATERIAL 3 EXPRESSIVE GADGETS === */";
    const markerIdx = html.indexOf(marker);
    const lastStyleEnd = html.lastIndexOf("</style>");

    expect(markerIdx).toBeGreaterThan(-1);
    expect(lastStyleEnd).toBeGreaterThan(markerIdx);

    const v2Css = html.slice(markerIdx, lastStyleEnd);
    expect(html).toContain('html[data-visual-style="expressive"]');
    expect(v2Css).toContain("--m3e-shape-lg: 28px");
    expect(v2Css).toContain("999px");
    expect(v2Css).toContain("cubic-bezier(0.34, 1.56, 0.64, 1)");
    expect(v2Css).toContain("tabular-nums");

    [
      ".quote-gadget",
      ".coach-gadget",
      ".coach-chat-log",
      ".coach-bubble",
      ".coach-chips",
      ".coach-insight-grid",
      ".momentum-gadget",
      ".xp-bar-track",
      ".xp-bar-fill",
      ".combo-badge",
      ".shield-pill",
      ".quest-list",
      ".quest-item",
      ".hiatus-card",
      ".loot-crate",
      ".feed-list",
      ".feed-card",
      ".story-card",
      ".streak-bars",
      ".streak-bar-col",
      ".streak-bar-track",
      ".streak-bar-fill",
    ].forEach((selector) => {
      expect(v2Css).toContain(selector);
    });

    // Ensure bottom script tags remain untouched
    expect(html).toContain('<script src="./features/reentry.js"></script>');
    expect(html).toContain('<script src="./app.js"></script>');
  });
});
