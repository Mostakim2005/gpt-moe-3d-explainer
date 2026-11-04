import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../state/useSceneStore';
import { chapters } from '../content';

const targetPos = new THREE.Vector3();
const targetLook = new THREE.Vector3();

type Pose = { p: [number, number, number]; t: [number, number, number] };

/** Where the camera wants to be for a pose, given the canvas aspect. */
function placePose(pose: Pose, aspect: number) {
  targetLook.set(pose.t[0], pose.t[1], pose.t[2]);
  // Narrow viewports lose horizontal field of view first, so back the camera
  // off proportionally instead of cropping the scene. The canvas here is often
  // taller than it is wide once the narration column is docked.
  const pullBack = THREE.MathUtils.clamp(1.45 / Math.max(0.45, aspect), 1, 2.1);
  targetPos
    .set(pose.p[0], pose.p[1], pose.p[2])
    .sub(targetLook)
    .multiplyScalar(pullBack)
    .add(targetLook);
  return { pos: targetPos, look: targetLook };
}

/**
 * Glides the camera to each step's pose, then hands control back to the user.
 *
 * While gliding, OrbitControls is disabled so damping and user input cannot
 * fight each other; any drag or wheel event cancels the glide immediately.
 */
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const auto = useRef(true);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const chapter = useSceneStore((s) => s.chapter);
  const step = useSceneStore((s) => s.step);

  const pose = chapters.find((c) => c.id === chapter)?.steps[step]?.camera;

  useEffect(() => {
    auto.current = true;
  }, [chapter, step]);

  useEffect(() => {
    const el = gl.domElement;
    const release = () => {
      auto.current = false;
    };
    el.addEventListener('pointerdown', release);
    el.addEventListener('wheel', release, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', release);
      el.removeEventListener('wheel', release);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || !pose) return;
    const d = Math.min(dt, 0.05);

    if (!auto.current) {
      c.enabled = true;
      return;
    }

    c.enabled = false;
    const aspect = size.width / Math.max(1, size.height);
    const { pos: targetPos, look: targetLook } = placePose(pose, aspect);

    const lambda = 4.2;
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

  // Dev-only: jump straight to the current pose. The automated label audit runs
  // in a background tab where the render loop is paused, so a glide would never
  // make progress.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__snapCam = () => {
      const c = controls.current;
      if (!c || !pose) return false;
      const aspect = size.width / Math.max(1, size.height);
      const { pos, look } = placePose(pose, aspect);
      camera.position.copy(pos);
      c.target.copy(look);
      auto.current = false;
      c.enabled = true;
      c.update();
      return true;
    };
  }, [pose, camera, size]);

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
