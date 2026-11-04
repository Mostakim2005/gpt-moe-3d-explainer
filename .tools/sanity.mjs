/**
 * Sanity check for the occlusion metric.
 *
 * The metric is only meaningful if its output actually tracks geometry, so this
 * renders a step with captions on and off and compares:
 *
 *   - the ring around each caption box      (should be busier with captions off,
 *                                            since the caption itself hides what
 *                                            is under it — no, the ring is outside
 *                                            the box, so it should be similar)
 *   - the whole stage                       (must differ, proving captions draw)
 *   - a synthetic empty corner              (must be much darker: the baseline)
 *
 * If the empty corner is not the darkest, the pixel path is misaligned.
 */
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.APP_URL || 'http://localhost:5174/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stats(png, x0, y0, x1, y1) {
  let n = 0, lum = 0, sat = 0;
  for (let y = Math.max(0, y0); y < Math.min(png.height, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(png.width, x1); x++) {
      const i = (y * png.width + x) << 2;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sat += Math.max(r, g, b) - Math.min(r, g, b);
      n++;
    }
  return n ? { lum: +(lum / n).toFixed(1), sat: +(sat / n).toFixed(1) } : { lum: 0, sat: 0 };
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
  protocolTimeout: 120000,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.stage-canvas canvas', { timeout: 30000 });
  await page.bringToFront();
  await sleep(2500);

  // MoE step 4: one caption, a merge box, and converging arcs.
  await page.evaluate(() => [...document.querySelectorAll('.tab')][1]?.click());
  await sleep(800);
  await page.evaluate(() => [...document.querySelectorAll('.step-item')][4]?.click());
  await sleep(2000);

  const box = await page.evaluate(() => {
    const s = document.querySelector('.stage-canvas').getBoundingClientRect();
    const el = document.querySelector('.anno');
    const r = el.getBoundingClientRect();
    return {
      stage: { x: s.left, y: s.top, w: s.width, h: s.height },
      box: { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height },
      text: el.textContent.trim().slice(0, 30),
    };
  });

  const pngWith = PNG.sync.read(Buffer.from(await page.screenshot({ encoding: 'binary' })));

  const ring = (png, b, pad) => {
    // ring = padded rect minus the box itself, approximated by 4 thin strips
    const X = Math.round(box.stage.x + b.x);
    const Y = Math.round(box.stage.y + b.y);
    const W = Math.round(b.w);
    const H = Math.round(b.h);
    const strips = [
      stats(png, X - pad, Y - pad, X + W + pad, Y),
      stats(png, X - pad, Y + H, X + W + pad, Y + H + pad),
      stats(png, X - pad, Y, X, Y + H),
      stats(png, X + W, Y, X + W + pad, Y + H),
    ];
    return {
      lum: +(strips.reduce((a, s) => a + s.lum, 0) / 4).toFixed(1),
      sat: +(strips.reduce((a, s) => a + s.sat, 0) / 4).toFixed(1),
    };
  };

  const captionRing = ring(pngWith, box.box, 7);
  const captionInterior = stats(
    pngWith,
    Math.round(box.stage.x + box.box.x),
    Math.round(box.stage.y + box.box.y),
    Math.round(box.stage.x + box.box.x + box.box.w),
    Math.round(box.stage.y + box.box.y + box.box.h),
  );
  // A corner with nothing in it: the metric's floor.
  const emptyCorner = stats(
    pngWith,
    Math.round(box.stage.x + 4),
    Math.round(box.stage.y + 4),
    Math.round(box.stage.x + 60),
    Math.round(box.stage.y + 60),
  );

  // Now switch captions off and measure the same screen areas.
  await page.evaluate(() => [...document.querySelectorAll('.toggle')][1]?.click());
  await sleep(1400);
  const pngWithout = PNG.sync.read(Buffer.from(await page.screenshot({ encoding: 'binary' })));
  const bareRegion = ring(pngWithout, box.box, 7);
  const bareInterior = stats(
    pngWithout,
    Math.round(box.stage.x + box.box.x),
    Math.round(box.stage.y + box.box.y),
    Math.round(box.stage.x + box.box.x + box.box.w),
    Math.round(box.stage.y + box.box.y + box.box.h),
  );

  const present = await page.evaluate(() => document.querySelectorAll('.anno').length);

  console.log(`caption: "${box.text}"  at ${Math.round(box.box.x)},${Math.round(box.box.y)}`);
  console.log(`  ring around caption        lum=${captionRing.lum} sat=${captionRing.sat}`);
  console.log(`  same ring, labels hidden   lum=${bareRegion.lum} sat=${bareRegion.sat}`);
  console.log(`  caption interior           lum=${captionInterior.lum} (panel, should be dark)`);
  console.log(`  same interior, no caption  lum=${bareInterior.lum} (what it covers)`);
  console.log(`  empty stage corner         lum=${emptyCorner.lum} sat=${emptyCorner.sat}`);
  console.log(`  .anno nodes while hidden: ${present}`);

  const aligned = emptyCorner.lum < captionRing.lum;
  const interiorDiffers = Math.abs(captionInterior.lum - bareInterior.lum) > 3;
  console.log(`\nbaseline-is-darkest:         ${aligned ? 'PASS' : 'FAIL'}`);
  console.log(`caption paints where measured: ${interiorDiffers ? 'PASS' : 'FAIL'}`);
  console.log(
    `occlusion the caption hides:  ${(bareInterior.lum - captionInterior.lum).toFixed(1)} lum ` +
      `(${bareInterior.lum > 30 ? 'sits on geometry' : 'sits on empty space'})`,
  );
} finally {
  await browser.close();
}
