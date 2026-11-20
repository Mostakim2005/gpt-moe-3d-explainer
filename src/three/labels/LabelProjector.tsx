import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../state/useSceneStore';
import { clearProjected, notifyProjected, setProjected } from './projection';
import type { Annotation } from './types';

/**
 * Projects every annotation anchor to CSS pixels and immediately notifies the
 * DOM overlay in the same frame so captions stay locked to 3D geometry.
 */
export function LabelProjector({ items }: { items: Annotation[] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const vector = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    clearProjected();
  }, [items]);

  const project = useCallback(() => {
    const { step, labels } = useSceneStore.getState();
    for (const a of items) {
      const inRange = step >= a.from && step < a.to;
      vector.set(a.at[0], a.at[1], a.at[2]).project(camera);
      const onScreen = inRange && labels && vector.z >= -1 && vector.z <= 1;
      setProjected(
        a.id,
        (vector.x * 0.5 + 0.5) * size.width,
        (-vector.y * 0.5 + 0.5) * size.height,
        onScreen,
      );
    }
    notifyProjected();
  }, [items, vector, camera, size]);

  useFrame(project);

  const latest = useRef(project);
  useEffect(() => {
    latest.current = project;
  }, [project]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) latest.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return null;
}
