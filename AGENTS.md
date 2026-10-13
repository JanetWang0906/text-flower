# Web project conventions

Before substantial browser UI coding, follow `web-project-bootstrap`. This is a plain HTML/Canvas project; do not add React, shadcn configuration or an animation library merely for conventions.

# Keep web and mini-tool implementations separate

- Web source: project-root `index.html`, `style.css`, `toolbar.css`, `app.js`, `motion.js`, `background.js`, and `platforms/web.js`.
- Mini-tool source: `minitool-src/index.html`, `minitool-src/style.css`, and `minitool-src/app.js`. These extend the already-tuned original mini-tool.
- `minitool/` is generated only from `minitool-src/` by `tests/build-minitool.cjs`. Never rebuild it from the web JS, HTML controls or styles. The builder may refresh cake SVG geometry, but must retain the original rose geometry and mini-tool layout.
- Within each implementation, rose and cake reuse that implementation's text-rope engine. Adding a shape must not replace the mini-tool's native saving, safe area, controls, timing, collision tuning or error dialogs with web behavior.
- Preserve `backups/minitool-original-20260928/` and its checksum manifest. Use `tests/minitool-baseline.cjs` to check the original rose behavior before shipping further mini-tool changes.
- On 2026-10-07 the user authorized packaging after placing the shape selector on the left and HD save button on the right in one row. Build and audit from the independent mini-tool source; preserve the original ZIP and do not sync web source into the package.

# Verification

`tests/minitool-baseline.cjs` checks original behavior and build isolation. `tests/shapes.cjs`, `tests/v2-controls.cjs`, and `tests/verify-minitool.cjs` cover the shape extension and controls. Browser and mock SDK results are development evidence; platform simulator and Android/iOS validation remain separate.
