import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../state/useSceneStore';
import { C } from './constants';
import {
  ACTIVE_EMISSIVE,
  ACTIVE_OPACITY,
  DIM_EMISSIVE,
  DIM_OPACITY,
  usePresence,
} from './usePresence';

interface Props {
  id: string;
  position?: [number, number, number];
  size?: [number, number, number];
  color?: string;
  /** Step window in which this box is on screen. */
  range: [number, number];
  /** Bright/focused vs. dimmed context. */
  active?: boolean;
  /** Seconds of stagger when the step is entered. */
  delay?: number;
  radius?: number;
  /** Extra emissive pulse (per second) when active. */
  pulse?: number;
  /**
   * Where the box grows from as it appears. `'center'` (default) scales in place;
   * `'bottom'` rises out of its own base, which is what makes a pair of boxes
   * readable as a bar chart of proportions.
   */
  anchor?: 'center' | 'bottom';
  children?: React.ReactNode;
}

/** Rounded glowing slab: the workhorse primitive of both scenes. */
export function NeonBox({
  id,
  position = [0, 0, 0],
  size = [1, 1, 1],
  color = C.cyan,
  range,
  active = true,
  delay = 0,
  radius = 0.08,
  pulse = 0,
  anchor = 'center',
  children,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const hover = useRef(0);
  const { ref } = usePresence(range, delay);

  const xray = useSceneStore((s) => s.xray);
  const selected = useSceneStore((s) => s.selected);
  const setSelected = useSceneStore((s) => s.setSelected);

  const isSelected = selected === id;

  useFrame((state, dt) => {
    const g = group.current;
    const m = mat.current;
    if (!g || !m) return;
    const p = ref.current.p;
    const d = Math.min(dt, 0.05);

    const hoverTarget = isSelected ? 1 : 0;
    hover.current = THREE.MathUtils.damp(hover.current, hoverTarget, 10, d);
    const scale = Math.max(0.0001, p * (1 + hover.current * 0.06));
    g.scale.setScalar(scale);
    // Growing from the base keeps a bar's foot planted while its height changes.
    g.position.y = position[1] + (anchor === 'bottom' ? (size[1] / 2) * (scale - 1) : 0);
    g.visible = p > 0.01;

    const t = state.clock.elapsedTime;
    const wave = pulse ? (Math.sin(t * pulse) * 0.5 + 0.5) * 0.18 : 0;
    const emissive = (active ? ACTIVE_EMISSIVE : DIM_EMISSIVE) + wave;

    m.emissiveIntensity = THREE.MathUtils.damp(
      m.emissiveIntensity,
      emissive * p + (isSelected ? 0.5 : 0),
      10,
      d,
    );
    const baseOpacity = xray ? 0.2 : active ? ACTIVE_OPACITY : DIM_OPACITY;
    m.opacity = THREE.MathUtils.damp(m.opacity, baseOpacity * p, 10, d);
    m.transparent = true;
    m.depthWrite = m.opacity > 0.6 && !xray;
  });

  return (
    <group ref={group} position={position}>
      <RoundedBox
        args={size}
        radius={radius}
        smoothness={3}
        onClick={(e) => {
          e.stopPropagation();
          setSelected(isSelected ? null : id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <meshStandardMaterial
          ref={mat}
          color={color}
          emissive={color}
          emissiveIntensity={ACTIVE_EMISSIVE}
          roughness={0.34}
          metalness={0.18}
          transparent
          opacity={ACTIVE_OPACITY}
        />
        {(xray || isSelected) && (
          <Edges color={isSelected ? '#ffffff' : color} threshold={15} />
        )}
      </RoundedBox>
      {children}
    </group>
  );
}
