import { useSceneStore } from '../state/useSceneStore';

export function Controls() {
  const xray = useSceneStore((s) => s.xray);
  const setXray = useSceneStore((s) => s.setXray);
  const labels = useSceneStore((s) => s.labels);
  const setLabels = useSceneStore((s) => s.setLabels);
  const bloom = useSceneStore((s) => s.bloom);
  const setBloom = useSceneStore((s) => s.setBloom);

  return (
    <div className="controls">
      <button
        className={xray ? 'toggle active' : 'toggle'}
        onClick={() => setXray(!xray)}
        title="X-ray (X)"
      >
        X-ray
      </button>
      <button
        className={labels ? 'toggle active' : 'toggle'}
        onClick={() => setLabels(!labels)}
        title="Labels (L)"
      >
        Labels
      </button>
      <button
        className={bloom ? 'toggle active' : 'toggle'}
        onClick={() => setBloom(!bloom)}
        title="Glow"
      >
        Glow
      </button>
      <button
        className="toggle"
        onClick={() => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen();
        }}
        title="Fullscreen"
      >
        ⤢
      </button>
    </div>
  );
}

