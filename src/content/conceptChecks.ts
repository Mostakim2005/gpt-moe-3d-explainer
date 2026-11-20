export interface ConceptQuestion {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

/** Short self-check questions keyed by `${chapter}:${stepId}`. */
export const CONCEPT_CHECKS: Record<string, ConceptQuestion> = {
  'gpt:attention': {
    prompt: 'Why are all cells above the diagonal masked out in GPT self-attention?',
    choices: [
      'To save half the embedding dimensions',
      'So a token cannot read future tokens it has not generated yet',
      'Because softmax only works on triangular matrices',
    ],
    answerIndex: 1,
    explanation: 'GPT is causal (autoregressive): token i may attend only to positions 0..i.',
  },
  'gpt:residual': {
    prompt: 'What does the residual skip connection do at every sub-layer?',
    choices: [
      'Replaces the token vector with the sub-layer output',
      'Adds the sub-layer output onto the input vector so gradients flow cleanly',
      'Drops half the neurons during inference',
    ],
    answerIndex: 1,
    explanation: 'x ← x + Sublayer(LN(x)) preserves the running stream and prevents vanishing gradients.',
  },
  'gpt:sampling': {
    prompt: 'What happens to the probability bars as Temperature T approaches 0?',
    choices: [
      'All candidate tokens become equally likely',
      'Probability concentrates onto the highest-logit token (greedy argmax)',
      'The model weights are retrained on the fly',
    ],
    answerIndex: 1,
    explanation: 'Dividing logits by a tiny T amplifies gaps before softmax; weights never change.',
  },
  'moe:topk': {
    prompt: 'When the router selects Top-2 out of 8 experts, what happens to the other 6 experts?',
    choices: [
      'They still run, then their outputs are multiplied by zero',
      'They are skipped completely — zero FLOPs spent for this token',
      'They are deleted from GPU memory',
    ],
    answerIndex: 1,
    explanation: 'All 8 experts stay resident in memory, but only the top-k execute for a given token.',
  },
  'moe:economics': {
    prompt: 'In the 134B (30B shared + 8 × 13B) example, what does raising k from 1 to 2 change?',
    choices: [
      'Active compute rises from 43B to 56B while total memory stays 134B',
      'Total memory doubles from 134B to 268B',
      'Both active compute and total memory stay fixed',
    ],
    answerIndex: 0,
    explanation: 'Active params = 30B + k × 13B; memory always holds all 134B parameters.',
  },
  'moe:loadbalance': {
    prompt: 'When does the auxiliary load-balancing loss actually take effect?',
    choices: [
      'Only during inference to speed up batching',
      'During training, to stop the router collapsing onto 1–2 experts',
      'Only when temperature is above 1.0',
    ],
    answerIndex: 1,
    explanation: 'Load balancing is a training-time objective; at inference the router weights are frozen.',
  },
};
