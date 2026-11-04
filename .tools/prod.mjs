/**
 * Verify the PRODUCTION bundle, not the dev server.
 *
 * The dev server resolves modules differently from the built bundle, so the
 * `fs`/`path`/`os` externalisation warnings seen at build time can only be
 * proven harmless by exercising the built output. This drives :4173 and checks
 * the same three things: the scene renders, captions are placed, and the neural
 * voice worker loads and produces audio.
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL_BASE = 'http://localhost:4173/';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ],
  protocolTimeout: 300000,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message.slice(0, 250)}`));
  page.on('requestfailed', (r) =>
    errors.push(`[reqfail] ${r.url().slice(0, 120)} :: ${r.failure()?.errorText}`),
  );

  await page.evaluateOnNewDocument(() => {
    window.__audio = { started: 0, durations: [] };
    const orig = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function patched() {
      const node = orig.call(this);
      const start = node.start.bind(node);
      node.start = (...a) => {
        window.__audio.started++;
        if (node.buffer) window.__audio.durations.push(+node.buffer.duration.toFixed(2));
        return start(...a);
      };
      return node;
    };
  });

  await page.goto(URL_BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.stage-canvas canvas', { timeout: 30000 });
  await sleep(2500);

  const boot = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector('.stage-canvas canvas')),
    chapters: document.querySelectorAll('.tab').length,
    steps: document.querySelectorAll('.step-item').length,
    captions: document.querySelectorAll('.anno').length,
    terms: document.querySelectorAll('.terms-block').length,
    title: document.title,
  }));
  console.log('boot:', JSON.stringify(boot));

  // Walk every step and confirm something renders each time.
  const walk = [];
  for (let i = 0; i < boot.steps; i++) {
    await page.evaluate((n) => [...document.querySelectorAll('.step-item')][n]?.click(), i);
    await sleep(420);
    const s = await page.evaluate(() => ({
      captions: document.querySelectorAll('.anno').length,
      terms: document.querySelectorAll('.terms-block .term').length,
      heading: document.querySelector('.narration h2')?.textContent?.trim() ?? '',
    }));
    walk.push(s);
  }
  const empty = walk.filter((s) => s.captions === 0).length;
  const noTerms = walk.filter((s) => s.terms === 0).length;
  console.log(`steps walked: ${walk.length}, with 0 captions: ${empty}, with 0 terms: ${noTerms}`);

  // Second chapter.
  await page.evaluate(() => [...document.querySelectorAll('.tab')][1]?.click());
  await sleep(900);
  const moeSteps = await page.evaluate(() => document.querySelectorAll('.step-item').length);
  const moeCaps = await page.evaluate(() => document.querySelectorAll('.anno').length);
  console.log(`moe chapter: ${moeSteps} steps, ${moeCaps} captions rendered`);

  // Neural voice in the production bundle.
  await page.evaluate(() => document.querySelector('.voice-gear')?.click());
  await sleep(500);
  await page.evaluate(() => {
    [...document.querySelectorAll('.voice-body .seg-btn')]
      .find((x) => x.textContent.includes('Kitten'))
      ?.click();
  });

  let ready = false;
  let lastProgress = '';
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const st = await page.evaluate(() => ({
      prog: document.querySelector('.voice-progress')?.textContent?.trim() ?? null,
      err: document.querySelector('.voice-error')?.textContent?.trim() ?? null,
    }));
    if (st.prog) lastProgress = st.prog;
    if (st.err) {
      console.log('TTS error:', st.err);
      break;
    }
    if (!st.prog) {
      ready = true;
      break;
    }
  }
  console.log('neural voice ready:', ready, lastProgress ? `(last: ${lastProgress})` : '');

  if (ready) {
    await page.evaluate(() => document.querySelector('.voice-play')?.click());
    let spoken = null;
    for (let i = 0; i < 40; i++) {
      await sleep(2000);
      spoken = await page.evaluate(() => window.__audio);
      if (spoken.started > 0) break;
    }
    console.log('audio buffers:', spoken.started, 'durations:', spoken.durations.join(', ') || '(none)');
  }

  const real = errors.filter((e) => !/Download the React DevTools/.test(e));
  console.log('--- console errors/warnings ---');
  console.log(real.length ? real.slice(0, 10).join('\n') : '  (none)');
} finally {
  await browser.close();
}
