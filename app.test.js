/**
 * @jest-environment jsdom
 */

// Mock required DOM elements and globals for app.js initialization
beforeAll(() => {
    // Add required DOM elements
    document.body.innerHTML = `
        <div id="app"></div>
        <div id="toast-root"></div>
        <div id="sheet"></div>
        <div id="sheet-backdrop"></div>
        <div id="summary-overlay"></div>
    `;

    // Add minimal required globals
    window.LIFT_PLAN = {
        meta: { timeZone: 'UTC' },
        weeks: []
    };

    // Mock MatchMedia
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
});

describe('escapeHtml', () => {
    let escapeHtml;

    beforeAll(() => {
        // Now require app.js
        const app = require('./app.js');
        escapeHtml = app.escapeHtml;
    });

    it('should exist', () => {
        expect(escapeHtml).toBeDefined();
    });

    it('should escape HTML characters', () => {
        expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('should handle ampersand', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should handle quotes', () => {
        expect(escapeHtml('"test"')).toBe('&quot;test&quot;');
        expect(escapeHtml("'test'")).toBe('&#39;test&#39;');
    });

    it('should handle null/undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('should handle numbers', () => {
        expect(escapeHtml(123)).toBe('123');
        expect(escapeHtml(0)).toBe('0');
    });

    it('should handle multiple replacements', () => {
        expect(escapeHtml('<div class="test">a & b</div>')).toBe('&lt;div class=&quot;test&quot;&gt;a &amp; b&lt;/div&gt;');
    });

    it('should handle strings with no special characters', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });
});
