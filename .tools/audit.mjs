/**
 * Headless verification harness for the GPT/MoE explainer.
 *
 * Usage:
 *   node audit.mjs shots              -> screenshots of every step (both chapters)
 *   node audit.mjs labels [--w 1280]  -> overlap / out-of-bounds audit per step
 *   node audit.mjs contrast           -> WCAG contrast audit of DOM text
 *
 * Everything writes into .tools/out/.
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BROWSER_CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);
const EDGE = BROWSER_CANDIDATES.find((p) => existsSync(p)) || BROWSER_CANDIDATES[0];
const BASE = process.env.APP_URL || 'http://localhost:5174/';
const OUT = fileURLToPath(new URL('./out/', import.meta.url)).replace(/\\$/, '');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const mode = args[0] || 'shots';
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'shell',
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader', // software WebGL
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--hide-scrollbars',
      '--mute-audio',
    ],
    protocolTimeout: 180000,
  });
  return browser;
}

async function openPage(browser, { width = 1440, height = 900 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.stage-canvas canvas', { timeout: 30000 });
  return { page, logs };
}

/** Force the scene to render: bring to front + poke WebGL + wait. */
async function settle(page, ms = 1400) {
  await page.bringToFront();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(ms);
}

const STEP_COUNTS = { gpt: 11, moe: 8 };

async function goChapter(page, id) {
  await page.evaluate((chapterId) => {
    const tabs = [...document.querySelectorAll('.tab')];
    const idx = chapterId === 'gpt' ? 0 : 1;
    tabs[idx]?.click();
  }, id);
  await sleep(900);
}

async function goStep(page, i) {
  await page.evaluate((n) => {
    const items = [...document.querySelectorAll('.step-item')];
    items[n]?.click();
  }, i);
  await sleep(600);
}

/** Turns on x-ray / labels / bloom to a known state via the header buttons. */
async function setToggles(page, { xray, labels, bloom }) {
  await page.evaluate(
    (state) => {
      const btns = [...document.querySelectorAll('.toggle')];
      const map = { xray: btns[0], labels: btns[1], bloom: btns[2] };
      for (const [k, wanted] of Object.entries(state)) {
        if (wanted === undefined) continue;
        const b = map[k];
        const on = b.classList.contains('active');
        if (on !== wanted) b.click();
      }
    },
    { xray, labels, bloom },
  );
  await sleep(700);
}

// ---------------------------------------------------------------------------

