import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { Stage } from './Stage';
import { LabelProjector } from './labels/LabelProjector';
import { GptScene } from '../scenes/GptScene';
import { MoeScene } from '../scenes/MoeScene';
import { useSceneStore } from '../state/useSceneStore';
import type { Annotation } from './labels/types';
import { BG } from './shared/constants';

export function CanvasRoot({ annotations }: { annotations: Annotation[] }) {
  const chapter = useSceneStore((s) => s.chapter);
  const bloom = useSceneStore((s) => s.bloom);
  const setSelected = useSceneStore((s) => s.setSelected);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 3, 12], fov: 46, near: 0.1, far: 120 }}
      onPointerMissed={() => setSelected(null)}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 16, 40]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 10, 6]} intensity={1.0} />
      <directionalLight position={[-6, 4, -6]} intensity={0.45} color="#a970ff" />

      <Stage />
      <CameraRig />
      <LabelProjector items={annotations} />

      <Suspense fallback={null}>
        {chapter === 'gpt' ? <GptScene /> : <MoeScene />}
      </Suspense>

      {bloom && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            intensity={0.85}
            luminanceThreshold={0.18}
            luminanceSmoothing={0.3}
            radius={0.72}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.22} darkness={0.72} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
