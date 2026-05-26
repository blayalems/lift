const { formatDuration } = require('../app.js');

describe("formatDuration", () => {
  it("formats exactly 0 seconds as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatDuration(45)).toBe("0:45");
    expect(formatDuration(9)).toBe("0:09");
  });

  it("formats exact minutes", () => {
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(300)).toBe("5:00");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3599)).toBe("59:59");
  });

  it("formats exact hours", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(7200)).toBe("2:00:00");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(formatDuration(3665)).toBe("1:01:05");
    expect(formatDuration(36000)).toBe("10:00:00");
  });

  it("handles negative values by treating them as 0", () => {
    expect(formatDuration(-10)).toBe("0:00");
  });

  it("handles non-integer values by flooring them", () => {
    expect(formatDuration(65.9)).toBe("1:05");
    expect(formatDuration(0.5)).toBe("0:00");
  });

  it("handles non-numeric values gracefully", () => {
    expect(formatDuration("abc")).toBe("0:00");
    expect(formatDuration(null)).toBe("0:00");
    expect(formatDuration(undefined)).toBe("0:00");
  });
});
