import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { C } from './constants';
import { usePresence } from './usePresence';

interface Props {
  /** Number of stacked slabs. */
  count: number;
  range: [number, number];
  position?: [number, number, number];
  /** Vertical distance between slab centres. */
  spacing?: number;
  block?: [number, number, number];
  /** Two colours alternate up the stack. */
  palette?: [string, string];
  active?: boolean;
  delay?: number;
  /** Seconds per full pass of the travelling highlight. */
  period?: number;
}

/**
 * The transformer stack: slabs plus a light pulse that climbs through them,
 * so "the output of one block feeds the next" is visible rather than implied.
 */
export function Tower({
  count,
  range,
  position = [0, 0, 0],
  spacing = 0.46,
  block = [3.4, 0.34, 1.5],
  palette = [C.cyan, C.violet],
  active = true,
  delay = 0,
  period = 3.6,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const { ref } = usePresence(range, delay);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const p = ref.current.p;
    g.scale.setScalar(Math.max(0.0001, p));
    g.visible = p > 0.01;

    const t = state.clock.elapsedTime;
    const cycle = (t / period) % 1;
    const head = cycle * (count + 3) - 1.5;

    for (let i = 0; i < count; i++) {
      const m = mats.current[i];
      if (!m) continue;
      const dist = i - head;
      const boost = Math.exp((-dist * dist) / 1.1);
      const base = active ? 0.1 : 0.05;
      m.emissiveIntensity = (base + boost * 1.05) * p;
      m.opacity = (0.24 + boost * 0.72) * p;
      m.depthWrite = m.opacity > 0.55;
    }
  });

  return (
    <group ref={group} position={position}>
      {/* spine */}
      <mesh position={[0, ((count - 1) * spacing) / 2, 0]}>
        <cylinderGeometry args={[0.035, 0.035, Math.max(0.1, (count - 1) * spacing), 8]} />
        <meshBasicMaterial color={C.cyan} transparent opacity={0.25} toneMapped={false} />
      </mesh>

      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[0, i * spacing, 0]}>
          <boxGeometry args={block} />
          <meshStandardMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            color={i % 2 === 0 ? palette[0] : palette[1]}
            emissive={i % 2 === 0 ? palette[0] : palette[1]}
            emissiveIntensity={0.4}
            roughness={0.35}
            metalness={0.2}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}
