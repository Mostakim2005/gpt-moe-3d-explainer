import { useMemo } from 'react';
import { useSceneStore } from '../state/useSceneStore';
import { TokenRow, chipX } from '../three/shared/TokenChip';
import { VectorBarRow } from '../three/shared/VectorBar';
import { NeonBox } from '../three/shared/NeonBox';
import { Arc } from '../three/shared/Arc';
import { HeatmapPlane } from '../three/shared/HeatmapPlane';
import { Tower } from '../three/shared/Tower';
import { BarChart } from '../three/shared/BarChart';
import { C } from '../three/shared/constants';
import {
  ATTENTION,
  GPT_TOKENS,
  LOGITS_LAYOUT,
  LOGIT_VALUES,
  softmax,
} from './gptData';

const tokenX = (i: number) => chipX(i, GPT_TOKENS.length);

export function GptScene() {
  const step = useSceneStore((s) => s.step);
  const temperature = useSceneStore((s) => s.temperature);

  const probs = useMemo(() => softmax(LOGIT_VALUES, temperature), [temperature]);
  const maxP = Math.max(...probs, 0.001);
  const logitColors = probs.map((p, i) =>
    i === 0 ? C.green : i === 1 ? C.cyan : p > 0.12 ? C.violet : C.muted,
  );

  return (
    <group>
      {/* ---------- 0 · the sentence ---------- */}
      <TokenRow tokens={GPT_TOKENS} range={[0, 1]} position={[0, 2.4, 0]} showIds={false} />

      {/* ---------- 1-3 · tokens + ids ---------- */}
      <group position={[0, 2.4, 0]}>
        <TokenRow tokens={GPT_TOKENS} range={[1, 4]} active={step === 1} showIds />
      </group>

      {/* ---------- 2-3 · embedding vectors under each token ---------- */}
      <group position={[0, 0.2, 0]}>
        {GPT_TOKENS.map((_, i) => (
          <VectorBarRow
            key={i}
            count={7}
            range={[2, 4]}
            active={step === 2}
            spacing={0.16}
            height={1.35 + (i % 3) * 0.18}
            phase={i * 0.9}
            delay={i * 0.05}
            barWidth={0.11}
            position={[tokenX(i), 0, 0]}
          />
        ))}
      </group>

      {/* ---------- 3 · position signal ---------- */}
      <VectorBarRow
        count={28}
        range={[3, 4]}
        alternate
        spacing={0.31}
        height={0.85}
        barWidth={0.13}
        live={0.45}
        phase={0.4}
        position={[0, 0.3, 1.7]}
        palette={[C.amber, C.violet]}
      />

      {/* ---------- 4 · self-attention ---------- */}
      <group position={[0, -0.9, 0]}>
        <TokenRow tokens={GPT_TOKENS} range={[4, 5]} showIds={false} />
      </group>

      <group>
        {[
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 4],
          [4, 5],
          [2, 5],
          [3, 5],
        ].map(([a, b], i) => (
          <Arc
            key={i}
            from={[tokenX(a), -0.35, 0]}
            to={[tokenX(b), -0.35, 0]}
            range={[4, 5]}
            color={b === 5 ? C.violet : C.cyan}
            lift={0.55 + Math.abs(b - a) * 0.22}
            radius={0.035}
            phase={i * 0.17}
            flowSpeed={0.35}
          />
        ))}
      </group>

      <HeatmapPlane
        matrix={ATTENTION}
        range={[4, 5]}
        position={[0, 3.4, -0.6]}
        cellSize={0.4}
        tilt={-0.2}
        causal
      />

      {/* ---------- 5 · multi-head ---------- */}
      <group position={[0, 0, 0]}>
        {[C.cyan, C.violet, C.amber, C.pink].map((col, h) => (
          <NeonBox
            key={h}
            id={`head-${h}`}
            position={[-5.1 + h * 3.4, 1.5, 0]}
            size={[2.5, 1.0, 1.3]}
            color={col}
            range={[5, 6]}
            delay={h * 0.12}
            pulse={1.2}
          />
        ))}
        <VectorBarRow
          count={14}
          range={[5, 6]}
          delay={0.5}
          height={0.9}
          spacing={0.2}
          position={[0, -1.9, 0.4]}
        />
        <Arc
          from={[0, 1.0, 0]}
          to={[0, -1.0, 0.4]}
          range={[5, 6]}
          color={C.text}
          lift={0.2}
          radius={0.02}
          flow={false}
        />
      </group>

      {/* ---------- 6 · feed-forward ---------- */}
      <group position={[0, 0, 0]}>
        <NeonBox
          id="ffn-in"
          position={[-4.2, 1.1, 0]}
          size={[1.4, 0.6, 0.7]}
          color={C.cyan}
          range={[6, 7]}
        />
        <NeonBox
          id="ffn-up"
          position={[-1.7, 1.9, 0]}
          size={[1.3, 3.4, 0.9]}
          color={C.violet}
          range={[6, 7]}
          delay={0.12}
          pulse={0.9}
        />
        <NeonBox
          id="ffn-down"
          position={[0.9, 1.1, 0]}
          size={[1.3, 0.6, 0.7]}
          color={C.amber}
          range={[6, 7]}
          delay={0.24}
        />
        <NeonBox
          id="ffn-out"
          position={[3.5, 1.1, 0]}
          size={[1.4, 0.6, 0.7]}
          color={C.green}
          range={[6, 7]}
          delay={0.36}
        />
        <Arc
          from={[-3.5, 1.1, 0]}
          to={[-2.4, 1.9, 0]}
          range={[6, 7]}
          radius={0.03}
          lift={0.1}
        />
        <Arc from={[-1.0, 1.9, 0]} to={[0.2, 1.1, 0]} range={[6, 7]} radius={0.03} lift={0.1} phase={0.3} />
        <Arc
          from={[1.6, 1.1, 0]}
          to={[2.8, 1.1, 0]}
          range={[6, 7]}
          radius={0.03}
          lift={0.08}
          color={C.amber}
          phase={0.6}
        />
      </group>

      {/* ---------- 7 · residual + LayerNorm ---------- */}
      <group position={[0, 1.8, 0]}>
        <NeonBox id="block" position={[0, 0, 0]} size={[4.6, 2.6, 1.7]} color={C.cyan} range={[7, 8]} />
        <NeonBox
          id="attn-sublayer"
          position={[0, 0.55, 0.95]}
          size={[3.4, 0.55, 0.18]}
          color={C.violet}
          range={[7, 8]}
          delay={0.15}
        />
        <NeonBox
          id="ffn-sublayer"
          position={[0, -0.55, 0.95]}
          size={[3.4, 0.55, 0.18]}
          color={C.amber}
          range={[7, 8]}
          delay={0.25}
        />
        <Arc
          from={[-2.4, 1.5, 0]}
          to={[2.4, 1.5, 0]}
          range={[7, 8]}
          color={C.green}
          lift={0.75}
          radius={0.05}
          flowSpeed={0.3}
          phase={0.1}
        />
      </group>

      {/* ---------- 8 · the stack ---------- */}
      <Tower
        count={16}
        range={[8, 9]}
        position={[0, 0.3, -1.2]}
        spacing={0.44}
        block={[3.6, 0.3, 1.5]}
        palette={[C.cyan, C.violet]}
      />

      {/* ---------- 9-10 · logits ---------- */}
      <BarChart
        values={probs}
        max={maxP}
        colors={logitColors}
        range={[9, 11]}
        active={step === 9 || step === 10}
        position={[0, LOGITS_LAYOUT.baseY, LOGITS_LAYOUT.z]}
        height={LOGITS_LAYOUT.maxHeight}
        spacing={LOGITS_LAYOUT.spacing}
        barWidth={LOGITS_LAYOUT.barWidth}
      />

      {/* ---------- 10 · sampling ---------- */}
      <NeonBox
        id="sampling"
        position={[5.6, 2.2, 0.6]}
        size={[1.5, 1.5, 0.8]}
        color={C.green}
        range={[10, 11]}
        pulse={1.4}
      />
      <Arc
        from={[5.6, 3.1, 0.6]}
        to={[-5.6, 1.6, 0.6]}
        range={[10, 11]}
        color={C.green}
        lift={2.2}
        radius={0.045}
        flowSpeed={0.22}
        delay={0.2}
      />
    </group>
  );
}
