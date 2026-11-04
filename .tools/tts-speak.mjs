/**
 * End-to-end neural TTS check.
 *
 * Clicks Listen, waits for the model to finish warming, and then reads the
 * AudioContext state plus the number of samples the worker produced. This is as
 * close to "it speaks" as a headless browser gets: real model, real inference,
 * real audio buffer numbers — just no speaker to hear it.
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 180)}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 220)}`));

  // Record every AudioBufferSourceNode the app starts.
  await page.evaluateOnNewDocument(() => {
    window.__audio = { started: 0, durations: [], ctxState: null };
    const orig = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function patched() {
      const node = orig.call(this);
      const origStart = node.start.bind(node);
      node.start = (...a) => {
        window.__audio.started++;
        if (node.buffer) {
          window.__audio.durations.push(+node.buffer.duration.toFixed(2));
          window.__audio.ctxState = this.state;
          window.__audio.sampleRate = node.buffer.sampleRate;
        }
        return origStart(...a);
      };
      return node;
    };
  });

  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.stage-canvas canvas', { timeout: 30000 });
  await sleep(1200);

  // Select Kitten.
  await page.evaluate(() => document.querySelector('.voice-gear')?.click());
  await sleep(400);
  await page.evaluate(() => {
    [...document.querySelectorAll('.voice-body .seg-btn')]
      .find((x) => x.textContent.includes('Kitten'))
      ?.click();
  });

  // Wait for the download + warm-up to finish (models are cached after run 1).
  let ready = false;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const st = await page.evaluate(() => ({
      prog: document.querySelector('.voice-progress')?.textContent?.trim() ?? null,
      err: document.querySelector('.voice-error')?.textContent?.trim() ?? null,
    }));
    if (st.err) {
      console.log('ERROR shown:', st.err);
      break;
    }
    if (!st.prog) {
      ready = true;
      break;
    }
  }
  console.log('model ready:', ready);

  // Now ask it to speak and watch for a real audio buffer.
  await page.evaluate(() => document.querySelector('.voice-play')?.click());

  let spoken = null;
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    spoken = await page.evaluate(() => window.__audio);
    if (spoken.started > 0) break;
    const err = await page.evaluate(
      () => document.querySelector('.voice-error')?.textContent?.trim() ?? null,
    );
    if (err) {
      console.log('speak error:', err);
      break;
    }
  }

  console.log('audio buffers started :', spoken.started);
  console.log('buffer durations (s)  :', spoken.durations.join(', ') || '(none)');
  console.log('buffer sample rate    :', spoken.sampleRate ?? '(n/a)');
  console.log('audio context state   :', spoken.ctxState ?? '(n/a)');

  const errs = logs.filter((l) => /error|warn/i.test(l) && !l.includes('[vite]'));
  if (errs.length) {
    console.log('--- warnings/errors ---');
    errs.slice(0, 8).forEach((l) => console.log(' ', l));
  }
} finally {
  await browser.close();
}
