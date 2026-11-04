# Handover — GPT & Mixture of Experts 3D Explainer

Snapshot taken: **4 Nov 2026, ~19:25** (local). This supersedes the 17:20
snapshot, whose entire open-work list is now closed.

Read [`docs/architecture.md`](docs/architecture.md) for how the app is built and
[`docs/verification.md`](docs/verification.md) for what is checked and how.

---

## 1. State

| Area | State |
| --- | --- |
| Content (19 steps: text, numbers, glossary, camera) | Fact-corrected against GPT-2 small; every step has a terms block |
| 3D scenes & animation | Working; verified in the production bundle |
| Caption system | Rewritten placement; **0 overlaps, 0 out-of-bounds at 5 viewport sizes** |
| TTS (system voice) | **Verified** — 3 OS voices, utterance text matches the step |
| TTS (Kitten neural voice) | **Verified working** — was crashing, now speaks 44–48 s buffers at 24 kHz |
| `npx tsc -b` | Clean |
| `npm run lint` (oxlint) | **0 warnings, 0 errors** (was 28 warnings) |
| `npm run build` | Succeeds |
| Production bundle | Verified in a browser: no console errors, all 19 steps render |
| Docs | Rewritten to match the code; `architecture.md` byte corruption fixed |
| Dev-only debug hooks | All removed |
| Git | `main`, no remote, clean at `39c5e98` before this session's changes |

Nothing is known broken.

---

## 2. Run it

```bash
npm install
npm run dev      # http://localhost:5173 (see note)
npm run build    # tsc -b && vite build
npm run preview  # serves dist/ on :4173
npm run lint
```

> The dev server may land on **5174** if 5173 is taken. The verification scripts
> hard-code **5174** for dev and **4173** for preview — pass `--port` to match.

`start-server.bat`, `stop-server.bat` and `preview-production.bat` exist at the
repo root for the Windows workflow.

---

## 3. What this session changed

### 3.1 Two real bugs found by the harness

**Kitten TTS never worked.** The UI said "Worker crashed" with nothing in the
console. The cause: `jszip`'s `browser` field points at a UMD bundle with no ESM
default export. The main thread gets a Vite CJS→ESM shim; the TTS worker's
separate module graph did not, so it died at import time. Fixed by adding
`optimizeDeps.include: ['jszip']` to `vite.config.ts`. A second, quieter problem
was that `kitten-tts-js` overwrites `ort.env.wasm.numThreads` with
`navigator.hardwareConcurrency` just before creating its session, producing a
warning and a silent fallback; the worker now pins `hardwareConcurrency` to 1 for
the duration of the load.

**The logits chart was mathematically impossible.** The six probabilities summed
to 1.24. Six values presented as a softmax distribution cannot exceed 1. The
logits were re-chosen; they now sum to 1.000000 at `T = 1`.

### 3.2 Content corrections

`GPT-2 small` is now pinned as the reference model everywhere, so the numbers
agree with each other:

- embedding width `4,096` → **768**
- "positions 0–1023" labelling and block counts corrected to 12
- FFN expansion stated as 768 → 3,072
- BPE described as merging **bytes**, not characters; modern vocab sizes added
- the logits step now says the six bars are renormalised and names the tail

MoE:

- economics rebuilt around `30B shared + k × 13B` on a 134B network, so the `k`
  slider actually drives the bar height and the saving factor
- Mixtral and DeepSeek-V3 figures attributed to those models, not blended in
- load-balancing wording softened where "never" was too strong

### 3.3 Learnability

- Every one of the 19 steps gained a **terms block**: 2–3 terms with one-line
  meanings, rendered under the narration. Nobody has to leave the page to look up
  "KV cache" or "aux loss".
- Caption placement was rewritten to be **anchor-aware**: candidate positions are
  scored by clearance from every other anchor on the step, not just from other
  captions, so a caption stops landing on the geometry it describes. Worst-case
  ring saturation went from 99.9 to 52.4.
- An optional `place` hint lets an annotation express intent when it is the only
  caption on screen.
- The causal mask is now **drawn** (flat dark cells above the diagonal) instead of
  only asserted in prose.

### 3.4 Cleanup

- 28 lint warnings → **0**, by real refactors: scene data moved to
  `scenes/gptData.ts` and `scenes/moeData.ts` (which also makes those components
  hot-updatable), refs written in effects instead of during render, and one
  documented `oxlint-disable` for the legitimate R3F pattern of mutating
  `camera.position` in `useFrame`.
