import { CameraControls } from '@react-three/drei';
import { type ComponentRef, useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../state/useSceneStore';
import { getStep } from '../content';

type Pose = { p: [number, number, number]; t: [number, number, number] };

/**
 * Where the camera wants to be for a pose, given the canvas aspect.
 */
function placePose(
  pose: Pose,
  aspect: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3,
): void {
  outLook.set(pose.t[0], pose.t[1], pose.t[2]);
  const pullBack = THREE.MathUtils.clamp(1.45 / Math.max(0.45, aspect), 1, 2.1);
  outPos
    .set(pose.p[0], pose.p[1], pose.p[2])
    .sub(outLook)
    .multiplyScalar(pullBack)
    .add(outLook);
}

/**
 * Smoothly transitions the camera to each step's pose using `camera-controls`
 * (bundled in `@react-three/drei`). User drag or scroll interrupts any active
 * transition immediately without swallowing the first pointer event.
 */
export function CameraRig() {
  const controls = useRef<ComponentRef<typeof CameraControls>>(null);
  const size = useThree((s) => s.size);

  const chapter = useSceneStore((s) => s.chapter);
  const step = useSceneStore((s) => s.step);
  const cameraResetSeq = useSceneStore((s) => s.cameraResetSeq);

  const pose = getStep(chapter, step).camera;
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetLook = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const c = controls.current;
    if (!c || !pose) return;
    const aspect = size.width / Math.max(1, size.height);
    placePose(pose, aspect, targetPos, targetLook);
    void c.setLookAt(
      targetPos.x,
      targetPos.y,
      targetPos.z,
      targetLook.x,
      targetLook.y,
      targetLook.z,
      !reducedMotion,
    );
  }, [chapter, step, cameraResetSeq, pose, size.width, size.height, reducedMotion, targetPos, targetLook]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.45}
      draggingSmoothTime={0.12}
      truckSpeed={0}
      minDistance={3.5}
      maxDistance={30}
      minPolarAngle={Math.PI * 0.12}
      maxPolarAngle={Math.PI * 0.56}
    />
  );
}
