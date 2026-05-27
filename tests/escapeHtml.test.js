const { escapeHtml } = require("../app.js");

describe("escapeHtml", () => {
  it("is exported as a function", () => {
    expect(typeof escapeHtml).toBe("function");
  });

  it("escapes HTML metacharacters", () => {
    expect(escapeHtml('<div class="test">a & b</div>')).toBe(
      "&lt;div class=&quot;test&quot;&gt;a &amp; b&lt;/div&gt;"
    );
    expect(escapeHtml("'quoted'")).toBe("&#39;quoted&#39;");
  });

  it("normalizes nullish values and preserves plain scalar text", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(123)).toBe("123");
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});
