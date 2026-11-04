import { useEffect, useMemo, useRef } from 'react';
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
  const cameraRef = useRef(camera);
  const sizeRef = useRef(size);
  cameraRef.current = camera;
  sizeRef.current = size;

  const project = useMemo(
    () => () => {
      const cam = cameraRef.current;
      const dims = sizeRef.current;
      const { step, labels } = useSceneStore.getState();
      if (import.meta.env.DEV) {
        const w = window as unknown as Record<string, unknown>;
        w.__proj = ((w.__proj as number) ?? 0) + 1;
        const probe = new THREE.Vector3();
        w.__projInfo = {
          step,
          labels,
          hidden: document.hidden,
          cam: [cam.position.x, cam.position.y, cam.position.z].map((n) => +n.toFixed(2)),
          size: [dims.width, dims.height],
          pts: items.map((a) => {
            probe.set(a.at[0], a.at[1], a.at[2]).project(cam);
            return [a.id, +probe.z.toFixed(2), +probe.x.toFixed(2), +probe.y.toFixed(2)];
          }),
        };
      }
      for (const a of items) {
        const inRange = step >= a.from && step < a.to;
        vector.set(a.at[0], a.at[1], a.at[2]).project(cam);
        const onScreen = inRange && labels && vector.z < 1;
        setProjected(
          a.id,
          (vector.x * 0.5 + 0.5) * dims.width,
          (-vector.y * 0.5 + 0.5) * dims.height,
          onScreen,
        );
      }
    },
    [items, vector],
  );

  useFrame(project);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) project();
    }, 150);
    return () => window.clearInterval(id);
  }, [project]);

  return null;
}