async function shots(browser) {
  for (const [chapter, count] of Object.entries(STEP_COUNTS)) {
    const { page, logs } = await openPage(browser, { width: 1440, height: 900 });
    await settle(page, 2000);
    await goChapter(page, chapter);
    for (let i = 0; i < count; i++) {
      await goStep(page, i);
      await settle(page, 1500);
      const file = `${OUT}/${chapter}-${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: file });
      process.stdout.write(`shot ${chapter} ${i}\n`);
    }
    writeFileSync(`${OUT}/${chapter}-console.log`, logs.join('\n'));
    await page.close();
  }
}

/** Measures visible caption boxes and reports overlap / out-of-bounds. */
async function labels(browser) {
  const width = flag('w', 1440);
  const height = flag('h', 900);
  const report = {};

  for (const [chapter, count] of Object.entries(STEP_COUNTS)) {
    const { page } = await openPage(browser, { width, height });
    await settle(page, 2000);
    await goChapter(page, chapter);
    report[chapter] = [];
    for (let i = 0; i < count; i++) {
      await goStep(page, i);
      await settle(page, 1300);
      const r = await page.evaluate(() => {
        const stage = document.querySelector('.stage-canvas').getBoundingClientRect();
        const boxes = [...document.querySelectorAll('.anno')]
          .map((el) => {
            const b = el.getBoundingClientRect();
            return {
              t: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32),
              x: Math.round(b.left - stage.left),
              y: Math.round(b.top - stage.top),
              w: Math.round(b.width),
              h: Math.round(b.height),
              op: Number(getComputedStyle(el).opacity),
            };
          })
          .filter((b) => b.op > 0.4);
        const overlaps = [];
        for (let a = 0; a < boxes.length; a++)
          for (let b = a + 1; b < boxes.length; b++) {
            const A = boxes[a], B = boxes[b];
            const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
            const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
            if (ox > 1 && oy > 1) overlaps.push(`${A.t} <> ${B.t} (${ox}x${oy})`);
          }
        const out = boxes
          .filter(
            (b) => b.x < -1 || b.y < -1 || b.x + b.w > stage.width + 1 || b.y + b.h > stage.height + 1,
          )
          .map((b) => `${b.t} @ ${b.x},${b.y} ${b.w}x${b.h}`);
        return { stage: [Math.round(stage.width), Math.round(stage.height)], boxes, overlaps, out };
      });
      report[chapter].push({ step: i, ...r });
      process.stdout.write(
        `${chapter} step ${i}: ${r.boxes.length} captions, ${r.overlaps.length} overlaps, ${r.out.length} oob\n`,
      );
    }
    await page.close();
  }

  writeFileSync(`${OUT}/labels-${width}x${height}.json`, JSON.stringify(report, null, 2));
  let bad = 0;
  for (const [ch, steps] of Object.entries(report))
    for (const s of steps) {
      if (s.overlaps.length || s.out.length) {
        bad++;
        console.log(`\n!! ${ch} step ${s.step} stage=${s.stage}`);
        s.overlaps.forEach((o) => console.log('   overlap:', o));
        s.out.forEach((o) => console.log('   oob    :', o));
      }
    }
  console.log(`\n${bad === 0 ? 'PASS' : 'FAIL'}: ${bad} step(s) with label problems`);
}

/** WCAG contrast audit over every visible text node in the DOM. */
async function contrast(browser) {
  const width = flag('w', 1440);
  const height = flag('h', 900);
  const { page } = await openPage(browser, { width, height });
  await settle(page, 1800);

  const results = [];
  for (const [chapter, count] of Object.entries(STEP_COUNTS)) {
    await goChapter(page, chapter);
    for (let i = 0; i < count; i++) {
    await goStep(page, i);
    await settle(page, 700);
    const r = await page.evaluate(() => {
      const parse = (c) => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      };
      // walk up for the first opaque background
      const bgOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a >= 0.85) return c;
          n = n.parentElement;
        }
        return parse(getComputedStyle(document.body).backgroundColor) || { r: 7, g: 11, b: 22, a: 1 };
      };
      const lin = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      const ratio = (a, b) => {
        const l1 = lum(a), l2 = lum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };
      const out = [];
      let measuredGlobal = 0;
      for (const el of document.querySelectorAll('body *')) {
        if (!el.childNodes.length) continue;
        const own = [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
        );
        if (!own) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.2) continue;
        if (el.closest('canvas')) continue;
        const fg = parse(st.color);
        if (!fg) continue;
        const eff = { r: fg.r * fg.a + 7 * (1 - fg.a), g: fg.g * fg.a + 11 * (1 - fg.a), b: fg.b * fg.a + 22 * (1 - fg.a) };
        const bg = bgOf(el);
        const cr = ratio(eff, bg);
        measuredGlobal++;
        const px = parseFloat(st.fontSize);
        const bold = Number(st.fontWeight) >= 700;
        const large = px >= 24 || (px >= 18.66 && bold);
        const need = large ? 3 : 4.5;
        if (cr < need) {
          out.push({
            text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
            cls: el.className?.toString?.().slice(0, 40) || el.tagName,
            cr: Number(cr.toFixed(2)),
            need,
            px,
          });
        }
      }
      return { issues: out, measured: measuredGlobal };
    });
    if (r.issues.length) results.push({ chapter, step: i, issues: r.issues });
    process.stdout.write(`${chapter} step ${i}: measured ${r.measured} text nodes, ${r.issues.length} below AA\n`);
    }
  }
  writeFileSync(`${OUT}/contrast.json`, JSON.stringify(results, null, 2));
  if (!results.length) console.log('PASS: no contrast failures in the UI layer');
  else {
    // de-duplicate by class + text
    const seen = new Map();
    for (const s of results)
      for (const i of s.issues) {
        const key = `${i.cls}|${i.text}|${i.cr}`;
        if (!seen.has(key)) seen.set(key, { ...i, steps: [s.step] });
        else seen.get(key).steps.push(s.step);
      }
    for (const v of seen.values())
      console.log(`  ${v.cr}:1 (need ${v.need}) ${v.px}px  .${v.cls}  "${v.text}"  steps=${v.steps}`);
    console.log(`\n${seen.size} distinct contrast issue(s)`);
  }
  await page.close();
}

// ---------------------------------------------------------------------------

const browser = await launch();
try {
  if (mode === 'shots') await shots(browser);
  else if (mode === 'labels') await labels(browser);
  else if (mode === 'contrast') await contrast(browser);
  else console.log('unknown mode', mode);
} finally {
  await browser.close();
}
