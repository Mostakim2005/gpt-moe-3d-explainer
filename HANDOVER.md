# Handover — GPT & Mixture of Experts 3D Explainer

Snapshot taken: **4 Nov 2026, ~17:20** (local). This file describes the state of the
working tree as left by the "make it actually teachable + add lightweight TTS" session.
It is meant to be read *before* touching anything.

---

## 1. TL;DR — where things stand

| Area | State |
| --- | --- |
| Step content (text, numbers, camera poses) | Rewritten, fact-checked, in place |
| 3D scenes & animation | Working, verified visually at several steps |
| Label/caption system | Replaced; **all 19 steps audited: 0 overlaps, 0 out-of-bounds** |
| TTS code (system voice + Kitten neural voice) | Written, **not yet verified end-to-end** |
| `npx tsc -b` | Passes (exit 0) |
| `npm run build` | **Not run since the rewrite** (`dist/` is stale, built 15:15 mid-rewrite) |
| `npm run lint` (oxlint) | **Not run** |
| Docs (`README.md`, `docs/*.md`) | **Stale** — still describes the pre-rewrite app |
| Dev-only debug hooks in source | **3 blocks still present**, must be removed (§8) |
| Git | Initialized: one commit on `main`, tree clean (`93f8ca1`), no remote |

Nothing is broken as far as we know. What remains is verification, cleanup, and docs.

---

## 2. Run it

```bash
npm install      # already done; kitten-tts-js@0.1.2 is installed
npm run dev      # currently running on http://127.0.0.1:5174
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

* A dev server is **already running**: `http://127.0.0.1:5174`, listening PID **4696**
  (`.devserver.pid` holds `348`, which is the shell wrapper — trust the netstat PID).
  It is registered in the Preview panel. Log: `.devserver.log`.
* Vite picked **5174**, not 5173, because the default port was occupied on this machine.
* Ports/hosts are non-interactive; `start-server.bat` / `stop-server.bat` /
  `preview-production.bat` exist at the repo root for the Windows workflow.

---

## 3. What changed in this session

### 3.1 Content — `src/content/`

* `types.ts` — step type: `id, title, short, body, see[], tryIt?, narrationText,
  camera: {p, t}, active[]`.
* `gptSteps.ts` — 11 steps (tokens → ids, rare-word split, embedding lookup, 4,096-dim
  slice, positional signal, QKV + attention weights, causal mask & blend, multi-head,
  FFN, residual + LayerNorm, 16-block stack, logits → softmax, sampling loop).
* `moeSteps.ts` — 8 steps (dense baseline, router, top-k gating, experts, weighted merge,
  economics 46.7B / 12.9B, load balancing, where MoE lives).
* `index.ts` — `chapters[]` assembly + per-chapter narration helpers.
* Numbers were chosen to be defensible: GPT-2 small's **12** layers vs GPT-3-scale **16**
  in the tower step, Mixtral **46.7B total / 12.9B active**, no invented GPT-4 MoE claims.
  Everything is labelled "illustrative" in the footer.

### 3.2 Label system — `src/three/labels/` (the core fix)

The original app rendered **all 21 `drei` `<Html>` labels of every step at once**, which
is why captions overlapped. It was replaced with a two-part system:

* `projection.ts` — tiny store bridging R3F (which owns the camera) and the DOM overlay.
* `LabelProjector.tsx` — inside the canvas; projects every annotation anchor to NDC each
  frame (`requestAnimationFrame`, falling back to a 120 ms timer when `document.hidden`).
* `AnnotationOverlay.tsx` — one DOM layer above the canvas; measures real label boxes,
  runs a de-overlap pass (candidate placement + collision rejection + clamping), draws
  leader lines. Each caption carries `from`/`to` step ranges, so **only the current
  step's captions exist**.
* Deleted: `Label3D.tsx`, `usePose.ts`.

