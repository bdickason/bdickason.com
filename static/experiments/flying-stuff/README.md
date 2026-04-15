# Flying stuff

WebGL “flying emoji/glyph” experiment built with Three.js, shipped as **plain ES modules** (no build step).

## Run it

- Open `static/experiments/flying-stuff/index.html` via the site (recommended), e.g. from `npm run dev` at `/static/experiments/flying-stuff/`.
- Requirements:
  - A WebGL-capable browser.
  - JavaScript module support (uses `<script type="module">`).
  - Network access (Three.js is loaded via `importmap` CDN in `index.html`).

## Controls

- **Pointer / click / tap**: “splat” a flyer under the pointer.
- **`~` (Backquote key)**: toggle the debug panel.
- **Space**: cycle to the next emoji group.
  - If the dropdown is set to **Random Group**, space cycles immediately and resets the random timer.
  - If a specific group is selected, space changes the dropdown selection.
- **Arrow Up / Arrow Down**: previous/next emoji group (same behavior rules as Space).
- **Arrow Left / Arrow Right**: previous/next palette (only for unicode groups like Blocks/Sparkles/Energy).

## Reduced motion

If `prefers-reduced-motion: reduce` is enabled:

- The RAF loop does not run (no continuous animation).
- The scene renders a single snapshot on load.
- Clicking/tapping still works and triggers a few snapshot renders so splats visibly fade.
- Group/palette cycling is disabled.

## File map

- `index.html`: page shell, HUD, debug panel markup, importmap for Three.js.
- `main.js`: bootstraps the app, sets up UI auto-hide, and shows a fallback UI on init/runtime errors.
- `app.js`: owns app lifecycle; creates `THREE.Scene/Camera/Renderer`, wires UI controls, and drives the RAF loop.
- `flyers.js`: simulation + object pool; spawns flyers, updates motion, and handles splats/theme transitions.
- `utils.js`: tiny helpers (clamp, reduced-motion watcher, etc).

For more detail (architecture + API contracts), see `ARCHITECTURE.md`.

