import { GPT_TOKENS } from '../scenes/gptData';
import { EXPERT_PARAMS_B, ROUTER_SCORES } from '../scenes/moeData';

export interface InspectInfo {
  title: string;
  shape: string;
  formula: string;
  note: string;
}

const HEAD_ROLES = ['Syntax', 'Previous token', 'Coreference', 'Punctuation'];

/** Returns verified GPT-2 small / MoE metadata for any clickable 3D part id. */
export function getInspectInfo(id: string): InspectInfo | null {
  if (id.startsWith('tok-')) {
    const idx = Number(id.slice(4));
    const tok = GPT_TOKENS[idx];
    if (!tok) return null;
    return {
      title: `Token ${idx}: "${tok.text}"`,
      shape: `id ${tok.id} → [768]`,
      formula: `x_${idx} = E[${tok.id}] + P[${idx}]`,
      note: 'Discrete BPE token id mapped to a 768-wide embedding row plus its position vector.',
    };
  }

  if (id.startsWith('head-')) {
    const h = Number(id.slice(5));
    return {
      title: `Attention Head ${h + 1} (${HEAD_ROLES[h] ?? 'Parallel'})`,
      shape: 'Q, K, V ∈ ℝ^(T × 64)',
      formula: 'softmax(Q·Kᵀ / √64 + M) · V',
      note: 'GPT-2 small splits 768 dims across 12 heads of 64 dims each (4 heads drawn here).',
    };
  }

  if (id.startsWith('expert-')) {
    const e = Number(id.slice(7));
    const score = ROUTER_SCORES[e] ?? 0;
    return {
      title: `Expert E${e + 1}`,
      shape: `FFN · ~${EXPERT_PARAMS_B}B params (illustrative)`,
      formula: 'E_i(x) = W_down · GELU(W_up · x)',
      note: `Router raw score ${score.toFixed(2)}. Runs only when ranked in the active top-k.`,
    };
  }

  const staticMap: Record<string, InspectInfo> = {
    'ffn-in': {
      title: 'FFN Input Vector',
      shape: '[768]',
      formula: 'x_in = LayerNorm(x_attn)',
      note: 'Single token residual vector entering the position-wise feed-forward network.',
    },
    'ffn-up': {
      title: 'FFN Up-Projection (4×)',
      shape: '[768 × 3,072] (~2.36M params/layer)',
      formula: 'u = W_up · x + b_up',
      note: 'Expands each token independently to 4× model width before applying GELU.',
    },
    'ffn-down': {
      title: 'GELU + Down-Projection',
      shape: '[3,072 × 768] (~2.36M params/layer)',
      formula: 'y = W_down · GELU(u) + b_down',
      note: 'Compresses back to 768 dims; together with W_up holds ~2/3 of transformer weights.',
    },
    'ffn-out': {
      title: 'FFN Output Delta',
      shape: '[768]',
      formula: 'x_next = x_in + y',
      note: 'Added back onto the residual stream without overwriting earlier features.',
    },
    block: {
      title: 'Transformer Block (Pre-Norm)',
      shape: '12 stacked blocks in GPT-2 small',
      formula: 'x ← x + Attn(LN(x)); x ← x + FFN(LN(x))',
      note: 'Wraps both attention and FFN with pre-LayerNorm and residual skip paths.',
    },
    'attn-sublayer': {
      title: 'Attention Sub-layer',
      shape: '12 heads × 64 = 768',
      formula: 'x + MultiHeadAttn(LN(x))',
      note: 'The only step where tokens exchange information across positions.',
    },
    'ffn-sublayer': {
      title: 'FFN Sub-layer',
      shape: '768 → 3,072 → 768',
      formula: 'x + FFN(LN(x))',
      note: 'Transforms each token vector independently; replaced by MoE in sparse models.',
    },
    sampling: {
      title: 'Sampling & Autoregressive Loop',
      shape: '50,257 logits → 1 token id',
      formula: 'p_i = softmax(z_i / T), truncate at top-p',
      note: 'Draws one next token, appends it to the prompt, and reuses cached K/V states.',
    },
    dense: {
      title: 'Dense FFN Baseline',
      shape: '100% parameters active per token',
      formula: 'y = W_down · GELU(W_up · x)',
      note: 'Every token multiplies through every weight, tying latency directly to model size.',
    },
    router: {
      title: 'MoE Router (Gate)',
      shape: '[d_model × 8] (< 1% of FFN FLOPs)',
      formula: 'g = TopK(W_g · x, k), w = g / Σg',
      note: 'Scores all 8 experts per token and dispatches only the top-k highest matches.',
    },
    'router-small': {
      title: 'MoE Router (Dispatch)',
      shape: '1 token → k active experts',
      formula: 'active = argtop_k(W_g · x)',
      note: 'Sends the token vector only to lit experts; dormant experts consume zero FLOPs.',
    },
    merge: {
      title: 'Weighted Expert Merge',
      shape: 'k vectors → 1 residual update',
      formula: 'y = Σ_{i ∈ top-k} w_i · E_i(x)',
      note: 'Combines active expert outputs using renormalised gate weights and rejoins residual stream.',
    },
  };

  return staticMap[id] ?? null;
}
