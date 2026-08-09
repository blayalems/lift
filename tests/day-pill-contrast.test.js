const fs = require("fs");
const path = require("path");

describe("active day-pill theme contrast", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  function rgb(hex) {
    const value = hex.replace("#", "");
    return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  }

  function luminance(hex) {
    return rgb(hex).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  }

  function contrast(a, b) {
    const lighter = Math.max(luminance(a), luminance(b));
    const darker = Math.min(luminance(a), luminance(b));
    return (lighter + 0.05) / (darker + 0.05);
  }

  test("uses the paired on-primary ink for every selected-day indicator", () => {
    expect(source).toMatch(/\.day-pill\[data-active="true"\]\s*\{[^}]*--day-pill-active-ink:\s*var\(--md-on-primary\)/s);
    expect(source).toMatch(/\.day-pill\[data-active="true"\] \.dow\s*\{[^}]*color:\s*var\(--day-pill-active-ink\)/s);
    expect(source).toMatch(/\.day-pill\[data-active="true"\] \.dom\s*\{\s*color:\s*var\(--day-pill-active-ink\)/s);
    expect(source).toMatch(/\.day-pill\[data-active="true"\] \.status-dot\s*\{[^}]*background:\s*var\(--day-pill-active-ink\)/s);
  });

  test("light and dark primary/on-primary token pairs exceed text contrast", () => {
    expect(contrast("#1c1c1e", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ebebed", "#1c1c1e")).toBeGreaterThanOrEqual(4.5);
  });
});
