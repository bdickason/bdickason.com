# Starfield Experiment

3D starfield experiment rendered with Three.js.

## Files

- `index.html` - experiment shell, import map, and debug controls
- `main.js` - tiny bootstrap entrypoint
- `app.js` - lifecycle orchestration (`initStarfield()` + `dispose()`)
- `stars.js` - starfield geometry, shaders, and motion modes
- `comets.js` - comet spawning/trails
- `ufo.js` - rare UFO entity system
- `nebula.js` - procedural nebula textures and layers
- `settings-store.js` - localStorage load/save defaults
- `utils.js` - shared helpers

## Controls

- `\`` toggles the debug panel.
- Debug sliders:
  - `Density` controls visible star density.
  - `Brightness` controls star opacity scale.
  - `Direction` switches motion mode (`rtl` or `into`).

## Dependency Notes

- Three.js is loaded from jsDelivr import map in `index.html`.
- Current version: `three@0.160.0`.
- If WebGL or module loading fails, the UI shows a visible fallback message.

## Accessibility and Motion

- Honors `prefers-reduced-motion` on load and runtime changes.
- In reduced-motion mode, the scene renders a stable frame without continuous animation.
- Debug UI remains hidden by default.

## Performance Notes

- Renderer DPR is capped to avoid runaway GPU cost on high-DPI displays.
- Adaptive guardrails reduce quality under sustained frame-time pressure:
  - lowers DPR first
  - then disables UFO/comet systems if needed
- Nebula textures are generated procedurally at startup and can be the most expensive CPU step on slower devices.

## Manual QA Checklist

- Page loads with no runtime errors.
- Debug controls change starfield behavior and persist between reloads.
- Reduced-motion toggling updates behavior while page is open.
- Fallback message appears when WebGL/module init fails.
- Verify behavior in Chrome, Safari, and Firefox.
