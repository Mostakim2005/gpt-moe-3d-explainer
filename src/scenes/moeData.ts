/**
 * Data and pure helpers for the MoE scene.
 *
 * Kept out of `MoeScene.tsx` so Fast Refresh can hot-update the component:
 * a module that exports both components and constants is always invalidated as
 * a whole, which reloads the page and loses the current step.
 */

import { C } from '../three/shared/constants';

export const EXPERT_COUNT = 8;

export const EXPERT_COLORS = [
  C.cyan,
  C.violet,
  C.amber,
  C.pink,
  C.green,
  C.cyan,
  C.violet,
  C.amber,
];

/** Raw router scores for this token (illustrative, sorted descending). */
export const ROUTER_SCORES = [0.52, 0.38, 0.27, 0.19, 0.12, 0.09, 0.05, 0.03];

/** Layout constants shared with the annotation layer. */
export const GRID_LAYOUT = {
  cols: 4,
  x0: -3.3,
  xStep: 2.2,
  y0: 2.9,
  yStep: 1.8,
  cell: [1.8, 1.2, 1.0] as [number, number, number],
};

export const SCORE_LAYOUT = {
  x: 1.4,
  y: 0.2,
  spacing: 0.74,
  maxHeight: 2.0,
};

export const HIST_LAYOUT = {
  spacing: 1.1,
  height: 2.3,
  baseY: 0.2,
};

export function expertPos(i: number): [number, number, number] {
  const col = i % GRID_LAYOUT.cols;
  const row = Math.floor(i / GRID_LAYOUT.cols);
  return [GRID_LAYOUT.x0 + col * GRID_LAYOUT.xStep, GRID_LAYOUT.y0 - row * GRID_LAYOUT.yStep, 0];
}

export function topKOf(scores: number[], k: number) {
  return [...scores.keys()].sort((a, b) => scores[b] - scores[a]).slice(0, k);
}

/** Renormalised gate weights: zero for dropped experts, sums to 1 over the rest. */
export function gateWeights(scores: number[], active: number[]) {
  const total = active.reduce((a, i) => a + scores[i], 0);
  return scores.map((s, i) => (active.includes(i) ? s / total : 0));
}

export const HIST_COLLAPSED = [0.62, 0.11, 0.09, 0.06, 0.05, 0.03, 0.02, 0.02];
export const HIST_BALANCED = [0.16, 0.14, 0.13, 0.12, 0.13, 0.11, 0.11, 0.1];

/** Total parameters behind the (illustrative, 8-expert) example network. */
export const TOTAL_PARAMS_B = 134;
/**
 * Parameters that are live for *any* given token even when no expert runs —
 * embeddings, attention, the router, LayerNorms. This is why k = 0 is not free.
 */
export const SHARED_PARAMS_B = 30;
/** Parameters in one expert, i.e. one dense FFN. */
export const EXPERT_PARAMS_B = 13;

/** Compute actually spent on one token, in billions of parameters. */
export function activeParamsB(k: number): number {
  return SHARED_PARAMS_B + k * EXPERT_PARAMS_B;
}

/**
 * Projects `value` below `total` through `cbrt`, so shrinking it to a quarter
 * reads as "4× less" even though the height only drops by 1.59×. Without this
 * the shared parameters — a fifth of the total — would be 1 px tall.
 */
export function capacityScale(value: number, total: number): number {
  return (value / total) ** (1 / 3);
}

export const ECON_LAYOUT = {
  totalX: -3.6,
  activeX: 0,
  denseX: 3.6,
  baseY: 0,
  /** Height of the full-capacity bar. */
  fullH: 3.4,
  width: 1.6,
};
