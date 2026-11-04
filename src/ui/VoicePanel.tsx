import { useState } from 'react';
import { KITTEN_VOICES, useTtsStore } from '../tts/useTts';

interface Props {
  /** Full text to narrate for the current step. */
  text: string;
}

/**
 * Narrator controls.
 *
 * Two engines: the operating system's speech synthesis (instant, zero download)
 * and Kitten TTS Nano — a 15M-parameter neural model that runs locally in a
 * worker. The neural voice downloads on first use and is cached by the browser.
 */
export function VoicePanel({ text }: Props) {
  const [open, setOpen] = useState(false);

  const engine = useTtsStore((s) => s.engine);
  const setEngine = useTtsStore((s) => s.setEngine);
  const phase = useTtsStore((s) => s.phase);
  const progress = useTtsStore((s) => s.progress);
  const speaking = useTtsStore((s) => s.speaking);
  const autoNarrate = useTtsStore((s) => s.autoNarrate);
  const setAutoNarrate = useTtsStore((s) => s.setAutoNarrate);
  const rate = useTtsStore((s) => s.rate);
  const setRate = useTtsStore((s) => s.setRate);
  const speak = useTtsStore((s) => s.speak);
  const stop = useTtsStore((s) => s.stop);
  const preload = useTtsStore((s) => s.preload);
  const systemVoices = useTtsStore((s) => s.systemVoices);
  const systemVoice = useTtsStore((s) => s.systemVoice);
  const setSystemVoice = useTtsStore((s) => s.setSystemVoice);
  const kittenVoice = useTtsStore((s) => s.kittenVoice);
  const setKittenVoice = useTtsStore((s) => s.setKittenVoice);
  const error = useTtsStore((s) => s.error);

  const busy = phase === 'downloading' || phase === 'warming';

  return (
    <div className="voice">
      <div className="voice-row">
        <button
          className={speaking ? 'voice-play active' : 'voice-play'}
          onClick={() => (speaking ? stop() : void speak(text))}
          title="Read this step aloud (N)"
        >
          {speaking ? '■ Stop' : '▶ Listen'}
        </button>

        <label className="voice-auto" title="Read every step automatically">
          <input
            type="checkbox"
            checked={autoNarrate}
            onChange={(e) => setAutoNarrate(e.target.checked)}
          />
          <span>Auto</span>
        </label>

        <button
          className={open ? 'voice-gear active' : 'voice-gear'}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Voice {engine === 'kitten' ? '· Kitten' : '· System'} ⌄
        </button>
      </div>

      {busy && (
        <div className="voice-progress">
          <div className="voice-bar">
            <span style={{ width: `${Math.round((phase === 'warming' ? 1 : progress) * 100)}%` }} />
          </div>
          <span>
            {phase === 'warming'
              ? 'Warming up the model…'
              : `Downloading voice model… ${Math.round(progress * 100)}%`}
          </span>
        </div>
      )}

      {open && (
        <div className="voice-body">
          <div className="voice-field">
            <span className="voice-label">Engine</span>
            <div className="seg">
              <button
                className={engine === 'system' ? 'seg-btn active' : 'seg-btn'}
                onClick={() => setEngine('system')}
              >
                System voice
              </button>
              <button
                className={engine === 'kitten' ? 'seg-btn active' : 'seg-btn'}
                onClick={() => {
                  setEngine('kitten');
                  if (phase === 'idle') void preload();
                }}
              >
                Kitten · 15M
              </button>
            </div>
          </div>

          {engine === 'system' ? (
            <label className="voice-field">
              <span className="voice-label">Voice</span>
              <select
                value={systemVoice}
                onChange={(e) => setSystemVoice(e.target.value)}
                className="voice-select"
              >
                {systemVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="voice-field">
              <span className="voice-label">Voice</span>
              <select
                value={kittenVoice}
                onChange={(e) => setKittenVoice(e.target.value)}
                className="voice-select"
              >
                {KITTEN_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="voice-field">
            <span className="voice-label">
              Speed <strong>{rate.toFixed(1)}×</strong>
            </span>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.1}
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
            />
          </label>

          <p className="voice-note">
            {engine === 'kitten'
              ? 'Kitten TTS Nano: 15M parameters, English only, ~25 MB downloaded once and cached locally. Runs entirely on this device.'
              : 'Uses the voices already installed in your operating system — nothing to download, but the voice differs per machine.'}
          </p>

          {error && <p className="voice-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
