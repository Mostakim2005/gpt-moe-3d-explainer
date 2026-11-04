import { chapters } from './moeSteps';
import type { Chapter, ChapterDef, Step } from './types';

export { chapters };
export type { Chapter, ChapterDef, Step, CameraPose, KeyNumber } from './types';

export function getChapter(id: Chapter): ChapterDef {
  return chapters.find((c) => c.id === id) ?? chapters[0];
}

export function getStep(chapter: Chapter, index: number): Step {
  const ch = getChapter(chapter);
  return ch.steps[Math.max(0, Math.min(ch.steps.length - 1, index))];
}

/** Plain-text script for the narrator, assembled from the step's copy. */
export function narrationText(step: Step): string {
  const parts = [
    step.title + '.',
    step.body,
    'Why it matters. ' + step.why,
  ];
  if (step.tryIt) parts.push('Try this: ' + step.tryIt);
  return parts.join(' ');
}