- All three `import.meta.env.DEV` debug hooks removed (`__snapCam`, `__proj`,
  `__annoDebug`).
- `Stage.tsx` dust now uses a seeded PRNG, so the scene is genuinely pure and
  remounts don't reshuffle.
- `docs/architecture.md` contained a stray Windows-1252 `0x97` byte that made the
  file unreadable as UTF-8. Replaced with an em dash.

---

## 4. Verification harness

`.tools/` is a self-contained sandbox (own `package.json`, puppeteer-core +
pngjs). Dependencies and generated screenshots are gitignored; the scripts are
tracked.

```bash
cd .tools
node audit.mjs labels      # overlap + out-of-bounds (accepts --w/--h)
node audit.mjs contrast    # WCAG AA over every text node
node occlusion.mjs         # caption-on-geometry proxy
node sanity.mjs            # proves that proxy isn't vacuous
node tts-speak.mjs         # real neural TTS → buffer + sample rate
node prod.mjs              # all of the above against dist/ on :4173
```

See [`docs/verification.md`](docs/verification.md) for what each number means.

---

## 5. Known rough edges

- **Neural TTS needs the network on first use.** The model comes from the
  HuggingFace CDN (~25 MB); afterwards the browser caches it. Self-host and set
  `VITE_TTS_WASM_BASE` to go fully offline.
- **Single-threaded WASM.** Multi-threaded ONNX Runtime needs
  `crossOriginIsolated`, which needs COOP/COEP headers, and COEP would block the
  model download itself. This is a deliberate trade, documented in the worker.
- **The bundle is large**: ~1.4 MB main JS (394 kB gzip) plus a 1.5 MB worker chunk
  and 14.8 MB of ONNX WASM. The worker chunk and WASM load only when the user
  picks the neural voice. Code-splitting the main chunk is the obvious next win.
- **`fs` / `path` / `os` externalisation warnings** appear during `npm run build`.
  They come from `kitten-tts-js`'s Node code paths, which the browser never
  executes. Verified harmless by running the production bundle end to end.
- **Cross-browser is untested.** Everything was verified in Edge with SwiftShader.
- Two annotations sit slightly off-screen by design and rely on the clamping path
  (`a-flow`, `a-loop` on GPT steps 10–11).

---

## 6. Environment gotchas

1. **The Vite file watcher locks source files on Windows.** Bulk edits then fail
   with `ReplaceFileW EIO (Win32 32/1175)`. Stop the listener on the dev port
   first:
   ```powershell
   Get-NetTCPConnection -LocalPort 5174 -State Listen |
     Select-Object -ExpandProperty OwningProcess -Unique |
     ForEach-Object { Stop-Process -Id $_ -Force }
   ```
2. **PowerShell here rejects `||`.** Use `if/else` or `;`.
3. **Kill servers by PID, never by name** — the agent's own command line contains
   the same words.
4. **Git identity is repo-local** (`kazir <kazir@localhost>`) and there is no
   remote. `.gitattributes` pins `eol=lf` except `*.bat`.
5. **Headless screenshots need SwiftShader**:
   `--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`. Without
   them R3F never configures and the canvas stays 300 × 150.

---

## 7. If you continue

The obvious next steps, none of them blocking:

1. **Code-split the main bundle.** 1.4 MB is the largest remaining performance
   item, and the three.js half is the obvious split point.
2. **Add a test for the content invariants.** The `terms`/`annotations`/step-range
   relationship is currently only checked by the browser harness. A small unit
   test asserting every annotation's `[from, to)` falls inside some step, and that
   every `active[]` id exists in the scene, would catch authoring mistakes at
   commit time instead of at audit time.
3. **Cross-browser pass.** Firefox and Safari have not been exercised; Safari's
   WebAudio and `speechSynthesis` behave differently enough to be worth a look.
4. **Offline mode.** Self-host the ONNX model and WASM, then the app is fully
   local.

---

## 8. Definition of done — all met

- [x] Both voice engines verified working, no console errors
- [x] `npm run build` succeeds, `npm run lint` clean
- [x] No debug hooks in `src/`
- [x] README and both docs pages describe the code as it is
- [x] Captions verified across five viewport sizes
- [x] Contrast verified against WCAG AA
- [x] Every step measured, none blank
