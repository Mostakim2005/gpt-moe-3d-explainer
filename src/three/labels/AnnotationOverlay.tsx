import { useEffect, useMemo, useRef } from 'react';
import { useSceneStore } from '../../state/useSceneStore';
import { projectedLabels } from './projection';
import type { Annotation, Placement } from './types';

const PAD = 10;
const GAP = 8;
const LEAD = 22;
/** Extra offsets tried on top of LEAD, so a caption can back away from geometry. */
const LEAD_STEPS = [0, 26, 52, 78, 104, 130];

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
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

/** Shortest distance from a box to a point (0 when the point is inside). */
function boxPointDistance(box: Box, p: Point): number {
  const dx = Math.max(box.x - p.x, 0, p.x - (box.x + box.w));
  const dy = Math.max(box.y - p.y, 0, p.y - (box.y + box.h));
  return Math.hypot(dx, dy);
}

/**
 * Picks a screen position for one caption.
 */
function placeOne(
  id: string,
  ax: number,
  ay: number,
  w: number,
  h: number,
  placed: Box[],
  anchors: Point[],
  W: number,
  H: number,
  preferred: Placement,
): Box {
  const maxX = Math.max(PAD, W - w - PAD);
  const maxY = Math.max(PAD, H - h - PAD);

  const build = (cx: number, cy: number): Box => ({
    id,
    x: clamp(cx, PAD, maxX),
    y: clamp(cy, PAD, maxY),
    w,
    h,
  });

  const order: Placement[] = [preferred, 'above', 'below', 'right', 'left'];
  const sides = order.filter((s, i) => order.indexOf(s) === i);

  const place = (side: Placement, off: number, far: number): Array<[number, number]> => {
    switch (side) {
      case 'above':
        return [
          [ax - w / 2, ay - h - off],
          [ax + far, ay - h - far],
          [ax - w - far, ay - h - far],
        ];
      case 'below':
        return [
          [ax - w / 2, ay + off],
          [ax + far, ay + far],
          [ax - w - far, ay + far],
        ];
      case 'right':
        return [
          [ax + off, ay - h / 2],
          [ax + far, ay - h - far],
          [ax + far, ay + far],
        ];
      case 'left':
        return [
          [ax - w - off, ay - h / 2],
          [ax - w - far, ay - h - far],
          [ax - w - far, ay + far],
        ];
    }
  };

  let best: Box | null = null;
  let bestScore = -Infinity;

  for (const side of sides) {
    for (const d of LEAD_STEPS) {
      const off = LEAD + d;
      const far = LEAD * 0.7 + d * 0.7;
      for (const [cx, cy] of place(side, off, far)) {
        const box = build(cx, cy);
        if (placed.some((p) => overlaps(box, p))) continue;

        let clearance = Infinity;
        for (const a of anchors) {
          if (Math.abs(a.x - ax) < 0.5 && Math.abs(a.y - ay) < 0.5) continue;
          clearance = Math.min(clearance, boxPointDistance(box, a));
        }
        if (clearance === Infinity) clearance = 999;

        const score = clearance - d * 0.12 - (side === preferred ? 0 : 40);
        if (score > bestScore) {
          bestScore = score;
          best = box;
        }
      }
    }
  }

  if (best) return best;

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
 * Separates DOM measurement (read pass) from style updates (write pass) to
 * avoid per-caption forced synchronous reflows, and pauses in background tabs.
 */
export function AnnotationOverlay({ items }: { items: Annotation[] }) {
  const step = useSceneStore((s) => s.step);
  const labelsOn = useSceneStore((s) => s.labels);

  const visible = useMemo(
    () => items.filter((a) => step >= a.from && step < a.to),
    [items, step],
  );

  const visibleById = useMemo(
    () => new Map(visible.map((a) => [a.id, a])),
    [visible],
  );

  const hostRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef(new Map<string, HTMLDivElement>());
  const lineRefs = useRef(new Map<string, SVGLineElement>());
  const dotRefs = useRef(new Map<string, SVGCircleElement>());
  const disposed = useRef(false);

  useEffect(() => {
    if (!labelsOn || visible.length === 0) return;
    disposed.current = false;
    let raf = 0;

    const frame = () => {
      if (disposed.current) return;
      if (!document.hidden) {
        raf = requestAnimationFrame(frame);
      }

      const host = hostRef.current;
      if (!host) return;
      const W = host.clientWidth;
      const H = host.clientHeight;
      if (!W || !H) return;

      // Pass 1 (READ): measure all boxes before mutating any DOM styles.
      const entries: Array<{
        id: string;
        el: HTMLDivElement;
        ax: number;
        ay: number;
        w: number;
        h: number;
        on: boolean;
      }> = [];

      for (const a of visible) {
        const el = boxRefs.current.get(a.id);
        const proj = projectedLabels.get(a.id);
        if (!el || !proj) continue;
        entries.push({
          id: a.id,
          el,
          ax: clamp(proj.x, PAD, W - PAD),
          ay: clamp(proj.y, PAD, H - PAD),
          w: el.offsetWidth || 120,
          h: el.offsetHeight || 34,
          on: proj.visible,
        });
      }

      const anchors: Point[] = entries.map((e) => ({ x: e.ax, y: e.ay }));
      entries.sort((p, q) => p.ay - q.ay);

      // Pass 2 (WRITE): compute placement and apply transforms/SVG attributes.
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

        const item = visibleById.get(e.id);
        const box = placeOne(e.id, e.ax, e.ay, e.w, e.h, placed, anchors, W, H, item?.place ?? 'above');
        placed.push(box);

        e.el.style.transform = `translate3d(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px, 0)`;
        e.el.style.opacity = '1';

        const toX =
          e.ax < box.x ? box.x : e.ax > box.x + e.w ? box.x + e.w : clamp(e.ax, box.x, box.x + e.w);
        const toY =
          e.ay < box.y ? box.y : e.ay > box.y + e.h ? box.y + e.h : clamp(e.ay, box.y, box.y + e.h);

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

    const onVisible = () => {
      if (!document.hidden && !disposed.current) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    raf = requestAnimationFrame(frame);
    return () => {
      disposed.current = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [visible, visibleById, labelsOn]);

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
