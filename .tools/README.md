# Verification sandbox

Standalone scripts that drive the running app in a real browser and measure what
it renders. Kept out of the app's dependency tree on purpose — none of this ships.

```bash
npm install          # puppeteer-core + pngjs, ~43 MB
node audit.mjs labels      # caption overlap / out-of-bounds
node audit.mjs contrast    # WCAG AA over every text node
node audit.mjs shots       # PNG per step -> out/
node occlusion.mjs         # caption-on-geometry proxy (saturation)
node sanity.mjs            # proves the occlusion metric isn't vacuous
node tts-speak.mjs         # real neural TTS: buffer + sample rate
node prod.mjs              # same checks against the built bundle on :4173
```

`audit.mjs` takes `--w N --h N` to sweep viewport sizes.

The dev server must be on **:5174** (`npm run dev -- --port 5174`); `prod.mjs`
expects `npm run preview -- --port 4173`.

See [`../docs/verification.md`](../docs/verification.md) for what each number
means and the last recorded results.
