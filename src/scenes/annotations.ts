import { useMemo } from 'react';
import { useSceneStore } from '../state/useSceneStore';
import type { Annotation } from '../three/labels/types';
import type { Chapter } from '../content/types';
import { LOGITS_LAYOUT, LOGIT_VALUES, LOGIT_WORDS, softmax } from './GptScene';
import {
  EXPERT_COLORS,
  HIST_COLLAPSED,
  HIST_BALANCED,
  HIST_LAYOUT,
  ROUTER_SCORES,
  expertPos,
  gateWeights,
  topKOf,
} from './MoeScene';

/** Captions for the GPT chapter. Only one step's captions exist at a time. */
function gptAnnotations(temperature: number): Annotation[] {
  const probs = softmax(LOGIT_VALUES, temperature);
  const maxP = Math.max(...probs, 0.001);
  const x0 = -((LOGIT_WORDS.length - 1) * LOGITS_LAYOUT.spacing) / 2;

  const barLabels: Annotation[] = LOGIT_WORDS.map((word, i) => ({
    id: `a-bar-${i}`,
    at: [
      x0 + i * LOGITS_LAYOUT.spacing,
      LOGITS_LAYOUT.baseY + (probs[i] / maxP) * LOGITS_LAYOUT.maxHeight + 0.45,
      LOGITS_LAYOUT.z,
    ],
    title: word,
    sub: `${(probs[i] * 100).toFixed(1)}%`,
    from: 9,
    to: 11,
    tone: i === 0 ? 'green' : i === 1 ? 'cyan' : 'muted',
  }));

  return [
    // 0 · sentence
    {
      id: 'a-sentence',
      at: [0, 3.1, 0],
      title: 'Input sentence',
      sub: '6 tokens · text never enters the model',
      from: 0,
      to: 1,
    },

    // 1 · tokenization
    {
      id: 'a-ids',
      at: [0, 3.1, 0],
      title: 'Tokens → integer ids',
      sub: 'the id is what gets embedded next',
      from: 1,
      to: 2,
    },
    {
      id: 'a-split',
      at: [4.7, 2.4, 0],
      title: 'Rare words split',
      sub: 'un·believ·able → 3 tokens',
      from: 1,
      to: 2,
      tone: 'muted',
    },

    // 2 · embeddings
    {
      id: 'a-emb',
      at: [0, 3.1, 0],
      title: 'Embedding lookup',
      sub: 'one 4,096-number row per id',
      from: 2,
      to: 3,
      tone: 'violet',
    },
    {
      id: 'a-dims',
      at: [4.4, 1.1, 0],
      title: '8 of 4,096 dimensions',
      sub: 'height = value',
      from: 2,
      to: 3,
      tone: 'muted',
    },

    // 3 · positions
    {
      id: 'a-pos',
      at: [0, 3.1, 0],
      title: 'Position signal',
      sub: 'sin / cos fingerprint of each position',
      from: 3,
      to: 4,
      tone: 'amber',
    },
    {
      id: 'a-add',
      at: [4.4, 0.95, 1.7],
      title: 'Added element-wise',
      sub: 'before the first block',
      from: 3,
      to: 4,
      tone: 'muted',
    },

    // 4 · attention
    {
      id: 'a-heat',
      at: [0, 4.95, -0.6],
      title: 'Attention weights',
      sub: 'row = query token · column = key token',
      from: 4,
      to: 5,
    },
    {
      id: 'a-causal',
      at: [3.4, 3.4, -0.6],
      title: 'Causal mask',
      sub: 'nothing above the diagonal',
      from: 4,
      to: 5,
      tone: 'violet',
    },
    {
      id: 'a-blend',
      at: [0, -1.95, 0],
      title: 'Weighted blend of values',
      sub: 'new vector = Σ weight · value',
      from: 4,
      to: 5,
      tone: 'green',
    },

    // 5 · multi-head
    ...['syntax', 'previous token', 'reference', 'punctuation'].map((role, h) => ({
      id: `a-head-${h}`,
      at: [-5.1 + h * 3.4, 2.2, 0] as [number, number, number],
      title: `Head ${h + 1}`,
      sub: role,
      from: 5,
      to: 6,
      tone: (['cyan', 'violet', 'amber', 'pink'] as const)[h],
    })),
    {
      id: 'a-concat',
      at: [0, -2.75, 0.4],
      title: 'Concatenate + project',
      sub: '4 heads → one vector at model width',
      from: 5,
      to: 6,
      tone: 'amber',
    },

    // 6 · feed-forward
    {
      id: 'a-expand',
      at: [-1.7, 3.95, 0],
      title: 'Expand 4×',
      sub: '4,096 → ~16,000',
      from: 6,
      to: 7,
      tone: 'violet',
    },
    {
      id: 'a-gelu',
      at: [0.9, 1.95, 0],
      title: 'GELU',
      sub: 'the only nonlinearity',
      from: 6,
      to: 7,
      tone: 'amber',
    },
    {
      id: 'a-params',
      at: [3.5, 1.15, 0],
      title: '~2/3 of all parameters',
      sub: 'this is the knowledge store',
      from: 6,
      to: 7,
      tone: 'muted',
    },

    // 7 · residual
    {
      id: 'a-res',
      at: [0, 4.3, 0],
      title: 'Residual stream',
      sub: 'input + block output, never overwritten',
      from: 7,
      to: 8,
      tone: 'green',
    },
    {
      id: 'a-ln',
      at: [3.4, 1.8, 0],
      title: 'LayerNorm',
      sub: 'recentre + rescale per token',
      from: 7,
      to: 8,
      tone: 'amber',
    },
    {
      id: 'a-sublayers',
      at: [-3.7, 1.3, 1.1],
      title: 'attention → FFN',
      sub: 'two sub-layers, each wrapped',
      from: 7,
      to: 8,
      tone: 'muted',
    },

    // 8 · stack
    {
      id: 'a-stack',
      at: [3.4, 2.6, -1.2],
      title: 'Transformer stack',
      sub: '16 blocks (GPT-2 small: 12)',
      from: 8,
      to: 9,
    },
    {
      id: 'a-flow',
      at: [3.4, 6.8, -1.2],
      title: 'block n → block n+1',
      sub: 'depth is sequential, so it costs latency',
      from: 8,
      to: 9,
      tone: 'violet',
    },

    // 9-10 · logits
    {
      id: 'a-softmax',
      at: [0, 3.25, LOGITS_LAYOUT.z],
      title: 'Next-token distribution',
      sub: 'softmax over 50,257 logits',
      from: 9,
      to: 11,
    },
    ...barLabels,

    // 10 · sampling
    {
      id: 'a-sample',
      at: [5.6, 3.15, 0.6],
      title: 'Sample with temperature',
      sub: `T = ${temperature.toFixed(2)}`,
      from: 10,
      to: 11,
      tone: 'green',
    },
    {
      id: 'a-loop',
      at: [0, 4.75, 0.6],
      title: 'Then run the whole pass again',
      sub: 'with the new token appended',
      from: 10,
      to: 11,
      tone: 'muted',
    },
  ];
}

