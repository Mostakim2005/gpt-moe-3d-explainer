import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../state/useSceneStore';

interface PresenceState {
  p: number;
  t: number;
  on: boolean;
}

/**
 * Damped 0→1 presence for a component with a step visibility window.
 *
 * Reads `step` directly from the store inside `useFrame` so stepping never
 * triggers React re-renders across dozens of 3D primitives.
 */
export function usePresence(range: [number, number], delay = 0) {
  const [from, to] = range;
  const state = useRef<PresenceState>({ p: 0, t: 0, on: false });

  useFrame((_, dt) => {
    const step = useSceneStore.getState().step;
    const inRange = step >= from && step < to;
    const s = state.current;
    const d = Math.min(dt, 0.05);
    if (inRange) {
      if (!s.on) {
        s.on = true;
        s.t = 0;
      }
      s.t += d;
      const target = THREE.MathUtils.clamp((s.t - delay) / 0.5, 0, 1);
      s.p = THREE.MathUtils.damp(s.p, target, 11, d);
    } else {
      s.on = false;
      s.t = 0;
      s.p = THREE.MathUtils.damp(s.p, 0, 15, d);
    }
  });

  return { ref: state };
}

/** Dim factor helpers shared by every primitive. */
export const ACTIVE_EMISSIVE = 0.62;
export const DIM_EMISSIVE = 0.06;
export const ACTIVE_OPACITY = 0.92;
export const DIM_OPACITY = 0.16;
