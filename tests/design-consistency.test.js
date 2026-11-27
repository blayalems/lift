const fs = require("node:fs");
const path = require("node:path");

describe("Lift v2.0.0 Anti-AI-Slop design consistency invariants", () => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

  test("removes rainbow ambient blur blobs and neon card halos from index.html", () => {
    const html = read("index.html");

    expect(html).not.toContain("blur(34px) saturate(1.25)");
    expect(html).not.toContain("blur(38px) saturate(1.35)");
    expect(html).not.toContain("radial-gradient(760px 420px");
    expect(html).not.toContain("repeating-conic-gradient");

    const neuralCardsMatch = html.match(/html\[data-visual-style="neural"\] \.card,[\s\S]*?\{[^}]*\}/);
    expect(neuralCardsMatch).not.toBeNull();
    expect(neuralCardsMatch[0]).not.toContain("--nx-surface-glow");
  });

  test("defines high-contrast dark-mode --md-error, calendar ink tokens, and settings hero ink", () => {
    const html = read("index.html");
    const darkBlock = html.match(/html\[data-theme="dark"\]\s*\{[^}]*--md-primary:\s*#ebebed;[\s\S]*?\}/);
    expect(darkBlock).not.toBeNull();
    expect(darkBlock[0]).toMatch(/--md-error:\s*#[0-9a-fA-F]{6}/);
    expect(darkBlock[0]).toContain("--md-on-success:");

    expect(html).toMatch(/\.cal-cell\[data-status="done"\]\s*\{[^}]*color:\s*var\(--md-on-primary\)/s);
    expect(html).toMatch(/\.cal-cell\[data-status="completed"\]\s*\{[^}]*color:\s*var\(--md-on-primary\)/s);
    expect(html).toMatch(/\.cal-cell\[data-status="reconstructed"\]\s*\{[^}]*color:\s*var\(--md-on-success/s);

    expect(html).toMatch(/\.calendar-week\[data-phase="consolidate"\]\s*\{\s*background:\s*#8f5900;\s*\}/);
    expect(html).toMatch(/\.calendar-week\[data-phase="load"\],\s*\.calendar-week\[data-phase="loadplus"\]\s*\{\s*background:\s*#0d6e69;\s*\}/);

    const settingsHeroP = html.match(/\.settings-hero p\s*\{[^}]*\}/);
    expect(settingsHeroP).not.toBeNull();
    expect(settingsHeroP[0]).toContain("var(--md-on-primary)");
    expect(settingsHeroP[0]).not.toContain("rgba(255,255,255");
  });

  test("uses inline flex baseline alignment for .streak-ring .label-num and 4-col .quest-item", () => {
    const html = read("index.html");
    const labelNum = html.match(/\.streak-ring \.label-num\s*\{[^}]*\}/);
    expect(labelNum).not.toBeNull();
    expect(labelNum[0]).toContain("display: flex");
    expect(labelNum[0]).toContain("align-items: baseline");
    expect(labelNum[0]).toContain("justify-content: center");
    expect(labelNum[0]).not.toContain("display: grid");

    expect(html).toContain("grid-template-columns: 20px minmax(0, 1fr) auto auto;");
  });

  test("preserves Material 3 Expressive tokens, reduced motion, menu tones, and toast layering", () => {
    const html = read("index.html");
    expect(html).toContain('html[data-visual-style="expressive"]');
    expect(html).toContain("--m3e-shape-lg: 28px;");
    expect(html).toContain("--m3e-mono:");
    expect(html).toContain("@media (prefers-reduced-motion: reduce)");
    expect(html).toContain('.menu-icon[data-tone="coach"]');
    expect(html).toContain('.menu-icon[data-tone="feed"]');
    expect(html).toMatch(/\.toast-stack\s*\{[^}]*z-index:\s*142;/s);
  });

  test("eliminates decorative emoji spam across UI HTML and feature modules", () => {
    const featureFiles = fs.readdirSync(path.join(root, "features")).map((f) => path.join("features", f));
    const files = ["index.html", "app.js", ...featureFiles];
    const emojiRe = /&#128293;|&#127822;|&#9774;|&#9881;|[\u{1F300}-\u{1FAFF}]/u;

    files.forEach((rel) => {
      const content = read(rel);
      expect({ file: rel, hasEmoji: emojiRe.test(content) }).toEqual({ file: rel, hasEmoji: false });
    });
  });

  test("keeps refactored feature modules free of static inline style clutter", () => {
    const strictCleanFiles = [
      "features/marketplace.js",
      "features/strength.js",
      "features/measurements.js",
      "features/recap.js",
      "features/calendar.js",
      "features/summary.js",
      "features/healthkit.js"
    ];
    strictCleanFiles.forEach((rel) => {
      expect({ file: rel, hasInlineStyle: /\bstyle\s*=/.test(read(rel)) }).toEqual({
        file: rel,
        hasInlineStyle: false
      });
    });

    const streaks = read("features/streaks.js");
    const streakStyles = streaks.match(/style="[^"]*"/g) || [];
    expect(streakStyles.length).toBeGreaterThan(0);
    expect(streakStyles.every((attr) => /^style="height:' \+ pct \+ '%\"$/.test(attr))).toBe(true);
  });
});