Anchor definitions live in `src/scenes/annotations.ts` (`gptAnnotations(temperature)`,
`moeAnnotations(topK, loadBalancing)`); they are the file to edit when a caption sits
badly. Captions are step-ranged and reactive to the sliders.

### 3.3 Scenes and shared primitives

* `src/scenes/GptScene.tsx`, `MoeScene.tsx` — rewritten; every primitive stays mounted
  and animates scale/opacity through `usePresence`, so steps fade in/out instead of
  popping.
* `src/three/shared/` — `NeonBox`, `TokenChip`, `VectorBar`, `HeatmapPlane`, `Arc`,
  `Tower`, `BarChart`, `TextSprite` (canvas-based text; the old `drei` `<Text>` needed a
  CDN font), `usePresence`, `constants`.
* Bars / heatmap / histograms use **instanced meshes**; the glow is a canvas radial
  gradient instead of `ContactShadows`.
* `CameraRig.tsx` — glides to each step's pose (`lambda = 4.2`), backs off on narrow
  aspect (`pullBack = clamp(1.45 / aspect, 1, 2.1)`), releases to OrbitControls on drag.
* `CanvasRoot.tsx` — fov 46, near 0.1, far 120, `dpr [1, 1.75]`.

### 3.4 UI — `src/ui/`, `src/styles/global.css`

`Shell.tsx`, `NarrationPanel.tsx`, `Timeline.tsx`, `StepList.tsx`, `ChapterTabs.tsx`,
`VoicePanel.tsx` and the stylesheet were rewritten. Desktop = stage + narration column;
narrow viewport = stage above a stacked narration, chapter rail as a horizontal scroller.

### 3.5 Build config — `vite.config.ts`

Required for the TTS bundle:

* alias `onnxruntime-node` → `src/tts/ort-node-shim.ts` (the shim throws, forcing the
  browser build; `kitten-tts-js` prefers the Node runtime when it can find it),
* alias `onnxruntime-web` → `onnxruntime-web/wasm`,
* `optimizeDeps.exclude: ['kitten-tts-js']`, `worker.format: 'es'`.

---

## 4. TTS — what was added and how it works

**Choice: Kitten TTS Nano 0.8** — 15M parameters, ~24.4 MB int8 ONNX + ~3.3 MB voices,
8 English voices (Bella, Luna, Rosie, Kiki, Jasper, Bruno, Hugo, Leo). It is the smallest
neural TTS that is still clearly intelligible, which is why it was picked.

Design is **two-tier**, because a 25 MB download should never be mandatory:

1. **System voice (default, zero download)** — `speechSynthesis`, filtered to `en-*`,
   exposing whatever the OS has (on this machine: Microsoft David / Mark / Zira).
2. **Kitten neural voice (opt-in)** — downloaded and cached by the browser, then run
   fully locally in a Web Worker via `onnxruntime-web` (WASM, single thread), so the R3F
   render loop never blocks.

Files:

* `src/tts/useTts.ts` — zustand store (`engine`, `phase`, `progress`, `speaking`,
  `autoNarrate`, `rate`, voices, `error`) + `KittenClient` (worker lifecycle, progress
  plumbing, `AudioContext` playback of the returned `Float32Array`).
* `src/tts/kitten.worker.ts` — imports `KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8')`,
  warms the graph with a short sentence, synthesises on demand, messages back
  `{samples, sampleRate}` as a transferable. It wraps `fetch` to report real download
  progress for `.onnx` / `.npz`.
* `src/tts/ort-node-shim.ts` — throwing stub for the `onnxruntime-node` alias.
* `src/ui/VoicePanel.tsx` — engine switch, voice picker, speed slider, progress/error UI.

Operational notes:

