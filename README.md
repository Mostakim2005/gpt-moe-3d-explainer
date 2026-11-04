# GPT & Mixture of Experts — Interactive 3D Explainer

A dark-themed, interactive 3D web app that teaches how a GPT works and how Mixture of Experts works, step by step.

## Chapters

- **How GPT works** — 11 steps: tokenization, embeddings, positional encoding, self-attention, multi-head, feed-forward, residual + LayerNorm, 32-block tower, logits → softmax, and the autoregressive sampling loop.
- **Mixture of Experts** — 8 steps: dense baseline, router, top-k gating, expert grid, weighted merge, sparsity economics, load balancing, and where MoE sits inside a transformer.

## Setup

Requirements:

- Node.js 24+ and npm — installed system-wide at `C:\Program Files\nodejs\` (on PATH, usable by any app or harness).

```bat
npm install
npm run dev      # opens http://localhost:5173
npm run build    # production build into dist\
```

## What to see

- Camera glides to each step's pose; drag to orbit, scroll to zoom.
- X-ray toggle dissolves outer shells to reveal inner vectors.
- Live sliders: temperature (GPT sampling step), top-k (MoE routing), load balancing on/off.
- Keyboard: ←/→ steps, Space play/pause, X x-ray, L labels.
- All numbers are illustrative, not real model weights.

See `docs/` for architecture, algorithms, and flowcharts.