/** Captions for the MoE chapter. */
function moeAnnotations(topK: 1 | 2 | 3 | 4, loadBalancing: boolean): Annotation[] {
  const active = topKOf(ROUTER_SCORES, topK);
  const weights = gateWeights(ROUTER_SCORES, active);
  const histogram = loadBalancing ? HIST_BALANCED : HIST_COLLAPSED;
  const maxHist = Math.max(...histogram, 0.001);
  const histX0 = -((histogram.length - 1) * HIST_LAYOUT.spacing) / 2;

  return [
    // 0 · dense
    {
      id: 'm-dense',
      at: [0, 3.1, 0],
      title: 'Dense FFN',
      sub: 'every token touches every weight',
      from: 0,
      to: 1,
    },

    // 1-2 · router
    {
      id: 'm-vec',
      at: [-6.4, 3.05, 0],
      title: 'Token vector',
      sub: 'input to the gate',
      from: 1,
      to: 3,
      tone: 'cyan',
    },
    {
      id: 'm-gate',
      at: [-3.4, 2.65, 0],
      title: 'Router · the gate',
      sub: 'one matmul → 8 scores',
      from: 1,
      to: 3,
      tone: 'violet',
    },
    {
      id: 'm-scores',
      at: [2.4, 2.55, 0],
      title: 'A score per expert',
      sub: 'higher = better match for this token',
      from: 1,
      to: 2,
      tone: 'green',
    },

    // 2 · top-k
    {
      id: 'm-topk',
      at: [2.4, 2.55, 0],
      title: `Keep the top ${topK}`,
      sub: 'renormalised to sum to 1',
      from: 2,
      to: 3,
      tone: 'green',
    },
    {
      id: 'm-drop',
      at: [-3.4, 3.7, 0],
      title: `${8 - topK} experts dropped`,
      sub: 'zero compute for this token',
      from: 2,
      to: 3,
      tone: 'muted',
    },

    // 3-4 · experts
    ...active.map((ei, k) => {
      const [x, y] = expertPos(ei);
      return {
        id: `m-e${ei}`,
        at: [x, y + 1.0, 0] as [number, number, number],
        title: `E${ei + 1}`,
        sub: `weight ${weights[ei].toFixed(2)}`,
        from: 3,
        to: 4,
        tone: (['cyan', 'violet', 'amber', 'pink'] as const)[k],
      };
    }),
    {
      id: 'm-dormant',
      at: [-6.15, 0.55, 0],
      title: 'Dormant experts',
      sub: 'never run, never paid for',
      from: 3,
      to: 4,
      tone: 'muted',
    },

    // 4 · merge
    {
      id: 'm-merge',
      at: [0, -2.45, 1.6],
      title: 'Σ wᵢ · expertᵢ(x)',
      sub: 'the sum rejoins the residual stream',
      from: 4,
      to: 5,
      tone: 'green',
    },

    // 5-6 · economics
    {
      id: 'm-total',
      at: [-3.9, 4.35, 0],
      title: 'Total parameters',
      sub: '46.7B · all held in memory',
      from: 5,
      to: 6,
      tone: 'violet',
    },
    {
      id: 'm-active',
      at: [0, 1.45, 0],
      title: 'Compute per token',
      sub: `12.9B · k = ${topK}`,
      from: 5,
      to: 6,
      tone: 'green',
    },
    {
      id: 'm-dense-ref',
      at: [3.9, 1.0, 0],
      title: 'Dense reference',
      sub: '12.9B · 1×',
      from: 5,
      to: 6,
      tone: 'muted',
    },

    // 6-7 · load balancing
    {
      id: 'm-hist',
      at: [0, 3.35, 0],
      title: 'Share of tokens per expert',
      sub: loadBalancing ? 'balanced by an auxiliary loss' : 'collapsed: one expert takes most',
      from: 6,
      to: 7,
      tone: loadBalancing ? 'cyan' : 'pink',
    },
    ...histogram.map((v, i) => ({
      id: `m-hist-${i}`,
      at: [
        histX0 + i * HIST_LAYOUT.spacing,
        HIST_LAYOUT.baseY + (v / maxHist) * HIST_LAYOUT.height + 0.42,
        0,
      ] as [number, number, number],
      title: `E${i + 1}`,
      sub: `${Math.round(v * 100)}%`,
      from: 6,
      to: 7,
      tone: v > 0.3 ? ('pink' as const) : ('muted' as const),
    })),

    // 7 · where it lives
    {
      id: 'm-attn-layer',
      at: [3.2, 1.3, -1],
      title: 'Dense attention',
      sub: 'all tokens ↔ all tokens',
      from: 7,
      to: 8,
      tone: 'cyan',
    },
    {
      id: 'm-moe-layer',
      at: [3.2, 1.9, -1],
      title: 'Sparse MoE FFN',
      sub: `${topK} of ${EXPERT_COLORS.length} experts`,
      from: 7,
      to: 8,
      tone: 'violet',
    },
    {
      id: 'm-repeat',
      at: [0, -0.55, -1],
      title: '12 blocks shown',
      sub: 'attention + MoE, repeated',
      from: 7,
      to: 8,
      tone: 'muted',
    },
  ];
}

/** Captions for the visible chapter, rebuilt when a knob changes. */
export function useAnnotations(chapter: Chapter): Annotation[] {
  const temperature = useSceneStore((s) => s.temperature);
  const topK = useSceneStore((s) => s.topK);
  const loadBalancing = useSceneStore((s) => s.loadBalancing);

  return useMemo(() => {
    return chapter === 'gpt'
      ? gptAnnotations(temperature)
      : moeAnnotations(topK, loadBalancing);
  }, [chapter, temperature, topK, loadBalancing]);
}
