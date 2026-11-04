/**
 * Occlusion check for floating captions.
 *
 * A caption is drawn over a blurred, near-opaque panel, so "the caption sits on
 * geometry" means a lot of saturated colour is showing *around* it. For every
 * caption box we sample the ring just outside the box and compare its colour
 * energy against the ring around every other box on the same step. Boxes sitting
 * on bright geometry stand out as outliers.
 *
 * Usage: node occlusion.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.APP_URL || 'http://localhost:5174/';
const OUT = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\$/, '');
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(page, ms = 1400) {
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await sleep(ms);
}

/** Mean brightness + colourfulness of pixels in a rect (fraction 0..1 coords). */
function ringStats(png, box, pad) {
  const { x, y, w, h } = box;
  const x0 = Math.max(0, Math.round(x - pad));
  const y0 = Math.max(0, Math.round(y - pad));
  const x1 = Math.min(png.width, Math.round(x + w + pad));
  const y1 = Math.min(png.height, Math.round(y + h + pad));
  const ix0 = Math.round(x);
  const iy0 = Math.round(y);
  const ix1 = Math.round(x + w);
  const iy1 = Math.round(y + h);

  let n = 0, sumL = 0, sumSat = 0;
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      // ring only: outside the caption box itself
      if (px >= ix0 && px < ix1 && py >= iy0 && py < iy1) continue;
      const i = (py * png.width + px) << 2;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      sumL += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumSat += max - min; // crude chroma
      n++;
    }
  }
  if (!n) return { lum: 0, sat: 0 };
  return { lum: sumL / n, sat: sumSat / n };
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'shell',
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--hide-scrollbars',
  ],
  protocolTimeout: 180000,
});

// --chapter gpt --step 4   measures a single step (fast iteration loop)
const av = process.argv.slice(2);
const onlyChapter = av.includes('--chapter') ? av[av.indexOf('--chapter') + 1] : null;
const onlyStep = av.includes('--step') ? Number(av[av.indexOf('--step') + 1]) : null;

const report = {};
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.stage-canvas canvas', { timeout: 30000 });
  await settle(page, 2200);

  const chapterEntries = onlyChapter
    ? [[onlyChapter, onlyChapter === 'gpt' ? 11 : 8]]
    : Object.entries({ gpt: 11, moe: 8 });

  for (const [chapter, count] of chapterEntries) {
    await page.evaluate(
      (id) => [...document.querySelectorAll('.tab')][id === 'gpt' ? 0 : 1]?.click(),
      chapter,
    );
    await sleep(900);
    report[chapter] = [];

    for (let step = 0; step < count; step++) {
      if (onlyStep !== null && step !== onlyStep) continue;
      await page.evaluate(
        (n) => [...document.querySelectorAll('.step-item')][n]?.click(),
        step,
      );
      await settle(page, 1500);

      const geo = await page.evaluate(() => {
        const r = document.querySelector('.stage-canvas').getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });
      const boxes = await page.evaluate(() => {
        const stage = document.querySelector('.stage-canvas').getBoundingClientRect();
        return [...document.querySelectorAll('.anno')]
          .map((el) => {
            const b = el.getBoundingClientRect();
            return {
              t: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
              x: b.left - stage.left,
              y: b.top - stage.top,
              w: b.width,
              h: b.height,
              op: Number(getComputedStyle(el).opacity),
            };
          })
          .filter((b) => b.op > 0.4);
      });
      if (!boxes.length) {
        report[chapter].push({ step, boxes: [] });
        continue;
      }

      const shot = await page.screenshot({ encoding: 'binary' });
      const png = PNG.sync.read(Buffer.from(shot));
      const scale = png.width / 1440; // deviceScaleFactor 1, but be safe

      const scored = boxes.map((b) => {
        const s = ringStats(
          png,
          {
            x: (b.x + geo.left) * scale,
            y: (b.y + geo.top) * scale,
            w: b.w * scale,
            h: b.h * scale,
          },
          7,
        );
        return { ...b, lum: +s.lum.toFixed(1), sat: +s.sat.toFixed(1) };
      });

      report[chapter].push({ step, boxes: scored });
      const worst = scored.slice().sort((a, b) => b.sat - a.sat)[0];
      process.stdout.write(
        `${chapter} ${step}: ${scored.length} boxes, brightest surround "${worst.t}" lum=${worst.lum} sat=${worst.sat}\n`,
      );
    }
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/occlusion.json`, JSON.stringify(report, null, 2));

console.log('\n--- captions whose surroundings are busiest (candidates for sitting on geometry) ---');
const rows = [];
for (const [ch, steps] of Object.entries(report))
  for (const s of steps) for (const b of s.boxes) rows.push({ ch, step: s.step, ...b });
rows.sort((a, b) => b.sat - a.sat);
for (const r of rows.slice(0, 12))
  console.log(
    `  ${r.ch} ${r.step}  sat=${String(r.sat).padStart(5)}  lum=${String(r.lum).padStart(5)}  "${r.t}"`,
  );
