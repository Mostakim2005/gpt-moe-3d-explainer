import { useEffect, useRef } from 'react';
import { selectAtEnd, useSceneStore } from '../state/useSceneStore';
import { getChapter, getStep, narrationText } from '../content';
import { CanvasRoot } from '../three/CanvasRoot';
import { AnnotationOverlay } from '../three/labels/AnnotationOverlay';
import { useAnnotations } from '../scenes/annotations';
import { ChapterTabs } from './ChapterTabs';
import { StepList } from './StepList';
import { NarrationPanel } from './NarrationPanel';
import { Timeline } from './Timeline';
import { Controls } from './Controls';
import { useTtsStore } from '../tts/useTts';

export function Shell() {
  const chapter = useSceneStore((s) => s.chapter);
  const step = useSceneStore((s) => s.step);
  const annotations = useAnnotations(chapter);
  const atEnd = useSceneStore(selectAtEnd);

  const speak = useTtsStore((s) => s.speak);
  const stop = useTtsStore((s) => s.stop);
  const autoNarrate = useTtsStore((s) => s.autoNarrate);

  const currentStep = getStep(chapter, step);
  const currentChapter = getChapter(chapter);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }
      const s = useSceneStore.getState();
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          s.next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          s.prev();
          break;
        case ' ':
          if (target?.tagName === 'BUTTON') return;
          e.preventDefault();
          if (s.step >= currentChapter.steps.length - 1) {
            s.setStep(0);
            s.setPlaying(true);
          } else {
            s.setPlaying(!s.playing);
          }
          break;
        case 'x':
        case 'X':
          s.setXray(!s.xray);
          break;
        case 'l':
        case 'L':
          s.setLabels(!s.labels);
          break;
        case 'r':
        case 'R':
          s.resetCamera();
          break;
        case 'n':
        case 'N': {
          const tts = useTtsStore.getState();
          if (tts.speaking) tts.stop();
          else void tts.speak(narrationText(getStep(s.chapter, s.step)));
          break;
        }
        case 'Escape':
          s.setSelected(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentChapter]);

  // Auto narration: read each step as it becomes active, or stop stale manual speech.
  const lastNarrated = useRef<string>('');
  useEffect(() => {
    if (!autoNarrate) {
      lastNarrated.current = '';
      stop();
      return;
    }
    const key = `${chapter}:${step}`;
    if (lastNarrated.current === key) return;
    lastNarrated.current = key;
    void speak(narrationText(currentStep));
  }, [autoNarrate, chapter, step, currentStep, speak, stop]);

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <div>
            <h1>GPT &amp; Mixture of Experts</h1>
            <p>An interactive 3D explainer</p>
          </div>
        </div>
        <Controls />
      </header>

      <ChapterTabs />

      <main className="shell-main">
        <aside className="rail">
          <StepList />
        </aside>

        <section className="stage">
          <div className="stage-canvas">
            <CanvasRoot annotations={annotations} />
            <AnnotationOverlay items={annotations} />
          </div>
          <Timeline />
        </section>

        <aside className="narration-wrap">
          <NarrationPanel />
        </aside>
      </main>

      <footer className="shell-footer">
        <span>
          Drag to orbit · Scroll to zoom · ← → step · Space play · N narrate · X x-ray · L labels ·
          R reset view
        </span>
        <span>
          {atEnd ? 'Last step' : `Step ${step + 1} of ${currentChapter.steps.length}`} · all numbers
          illustrative
        </span>
      </footer>
    </div>
  );
}
