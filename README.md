# GPT & Mixture of Experts — Interactive 3D Explainer

A dark-themed 3D web app that teaches how a GPT works and how Mixture of Experts
works, one narrated step at a time. Nineteen scripted steps, a camera that glides
between them, and live controls you can drag to see the maths change.

## Chapters

**How GPT works** — 11 steps
`Text in` → `Tokenization` → `Embeddings` → `Position encoding` → `Self-attention`
→ `Multi-head` → `Feed-forward` → `Residual + LayerNorm` → `Stacking blocks`
→ `Logits → softmax` → `Sampling + the loop`

**Mixture of Experts** — 8 steps
`Dense baseline` → `The router` → `Top-k gating` → `The experts` → `Weighted merge`
→ `The economics` → `Load balancing` → `Where it lives`

Every step carries the same five blocks of copy, so you always know where you are:
what is happening, what you are looking at in the scene, why it matters, the
jargon it just introduced (defined in place), and one number worth remembering.

## The one model the numbers belong to

The GPT chapter stays on **GPT-2 small** throughout, so the figures are mutually
consistent rather than a pick-and-mix from different papers:

| | GPT-2 small |
|---|---|
| Vector width (`d_model`) | 768 |
| Attention heads | 12 |
| Blocks | 12 |
| FFN inner width | 3,072 (4×) |
| Context window | 1,024 tokens |
| Vocabulary | 50,257 tokens |

The Mixtral and DeepSeek-V3 figures quoted in the MoE chapter are labelled as
such and are not mixed into the worked example, which uses a clearly illustrative
8-expert / 134B network so that k can actually be varied on screen.

The scene draws **6 tokens, 4 heads, 8 experts and 16 blocks** — small enough to
fit in a viewport and to count by eye. Where a drawn number differs from the real
model, the narration says so.

## Run it

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build -> dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```

## Controls

| Input | Action |
|---|---|
| `←` `→` | previous / next step |
| `Space` | play / pause the step sequence |
| `X` | X-ray — dissolve outer shells to reveal the vectors inside |
| `L` | labels on / off |
| `N` | narrate this step aloud |
| `Esc` | clear the current selection |
| Drag | orbit |
| Scroll | zoom |
| Click a slab | select it (press again to deselect) |

Live knobs appear on the step where they matter:

- **Temperature** (sampling step) — drag it and the probability bars renormalise
  before your eyes. The percentages are computed, not hard-coded.
- **Top-k** (gating / experts / economics) — changes how many experts light up,
  and the economics bar re-renders at `30B + k × 13B` of active compute.
- **Load balancing** (load-balancing step) — toggles between a flat histogram and
  a collapsed one where a single expert takes 62% of tokens.

## Narration

Two engines, switchable under **Voice**:

- **System voice** — the operating system's speech synthesis. Instant, nothing to
  download, but the voice depends on the machine.
- **Kitten TTS Nano** — a 15M-parameter neural model (8 English voices, ~25 MB
  ONNX) running locally in a Web Worker via ONNX Runtime Web. Downloads once and
  is cached by the browser; the progress bar reports real bytes.

`Auto` reads each step as it becomes active, and autoplay holds while the narrator
is still speaking so steps are never cut off mid-sentence.

> The neural path needs network access on first use (the model comes from the
> HuggingFace CDN) and requires WebAssembly. It runs single-threaded on purpose —
> multi-threaded WASM needs `crossOriginIsolated`, which would require COOP/COEP
> headers, and COEP would block the model download itself.

## Layout

Three columns: the step rail, the 3D stage with its timeline, and the narration
panel. Below 900 px wide the columns stack, the rail becomes a horizontal strip,
and the narration moves under the stage. Captions are re-placed every frame and
are verified overlap-free from 980 px to 1920 px wide.

## Docs

- [`docs/architecture.md`](docs/architecture.md) — how the app is put together,
  the step-range + damping model, and why each dependency is there.
- [`docs/algorithms.md`](docs/algorithms.md) — the maths behind each visualised
  step, with flowcharts and formulas.
- [`docs/verification.md`](docs/verification.md) — what is checked automatically
  and how to re-run it.

## Scope

All numbers are illustrative. There is no tokenizer, no real weights and no
inference — the goal is a correct mental model, not a runnable LLM.
