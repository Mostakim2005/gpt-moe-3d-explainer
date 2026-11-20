import { useEffect, useState } from 'react';
import { useSceneStore } from '../state/useSceneStore';

export function Controls() {
  const xray = useSceneStore((s) => s.xray);
  const setXray = useSceneStore((s) => s.setXray);
  const labels = useSceneStore((s) => s.labels);
  const setLabels = useSceneStore((s) => s.setLabels);
  const bloom = useSceneStore((s) => s.bloom);
  const setBloom = useSceneStore((s) => s.setBloom);
  const resetCamera = useSceneStore((s) => s.resetCamera);

  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  );

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <div className="controls">
      <button
        className={xray ? 'toggle active' : 'toggle'}
        aria-pressed={xray}
        onClick={() => setXray(!xray)}
        title="X-ray (X)"
      >
        X-ray
      </button>
      <button
        className={labels ? 'toggle active' : 'toggle'}
        aria-pressed={labels}
        onClick={() => setLabels(!labels)}
        title="Labels (L)"
      >
        Labels
      </button>
      <button
        className={bloom ? 'toggle active' : 'toggle'}
        aria-pressed={bloom}
        onClick={() => setBloom(!bloom)}
        title="Glow"
      >
        Glow
      </button>
      <button
        className="toggle"
        onClick={resetCamera}
        title="Reset camera view (R)"
        aria-label="Reset camera view"
      >
        Reset
      </button>
      <button
        className={isFullscreen ? 'toggle active' : 'toggle'}
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        onClick={() => {
          const op = document.fullscreenElement
            ? document.exitFullscreen()
            : document.documentElement.requestFullscreen();
          void op?.catch(() => {});
        }}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        ⤢
      </button>
    </div>
  );
}
