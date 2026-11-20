import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { C } from './constants';
import { usePresence } from './usePresence';

interface Props {
  from: [number, number, number];
  to: [number, number, number];
  range: [number, number];
  active?: boolean;
  color?: string;
  /** Tube thickness. */
  radius?: number;
  /** Height of the arc apex above the endpoints. */
  lift?: number;
  /** Send a light pulse along the arc. */
  flow?: boolean;
  flowSpeed?: number;
  /** Phase offset for the flow pulse (0..1). */
  phase?: number;
  delay?: number;
}

/**
 * A curved connection between two points with a travelling light pulse.
 *
 * The tube "draws itself" on entry by animating the geometry draw range, which
 * makes the direction of information flow readable instead of a static wire.
 */
export function Arc({
  from,
  to,
  range,
  active = true,
  color = C.cyan,
  radius = 0.045,
  lift = 1.1,
  flow = true,
  flowSpeed = 0.45,
  phase = 0,
  delay = 0,
}: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const { ref } = usePresence(range, delay);

  const [fx, fy, fz] = from;
  const [tx, ty, tz] = to;

  const { geometry, curve, indexCount } = useMemo(() => {
    const mid = new THREE.Vector3(
      (fx + tx) / 2,
      Math.max(fy, ty) + lift,
      (fz + tz) / 2,
    );
    const c = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(fx, fy, fz),
      mid,
      new THREE.Vector3(tx, ty, tz),
    );
    const geo = new THREE.TubeGeometry(c, 40, radius, 6, false);
    return {
      geometry: geo,
      curve: c,
      indexCount: geo.index ? geo.index.count : 0,
    };
  }, [fx, fy, fz, tx, ty, tz, radius, lift]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, dt) => {
    const m = mesh.current;
    const p = ref.current.p;
    const d = Math.min(dt, 0.06);

    if (m) {
      m.visible = p > 0.01;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.opacity = THREE.MathUtils.damp(mat.opacity, p * (active ? 0.95 : 0.22), 10, d);
      mat.emissiveIntensity = (active ? 1.1 : 0.2) * p;
      mat.depthWrite = false;
      geometry.setDrawRange(0, Math.floor(indexCount * Math.min(1, p * 1.15)));
    }

    const q = pulse.current;
    if (q) {
      const on = flow && p > 0.6;
      q.visible = on;
      if (on) {
        const t = ((state.clock.elapsedTime * flowSpeed + phase) % 1 + 1) % 1;
        curve.getPointAt(t, q.position);
        const s = 0.55 + 0.45 * Math.sin(t * Math.PI);
        q.scale.setScalar(Math.max(0.001, s * p));
      }
    }
  });

  return (
    <group>
      <mesh ref={mesh} geometry={geometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1}
          roughness={0.3}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={pulse}>
        <sphereGeometry args={[radius * 2.6, 12, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} />
      </mesh>
    </group>
  );
}
