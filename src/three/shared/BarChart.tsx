import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../state/useSceneStore';
import { usePresence } from './usePresence';

interface Props {
  values: number[];
  /** Value that maps to the full bar height. */
  max: number;
  colors: string[];
  range: [number, number];
  position?: [number, number, number];
  /** Height of a full-value bar. */
  height?: number;
  spacing?: number;
  barWidth?: number;
  depth?: number;
  active?: boolean;
  delay?: number;
}

/**
 * Vertical bars whose heights damp toward the data, so both step changes and
 * live slider edits (temperature, k) animate instead of jumping.
 */
export function BarChart({
  values,
  max,
  colors,
  range,
  position = [0, 0, 0],
  height = 2.4,
  spacing = 1.15,
  barWidth = 0.8,
  depth = 0.45,
  active = true,
  delay = 0,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const baseMat = useRef<THREE.MeshStandardMaterial>(null);
  const heights = useRef<Float32Array>(new Float32Array(values.length));
  const mats = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  const { ref } = usePresence(range, delay);
  const xray = useSceneStore((s) => s.xray);

  const startX = -((values.length - 1) * spacing) / 2;
  const targets = values.map((v) => Math.max(0.04, (v / Math.max(max, 1e-6)) * height));

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const p = ref.current.p;
    const visible = p > 0.01;
    g.visible = visible;
    if (!visible) return;

    const d = Math.min(dt, 0.05);
    if (baseMat.current) {
      baseMat.current.opacity = p;
      baseMat.current.depthWrite = p > 0.6;
    }

    for (let i = 0; i < values.length; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      const target = targets[i] * p;
      const h = THREE.MathUtils.damp(heights.current[i], target, 8, d);
      heights.current[i] = h;
      m.scale.y = Math.max(0.0001, h);
      m.position.y = h / 2;

      const mat = mats.current[i];
      if (mat) {
        mat.opacity = THREE.MathUtils.damp(
          mat.opacity,
          (active ? 0.95 : 0.35) * p * (xray ? 0.6 : 1),
          10,
          d,
        );
        mat.emissiveIntensity = (active ? 0.75 : 0.15) * p;
        mat.depthWrite = mat.opacity > 0.6;
      }
    }
  });

  return (
    <group ref={group} position={position} visible={false}>
      {values.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          position={[startX + i * spacing, 0.02, 0]}
        >
          <boxGeometry args={[barWidth, 1, depth]} />
          <meshStandardMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            color={colors[i % colors.length]}
            emissive={colors[i % colors.length]}
            emissiveIntensity={0.7}
            roughness={0.3}
            metalness={0.15}
            transparent
            opacity={0.95}
          />
        </mesh>
      ))}
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[(values.length - 1) * spacing + barWidth + 0.5, 0.05, depth + 0.16]} />
        <meshStandardMaterial
          ref={baseMat}
          color="#16213c"
          roughness={0.85}
          metalness={0.1}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  );
}
