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
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
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
          e.preventDefault();
          if (s.step >= currentChapter.steps.length - 1) s.setStep(0);
          s.setPlaying(!s.playing);
          break;
        case 'x':
        case 'X':
          s.setXray(!s.xray);
          break;
        case 'l':
        case 'L':
          s.setLabels(!s.labels);
          break;
        case 'n':
        case 'N':
          void useTtsStore.getState().speak(narrationText(getStep(s.chapter, s.step)));
          break;
        case 'Escape':
          useSceneStore.getState().setSelected(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentChapter]);

  // Auto narration: read each step as it becomes active.
  const lastNarrated = useRef<string>('');
  useEffect(() => {
    if (!autoNarrate) return;
    const key = `${chapter}:${step}`;
    if (lastNarrated.current === key) return;
    lastNarrated.current = key;
    void speak(narrationText(currentStep));
  }, [autoNarrate, chapter, step, currentStep, speak]);

  useEffect(() => {
    if (!autoNarrate) {
      lastNarrated.current = '';
      stop();
    }
  }, [autoNarrate, stop]);

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
          Drag to orbit · Scroll to zoom · Click a part to inspect · ← → step · Space play · N
          narrate · X x-ray · L labels
        </span>
        <span>
          {atEnd ? 'Last step' : `Step ${step + 1} of ${currentChapter.steps.length}`} · all numbers
          illustrative
        </span>
      </footer>
    </div>
  );
}
