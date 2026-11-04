import { useMemo } from 'react';
import { useSceneStore } from '../state/useSceneStore';
import { NeonBox } from '../three/shared/NeonBox';
import { VectorBarRow } from '../three/shared/VectorBar';
import { Arc } from '../three/shared/Arc';
import { Tower } from '../three/shared/Tower';
import { BarChart } from '../three/shared/BarChart';
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

export function gateWeights(scores: number[], active: number[]) {
  const total = active.reduce((a, i) => a + scores[i], 0);
  return scores.map((s, i) => (active.includes(i) ? s / total : 0));
}

export const HIST_COLLAPSED = [0.62, 0.11, 0.09, 0.06, 0.05, 0.03, 0.02, 0.02];
export const HIST_BALANCED = [0.16, 0.14, 0.13, 0.12, 0.13, 0.11, 0.11, 0.1];

export function MoeScene() {
  const step = useSceneStore((s) => s.step);
  const topK = useSceneStore((s) => s.topK);
  const loadBalancing = useSceneStore((s) => s.loadBalancing);

  const active = useMemo(() => topKOf(ROUTER_SCORES, topK), [topK]);
  const histogram = loadBalancing ? HIST_BALANCED : HIST_COLLAPSED;
  const maxHist = Math.max(...histogram, 0.001);

  const scoreColors = ROUTER_SCORES.map((_, i) =>
    active.includes(i) ? C.green : '#33405c',
  );
  const scoreHeights = ROUTER_SCORES.map((v) => v * 3.4);

  return (
    <group>
      {/* ---------- 0 · dense baseline ---------- */}
      <group position={[0, 0, 0]}>
        <NeonBox
          id="dense"
          position={[0, 1.9, 0]}
          size={[4.8, 2.1, 1.6]}
          color={C.cyan}
          range={[0, 1]}
        />
        <VectorBarRow count={6} range={[0, 1]} position={[-5.6, 1.2, 0]} height={1.5} />
        <VectorBarRow
          count={6}
          range={[0, 1]}
          position={[5.6, 1.2, 0]}
          height={1.5}
          palette={[C.green, C.cyan]}
          delay={0.3}
        />
        <Arc from={[-4.6, 1.9, 0]} to={[-2.6, 1.9, 0]} range={[0, 1]} lift={0.2} radius={0.035} />
        <Arc
          from={[2.6, 1.9, 0]}
          to={[4.6, 1.9, 0]}
          range={[0, 1]}
          lift={0.2}
          radius={0.035}
          color={C.green}
          phase={0.4}
        />
      </group>

      {/* ---------- 1-2 · router ---------- */}
      <VectorBarRow
        count={8}
        range={[1, 3]}
        position={[-6.4, 1.2, 0]}
        height={1.7}
        active={step === 1}
        phase={0.3}
      />
      <NeonBox
        id="router"
        position={[-3.4, 1.8, 0]}
        size={[1.5, 1.3, 1.2]}
        color={C.violet}
        range={[1, 3]}
        active={step === 1 || step === 2}
        pulse={1.1}
      />
      <Arc
        from={[-5.6, 1.8, 0]}
        to={[-4.2, 1.8, 0]}
        range={[1, 3]}
        lift={0.15}
        radius={0.035}
        color={C.cyan}
      />
      <Arc
        from={[-2.6, 1.8, 0]}
        to={[-0.6, 1.8, 0]}
        range={[1, 3]}
        lift={0.15}
        radius={0.035}
        color={C.violet}
        phase={0.3}
      />

      {/* score bars: one per expert */}
      <BarChart
        values={scoreHeights}
        max={Math.max(...scoreHeights)}
        colors={scoreColors}
        range={[1, 3]}
        active={step === 1 || step === 2}
        position={[SCORE_LAYOUT.x, SCORE_LAYOUT.y, 0]}
        height={SCORE_LAYOUT.maxHeight}
        spacing={SCORE_LAYOUT.spacing}
        barWidth={0.46}
        depth={0.42}
      />

      {/* ---------- 3-4 · expert grid ---------- */}
      <group>
        {EXPERT_COLORS.map((col, i) => {
          const isActive = active.includes(i);
          return (
            <NeonBox
              key={i}
              id={`expert-${i}`}
              position={expertPos(i)}
              size={GRID_LAYOUT.cell}
              color={col}
              range={[3, 5]}
              active={isActive}
              delay={isActive ? 0.1 * active.indexOf(i) : 0.35}
              pulse={isActive ? 1.5 : 0}
            />
          );
        })}
        <NeonBox
          id="router-small"
          position={[-6.1, 2.0, 0]}
          size={[1.2, 1.1, 1.0]}
          color={C.violet}
          range={[3, 5]}
          active={false}
        />
        {active.map((ei, k) => {
          const [x, y] = expertPos(ei);
          return (
            <Arc
              key={ei}
              from={[-5.4, 2.0, 0]}
              to={[x - 1.0, y, 0]}
              range={[3, 5]}
              lift={0.9}
              radius={0.03}
              color={EXPERT_COLORS[ei]}
              phase={k * 0.2}
            />
          );
        })}
      </group>

      {/* ---------- 4-5 · weighted merge ---------- */}
      <NeonBox
        id="merge"
        position={[0, -1.5, 1.6]}
        size={[2.6, 1.1, 1.0]}
        color={C.green}
        range={[4, 5]}
        active={step === 4}
        pulse={1.2}
      />
      {active.map((ei, k) => {
        const [x, y] = expertPos(ei);
        return (
          <Arc
            key={`m-${ei}`}
            from={[x, y - 0.7, 0]}
            to={[0, -1.0, 1.6]}
            range={[4, 5]}
            lift={0.7}
            radius={0.032}
            color={EXPERT_COLORS[ei]}
            phase={k * 0.22}
          />
        );
      })}

      {/* ---------- 5-6 · economics ---------- */}
      <group position={[0, 0, 0]}>
        <NeonBox
          id="econ-total"
          position={[-3.9, 2.0, 0]}
          size={[1.8, 4.0, 0.9]}
          color={C.violet}
          range={[5, 7]}
        />
        <NeonBox
          id="econ-active"
          position={[0, 0.55, 0]}
          size={[1.8, 1.1, 0.9]}
          color={C.green}
          range={[5, 7]}
          delay={0.15}
          pulse={1}
        />
        <NeonBox
          id="econ-dense"
          position={[3.9, 0.25, 0]}
          size={[1.8, 0.5, 0.9]}
          color={C.muted}
          range={[5, 7]}
          delay={0.3}
        />
      </group>

      {/* ---------- 6-7 · load balancing ---------- */}
      <BarChart
        values={histogram}
        max={maxHist}
        colors={histogram.map((v) => (v > 0.3 ? C.red : C.cyan))}
        range={[6, 8]}
        active={step === 6}
        position={[0, HIST_LAYOUT.baseY, 0]}
        height={HIST_LAYOUT.height}
        spacing={HIST_LAYOUT.spacing}
        barWidth={0.7}
        depth={0.55}
      />

      {/* ---------- 7 · the block ---------- */}
      <Tower
        count={12}
        range={[7, 8]}
        position={[0, 0.3, -1]}
        spacing={0.5}
        block={[3.8, 0.34, 1.5]}
        palette={[C.cyan, C.violet]}
        period={4.4}
      />
    </group>
  );
}
