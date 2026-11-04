import { AnimatePresence, motion } from 'framer-motion';
import { useSceneStore } from '../state/useSceneStore';
import { chapters, narrationText } from '../content';
import { VoicePanel } from './VoicePanel';

export function NarrationPanel() {
  const chapter = useSceneStore((s) => s.chapter);
  const step = useSceneStore((s) => s.step);
  const temperature = useSceneStore((s) => s.temperature);
  const setTemperature = useSceneStore((s) => s.setTemperature);
  const topK = useSceneStore((s) => s.topK);
  const setTopK = useSceneStore((s) => s.setTopK);
  const loadBalancing = useSceneStore((s) => s.loadBalancing);
  const setLoadBalancing = useSceneStore((s) => s.setLoadBalancing);

  const ch = chapters.find((c) => c.id === chapter);
  const current = ch?.steps[step];
  if (!ch || !current) return null;

  const isGptSampling = chapter === 'gpt' && current.id === 'sampling';
  const isMoeTopK = chapter === 'moe' && (current.id === 'topk' || current.id === 'experts');
  const isMoeEconomics = chapter === 'moe' && current.id === 'economics';
  const isMoeBalance = chapter === 'moe' && current.id === 'loadbalance';

  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={`${chapter}-${step}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22 }}
        className="narration"
      >
        <div className="narration-kicker">
          Step {step + 1} / {ch.steps.length} · {current.short}
        </div>
        <h2>{current.title}</h2>
        <p className="narration-body">{current.body}</p>

        <VoicePanel text={narrationText(current)} />

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

        {current.tryIt && (
          <div className="try-block">
            <span className="try-label">Try it</span>
            <p>{current.tryIt}</p>
          </div>
        )}

        {current.numbers && (
          <dl className="stat-row">
            {current.numbers.map((n) => (
              <div key={n.label} className="stat">
                <dt>{n.label}</dt>
                <dd>{n.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {isGptSampling && (
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

        {isMoeTopK && (
          <label className="slider">
            <span>
              Top-k experts <strong>{topK}</strong>
            </span>
            <div className="seg">
              {([1, 2, 3, 4] as const).map((k) => (
                <button
                  key={k}
                  className={k === topK ? 'seg-btn active' : 'seg-btn'}
                  onClick={() => setTopK(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </label>
        )}

        {isMoeEconomics && (
          <div className="slider">
            <span>
              Compute with k = <strong>{topK}</strong>
            </span>
            <div className="seg">
              {([1, 2, 3, 4] as const).map((k) => (
                <button
                  key={k}
                  className={k === topK ? 'seg-btn active' : 'seg-btn'}
                  onClick={() => setTopK(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {isMoeBalance && (
          <div className="slider">
            <span>Load balancing</span>
            <div className="seg">
              <button
                className={!loadBalancing ? 'seg-btn active' : 'seg-btn'}
                onClick={() => setLoadBalancing(false)}
              >
                Off
              </button>
              <button
                className={loadBalancing ? 'seg-btn active' : 'seg-btn'}
                onClick={() => setLoadBalancing(true)}
              >
                On
              </button>
            </div>
          </div>
        )}
      </motion.article>
    </AnimatePresence>
  );
}
