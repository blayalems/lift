# Lift v2.0.0 Design System — Anti-AI-Slop Material 3 Expressive

This specification defines the visual, structural, accessibility, and code-hygiene standards for Lift v2.0.0 across both the PWA (`index.html`, `app.js`, `features/*.js`) and the Android Material 3 Expressive surface (`LiftWidgetProvider`, notifications).

---

## 1. Core Principles (Anti-AI-Slop Standards)

Lift is a daily strength-training instrument used under gym fatigue, bright gym lighting, and low-connectivity environments. Every surface must optimize for fast visual scanning, genuine state feedback, and quiet craft.

### 1.1 Crisp Geometric Inline SVGs Only — Zero Emoji Spam
- **Forbidden**: Decorative Unicode emojis or HTML numeric emoji entities (`&#128293;`, 🔥, 🏆, 💪, ⚡, 🎯, 🎁, 👑, ✨, 🚀) anywhere in JS-rendered HTML, labels, or widget copy.
- **Required**: Crisp geometric inline SVGs (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `aria-hidden="true"`) or `ctx.icon(name)` when `ctx.icon` is available (always provide a local SVG fallback when a module may be unit-tested without `ctx.icon`).
- Keep decorative SVGs `aria-hidden="true"` and place clear accessible labels (`aria-label`, `role="img"`, or visible text) on the enclosing interactive element or semantic group.

### 1.2 Zero Raw Inline `style="..."` Clutter
- **Forbidden**: Inline `style="..."` for layout (`display:flex`, `grid`, `gap`), spacing (`margin-top`), colors/backgrounds/gradients, typography (`font-size`, `font-variation-settings`), borders/radii, or SVG dimensions inside JS-rendered HTML (charts, sparklines, tables, card headers, alerts, chips, badges).
- **Required**: Semantic CSS classes mapped to the shared Material 3 Expressive tokens in `index.html`.
- **Single narrow exception**: Runtime data-driven scalars that cannot be expressed statically in CSS classes (for example `style="height:66.7%"` on `.streak-bar-fill` or `style="width:72%"` on `.xp-bar-fill` / `.hero-progress span`), plus standard SVG geometric presentation attributes (`viewBox`, `points`, `stroke-dasharray`, `stroke-dashoffset`). Even then, all layout, radii, colors, and transitions live in CSS.

### 1.3 Quiet Tonal Elevation Hierarchy (Zero Neon Halos or Rainbow Blobs)
- Use Lift's Material 3 tonal container ladder (`index.html`) for surface hierarchy rather than stacked glow shadows or saturated multi-hue blobs:
  - `--md-surface`: page canvas (`#fafafa` light / `#0a0a0a` dark)
  - `--md-surface-container-lowest`: inset inputs & recessed tracks (`#ffffff` / `#050505`)
  - `--md-surface-container-low`: sheets, drawer, status-bar strip (`#f2f2f3` / `#161616`)
  - `--md-surface-container`: primary supporting cards (`#f0f0f0` / `#1c1c1c`)
  - `--md-surface-container-high`: nested rows, inactive chips, secondary controls (`#ebebeb` / `#262628`)
  - `--md-surface-container-highest`: hover/active track fills (`#e5e5e5` / `#303032`)
- **Rule of one focal point**: Reserve high-contrast gradient/filled prominence for the single active Hero card, active primary CTA, or live rest timer. Supporting gadgets (`.quote-gadget`, `.coach-gadget`, `.momentum-gadget`, `.feed-card`, `.hiatus-card`, `.overview-card`) stay calm on `--md-surface-container` with `1px solid var(--md-outline-variant)`.
- **Forbidden**: Gratuitous neon halo shadows (`box-shadow: 0 0 24px rgba(...)`), rainbow ambient blurs behind content cards, or animated pulsing borders on resting gadgets.

### 1.4 Material 3 Expressive Corner Scale & Spring Motion
- **Corner scale**:
  - `--md-shape-xs: 4px` — heatmap cells, thin bar caps
  - `--md-shape-sm: 12px` — compact tool chips, tag pills, inputs
  - `--md-shape-md: 16px` — nested rows (`.quest-item`, `.set-row`, `.coach-bubble`)
  - `--md-shape-lg: 24px` — inset banners, `.reentry-banner`, `.hiatus-card`, `.loot-crate`
  - `--md-shape-xl: 28px` — top-level cards (`.quote-gadget`, `.coach-gadget`, `.momentum-gadget`, `.overview-card`) and modal sheet tops
  - `--md-shape-xxl: 36px` — hero statement containers
  - `--md-shape-full: 9999px` — action pills, segmented controls, filter chips, switches
- **Motion**: Use `--md-emphasized` (`cubic-bezier(.2, 0, 0, 1)`) for collapses/sheets and `--md-spring-bounce` (`cubic-bezier(.34, 1.56, .64, 1)`) / `--md-spring-fast` (`cubic-bezier(.2, .9, .2, 1.3)`) for micro-feedback, animating only `transform` and `opacity` and strictly honoring `@media (prefers-reduced-motion: reduce)`.

### 1.5 Typography & Tabular Numerals
- **Display & Headings**: `"Roboto Flex", system-ui, sans-serif` with optical sizing (`opsz`) and `text-wrap: balance`.
- **Numeric Telemetry** (weights, reps, e1RM, percentages, timers, XP counters, streak counts, chart axis labels, table columns): `"Roboto Mono", ui-monospace, monospace` paired with `font-variant-numeric: tabular-nums` (`font-feature-settings: "tnum"`). Live updates must never shift neighboring text horizontally.

