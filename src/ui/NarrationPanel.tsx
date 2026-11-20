import { useState } from 'react';
import { useSceneStore } from '../state/useSceneStore';
import { getChapter, narrationText } from '../content';
import { LOGIT_VALUES, LOGIT_WORDS, softmax } from '../scenes/gptData';
import { TOTAL_PARAMS_B, activeParamsB } from '../scenes/moeData';
import { VoicePanel } from './VoicePanel';

function sampleToken(temperature: number, topP: number): { word: string; prob: number } {
  const probs = softmax(LOGIT_VALUES, temperature);
  const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]);
  const kept: Array<{ idx: number; p: number }> = [];
  let cum = 0;
  for (const idx of order) {
    kept.push({ idx, p: probs[idx] });
    cum += probs[idx];
    if (cum >= topP) break;
  }
  const total = kept.reduce((acc, item) => acc + item.p, 0);
  let r = Math.random() * total;
  for (const item of kept) {
    r -= item.p;
    if (r <= 0) return { word: LOGIT_WORDS[item.idx], prob: item.p };
  }
  const last = kept[kept.length - 1];
  return { word: LOGIT_WORDS[last.idx], prob: last.p };
}

export function NarrationPanel() {
  const chapter = useSceneStore((s) => s.chapter);
  const step = useSceneStore((s) => s.step);
  const temperature = useSceneStore((s) => s.temperature);
  const setTemperature = useSceneStore((s) => s.setTemperature);
  const topP = useSceneStore((s) => s.topP);
  const setTopP = useSceneStore((s) => s.setTopP);
  const topK = useSceneStore((s) => s.topK);
  const setTopK = useSceneStore((s) => s.setTopK);
  const loadBalancing = useSceneStore((s) => s.loadBalancing);
  const setLoadBalancing = useSceneStore((s) => s.setLoadBalancing);

  const [sampled, setSampled] = useState<{ word: string; prob: number } | null>(null);

  const ch = getChapter(chapter);
  const current = ch.steps[Math.max(0, Math.min(ch.steps.length - 1, step))];
  if (!current) return null;

  const isGptTemp = chapter === 'gpt' && (current.id === 'logits' || current.id === 'sampling');
  const isGptSampling = chapter === 'gpt' && current.id === 'sampling';
  const isMoeTopK = chapter === 'moe' && (current.id === 'topk' || current.id === 'experts');
  const isMoeEconomics = chapter === 'moe' && current.id === 'economics';
  const isMoeBalance = chapter === 'moe' && current.id === 'loadbalance';

  const numbers = isMoeEconomics
    ? [
        { label: `Active (k = ${topK})`, value: `${activeParamsB(topK)}B / ${TOTAL_PARAMS_B}B` },
        { label: 'Compute saving', value: `${(TOTAL_PARAMS_B / activeParamsB(topK)).toFixed(1)}× vs dense` },
      ]
    : current.numbers;

  return (
    <div className="narration-stack">
      <VoicePanel text={narrationText(current)} />

      <article key={`${chapter}-${step}`} className="narration narration-enter">
        <div className="narration-kicker">
          Step {step + 1} / {ch.steps.length} · {current.short}
        </div>
        <h2>{current.title}</h2>
        <p className="narration-body">{current.body}</p>

        {current.see.length > 0 && (
          <div className="see-block">
            <span className="see-label">What you are looking at</span>
            <ul className="see-list">
              {current.see.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="narration-why">
          <span className="why-label">Why it matters</span>
          <p>{current.why}</p>
        </div>

        {current.terms && current.terms.length > 0 && (
          <div className="terms-block">
            <span className="terms-label">Terms introduced here</span>
            <dl className="terms-list">
              {current.terms.map((t) => (
                <div key={t.term} className="term">
                  <dt>{t.term}</dt>
                  <dd>{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {current.tryIt && (
          <div className="try-block">
            <span className="try-label">Try it</span>
            <p>{current.tryIt}</p>
          </div>
        )}

        {numbers && (
          <dl className="stat-row">
            {numbers.map((n) => (
              <div key={n.label} className="stat">
                <dt>{n.label}</dt>
                <dd>{n.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {isGptTemp && (
          <label className="slider">
            <span>
              Temperature <strong>{temperature.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
            />
          </label>
        )}

        {isGptSampling && (
          <div className="slider">
            <label className="slider-inner">
              <span>
                Top-p nucleus <strong>{topP.toFixed(2)}</strong>
              </span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
              />
            </label>
            <div className="sample-roll">
              <button
                className="seg-btn active"
                onClick={() => setSampled(sampleToken(temperature, topP))}
              >
                Roll sample
              </button>
              {sampled && (
                <span className="sample-result">
                  Next token: <strong>&ldquo;{sampled.word}&rdquo;</strong> ({(sampled.prob * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}

        {isMoeTopK && (
          <div className="slider" role="group" aria-label="Top-k experts">
            <span>
              Top-k experts <strong>{topK}</strong>
            </span>
            <div className="seg">
              {([1, 2, 3, 4] as const).map((k) => (
                <button
                  key={k}
                  className={k === topK ? 'seg-btn active' : 'seg-btn'}
                  aria-pressed={k === topK}
                  onClick={() => setTopK(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {isMoeEconomics && (
          <div className="slider" role="group" aria-label="Compute with top-k experts">
            <span>
              Compute with k = <strong>{topK}</strong>
            </span>
            <div className="seg">
              {([1, 2, 3, 4] as const).map((k) => (
                <button
                  key={k}
                  className={k === topK ? 'seg-btn active' : 'seg-btn'}
                  aria-pressed={k === topK}
                  onClick={() => setTopK(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {isMoeBalance && (
          <div className="slider" role="group" aria-label="Load balancing">
            <span>Load balancing</span>
            <div className="seg">
              <button
                className={!loadBalancing ? 'seg-btn active' : 'seg-btn'}
                aria-pressed={!loadBalancing}
                onClick={() => setLoadBalancing(false)}
              >
                Off
              </button>
              <button
                className={loadBalancing ? 'seg-btn active' : 'seg-btn'}
                aria-pressed={loadBalancing}
                onClick={() => setLoadBalancing(true)}
              >
                On
              </button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
