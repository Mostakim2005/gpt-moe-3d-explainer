import type { ChapterDef } from './types';
import { gptChapter } from './gptSteps';

/**
 * Mixture of Experts chapter — 8 steps from the dense baseline to where the
 * layer sits inside a transformer block.
 */
export const moeChapter: ChapterDef = {
  id: 'moe',
  label: 'Mixture of Experts',
  blurb: 'A huge model where only a fraction of it runs per token.',
  steps: [
    {
      id: 'dense',
      short: 'Dense baseline',
      title: 'Start with a dense FFN',
      body: 'A normal transformer runs every token through the same feed-forward network: every weight, every token, every layer. That is simple and predictable — and it means per-token compute grows in lockstep with model size.',
      why: 'Dense compute is the cost MoE attacks. If only part of the network mattered for a given token, the rest could be skipped.',
      see: ['One FFN, used by every token', 'Input vector in, output vector out'],
      terms: [
        { term: 'Dense', meaning: 'every parameter is used for every token' },
        { term: 'FLOPs', meaning: 'floating-point operations — the unit compute is counted in' },
      ],
      numbers: [
        { label: 'Params used per token', value: '100%' },
        { label: 'Compute per token', value: '100%' },
      ],
      camera: { p: [0, 2.8, 11.0], t: [0, 1.6, 0] },
      active: ['dense'],
      durationMs: 6500,
    },
    {
      id: 'router',
      short: 'The router',
      title: 'The router',
      body: 'Replace that FFN with 8 experts plus one small gate. The gate multiplies the token vector by a matrix of shape (d_model × 8) and produces one score per expert. That is the entire routing decision — a fraction of a percent of the FFN\'s cost.',
      why: 'The router is the only new machinery. It trains on the same signal as everything else: experts whose output reduces the loss get picked more often.',
      see: ['Left: the token vector', 'Middle: the gate — a single matmul', 'Right: one score per expert'],
      terms: [
        { term: 'Router / gate', meaning: 'a small linear layer that scores each expert' },
        { term: 'MoE', meaning: 'mixture of experts: many FFNs, a few used per token' },
      ],
      numbers: [
        { label: 'Experts', value: '8' },
        { label: 'Router cost', value: '< 1% of FFN' },
      ],
      camera: { p: [0, 2.8, 12.0], t: [-0.8, 1.6, 0] },
      active: ['router'],
      durationMs: 7000,
    },
    {
      id: 'topk',
      short: 'Top-k gating',
      title: 'Top-k gating',
      body: 'Keep only the k highest-scoring experts and renormalise their scores so the weights sum to 1. The rest are dropped and never run. Top-1 is cheapest, top-2 is the common default, top-4 buys robustness for twice the compute.',
      why: 'k is the single dial that trades inference cost against capacity and stability. Too small and routing is brittle; too large and the savings disappear.',
      see: ['Green bars: selected experts', 'Grey bars: dropped, zero compute'],
      tryIt: 'Switch k between 1 and 4 and count how many experts light up.',
      terms: [
        { term: 'Top-k', meaning: 'keep only the k highest-scoring experts' },
        { term: 'Renormalise', meaning: 'rescale the kept weights so they sum to 1' },
      ],
      numbers: [
        { label: 'k here', value: '1 – 4' },
        { label: 'Mixtral 8x7B', value: 'k = 2' },
      ],
      camera: { p: [0, 2.8, 12.0], t: [-0.8, 1.6, 0] },
      active: ['router', 'gate'],
      durationMs: 8000,
    },
    {
      id: 'experts',
      short: 'The experts',
      title: 'The experts',
      body: 'Each expert is a full FFN of its own. The k chosen ones run; the other 8−k stay dormant, their weights never touched for this token. Total parameters grow 8× while per-token compute stays at about k×.',
      why: 'Because different tokens route to different experts, each expert sees a narrower slice of the data and can specialise — one gets good at code, another at punctuation, another at numbers.',
      see: ['Lit experts: running for this token', 'Dark experts: dormant, no FLOPs'],
      terms: [
        { term: 'Expert', meaning: 'a full FFN of its own, with its own weights' },
        { term: 'Dormant', meaning: 'not selected, so its weights are never read' },
      ],
      numbers: [
        { label: 'Total expert params', value: '8× a dense FFN' },
        { label: 'Active per token', value: 'k of 8' },
      ],
      camera: { p: [1.5, 3.0, 11.6], t: [-1.0, 1.4, 0] },
      active: ['experts'],
      durationMs: 8000,
    },
    {
      id: 'merge',
      short: 'Weighted merge',
      title: 'Weighted merge',
      body: 'Each active expert returns a vector. The gate\'s renormalised weights scale them and the results are summed: y = Σ wᵢ · expertᵢ(x). That sum is added into the residual stream exactly where the dense FFN output used to go.',
      why: 'Downstream of the FFN nothing changes. MoE is a drop-in replacement for one layer, which is why it fits existing transformer code with almost no other edits.',
      see: ['Arcs: weighted contributions converging', 'Merge box: the sum rejoins the residual stream'],
      terms: [
        { term: 'Weighted sum', meaning: 'scale each expert output, then add them up' },
        { term: 'Drop-in', meaning: 'the rest of the transformer needs no changes' },
      ],
      numbers: [
        { label: 'Combine rule', value: 'Σ wᵢ · Eᵢ(x)' },
        { label: 'Weights from', value: 'the gate' },
      ],
      camera: { p: [2.5, 2.8, 10.8], t: [-0.6, 0.9, 0] },
      active: ['experts', 'merge'],
      durationMs: 7000,
    },
    {
      id: 'economics',
      short: 'The economics',
      title: 'The economics',
      body: 'Here is the trade in one picture, for this 8-expert example: 134B parameters exist, but only 30B shared + k × 13B of expert runs for any given token. At k = 2 that is 56B of compute carrying 134B of capacity — a 2.4× saving. The same arithmetic is why Mixtral 8×7B (46.7B total, ~12.9B active) costs about as much per token as a 13B dense model.',
      why: 'Training still pays for every parameter, and you need enough GPU memory to hold them. Inference compute is what MoE saves — not memory.',
      see: ['Violet: total capacity', 'Green: compute actually spent per token', 'Grey: one dense FFN, for scale'],
      tryIt: 'Raise k: the green bar grows and the "compute per token" number climbs, while total parameters stay put.',
      terms: [
        { term: 'Total params', meaning: 'what you must hold in memory, always' },
        { term: 'Active params', meaning: 'what actually runs for one token, what sets cost' },
      ],
      numbers: [
        { label: 'Mixtral total', value: '46.7B params' },
        { label: 'Active per token', value: '12.9B' },
      ],
      camera: { p: [0, 3.0, 11.2], t: [0, 2.0, 0] },
      active: ['economics'],
      durationMs: 8000,
    },
    {
      id: 'loadbalance',
      short: 'Load balancing',
      title: 'Load balancing',
      body: 'Left alone the router collapses: a few experts receive almost every token while the rest are barely trained. The usual fix is an auxiliary loss that penalises uneven assignment, added to the training objective. Capacity factor and token dropping are the related engineering knobs.',
      why: 'This is a real practical headache of MoE — and it is a training-time problem. At inference the router is frozen and simply does what training left it doing.',
      see: ['Histogram: share of tokens per expert', 'Toggle balancing off to see collapse'],
      terms: [
        { term: 'Aux loss', meaning: 'an extra training term rewarding even expert usage' },
        { term: 'Capacity factor', meaning: 'a per-expert cap; overflow tokens get dropped' },
        { term: 'Collapse', meaning: 'the router sending nearly everything to a few experts' },
      ],
      numbers: [
        { label: 'Failure mode', value: 'expert collapse' },
        { label: 'Fix', value: 'aux loss + capacity factor' },
      ],
      camera: { p: [0, 2.8, 10.6], t: [0, 1.6, 0] },
      active: ['balance'],
      durationMs: 9000,
    },
    {
      id: 'where',
      short: 'Where it lives',
      title: 'Where it lives',
      body: 'MoE replaces the FFN inside each block; attention stays dense. A production model alternates all-to-all attention with sparse MoE, dozens of times. DeepSeek-V3 is the clearest published example: 671B total parameters, 37B active per token, with MoE feed-forward in every block. Zoomed out, an MoE model is an ordinary transformer with one layer swapped.',
      why: 'Attention needs every token to see every other token, so it stays dense. The FFN is where capacity can be added cheaply — so that is the layer that gets sparsified.',
      see: ['Cyan layers: dense attention', 'Violet layers: MoE feed-forward'],
      terms: [
        { term: 'Sparse', meaning: 'only a fraction of the parameters actually run' },
        { term: 'Dense attention', meaning: 'every token still attends to every earlier token' },
      ],
      numbers: [
        { label: 'Replaced', value: 'FFN only' },
        { label: 'Attention', value: 'dense, unchanged' },
      ],
      camera: { p: [5.0, 4.6, 11.6], t: [0, 2.9, -1.0] },
      active: ['tower'],
      durationMs: 8500,
    },
  ],
};

export const chapters: ChapterDef[] = [gptChapter, moeChapter];
