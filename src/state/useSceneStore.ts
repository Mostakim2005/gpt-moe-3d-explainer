import { create } from 'zustand';
import { chapters } from '../content';
import type { Chapter, Step } from '../content/types';

export type Speed = 0.5 | 1 | 2;

interface SceneStore {
  chapter: Chapter;
  step: number;
  playing: boolean;
  speed: Speed;
  xray: boolean;
  labels: boolean;
  bloom: boolean;
  selected: string | null;
  temperature: number;
  topK: 1 | 2 | 3 | 4;
  loadBalancing: boolean;
  cameraResetSeq: number;

  setChapter: (c: Chapter) => void;
  setStep: (i: number) => void;
  next: () => void;
  prev: () => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: Speed) => void;
  setXray: (v: boolean) => void;
  setLabels: (v: boolean) => void;
  setBloom: (v: boolean) => void;
  setSelected: (id: string | null) => void;
  setTemperature: (t: number) => void;
  setTopK: (k: 1 | 2 | 3 | 4) => void;
  setLoadBalancing: (v: boolean) => void;
  resetCamera: () => void;
}

function stepsOf(chapter: Chapter): Step[] {
  return (chapters.find((c) => c.id === chapter) ?? chapters[0]).steps;
}

function stepCount(chapter: Chapter): number {
  return stepsOf(chapter).length;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  chapter: 'gpt',
  step: 0,
  playing: false,
  speed: 1,
  xray: false,
  labels: true,
  bloom: true,
  selected: null,
  temperature: 0.8,
  topK: 2,
  loadBalancing: true,
  cameraResetSeq: 0,

  setChapter: (chapter) =>
    set({ chapter, step: 0, playing: false, selected: null }),
  setStep: (i) => {
    const max = stepCount(get().chapter) - 1;
    set({ step: Math.max(0, Math.min(max, i)), selected: null });
  },
  next: () => {
    const { chapter, step } = get();
    set({ step: Math.min(stepCount(chapter) - 1, step + 1), selected: null });
  },
  prev: () => set((s) => ({ step: Math.max(0, s.step - 1), selected: null })),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setXray: (xray) => set({ xray }),
  setLabels: (labels) => set({ labels }),
  setBloom: (bloom) => set({ bloom }),
  setSelected: (selected) => set({ selected }),
  setTemperature: (temperature) => set({ temperature }),
  setTopK: (topK) => set({ topK }),
  setLoadBalancing: (loadBalancing) => set({ loadBalancing }),
  resetCamera: () => set((s) => ({ cameraResetSeq: s.cameraResetSeq + 1 })),
}));

export const selectAtEnd = (s: SceneStore): boolean =>
  s.step >= stepCount(s.chapter) - 1;
