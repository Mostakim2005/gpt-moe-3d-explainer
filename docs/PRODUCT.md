# Product Intent & Feature Map (`PRODUCT.md`)
> **1-Line Summary:** The permanent source of truth for what the user wants the app to do and feel like, independent of how the code is currently implemented.

## 1. Core Vision & User Experience Intent
* **What This App Does (Plain English):** A dark-themed, camera-driven interactive 3D web application that teaches how transformer language models work and how Mixture of Experts (MoE) scales them. It turns complex ML concepts into 19 scripted, narrated, and visually interactive steps.
* **How It Must Feel to Use:** Fast, cinematic (#070b16 dark stage), and smooth at 60 FPS. Camera glides smoothly between viewing angles without disorienting the user. Captions remain crisp DOM text with zero collisions or out-of-bounds across all screen sizes (1920px down to 980px). Audio narration starts instantly with synced glossary terms, and live sliders update mathematical charts instantaneously.

---

## 2. Active Features (Do Not Break)

### [FEATURE: Interactive-3D-Step-Sequencing] | Aliases: step list, timeline, camera glide, 3d scenes
> **1-Line Summary:** 19 scripted learning steps across two chapters (11 GPT, 8 MoE) with automatic camera positioning and progressive 3D element reveals.
* **User Intention (Non-Negotiable):** The learner must be able to step forward/backward or scrub freely across the timeline without animation desynchronization or jumping geometry.
* **Visual / UI Behavior:** Top chapter tabs switch between "How GPT Works" and "Mixture of Experts". Bottom timeline and arrow keys navigate steps. The camera smoothly damps to preset viewing angles (`p`, `t`) for each step, and orbital control unlocks when resting.
* **Code Anchors (Grep Targets):**
  * `src/content/gptSteps.ts` -> `gptChapter`
  * `src/content/moeSteps.ts` -> `moeChapter`, `chapters`
  * `src/three/CameraRig.tsx` -> `CameraRig`
  * `src/state/useSceneStore.ts` -> `useSceneStore`

### [FEATURE: Dual-Engine-TTS-Narration] | Aliases: voice narration, kitten tts, web speech, neural voice
> **1-Line Summary:** In-browser audio narration of every step supporting both lightweight local neural TTS (Kitten TTS Nano) and native OS Web Speech.
* **User Intention (Non-Negotiable):** Every step must offer clear voiceover explaining the scene without lagging the 3D render thread or crashing on module imports.
* **Visual / UI Behavior:** Narration panel displays audio controls (play/pause/stop, voice dropdown, speed slider). When Kitten TTS is chosen, the ONNX model runs in a dedicated web worker; when system speech is chosen, browser speech synthesis is used.
* **Code Anchors (Grep Targets):**
  * `src/tts/useTts.ts` -> `useTts`
  * `src/tts/kitten.worker.ts` -> `withSingleThread`, `MODEL_ID`
  * `src/ui/VoicePanel.tsx` -> `VoicePanel`

### [FEATURE: Screen-Space-Annotation-Overlay] | Aliases: captions, 2d labels, clear placement, occlusion avoidance
> **1-Line Summary:** DOM-rendered crisp captions projected from 3D world coordinates with dynamic anchor-clearance scoring to avoid geometry collisions.
* **User Intention (Non-Negotiable):** Captions must remain legible, razor-sharp on high-DPI displays, and never overlap each other or cover the primary 3D geometry they describe.
* **Visual / UI Behavior:** Floating text cards with cyan indicator pins track 3D positions across camera rotation. Candidate positions (top, bottom, left, right) are scored each frame to choose maximum clearance from other pins.
* **Code Anchors (Grep Targets):**
  * `src/three/labels/AnnotationOverlay.tsx` -> `placeOne`
  * `src/three/labels/LabelProjector.tsx` -> `LabelProjector`
  * `src/scenes/annotations.ts` -> `useAnnotations`

### [FEATURE: Real-Time-Math-Controls] | Aliases: interactive sliders, temperature slider, top-k gate, moe economics
> **1-Line Summary:** Live parameter sliders that recompute mathematical probabilities and parameter allocation dynamically without reloading the scene.
* **User Intention (Non-Negotiable):** Interactive sliders must immediately demonstrate the mathematical effects of temperature, Top-K gating, and expert capacity without desynchronizing state.
* **Visual / UI Behavior:** Sliders appear in the narration card for relevant steps. Temperature slider re-normalizes softmax bars; Top-K slider illuminates active experts and recalculates active FLOP parameters.
* **Code Anchors (Grep Targets):**
  * `src/scenes/gptData.ts` -> `LOGIT_VALUES`, `softmax`
  * `src/scenes/moeData.ts` -> `activeParamsB`, `EXPERT_COUNT`
  * `src/ui/NarrationPanel.tsx` -> `NarrationPanel`
  * `src/three/shared/BarChart.tsx` -> `BarChart`

### [FEATURE: X-Ray-Internal-Inspection] | Aliases: xray mode, see-through boxes, inner vectors, wireframe
> **1-Line Summary:** Toggleable inspection mode that drops outer mesh opacity and renders outlines to expose internal vectors and active routes.
* **User Intention (Non-Negotiable):** Users can peek inside transformer blocks to observe the residual stream, vector representations, and gating paths directly.
* **Visual / UI Behavior:** An X-Ray toggle button in the header fades outer boxes to 12% opacity with glowing neon edges, revealing internal 3D vectors and connection arcs.
* **Code Anchors (Grep Targets):**
  * `src/three/shared/NeonBox.tsx` -> `NeonBox`
  * `src/state/useSceneStore.ts` -> `useSceneStore`
  * `src/ui/Shell.tsx` -> `Shell`

---

## 3. Planned Features & App-Merge Wishlist

### [WISHLIST: Cross-Platform-Desktop-Packaging] | Aliases: electron wrapper, portable exe, desktop app
> **1-Line Summary:** Package the 3D explainer as a portable standalone Windows .exe desktop application with pre-cached neural voice weights.
* **User Intention:** Provide an entirely offline executable that launches instantly without starting a local web dev server.
* **Target Integration Point:** Root build scripts, GitHub Actions tag-triggered release workflow.

### [WISHLIST: Custom-Input-Tokenization-Playground] | Aliases: user text prompt, live bpe tokenizer, dynamic token chips
> **1-Line Summary:** Allow users to type custom text prompts and watch real-time BPE byte-merging into dynamic 3D token chips.
* **User Intention:** Expand Step 1 & 2 to allow the learner to test their own phrases and see token splitting in 3D space.
* **Target Integration Point:** `src/scenes/GptScene.tsx` -> `TokenChip`, `src/scenes/gptData.ts`.
