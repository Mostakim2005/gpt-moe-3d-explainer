# Project Operating Instructions (`AGENTS.md`)
> **Notice:** This project inherits user persona, confirmation gates, and documentation blueprints from the global master `AGENTS.md`. Do not duplicate those rules here.

## 1. Project Tech Stack & Environment
* **Runtime / Language:** Node.js v20+, TypeScript 5+ (ES2022 target)
* **Framework / Host:** Vite 8 + React 19 + Three.js + React Three Fiber + Drei + Framer Motion + Zustand
* **Speech Engine:** Local 15M StyleTTS-2 (Kitten TTS Nano) via ONNX Runtime Web + Browser Web Speech API
* **Target Output:** Static single-page application (`dist/`)

## 2. Mandatory Verification & Build Commands
* **Type Check:** `npx tsc -b`
* **Lint:** `npm run lint` (oxlint across 40 files with 116 rules)
* **Build / Bundle:** `npm run build` (`tsc -b && vite build`)
* **Preview Built Bundle:** `npm run preview` (serves `dist/` on port 4173)
* **Caption & Contrast Verification:**
  * Labels collision & bounds check: `node .tools/audit.mjs labels`
  * Text contrast audit (WCAG AA): `node .tools/audit.mjs contrast`

## 3. Repository Directory Structure & Conventions
* `src/content/` - Step sequences (`gptSteps.ts`, `moeSteps.ts`), glossary terms, and camera poses.
* `src/scenes/` - 3D scenes (`GptScene.tsx`, `MoeScene.tsx`) and decoupled data modules (`gptData.ts`, `moeData.ts`).
* `src/state/` - Single Zustand store (`useSceneStore.ts`) managing chapter, step, and interactive slider state.
* `src/three/` - Camera rig, stage, shared 3D primitives (NeonBox, VectorBar, Arc), and label projection.
* `src/tts/` - Audio abstraction hook (`useTts.ts`) and background neural worker (`kitten.worker.ts`).
* `src/ui/` - 2D DOM shell, narration panel, timeline scrubber, and control widgets.
* `docs/` - Core documentation suite (`PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS_AND_TRAPS.md`, `VISUAL_GUIDE.html`, `algorithms.md`, `verification.md`).
* `.tools/` - Isolated headless browser verification sandbox (Puppeteer + SwiftShader).

## 4. Repository-Specific Engineering Traps
* **TRAP 1 (Kitten TTS Single-Thread Override):** Never remove `withSingleThread` in `src/tts/kitten.worker.ts`. Multi-threaded WASM requires `crossOriginIsolated` headers (COOP/COEP), which block model downloads from HuggingFace CDN.
* **TRAP 2 (Windows File Handle Locks):** Stop the local dev server on port 5174/5173 using `stop-server.bat` before large file refactors or renames to avoid Windows `ReplaceFileW EIO` filesystem locks.
* **TRAP 3 (Fast Refresh Constant Isolation):** Never export constants or numerical datasets directly from scene component files (`GptScene.tsx`, `MoeScene.tsx`). Keep constants in `gptData.ts` and `moeData.ts` so Vite React Fast Refresh preserves view state without page reloads.
* **TRAP 4 (Vite Worker ESM Pre-bundling):** Keep `optimizeDeps.include: ['jszip']` in `vite.config.ts`. Without it, `jszip`'s UMD bundle causes the background TTS web worker to fail on import.
