describe("body measurement and progress-photo tracking", () => {
  let measurements;

  function makeCtx(overrides) {
    return Object.assign({
      state: { settings: { units: "kg" }, measurements: [], progressPhotos: [] },
      todayId: () => "2026-08-10",
      localDateId: jest.fn(() => "1999-01-01"),
      escapeHtml: (value) => String(value == null ? "" : value),
      saveState: jest.fn(),
      toast: jest.fn()
    }, overrides || {});
  }

  beforeEach(() => {
    jest.resetModules();
    window.LIFT_FEATURES = {};
    require("../features/measurements.js");
    measurements = window.LIFT_FEATURES.measurements;
  });

  test("uses the app date and renders the monthly reminder first", () => {
    const ctx = makeCtx();
    const html = measurements.renderMeasurements(ctx);

    expect(html.indexOf("Monthly progress photos due")).toBeLessThan(html.indexOf("Body measurements"));
    expect(html).toContain('data-date="2026-08-10"');
    expect(html).toContain('data-m-date value="2026-08-10"');
    expect(ctx.localDateId).not.toHaveBeenCalled();
  });

  test("falls back to the supplied local-date helper instead of UTC", () => {
    const localDateId = jest.fn(() => "2026-08-11");
    const ctx = makeCtx({ todayId: undefined, localDateId });

    expect(measurements.todayId(ctx)).toBe("2026-08-11");
    expect(localDateId).toHaveBeenCalledTimes(1);
  });

  test("records one date per month and becomes due again next month", () => {
    const ctx = makeCtx();
    ctx.state.progressPhotos = ["not-a-date", "2026-07-18", { date: "2026-06-01" }];

    expect(measurements.photoReminderStatus(ctx).due).toBe(true);
    expect(ctx.state.progressPhotos).toEqual(["2026-07-18"]);
    expect(measurements.recordPhotoCheckin(ctx)).toBe(true);
    expect(ctx.state.progressPhotos).toEqual(["2026-07-18", "2026-08-10"]);
    expect(measurements.photoReminderStatus(ctx).due).toBe(false);

    expect(measurements.recordPhotoCheckin(ctx, "2026-08-22")).toBe(true);
    expect(ctx.state.progressPhotos).toEqual(["2026-07-18", "2026-08-22"]);
    expect(measurements.photoReminderStatus(ctx, "2026-09-01").due).toBe(true);
    expect(ctx.saveState).toHaveBeenCalledTimes(2);
  });

  test("persists notes by date and field and renders them", () => {
    const ctx = makeCtx();

    expect(measurements.addEntry(ctx, "waist", "81.2", "2026-08-10", "Morning, before breakfast")).toBe(true);
    expect(ctx.state.measurements).toEqual([{
      date: "2026-08-10",
      waist: 81.2,
      notes: { waist: "Morning, before breakfast" }
    }]);
    expect(measurements.renderMeasurements(ctx)).toContain("Morning, before breakfast");
  });

  test("deleting fields removes their notes and the final empty record", () => {
    const ctx = makeCtx();
    measurements.addEntry(ctx, "waist", "81", "2026-08-10", "Relaxed");
    measurements.addEntry(ctx, "chest", "101", "2026-08-10", "Exhaled");

    measurements.deleteEntry(ctx, "2026-08-10", "waist");
    expect(ctx.state.measurements).toEqual([{
      date: "2026-08-10",
      chest: 101,
      notes: { chest: "Exhaled" }
    }]);

    measurements.deleteEntry(ctx, "2026-08-10", "chest");
    expect(ctx.state.measurements).toEqual([]);
  });
});
