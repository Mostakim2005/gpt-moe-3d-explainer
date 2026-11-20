import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Soft radial glow used as a floor so objects feel grounded without shadows. */
function useGlowTexture() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(56,225,255,0.30)');
      g.addColorStop(0.45, 'rgba(80,120,255,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/**
 * Deterministic PRNG (mulberry32).
 *
 * The dust field must look scattered but must also be identical on every mount:
 * `Math.random()` inside a `useMemo` re-rolls whenever React discards the memo,
 * so the background visibly reshuffles on a hot reload or a re-mounted canvas.
 * A fixed seed makes the decoration a pure function of the code.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ground grid, a soft floor glow and slow-drifting dust. */
export function Stage() {
  const dust = useRef<THREE.Points>(null);
  const glow = useGlowTexture();
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const geometry = useMemo(() => {
    const rand = mulberry32(0x5eed);
    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * 34;
      positions[i * 3 + 1] = rand() * 14;
      positions[i * 3 + 2] = (rand() - 0.5) * 34;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, dt) => {
    const d = dust.current;
    if (!d || reducedMotion) return;
    d.rotation.y += Math.min(dt, 0.05) * 0.012;
    d.position.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.12;
  });

  return (
    <group>
      <gridHelper args={[44, 44, 0x1c2c4e, 0x0c1424]} position={[0, -0.02, 0]} />
      <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[26, 26]} />
        <meshBasicMaterial
          map={glow}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <points ref={dust} geometry={geometry}>
        <pointsMaterial
          size={0.05}
          color={0x3d5a8a}
          transparent
          opacity={0.5}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
}
