import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { C } from './constants';
import { usePresence } from './usePresence';

interface Props {
  /** n × n matrix: row = query token, column = key token. */
  matrix: number[][];
  range: [number, number];
  active?: boolean;
  cellSize?: number;
  position?: [number, number, number];
  /** Tilt around X so the plane reads as a table from a high camera. */
  tilt?: number;
  /** Cycle a highlight across rows to show that each row is one distribution. */
  sweep?: boolean;
  delay?: number;
  /**
   * Paint cells above the diagonal as explicitly masked (future tokens that a
   * causal model cannot read). The matrix values there must already be 0.
   */
  causal?: boolean;
}

const OFF = new THREE.Color('#0c1730');
const MID = new THREE.Color(C.cyan);
const HOT = new THREE.Color(C.violet);
const WHITE = new THREE.Color('#ffffff');
/** Colour for a cell the causal mask blocks. Must stay clearly distinct from OFF. */
const MASKED = new THREE.Color('#3a1230');

/**
 * Attention / routing matrix as a single instanced grid.
 *
 * Cell colour encodes weight; a slow sweep highlights one row at a time so the
 * "each row is one token's distribution" idea is visible without a legend.
 */
export function HeatmapPlane({
  matrix,
  range,
  active = true,
  cellSize = 0.4,
  position = [0, 0, 0],
  tilt = -0.18,
  sweep = true,
  delay = 0,
  causal = false,
}: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { ref } = usePresence(range, delay);
  const n = matrix.length;
  const gap = 0.055;
  const step = cellSize + gap;
  const start = -((n - 1) * step) / 2;

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const cells = useMemo(() => {
    const arr: Array<{ x: number; y: number; v: number; row: number; col: number }> = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        arr.push({
          x: start + j * step,
          y: -start - i * step,
          v: matrix[i][j] ?? 0,
          row: i,
          col: j,
        });
      }
    }
    return arr;
  }, [matrix, n, start, step]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.frustumCulled = false;
    for (let i = 0; i < cells.length; i++) {
      dummy.position.set(cells[i].x, cells[i].y, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, OFF);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [cells, dummy]);

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const p = ref.current.p;
    m.scale.setScalar(Math.max(0.0001, p));
    m.visible = p > 0.01;

    const t = state.clock.elapsedTime;
    const head = sweep ? Math.floor((t * 0.9) % n) : -1;

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (causal && c.col > c.row) {
        // Blocked: the query may not look at a later key. Painted a flat warning
        // colour so the triangular shape reads even at a glance.
        color.copy(MASKED);
        m.setColorAt(i, color);
        continue;
      }
      color.copy(OFF).lerp(MID, c.v);
      if (c.v > 0.45) color.lerp(HOT, (c.v - 0.45) * 1.4);
      if (c.row === head) color.lerp(WHITE, 0.22 + c.v * 0.35);
      m.setColorAt(i, color);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;

    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = p * (active ? 1 : 0.4);
    mat.depthWrite = false;
  });

  const bg = (n * step + 0.2);

  return (
    <group position={position} rotation={[tilt, 0, 0]}>
      <mesh position={[0, 0, -0.035]}>
        <planeGeometry args={[bg + 0.28, bg + 0.28]} />
        <meshStandardMaterial color="#080f20" roughness={0.9} metalness={0.1} />
      </mesh>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, n * n]}
        frustumCulled={false}
      >
        <planeGeometry args={[cellSize, cellSize]} />
        <meshBasicMaterial transparent opacity={1} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
