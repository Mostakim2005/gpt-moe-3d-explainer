import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
 * Glides the camera to each step's pose, then hands control back to the user.
 *
 * Uses a capture-phase pointerdown/wheel listener to re-enable OrbitControls
 * synchronously before OrbitControls' own listener runs, so the user's first
 * drag during a glide is never swallowed.
 */
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const auto = useRef(true);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const chapter = useSceneStore((s) => s.chapter);
  const step = useSceneStore((s) => s.step);

  const pose = getStep(chapter, step).camera;
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // Scratch vectors for the damp targets, allocated once per mount.
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetLook = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    auto.current = true;
  }, [chapter, step]);

  useEffect(() => {
    const el = gl.domElement;
    const release = () => {
      auto.current = false;
      if (controls.current) controls.current.enabled = true;
    };
    el.addEventListener('pointerdown', release, { capture: true });
    el.addEventListener('wheel', release, { passive: true, capture: true });
    return () => {
      el.removeEventListener('pointerdown', release, { capture: true });
      el.removeEventListener('wheel', release, { capture: true });
    };
  }, [gl]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || !pose) return;
    const d = Math.min(dt, 0.05);
    const aspect = size.width / Math.max(1, size.height);
    placePose(pose, aspect, targetPos, targetLook);

    if (!auto.current) {
      c.enabled = true;
      return;
    }

    if (reducedMotion) {
      // oxlint-disable-next-line react/immutability
      camera.position.copy(targetPos);
      c.target.copy(targetLook);
      auto.current = false;
      c.enabled = true;
      c.update();
      return;
    }

    c.enabled = false;

    const lambda = 4.2;
    // oxlint-disable-next-line react/immutability
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.x, lambda, d);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.y, lambda, d);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.z, lambda, d);
    c.target.x = THREE.MathUtils.damp(c.target.x, targetLook.x, lambda, d);
    c.target.y = THREE.MathUtils.damp(c.target.y, targetLook.y, lambda, d);
    c.target.z = THREE.MathUtils.damp(c.target.z, targetLook.z, lambda, d);

    if (camera.position.distanceTo(targetPos) < 0.05 && c.target.distanceTo(targetLook) < 0.05) {
      auto.current = false;
      c.enabled = true;
      c.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={3.5}
      maxDistance={30}
      maxPolarAngle={Math.PI * 0.56}
      minPolarAngle={Math.PI * 0.12}
    />
  );
}
