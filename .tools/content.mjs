/**
 * Content integrity check.
 *
 * Walks both chapters in the built app and asserts the invariants that unit
 * tests would normally cover:
 *   - every step renders at least one caption (nothing silently blank)
 *   - every step shows a narration body and at least one key number
 *   - step titles/shorts are unique within a chapter
 *   - nothing renders the literal string "undefined"/"NaN" into the DOM
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
  ],
  protocolTimeout: 240000,
});

const problems = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.stage-canvas canvas', { timeout: 30000 });
  await sleep(2000);

  const chapters = await page.evaluate(() =>
    [...document.querySelectorAll('.tab')].map((t) => t.textContent.trim()),
  );

  const seenTitles = new Map();

  for (let c = 0; c < chapters.length; c++) {
    await page.evaluate((i) => [...document.querySelectorAll('.tab')][i]?.click(), c);
    await sleep(900);

    const shorts = await page.evaluate(() =>
      [...document.querySelectorAll('.step-item')].map((s) => s.textContent.trim()),
    );

    for (let i = 0; i < shorts.length; i++) {
      await page.evaluate((n) => [...document.querySelectorAll('.step-item')][n]?.click(), i);

      // Wait for the click to actually register: the active marker moves
      // immediately, while the heading cross-fades afterwards. Polling the
      // heading for "stability" is useless — the outgoing title is already
      // stable — so gate on the active index first, then let the slide finish.
      let active = -1;
      for (let k = 0; k < 40; k++) {
        await sleep(80);
        active = await page.evaluate(() => {
          const el = document.querySelector('.step-item.active .step-num');
          return el ? Number(el.textContent.trim()) : -1;
        });
        if (active === i + 1) break;
      }
      if (active !== i + 1) problems.push(`step ${i}: click did not take (active=${active})`);
      await sleep(700);

      const s = await page.evaluate(() => ({
        captions: document.querySelectorAll('.anno').length,
        terms: document.querySelectorAll('.terms-block .term').length,
        title: document.querySelector('.narration h2')?.textContent?.trim() ?? '',
        bodyLen: (document.querySelector('.narration-body')?.textContent ?? '').trim().length,
        text: document.querySelector('.narration')?.innerText ?? '',
        header: document.body.innerText.match(/(Step \d+ of \d+|Last step)/)?.[0] ?? '',
      }));

      const where = `${chapters[c]} #${i} "${s.title}"`;

      if (s.captions === 0) problems.push(`${where}: 0 captions rendered`);
      if (s.terms === 0) problems.push(`${where}: 0 terms`);
      if (!s.title) problems.push(`${where}: empty title`);
      if (s.bodyLen < 80) problems.push(`${where}: body too short (${s.bodyLen})`);
      if (!s.header) problems.push(`${where}: no step footer`);

      // The footer must agree with the step actually selected. This is what
      // catches a narration panel left showing the previous step — the failure
      // mode a fixed sleep produced, and the one a duplicate-title check missed.
      const total = shorts.length;
      const expected = i === total - 1 ? 'Last step' : `Step ${i + 1} of ${total}`;
      if (s.header && s.header !== expected) {
        problems.push(`${where}: footer says "${s.header}", expected "${expected}"`);
      }

      for (const bad of ['undefined', 'NaN', '[object Object]', 'null%']) {
        if (s.text.includes(bad)) problems.push(`${where}: renders "${bad}"`);
      }

      const key = `${chapters[c]}::${s.title}`;
      if (seenTitles.has(key)) problems.push(`${where}: duplicate title`);
      seenTitles.set(key, true);

      console.log(
        `${where.padEnd(48)} caps=${String(s.captions).padStart(2)} terms=${s.terms} body=${s.bodyLen}`,
      );
    }

    const dupes = shorts.filter((v, i) => shorts.indexOf(v) !== i);
    if (dupes.length) problems.push(`${chapters[c]}: duplicate step shorts ${dupes.join(', ')}`);
  }
} finally {
  await browser.close();
}

console.log('\n=== RESULT ===');
if (problems.length === 0) console.log('PASS: all steps complete, nothing blank or degenerate');
else problems.forEach((p) => console.log('  FAIL ' + p));
