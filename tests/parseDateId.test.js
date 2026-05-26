const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');

const parseDateIdRegex = /function parseDateId\(id\) \{[\s\S]*?\n\s*\}/m;
const match = code.match(parseDateIdRegex);
if (match) {
  eval(match[0]);
} else {
  throw new Error("Could not find parseDateId function in app.js");
}

describe('parseDateId', () => {
  test('parses a valid date id string into a Date object', () => {
    const date = parseDateId('2026-05-12');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(12);
  });

  test('handles undefined input', () => {
    const date = parseDateId(undefined);
    expect(date).toBeInstanceOf(Date);
    expect(isNaN(date.getTime())).toBe(true);
  });

  test('handles null input', () => {
    const date = parseDateId(null);
    expect(date).toBeInstanceOf(Date);
    expect(isNaN(date.getTime())).toBe(true);
  });

  test('handles empty string', () => {
    const date = parseDateId("");
    expect(date).toBeInstanceOf(Date);
    expect(isNaN(date.getTime())).toBe(true);
  });

  test('handles partial date strings', () => {
    const date = parseDateId("2026");
    expect(isNaN(date.getTime())).toBe(true);
  });

  test('handles non-numeric strings', () => {
    const date = parseDateId("abcd-ef-gh");
    expect(isNaN(date.getTime())).toBe(true);
  });
});
