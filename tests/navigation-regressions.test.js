const { alignActiveStrip } = require("../app.js");

function sizedElement(tag, metrics) {
  const node = document.createElement(tag);
  Object.entries(metrics).forEach(([key, value]) => {
    Object.defineProperty(node, key, { configurable: true, value });
  });
  return node;
}

describe("mobile navigation alignment", () => {
  test("centers the active week in an overflowing strip", () => {
    const strip = sizedElement("nav", { clientWidth: 320, scrollWidth: 2000, offsetLeft: 100 });
    const active = sizedElement("button", { offsetLeft: 1100, offsetWidth: 92 });
    active.dataset.active = "true";
    strip.appendChild(active);

    alignActiveStrip(strip);

    expect(strip.scrollLeft).toBe(886);
  });

  test("clamps active tabs at both ends of the strip", () => {
    const startStrip = sizedElement("nav", { clientWidth: 320, scrollWidth: 2000 });
    const start = sizedElement("button", { offsetLeft: 10, offsetWidth: 92 });
    start.dataset.active = "true";
    startStrip.appendChild(start);
    alignActiveStrip(startStrip);
    expect(startStrip.scrollLeft).toBe(0);

    const endStrip = sizedElement("nav", { clientWidth: 320, scrollWidth: 2000 });
    const end = sizedElement("button", { offsetLeft: 1950, offsetWidth: 92 });
    end.dataset.active = "true";
    endStrip.appendChild(end);
    alignActiveStrip(endStrip);
    expect(endStrip.scrollLeft).toBe(1680);
  });
});
