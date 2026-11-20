import { useState } from 'react';
import { CONCEPT_CHECKS } from '../content/conceptChecks';

/** Compact 1-question self-check card for key conceptual steps. */
export function ConceptCheck({ stepKey }: { stepKey: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const q = CONCEPT_CHECKS[stepKey];
  if (!q) return null;

  const isCorrect = picked === q.answerIndex;

  return (
    <div className="check-block" role="region" aria-label="Quick concept check">
      <span className="check-label">Quick check</span>
      <p className="check-prompt">{q.prompt}</p>
      <div className="check-choices">
        {q.choices.map((choice, idx) => {
          const state =
            picked === null
              ? ''
              : idx === q.answerIndex
                ? ' correct'
                : idx === picked
                  ? ' wrong'
                  : '';
          return (
            <button
              key={choice}
              className={`check-btn${state}`}
              aria-pressed={picked === idx}
              onClick={() => setPicked(idx)}
            >
              {choice}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className={isCorrect ? 'check-feedback ok' : 'check-feedback bad'}>
          <strong>{isCorrect ? 'Correct.' : 'Not quite.'}</strong> {q.explanation}
        </p>
      )}
    </div>
  );
}
