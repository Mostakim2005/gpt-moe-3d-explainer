# Verification Reference (`verification.md`)
> **1-Line Summary:** Complete specifications of the automated verification suite, headless-browser audits, and quality metrics.

Every claim in the project is checked by automated scripts in this repository, not judged by eye. This document records what is measured, how to re-run it, and the metrics achieved.

---

## 1. Automated Verification Checks

### [VERIFY: Static-Analysis-And-Compilation] | Aliases: tsc, typecheck, oxlint, bundle build
> **1-Line Summary:** Validates complete TypeScript type safety and zero linter warnings across all application code.

| Check | Tool / Engine | Command | Result |
|---|---|---|---|
| TypeScript Types | `tsc -b` (ES2022) | `npx tsc -b` | Clean (0 errors) |
| Linter | `oxlint` (116 rules) | `npm run lint` | 0 warnings, 0 errors |
| Production Build | `vite build` | `npm run build` | Succeeds (1.08s) |

* **Code Anchors (Grep Targets):**
  * `package.json` -> `scripts`
  * `.oxlintrc.json`
  * `tsconfig.json`

---

## 2. Headless Browser Visual Audits

### [VERIFY: Screen-Space-Caption-Audit] | Aliases: labels audit, caption overlap, out of bounds, clearance
> **1-Line Summary:** Headless Puppeteer browser testing that asserts 0 caption overlaps and 0 out-of-bounds across all 19 steps and 5 viewport sizes.

* **Audit Command:** `node .tools/audit.mjs labels`
* **Test Viewports:** 1920×1080, 1440×900, 1280×720, 1100×700, 980×600 px.
* **Result:** 19/19 steps pass with **0 pairwise overlaps and 0 out-of-bounds**.
* **Why This Matters:** Captions are DOM overlays on a WebGL canvas. Collisions cannot be derived from static source; they require a true browser layout engine.

* **Code Anchors (Grep Targets):**
  * `.tools/audit.mjs`
  * `src/three/labels/AnnotationOverlay.tsx` -> `placeOne`

### [VERIFY: WCAG-Contrast-Compliance] | Aliases: text contrast, wcag aa, color accessibility
> **1-Line Summary:** Computes WCAG AA contrast ratios over computed foreground/background styles for UI and caption text nodes across both chapters.

* **Audit Command:** `node .tools/audit.mjs contrast`
* **Result:** **0 failures** across 47–54 text nodes measured per step.
* **Why This Matters:** Backgrounds contain glowing 3D meshes and post-processing bloom. Sampling rendered contrast proves labels remain legible regardless of scene brightness.

### [VERIFY: Geometry-Occlusion-And-Sanity] | Aliases: occlusion proxy, sanity check, saturation ring
> **1-Line Summary:** Measures pixel luminance in the ring around caption boxes to prove text does not obscure bright 3D geometry.

* **Audit Commands:** `node .tools/occlusion.mjs` & `node .tools/sanity.mjs`
* **Result:** Worst-case saturation 52.3 on `gpt 9` (dropped from 99.9 after dynamic clearance was implemented). Baseline-is-darkest and caption-paints tests both PASS.

---

## 3. Speech & Neural Voice Verification

### [VERIFY: Dual-Engine-Audio-Pipeline] | Aliases: tts test, kitten audio buffer, web speech queue
> **1-Line Summary:** Verifies local ONNX neural voice model execution, audio buffer synthesis at 24 kHz, and Web Speech fallback.

* **Audit Command:** `node .tools/tts-speak.mjs`
* **Result:** Kitten TTS Nano downloads, initializes single-threaded WASM, and produces 44–48 seconds of 24 kHz uncompressed audio buffers. OS Web Speech queues correct step narration text across all tested voices.

* **Code Anchors (Grep Targets):**
  * `.tools/tts-speak.mjs`
  * `src/tts/kitten.worker.ts` -> `withSingleThread`

---

## 4. Running the Harness

```bash
# Terminal 1: Start servers
npm run dev -- --port 5174          # Dev server expected by audit scripts
npm run preview -- --port 4173      # Preview server for prod bundle checks

# Terminal 2: Run verification suite
cd .tools
node audit.mjs labels
node audit.mjs contrast
node occlusion.mjs
node sanity.mjs
node content.mjs
node tts-speak.mjs
node prod.mjs
```
