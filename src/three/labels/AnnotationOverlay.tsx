import { useEffect, useMemo, useRef } from 'react';
import { useSceneStore } from '../../state/useSceneStore';
import { projectedLabels } from './projection';
import type { Annotation } from './types';

const PAD = 10;
const GAP = 8;
const LEAD = 20;

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + b.w + GAP &&
    a.x + a.w + GAP > b.x &&
    a.y < b.y + b.h + GAP &&
    a.y + a.h + GAP > b.y
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Picks a screen position for one caption given the ones already placed.
 * Tries above → below → right → left → corner, then slides until free.
 */
function placeOne(
  id: string,
  ax: number,
  ay: number,
  w: number,
  h: number,
  placed: Box[],
  W: number,
  H: number,
): Box {
  const maxX = Math.max(PAD, W - w - PAD);
  const maxY = Math.max(PAD, H - h - PAD);
  const candidates: Array<[number, number]> = [
    [ax - w / 2, ay - h - LEAD],
    [ax - w / 2, ay + LEAD],
    [ax + LEAD, ay - h / 2],
    [ax - w - LEAD, ay - h / 2],
    [ax + LEAD * 0.6, ay - h - LEAD * 0.6],
    [ax + LEAD * 0.6, ay + LEAD * 0.6],
  ];

  for (const [cx, cy] of candidates) {
    const box: Box = {
      id,
      x: clamp(cx, PAD, maxX),
      y: clamp(cy, PAD, maxY),
      w,
      h,
    };
    if (!placed.some((p) => overlaps(box, p))) return box;
  }

  // Everything is crowded: start from the preferred slot and slide down,
  // then up, until a free line is found. Bounded so we never spin.
  const startX = clamp(ax - w / 2, PAD, maxX);
  const startY = clamp(ay - h - LEAD, PAD, maxY);
  for (let d = 0; d <= H; d += 6) {
    const down: Box = { id, x: startX, y: clamp(startY + d, PAD, maxY), w, h };
    if (!placed.some((p) => overlaps(down, p))) return down;
    const up: Box = { id, x: startX, y: clamp(startY - d, PAD, maxY), w, h };
    if (!placed.some((p) => overlaps(up, p))) return up;
  }
  return { id, x: startX, y: startY, w, h };
}

/**
 * DOM layer of floating captions, drawn above the WebGL canvas.
 *
 * Every visible caption is positioned against its projected 3D anchor and then
 * pushed away from its neighbours, so labels can never stack on top of each
 * other regardless of camera angle.
 */
export function AnnotationOverlay({ items }: { items: Annotation[] }) {
  const step = useSceneStore((s) => s.step);
  const labelsOn = useSceneStore((s) => s.labels);

  const visible = useMemo(
    () => items.filter((a) => step >= a.from && step < a.to),
    [items, step],
  );

  const hostRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef(new Map<string, HTMLDivElement>());
  const lineRefs = useRef(new Map<string, SVGLineElement>());
  const dotRefs = useRef(new Map<string, SVGCircleElement>());

  useEffect(() => {
    if (!labelsOn || visible.length === 0) return;
    let raf = 0;
    let timer = 0;
    let disposed = false;

    // rAF stops entirely in a background tab. Fall back to a timer so the
    // captions are already placed when the tab comes back to the foreground.
    const schedule = () => {
      if (disposed) return;
      if (document.hidden) timer = window.setTimeout(() => frame(), 120);
      else raf = requestAnimationFrame(() => frame());
    };

    const frame = () => {
      schedule();
      const host = hostRef.current;
      if (!host) return;
      const W = host.clientWidth;
      const H = host.clientHeight;
      if (!W || !H) return;

      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__annoDebug = {
          visible: visible.length,
          boxes: boxRefs.current.size,
          projected: projectedLabels.size,
        };
      }

      const entries: Array<{
        id: string;
        el: HTMLDivElement;
        ax: number;
        ay: number;
        on: boolean;
      }> = [];

      for (const a of visible) {
        const el = boxRefs.current.get(a.id);
        const proj = projectedLabels.get(a.id);
        if (!el || !proj) continue;
        // Clamp slightly-off anchors into the canvas rather than dropping the
        // caption: at narrow aspect ratios the margins are the first to go.
        entries.push({
          id: a.id,
          el,
          ax: clamp(proj.x, PAD, W - PAD),
          ay: clamp(proj.y, PAD, H - PAD),
          on: proj.visible,
        });
      }

      // Upper captions claim space first, which keeps the result stable.
      entries.sort((p, q) => p.ay - q.ay);

      const placed: Box[] = [];
      for (const e of entries) {
        if (!e.on) {
          e.el.style.opacity = '0';
          const line = lineRefs.current.get(e.id);
          if (line) line.style.opacity = '0';
          const dot = dotRefs.current.get(e.id);
          if (dot) dot.style.opacity = '0';
          continue;
        }

        const w = e.el.offsetWidth || 120;
        const h = e.el.offsetHeight || 34;
        const box = placeOne(e.id, e.ax, e.ay, w, h, placed, W, H);
        placed.push(box);

        e.el.style.transform = `translate3d(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px, 0)`;
        e.el.style.opacity = '1';

        // Leader line from the anchor to the nearest edge of the caption.
        const midY = box.y + h / 2;
        const midX = box.x + w / 2;
        const toX =
          e.ax < box.x ? box.x : e.ax > box.x + w ? box.x + w : clamp(e.ax, box.x, box.x + w);
        const toY =
          e.ay < box.y ? box.y : e.ay > box.y + h ? box.y + h : clamp(e.ay, box.y, box.y + h);
        void midX;
        void midY;

        const line = lineRefs.current.get(e.id);
        if (line) {
          line.setAttribute('x1', e.ax.toFixed(1));
          line.setAttribute('y1', e.ay.toFixed(1));
          line.setAttribute('x2', toX.toFixed(1));
          line.setAttribute('y2', toY.toFixed(1));
          line.style.opacity = '0.5';
        }
        const dot = dotRefs.current.get(e.id);
        if (dot) {
          dot.setAttribute('cx', e.ax.toFixed(1));
          dot.setAttribute('cy', e.ay.toFixed(1));
          dot.style.opacity = '0.75';
        }
      }
    };

    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [visible, labelsOn]);

  if (!labelsOn || visible.length === 0) return null;

  return (
    <div className="anno-layer" ref={hostRef} aria-hidden="true">
      <svg className="anno-lines">
        {visible.map((a) => (
          <g key={a.id}>
            <line
              ref={(el) => {
                if (el) lineRefs.current.set(a.id, el);
                else lineRefs.current.delete(a.id);
              }}
              className="anno-line"
            />
            <circle
              ref={(el) => {
                if (el) dotRefs.current.set(a.id, el);
                else dotRefs.current.delete(a.id);
              }}
              className="anno-dot"
              r={2.5}
            />
          </g>
        ))}
      </svg>

      {visible.map((a) => (
        <div
          key={a.id}
          data-anno={a.id}
          ref={(el) => {
            if (el) boxRefs.current.set(a.id, el);
            else boxRefs.current.delete(a.id);
          }}
          className={`anno anno-${a.tone ?? 'cyan'}`}
          style={{ opacity: 0 }}
        >
          <span className="anno-title">{a.title}</span>
          {a.sub && <span className="anno-sub">{a.sub}</span>}
        </div>
      ))}
    </div>
  );
}
