const assert = require('assert');

// Mock browser environment globals needed by app.js IIFE execution
global.window = {
  addEventListener: () => {}
};
global.document = {
  getElementById: () => ({
    dataset: {},
    style: { setProperty: () => {} },
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    addEventListener: () => {},
    setAttribute: () => {}
  }),
  documentElement: { dataset: {} },
  addEventListener: () => {},
  body: { classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: { setProperty: () => {} }, dataset: {} },
  querySelectorAll: () => ({ forEach: () => {} }),
  querySelector: () => null
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};
global.navigator = {};
global.location = { protocol: 'http:', pathname: '/', search: '', hash: '' };
global.matchMedia = () => ({ matches: false, addEventListener: () => {} });

// Override setInterval to avoid hanging the process
const originalSetInterval = global.setInterval;
global.setInterval = () => {};

// Override requestAnimationFrame
global.requestAnimationFrame = () => {};

// We require app.js and it should now export clamp
const appModule = require('./app.js');

if (!appModule || !appModule.clamp) {
  console.error("Could not find exported clamp function in app.js");
  process.exit(1);
}

const clamp = appModule.clamp;

try {
  // 1. Within range
  assert.strictEqual(clamp(5, 1, 10), 5, 'Should return value when within range');

  // 2. Below range
  assert.strictEqual(clamp(0, 1, 10), 1, 'Should return min when below range');

  // 3. Above range
  assert.strictEqual(clamp(15, 1, 10), 10, 'Should return max when above range');

  // 4. Negative numbers
  assert.strictEqual(clamp(-5, -10, 0), -5, 'Should handle negative numbers within range');
  assert.strictEqual(clamp(-15, -10, 0), -10, 'Should handle negative numbers below range');
  assert.strictEqual(clamp(5, -10, 0), 0, 'Should handle negative numbers above range');

  // 5. Float numbers
  assert.strictEqual(clamp(5.5, 1.1, 10.9), 5.5, 'Should handle floats within range');
  assert.strictEqual(clamp(0.5, 1.1, 10.9), 1.1, 'Should handle floats below range');
  assert.strictEqual(clamp(15.5, 1.1, 10.9), 10.9, 'Should handle floats above range');

  // 6. Equal min and max
  assert.strictEqual(clamp(5, 10, 10), 10, 'Should return min/max when min equals max and value is below');
  assert.strictEqual(clamp(15, 10, 10), 10, 'Should return min/max when min equals max and value is above');
  assert.strictEqual(clamp(10, 10, 10), 10, 'Should return min/max when min equals max and value equals min/max');

  console.log('✅ All clamp tests passed!');
  process.exit(0);
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
