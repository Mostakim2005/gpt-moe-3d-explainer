import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../state/useSceneStore';
import { C } from './constants';
import { usePresence } from './usePresence';
import { TextSprite } from './TextSprite';

export interface Token {
  text: string;
  id: number;
}

interface Props {
  tokens: Token[];
  range: [number, number];
  /** Bright/focused vs. dimmed context. */
  active?: boolean;
  /** Show the integer id under each token. */
  showIds?: boolean;
  /** Per-token colour override. */
  highlight?: (i: number) => string | undefined;
  /** World offset of the row. */
  position?: [number, number, number];
}

export const CHIP_W = 1.24;
export const CHIP_H = 0.66;
const GAP = 0.2;

/** A row of rounded token chips with their ids. */
export function TokenRow({
  tokens,
  range,
  active = true,
  showIds = true,
  highlight,
  position = [0, 0, 0],
}: Props) {
  const group = useRef<THREE.Group>(null);
  const { ref } = usePresence(range);

  const xray = useSceneStore((s) => s.xray);
  const selected = useSceneStore((s) => s.selected);
  const setSelected = useSceneStore((s) => s.setSelected);

  const totalW = tokens.length * (CHIP_W + GAP) - GAP;
  const startX = -totalW / 2 + CHIP_W / 2;

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const p = ref.current.p;
    g.scale.setScalar(Math.max(0.0001, p));
    g.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.7) * 0.025 * p;
    g.visible = p > 0.01;
    void xray;
  });

  return (
    <group ref={group} position={position} scale={Math.max(0.0001, 0.0001)}>
      {tokens.map((tok, i) => {
        const c = highlight?.(i) ?? C.cyan;
        const key = `tok-${i}`;
        const isSelected = selected === key;
        return (
          <group key={i} position={[startX + i * (CHIP_W + GAP), 0, 0]}>
            <RoundedBox
              args={[CHIP_W, CHIP_H, 0.3]}
              radius={0.07}
              smoothness={3}
              onClick={(e) => {
                e.stopPropagation();
                setSelected(isSelected ? null : key);
              }}
            >
              <ChipMaterial color={c} active={active} range={range} delay={i * 0.06} />
            </RoundedBox>
            <TextSprite
              text={tok.text.trim()}
              position={[0, 0.1, 0.18]}
              size={0.24}
              color={C.text}
            />
            {showIds && (
              <TextSprite
                text={String(tok.id)}
                position={[0, -0.16, 0.18]}
                size={0.15}
                color={C.muted}
                weight={500}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Chip material with the same damped presence/opacity rules as NeonBox. */
function ChipMaterial({
  color,
  active,
  range,
  delay,
}: {
  color: string;
  active: boolean;
  range: [number, number];
  delay: number;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const { ref } = usePresence(range, delay);
  const xray = useSceneStore((s) => s.xray);

  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    const p = ref.current.p;
    const d = Math.min(dt, 0.05);
    m.opacity = THREE.MathUtils.damp(m.opacity, (active ? 0.95 : 0.28) * p * (xray ? 0.5 : 1), 10, d);
    m.emissiveIntensity = THREE.MathUtils.damp(
      m.emissiveIntensity,
      (active ? 0.5 : 0.08) * p,
      10,
      d,
    );
    m.depthWrite = m.opacity > 0.6;
  });

  return (
    <meshStandardMaterial
      ref={mat}
      color={color}
      emissive={color}
      emissiveIntensity={0.5}
      roughness={0.3}
      metalness={0.1}
      transparent
      opacity={0.95}
    />
  );
}