### 1.6 High WCAG Contrast & Mobile Touch Targets
- **Contrast**: Minimum `4.5:1` for body/label text and `3:1` for large numerals and graphical indicators across **both** `html[data-theme="light"]` and `html[data-theme="dark"]`, and across `classic`, `expressive`, and `neural` visual styles.
- **Paired tokens**: Never place `--md-on-surface` on `--md-primary` or hardcode `#fff` onto theme-flipped containers. Always pair:
  - `--md-primary` <-> `--md-on-primary`
  - `--md-primary-container` <-> `--md-on-primary-container`
  - `--md-secondary-container` <-> `--md-on-secondary-container`
  - `--md-tertiary-container` <-> `--md-on-tertiary-container`
- **Touch targets & overflow**: All interactive buttons/chips/toggles meet `min-height: 44px` (`min-width: 44px` for icon controls) on mobile (`320px` and `390px` viewports). Grid children inside cards use `min-width: 0` and safe wrapping so `document.documentElement.scrollWidth <= window.innerWidth` at every breakpoint.
- **Semantics**: Pair every form control `<input>/<select>/<textarea>` with a unique `id` and matching `<label for="...">`. Use `aria-pressed` for toggles, `role="tablist"` / `role="tab"` + `aria-selected` for filter strips, and visible `:focus-visible` outlines.

---

## 2. Shared CSS Class Contracts

New v2 modules and refactored Wave 1 modules MUST emit these exact semantic classes so `index.html` styles apply consistently in Light, Dark, Expressive, and Neural themes:

### 2.1 In-Session Quote Engine (`features/quotes.js`)
- `.quote-gadget` — top-level container (`--md-surface-container`, `border-radius: var(--md-shape-xl)`)
- `.quote-head`, `.quote-eyebrow`, `.quote-text`, `.quote-author`, `.quote-actions`, `.quote-btn`

### 2.2 Offline Adaptive AI Coach (`features/coach.js`)
- `.coach-gadget` — home/today brief strip
- `.coach-head`, `.coach-badge`, `.coach-brief`, `.coach-actions`
- `.coach-insight-grid` — 2-up diagnostic metric grid inside Coach sheet
- `.coach-chips`, `.coach-chip` — quick prompt & tone pills (`min-height: 44px`)
- `.coach-chat-log`, `.coach-bubble` (`data-role="user"` | `data-role="coach"`), `.coach-compose`

### 2.3 Habit Psychology & Momentum Engine (`features/engagement.js`)
- `.momentum-gadget` — home-screen momentum strip
- `.xp-bar-track`, `.xp-bar-fill` (sets `style="width:<pct>%"` only)
- `.combo-badge`, `.shield-pill`
- `.quest-list`, `.quest-item` (`data-done="true"|"false"`)
- `.hiatus-card` (`data-tier="active"|"watch"|"warning"|"rescue"|"reentry"`)
- `.loot-crate` (`data-rarity="common"|"rare"|"epic"|"mythic"`)
- `.feed-list`, `.feed-card`, `.story-card`

### 2.4 Streaks & 12-Week Adherence (`features/streaks.js`)
- `.streak-ring-goal` — `/goal` denominator inside `.streak-ring .label-num`
- `.streak-flames`, `.streak-pip` (`data-on="true"|"false"`), `.streak-pip-icon` — crisp geometric SVG streak indicators (7 slots)
- `.streak-bars`, `.streak-bar-col`, `.streak-bar-track`, `.streak-bar-fill` (`data-sessions`, `data-empty="true"|"false"`, `style="height:<pct>%"` only), `.streak-bar-label`

### 2.5 Marketplace (`features/marketplace.js`)
- `.market-tag-duration`, `.market-tag-sessions` — semantic tonal container tags inside `.market-tags`
- `.market-filter-strip` — horizontally scrollable `.segmented` vibe filter strip
- `.market-detail`, `.market-detail-summary`, `.market-detail-table`, `.market-detail-actions`

### 2.6 Strength 1RM & Trends (`features/strength.js`)
- `.est-unit` — uppercase unit label in `.est-big`
- `.strength-table` — `.mini-table` top spacing & tabular numerals
- `.strength-trend-item`, `.strength-trend-head`, `.strength-sparkline`, `.strength-sparkline-line`

### 2.7 Measurements (`features/measurements.js`) & Recap (`features/recap.js`)
- `.measure-date-field`, `.measure-field-row`, `.measure-empty`, `.measure-history-table`
- `.summary-body-grid` — top margin modifier on `.sheet-grid` inside `.summary-panel`

---

## 3. Wave 2.5 `index.html` Holistic Polish Checklist (Post-Integration)

1. **Dark-mode calendar contrast**: Update `.cal-cell[data-status="completed"]` and `[data-status="done"]` in `index.html` from hardcoded `color: #fff` to `color: var(--md-on-primary)` (fixes ~1.2:1 white-on-light-gray contrast in Dark mode).
2. **Dark-mode `--md-error` token**: Define high-contrast dark-mode `--md-error` (e.g. `#ff897d`) inside `html[data-theme="dark"]` so danger buttons, missed calendar marks, negative deltas, and overdue alerts exceed `4.5:1`.
3. **Streak ring inline ratio layout**: Update `.streak-ring .label-num` from `display: grid` to `display: flex; align-items: baseline; justify-content: center;` so `count` and `.streak-ring-goal` (`/goal`) sit inline rather than stacking vertically.
4. **Calendar phase badges & style parity**: Improve contrast on `.calendar-week[data-phase="consolidate"]` and `[data-phase="load"]`, give `html[data-visual-style="expressive"]` distinct Material 3 Expressive surface/motion polish, and add clean desktop scroll affordance on `.week-strip`.
5. **Refactored class styling verification**: Confirm every Wave 1 and Wave 2 class in Section 2 renders cleanly across `320x568`, `390x844`, and `1280x800` in Light & Dark modes.

