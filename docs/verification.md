# Verification

Every claim in the README is checked by a script in this repo, not by eye. This
page records what is measured, how to re-run it, and what the numbers were on the
last pass.

## What is automated

| Check | How | Command |
|---|---|---|
| Types | TypeScript project build | `npx tsc -b` |
| Lint | oxlint, 116 rules | `npm run lint` |
| Caption overlap / out-of-bounds | headless browser, measures every caption box | `.tools/audit.mjs labels` |
| Text contrast | WCAG AA over every rendered text node | `.tools/audit.mjs contrast` |
| Captions over geometry | pixel busyness in the ring outside each caption | `.tools/occlusion.mjs` |
| Metric sanity | proves the pixel measurement isn't vacuous | `.tools/sanity.mjs` |
| Content completeness | every step has captions, terms, body, footer | `.tools/content.mjs` |
| Voice pipeline | real model load + real audio buffer | `.tools/tts-speak.mjs` |
| Production bundle | all of the above against `dist/` | `.tools/prod.mjs` |

The `.tools/` directory is a self-contained sandbox with its own `package.json`
(puppeteer-core + pngjs). It is deliberately outside the app's dependency tree
and is excluded from lint.

## Why headless-browser checks at all

Captions are DOM elements positioned over a WebGL canvas, so their collisions are
not derivable from source. Overlap, off-screen placement and contrast inversion
are all *rendered* properties. Asserting them requires a real layout engine, which
is what the harness provides.

## The three caption checks

**`labels`** reads back every caption's bounding box after layout settles and
reports pairwise intersections and anything outside the stage rect. This is a
hard pass/fail: overlapping captions are unreadable.

**`occlusion`** cannot be measured directly — you cannot ask a DOM node "what is
behind you". Instead it measures the *ring* of pixels just outside each caption
box and reports mean luminance and saturation there. High saturation in the ring
means the caption is sitting on top of colourful geometry, which is the condition
that makes text hard to read. It is a proxy, and it is only useful because of the
next check.

**`sanity`** validates that proxy. It verifies three things: the empty stage
corner really is the darkest region measured (so the metric isn't reporting a
constant), the caption's own interior really is brighter than the background (so
the measurement is reading the thing it claims to read), and it quantifies how
much luminance the caption actually hides. Without this, a broken measurement
would silently report "all clear" — which is exactly what an early version did.

## Last recorded results

| Check | Result |
|---|---|
| `tsc -b` | clean |
| `oxlint` | 0 warnings, 0 errors (116 rules, 40 files) |
| `labels` @ 1920 / 1440 / 1280 / 1100 / 980 px | 19/19 steps, **0 overlaps, 0 out-of-bounds** |
| `contrast` | 0 failures; 47–54 text nodes measured per step |
| `occlusion` worst step | saturation 52.3 on `gpt 9` (was 99.9 before caption placement was rewritten) |
| `sanity` | baseline-is-darkest PASS, caption-paints PASS |
| `content` | 19/19 steps: captions ≥ 1, terms ≥ 2, body ≥ 192 chars, no `undefined`/`NaN` |
| `prod` (built bundle on :4173) | all steps render, **no console errors**, neural voice produced 44.3 s of audio |
| TTS (system voice) | 3 OS voices; utterance queued and text matches the step |
| TTS (Kitten) | model downloaded, warmed, produced **44–48 s of 24 kHz audio** |

## Two bugs the harness caught that review did not

**The logits chart was mathematically impossible.** The six probabilities summed
to 1.24. Six values that are supposed to be a softmax distribution cannot exceed
1, so either the logits or the display was wrong. They were rewritten and now sum
to 1.000000 at `T = 1`.

**The Kitten voice worker never started.** The UI reported "Worker crashed" with
nothing in the console. Isolating the worker showed `jszip`'s `browser` field
points at a UMD bundle with no ESM default export. The main thread got a Vite
CJS→ESM shim; the worker's separate module graph did not, so it died at import
time. Fixed with `optimizeDeps.include: ['jszip']`. This had been shipping broken
because nobody had loaded the page with the neural engine selected.

## Running the harness

```bash
# terminal 1
npm run dev -- --port 5174   # the scripts below expect :5174
npm run preview -- --port 4173   # only for prod.mjs

# terminal 2
cd .tools
node audit.mjs labels
node audit.mjs contrast
node occlusion.mjs
node sanity.mjs
node content.mjs
node tts-speak.mjs
node prod.mjs
```

`audit.mjs` also accepts `--w` / `--h` to sweep viewport sizes, and `shots` to
capture PNGs to `.tools/out/`.

> **Note:** the dev server's file watcher holds handles on source files on
> Windows, which makes some bulk edits fail with `ReplaceFileW EIO`. Stop the
> listener on port 5174 before large refactors, then restart it.

## What is not verified

- **Audio content.** The harness proves a 47.8 s buffer was produced at the right
  sample rate and played through a running `AudioContext`. It cannot judge whether
  the words are intelligible — that needs a human ear.
- **Visual taste.** Geometry, colour balance and camera composition are checked
  only where they can be reduced to numbers (contrast, saturation, overlap). The
  look itself is a design judgement.
- **Cross-browser behaviour.** The harness drives Edge with SwiftShader. Safari
  and Firefox are untested.
