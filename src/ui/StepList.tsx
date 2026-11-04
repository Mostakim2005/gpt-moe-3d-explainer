import { useSceneStore } from '../state/useSceneStore';
import { chapters } from '../content';

export function StepList() {
  const chapter = useSceneStore((s) => s.chapter);
  const step = useSceneStore((s) => s.step);
  const setStep = useSceneStore((s) => s.setStep);

  const ch = chapters.find((c) => c.id === chapter);
  if (!ch) return null;

  return (
    <ol className="step-list">
      {ch.steps.map((s, i) => (
        <li key={s.id}>
          <button
            className={i === step ? 'step-item active' : i < step ? 'step-item done' : 'step-item'}
            onClick={() => setStep(i)}
            aria-current={i === step}
          >
            <span className="step-num">{i + 1}</span>
            <span className="step-name">{s.short}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