* ONNX Runtime WASM is loaded from jsDelivr by default:
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/`. Override with
  `VITE_TTS_WASM_BASE` (e.g. `/ort/`) to self-host and go fully offline.
* Model weights come from the HuggingFace CDN (whatever `kitten-tts-js` fetches), so the
  **first** use of the Kitten voice needs internet; afterwards it is browser-cached.
* `speak()` speaks **one sentence at a time** and resolves on `onended`, which is what
  drives "auto-narrate" pacing.

---

## 5. Verification actually performed

Done:

* `npx tsc -b` → exit 0 (run again after the `CameraRig` refactor; still clean).
* **Label audit across all 19 steps** at a 574 × 398 stage (a deliberately cramped
  aspect): caption count per step 1/2/2/2/3/5/3/3/2/7/9 (GPT) and 1/3/4/3/1/3/9/3 (MoE) —
  66 captions total; **zero label-label overlaps, zero boxes outside the canvas**, and the
  counts match the authored annotations (nothing silently missing).
* Visual: the scene renders and animates (heatmap + mask, logits bars with percentages,
  expert towers, 16-block tower), captions land beside their geometry.
* System voice list enumerates correctly in `VoicePanel` (3 Microsoft English voices).

**Not** verified:

* Kitten model download / worker boot / audio playback — see §7.1. An attempt to switch
  the engine did not visibly change the panel label, so **treat TTS as untested**. The
  system-voice path (`Listen`) has not been exercised either.
* Production build, bundle size, lint.
* Mobile/real-window visual pass beyond the 574–620 px wide captures.

---

## 6. Known rough edges (cosmetic, not blockers)

* **Captions can sit on top of geometry** (they never collide with each other, but the
  placement pass is not occlusion-aware). Two visible cases:
  * GPT step 5 — "Weighted blend of values" lands on the token-chip row at the bottom.
  * MoE step 8 — "12 blocks shown" / "Dense attention" land on the towers.
  Fix by moving the anchor in `src/scenes/annotations.ts`, or by raising `LEAD`/changing
  the preferred side in `AnnotationOverlay.tsx`.
* Some anchors are intentionally off-screen and rely on the clamping path
  (`a-flow`, `a-loop` at GPT steps 10–11).
* `dist/` is stale (15:15, mid-rewrite). Rebuild before comparing anything against it.
* `README.md` still says "32-block tower" and `localhost:5173`; the app says 16 blocks
  and the dev server is on 5174.

---

## 7. Open work, in priority order

### 7.1 TTS end-to-end (highest risk — the only feature never proven to run)

1. Open the Voice panel → pick **Kitten · 15M** → expect `downloading` with a real
   percentage, then `warming`, then `ready` (~25 MB once).
2. `Listen` → audio should play; `speaking` should flip back to `false` on its own.
3. Check the console for worker/CORS/WASM errors, and that nothing 404s from jsDelivr.
4. Then the system-voice path: switch back to System voice, `Listen`, confirm no error
   and that `Auto` narrates step by step.
5. If the engine button appears not to respond, look at `VoicePanel.tsx` — the popover
   may be closing on click before `setEngine` runs. That is the current suspicion.

### 7.2 Build + lint

`npm run build` (also the honest bundle-size check — the pre-rewrite build was 1,493 kB
JS / 429 kB gzip) and `npm run lint`. Fix whatever they report rather than suppressing.

### 7.3 Remove the dev-only hooks

Three blocks guarded by `import.meta.env.DEV` exist purely for the automated audit and
**should be deleted before this is considered finished**:

* `src/three/CameraRig.tsx:97` — `window.__snapCam()` (jumps to a pose instantly). Added
  because a background tab gives no frames, so the glide never progresses.
* `src/three/labels/AnnotationOverlay.tsx:123` — `window.__annoDebug` (visible/box counts).
* `src/three/labels/LabelProjector.tsx:29` — `window.__proj` / `window.__projInfo`.

`placePose()` in `CameraRig.tsx` is shared by the glide and the hook — keep it; only the
hook effect goes.

### 7.4 Docs

* `README.md` — step list, TTS section (two-tier voice, model size, `VITE_TTS_WASM_BASE`),
  "16 blocks", correct dev port, label system bullet.
* `docs/architecture.md` — replace the label section with `LabelProjector` +
  `AnnotationOverlay` + `projection.ts`; add the TTS worker; new file map.
* `docs/algorithms.md` — confirm the attention / routing / top-k maths still matches the
  rewritten narration text.

---

## 8. Environment gotchas (cost us real time — read these)

1. **The preview tab is usually in a hidden/minimised window.** When hidden there are no
   `requestAnimationFrame` ticks, R3F never configures (`canvas` stays 300 × 150,
   `data-engine` null, nothing projects), and `preview_screenshot` fails with "has not
   been drawn yet". Workaround that works: `preview_recording_start` (flips
   `document.hidden` to `false`, frames flow) and then `preview_resize` to force a resize
   so the scene mounts. Stop the recording when done; it is capped at 5 minutes.
2. **Screenshots crop** to roughly 612 px wide when the panel is narrower than the
   viewport. Resize to ~620 px wide to get the full mobile layout in one capture; wider
   viewports produce a left-hand crop. Do **not** fix this with CSS `zoom`/`transform`.
3. **Windows + CRLF:** `write_file` / `str_replace` / `apply_patch` can fail on
   pre-existing CRLF files. Workaround: `apply_patch delete_file` then `write_file`, or
   only edit files already written by the agent (LF).
4. **Kill servers by PID**, never by name pattern — the agent's own command line contains
   the same words.
5. The repo has **no remote** and uses a placeholder identity, set repo-locally:
   `kazir <kazir@localhost>`. Run `git config user.email <you@example.com>` before
   pushing anywhere. `.gitattributes` pins `eol=lf` (with `*.bat` as CRLF), which is
   why new files stay LF even though the machine's `core.autocrlf` is `true` — that is
   what keeps the `write_file` / `str_replace` CRLF failures from coming back.

---

## 9. Resume recipe (audit helpers)

The helpers below lived in the page and are lost on reload. Paste this in
`preview_evaluate` after the scene is live (see gotcha 1):

```js
window.__m = () => {
  const s = document.querySelector('.stage-canvas').getBoundingClientRect();
  const list = [...document.querySelectorAll('.anno')].map(e => {
    const r = e.getBoundingClientRect();
    return {t:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,20),
            x:Math.round(r.left-s.left), y:Math.round(r.top-s.top),
            w:Math.round(r.width), h:Math.round(r.height),
            op:+getComputedStyle(e).opacity};
  }).filter(a => a.op > 0.4);
  const ov = [];
  for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++) {
    const a=list[i], b=list[j];
    if (Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x) > 1 &&
        Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y) > 1) ov.push(a.t+'|'+b.t);
  }
  const out = list.filter(a => a.x<-1||a.y<-1||a.x+a.w>s.width+1||a.y+a.h>s.height+1).map(a=>a.t);
  return {hdr:(document.body.innerText.match(/Step \d+ of \d+/)||[])[0],
          W:Math.round(s.width), H:Math.round(s.height), n:list.length, ov, out,
          boxes:list.map(a=>[a.t,a.x,a.y])};
};
window.__audit3 = async (n) => {
  const res = [];
  for (let i=0;i<n;i++) {
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    await new Promise(r=>setTimeout(r,160));
    window.__snapCam && window.__snapCam();          // needs the DEV hook from §7.3
    await new Promise(r=>setTimeout(r,420));
    res.push(window.__m());
  }
  return res;
};
```

Steps change with `ArrowRight`/`ArrowLeft` keydowns (`bubbles: true`); the footer text
`Step N of M` identifies the index. `preview_evaluate` has a ~10 s budget, so audit in
batches of 4–5 steps.

**Reminder:** once §7.3 lands, `__snapCam` disappears — then the audit needs a visible
window (gotcha 1) and a settle wait of ≥ 1.5 s per step instead.
