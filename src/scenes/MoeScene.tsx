import { useMemo } from 'react';
import { useSceneStore } from '../state/useSceneStore';
import { NeonBox } from '../three/shared/NeonBox';
import { VectorBarRow } from '../three/shared/VectorBar';
import { Arc } from '../three/shared/Arc';
import { Tower } from '../three/shared/Tower';
import { BarChart } from '../three/shared/BarChart';
import { C } from '../three/shared/constants';
import {
  ECON_LAYOUT,
  EXPERT_COLORS,
  EXPERT_PARAMS_B,
  GRID_LAYOUT,
  HIST_BALANCED,
  HIST_COLLAPSED,
  HIST_LAYOUT,
  ROUTER_SCORES,
  SCORE_LAYOUT,
  TOTAL_PARAMS_B,
  activeParamsB,
  capacityScale,
  expertPos,
  topKOf,
} from './moeData';

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

      {/* ---------- 4 · weighted merge ---------- */}
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

      {/* ---------- 5 · economics ---------- */}
      <BarChart
        values={[
          capacityScale(TOTAL_PARAMS_B, TOTAL_PARAMS_B),
          capacityScale(activeParamsB(topK), TOTAL_PARAMS_B),
          capacityScale(EXPERT_PARAMS_B, TOTAL_PARAMS_B),
        ]}
        max={1}
        colors={[C.violet, C.green, C.muted]}
        range={[5, 6]}
        active={step === 5}
        position={[0, ECON_LAYOUT.baseY, 0]}
        height={ECON_LAYOUT.fullH}
        spacing={3.6}
        barWidth={ECON_LAYOUT.width}
        depth={0.9}
      />

      {/* ---------- 6 · load balancing ---------- */}
      <BarChart
        values={histogram}
        max={maxHist}
        colors={histogram.map((v) => (v > 0.3 ? C.red : C.cyan))}
        range={[6, 7]}
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
