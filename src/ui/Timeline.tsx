import { useEffect } from 'react';
import { selectAtEnd, useSceneStore, type Speed } from '../state/useSceneStore';
import { chapters } from '../content';
import { useTtsStore } from '../tts/useTts';

export function Timeline() {
  const chapter = useSceneStore((s) => s.chapter);
  const step = useSceneStore((s) => s.step);
  const playing = useSceneStore((s) => s.playing);
  const setPlaying = useSceneStore((s) => s.setPlaying);
  const speed = useSceneStore((s) => s.speed);
  const setSpeed = useSceneStore((s) => s.setSpeed);
  const next = useSceneStore((s) => s.next);
  const prev = useSceneStore((s) => s.prev);
  const setStep = useSceneStore((s) => s.setStep);
  const atEnd = useSceneStore(selectAtEnd);
  const speaking = useTtsStore((s) => s.speaking);

  const ch = chapters.find((c) => c.id === chapter);
  const durationMs = ch?.steps[step]?.durationMs ?? 6000;

  // Autoplay: hold while the narrator is still reading, so steps never get cut off.
  useEffect(() => {
    if (!playing) return;
    if (step >= (ch?.steps.length ?? 1) - 1) {
      setPlaying(false);
      return;
    }
    if (speaking) return;
    const t = setTimeout(() => next(), durationMs / speed);
    return () => clearTimeout(t);
  }, [playing, step, ch, durationMs, speed, next, setPlaying, speaking]);

  if (!ch) return null;
  const max = ch.steps.length - 1;

  return (
    <div className="timeline">
      <button className="t-btn" onClick={prev} disabled={step === 0} aria-label="Previous step">
        ‹
      </button>
      <button
        className="t-btn t-play"
        onClick={() => {
          if (atEnd) {
            setStep(0);
            setPlaying(true);
          } else {
            setPlaying(!playing);
          }
        }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? '❙❙' : '▶'}
      </button>
      <button className="t-btn" onClick={next} disabled={atEnd} aria-label="Next step">
        ›
      </button>

      <input
        type="range"
        min={0}
        max={max}
        value={step}
        onChange={(e) => setStep(parseInt(e.target.value, 10))}
        aria-label="Scrub steps"
      />

      <div className="seg speed">
        {([0.5, 1, 2] as Speed[]).map((s) => (
          <button
            key={s}
            className={s === speed ? 'seg-btn active' : 'seg-btn'}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>

      <span className="t-counter">
        {step + 1} / {ch.steps.length}
      </span>
    </div>
  );
}
