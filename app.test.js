const { clamp } = require("./app.js");

describe("clamp", () => {
  it("keeps values inside the supplied range", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-5, -10, 0)).toBe(-5);
    expect(clamp(5.5, 1.1, 10.9)).toBe(5.5);
  });

  it("clamps values below or above the range", () => {
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(15, 1, 10)).toBe(10);
    expect(clamp(-15, -10, 0)).toBe(-10);
  });

  it("uses the fixed boundary when min and max are equal", () => {
    expect(clamp(5, 10, 10)).toBe(10);
    expect(clamp(15, 10, 10)).toBe(10);
    expect(clamp(10, 10, 10)).toBe(10);
  });
});
