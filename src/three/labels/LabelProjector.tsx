import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../state/useSceneStore';
import { setProjected } from './projection';
import type { Annotation } from './types';

/**
 * Projects every annotation anchor to CSS pixels.
 *
 * Runs in the render loop while the scene is animating. A timer covers the case
 * where the render loop is paused (background tab), so captions are already in
 * place the moment the tab is foregrounded again.
 */
export function LabelProjector({ items }: { items: Annotation[] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const vector = useMemo(() => new THREE.Vector3(), []);

  const project = useCallback(() => {
    const { step, labels } = useSceneStore.getState();
    for (const a of items) {
      const inRange = step >= a.from && step < a.to;
      vector.set(a.at[0], a.at[1], a.at[2]).project(camera);
      const onScreen = inRange && labels && vector.z < 1;
      setProjected(
        a.id,
        (vector.x * 0.5 + 0.5) * size.width,
        (-vector.y * 0.5 + 0.5) * size.height,
        onScreen,
      );
    }
  }, [items, vector, camera, size]);

  useFrame(project);

  // The interval must always call the newest `project` without being torn down
  // and rebuilt on every prop change, so it reads through a ref that an effect
  // keeps current (rather than assigning the ref during render).
  const latest = useRef(project);
  useEffect(() => {
    latest.current = project;
  }, [project]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) latest.current();
    }, 150);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
