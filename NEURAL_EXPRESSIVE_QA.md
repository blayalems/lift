# Neural Expressive QA Checklist

Scope for v1.4.8 PR 2-10.

- Chrome desktop: launch app, switch Settings > Visual style to Neural, verify Today, sheet, rest timer, and bottom nav render.
- Android Chrome / installed PWA: verify fullscreen shell, haptics on/off, and native bridge paths remain progressive enhancement.
- Themes: verify light, dark, and system choices after switching visual style.
- Reduced motion: enable OS/browser reduced motion and confirm animations collapse through the global media query.
- Offline: install service worker, reload offline, and confirm `lift-v17` serves the updated shell.
- Workout flow: start workout, complete set, undo set, log PR, start/rest/finish timer, finish workout.
- Layout: check no bottom-nav, rest FAB, toast stack, modal, or page sheet overlap at narrow mobile and desktop widths.
- Tap targets: keep primary controls at or above 44px where existing layout allows.
- Manifest: confirm Start Workout shortcut appears beside Today, Records, Library, and Backups.
