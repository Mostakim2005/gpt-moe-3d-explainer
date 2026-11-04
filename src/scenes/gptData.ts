/**
 * Data and pure helpers for the GPT scene.
 *
 * These live outside `GptScene.tsx` on purpose. React Fast Refresh can only
 * hot-update a module that exports nothing but components — a file that also
 * exports constants gets invalidated wholesale, so tweaking a logit value used
 * to reload the page and reset the step you were reading. Keeping the numbers
 * here means editing them refreshes just this module.
 */

export interface Token {
  text: string;
  id: number;
}

/** The running example sentence, tokenized the way GPT-2 would. */
export const GPT_TOKENS: Token[] = [
  { text: 'The', id: 464 },
  { text: 'cat', id: 3797 },
  { text: 'sat', id: 3332 },
  { text: 'on', id: 319 },
  { text: 'the', id: 262 },
  { text: 'mat', id: 2603 },
];

/**
 * Illustrative causal attention: row = query token, column = key token.
 *
 * Lower-triangular by construction — every entry above the diagonal is 0, and
 * each row sums to 1. GPT-2 small uses 12 heads of 64 dimensions; six tokens in
 * one head is small enough to read in 3D.
 */
export const ATTENTION = [
  [1.0, 0, 0, 0, 0, 0],
  [0.5, 0.5, 0, 0, 0, 0],
  [0.2, 0.45, 0.35, 0, 0, 0],
  [0.1, 0.3, 0.4, 0.2, 0, 0],
  [0.08, 0.22, 0.3, 0.25, 0.15, 0],
  [0.05, 0.15, 0.35, 0.25, 0.2, 0],
];

/** Layout constants shared with the annotation layer so labels land on bars. */
export const LOGITS_LAYOUT = {
  spacing: 1.15,
  maxHeight: 2.4,
  baseY: 0.2,
  z: 0.6,
  barWidth: 0.8,
};

export const LOGIT_WORDS = ['the', 'a', 'mat', 'rug', 'floor', 'bed'];

/**
 * Raw logits for the six most likely continuations of "The cat sat on the".
 *
 * Softmax at T = 1 gives roughly 62 / 19 / 7 / 5 / 4 / 3 %. These six are drawn
 * renormalised — the vocabulary's long tail is described in the narration
 * instead of drawn, because a tail bar would swamp every other bar above T ≈ 1.2.
 */
export const LOGIT_VALUES = [3.35, 2.16, 1.14, 0.85, 0.62, 0.38];

/** Softmax with temperature over illustrative logits. */
export function softmax(logits: number[], temperature: number) {
  const scaled = logits.map((z) => Math.exp(z / Math.max(0.05, temperature)));
  const sum = scaled.reduce((a, b) => a + b, 0);
  return scaled.map((v) => v / sum);
}
