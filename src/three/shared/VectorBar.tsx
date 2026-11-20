import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../state/useSceneStore';
import { C } from './constants';
import { usePresence } from './usePresence';

interface Props {
  count: number;
  range: [number, number];
  active?: boolean;
  /** Colour ramp across the row (top half / bottom half, or alternating). */
  palette?: [string, string];
  /** Interleave the two palette colours instead of splitting the row. */
  alternate?: boolean;
  /** Distance between bar centres. */
  spacing?: number;
  /** Tallest bar height. */
  height?: number;
  position?: [number, number, number];
  /** Phase shift so neighbouring rows do not animate in lockstep. */
  phase?: number;
  delay?: number;
  barWidth?: number;
  /** Amplitude of a continuous breathing motion (0 = still). */
  live?: number;
}

/**
 * A row of bars standing for the elements of one vector.
 *
 * Instanced: each colour group is one draw call, while every bar keeps its own
 * damped height so a row visibly fills in when its step starts.
 */
export function VectorBarRow({
  count,
  range,
  active = true,
  palette = [C.cyan, C.violet],
  alternate = false,
  spacing = 0.26,
  height = 2.2,
  position = [0, 0, 0],
  phase = 0,
  delay = 0,
  barWidth = 0.15,
  live = 0,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const baseMat = useRef<THREE.MeshStandardMaterial>(null);
  const meshA = useRef<THREE.InstancedMesh>(null);
  const meshB = useRef<THREE.InstancedMesh>(null);
  const bars = useRef<Float32Array>(new Float32Array(count));
  const { ref } = usePresence(range, delay);
  const xray = useSceneStore((s) => s.xray);

  const startX = -((count - 1) * spacing) / 2;

  const { groupA, groupB } = useMemo(() => {
    const a: number[] = [];
    const b: number[] = [];
    for (let i = 0; i < count; i++) {
      const inA = alternate ? i % 2 === 0 : i < Math.ceil(count / 2);
      (inA ? a : b).push(i);
    }
    return { groupA: a, groupB: b };
  }, [count, alternate]);

  const targets = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      arr[i] = height * (0.32 + 0.68 * Math.abs(Math.sin(i * 0.8 + 1.1 + phase))) * (0.72 + 0.28 * t);
    }
    return arr;
  }, [count, height, phase]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, dt) => {
    const g = groupRef.current;
    const a = meshA.current;
    const b = meshB.current;
    if (!g || !a || !b) return;
    const p = ref.current.p;
    const visible = p > 0.01;
    g.visible = visible;
    if (!visible) return;

    if (baseMat.current) {
      baseMat.current.opacity = p;
      baseMat.current.depthWrite = p > 0.6;
    }

    const d = Math.min(dt, 0.05);
    const hs = bars.current;
    const t = state.clock.elapsedTime;

    for (const [mesh, group] of [
      [a, groupA] as const,
      [b, groupB] as const,
    ]) {
      group.forEach((barIndex, slot) => {
        const breathing = live ? 1 + Math.sin(t * 1.6 + barIndex * 0.7 + phase) * live : 1;
        hs[barIndex] = THREE.MathUtils.damp(hs[barIndex], targets[barIndex] * p * breathing, 9, d);
        const h = Math.max(0.0001, hs[barIndex]);
        dummy.position.set(startX + barIndex * spacing, h / 2, 0);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(slot, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = (active ? 0.95 : 0.3) * p * (xray ? 0.55 : 1);
      mat.emissiveIntensity = (active ? 0.72 : 0.12) * p;
      mat.depthWrite = mat.opacity > 0.6;
    }
  });

  return (
    <group ref={groupRef} position={position} visible={false}>
      <instancedMesh
        ref={meshA}
        args={[undefined, undefined, Math.max(1, groupA.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[barWidth, 1, barWidth]} />
        <meshStandardMaterial
          color={palette[0]}
          emissive={palette[0]}
          emissiveIntensity={0.7}
          roughness={0.25}
          metalness={0.1}
          transparent
          opacity={0.95}
        />
      </instancedMesh>
      <instancedMesh
        ref={meshB}
        args={[undefined, undefined, Math.max(1, groupB.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[barWidth, 1, barWidth]} />
        <meshStandardMaterial
          color={palette[1]}
          emissive={palette[1]}
          emissiveIntensity={0.7}
          roughness={0.25}
          metalness={0.1}
          transparent
          opacity={0.95}
        />
      </instancedMesh>
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[count * spacing + 0.24, 0.05, 0.26]} />
        <meshStandardMaterial
          ref={baseMat}
          color="#16213c"
          roughness={0.8}
          metalness={0.15}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  );
}
