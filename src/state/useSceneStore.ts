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
  topP: number;
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
  setTopP: (p: number) => void;
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

function parseHash(): Partial<Pick<SceneStore, 'chapter' | 'step' | 'temperature' | 'topP' | 'topK'>> {
  if (typeof window === 'undefined' || !window.location.hash) return {};
  const raw = window.location.hash.slice(1);
  const [path, query = ''] = raw.split('?');
  const [chRaw, stepRaw] = path.split('/');
  const out: Partial<Pick<SceneStore, 'chapter' | 'step' | 'temperature' | 'topP' | 'topK'>> = {};
  if (chRaw === 'gpt' || chRaw === 'moe') {
    out.chapter = chRaw;
    const idx = Number.parseInt(stepRaw ?? '0', 10);
    if (Number.isFinite(idx)) {
      out.step = Math.max(0, Math.min(stepCount(chRaw) - 1, idx));
    }
  }
  const params = new URLSearchParams(query);
  const k = Number.parseInt(params.get('k') ?? '', 10);
  if (k === 1 || k === 2 || k === 3 || k === 4) out.topK = k;
  const t = Number.parseFloat(params.get('t') ?? '');
  if (Number.isFinite(t)) out.temperature = Math.max(0.1, Math.min(2, t));
  const p = Number.parseFloat(params.get('p') ?? '');
  if (Number.isFinite(p)) out.topP = Math.max(0.1, Math.min(1, p));
  return out;
}

const initial = parseHash();

export const useSceneStore = create<SceneStore>((set, get) => ({
  chapter: initial.chapter ?? 'gpt',
  step: initial.step ?? 0,
  playing: false,
  speed: 1,
  xray: false,
  labels: true,
  bloom: true,
  selected: null,
  temperature: initial.temperature ?? 0.8,
  topP: initial.topP ?? 0.9,
  topK: initial.topK ?? 2,
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
  setTopP: (topP) => set({ topP }),
  setTopK: (topK) => set({ topK }),
  setLoadBalancing: (loadBalancing) => set({ loadBalancing }),
  resetCamera: () => set((s) => ({ cameraResetSeq: s.cameraResetSeq + 1 })),
}));

if (typeof window !== 'undefined') {
  useSceneStore.subscribe((s) => {
    const params = new URLSearchParams();
    if (s.chapter === 'gpt' && s.temperature !== 0.8) params.set('t', s.temperature.toFixed(2));
    if (s.chapter === 'gpt' && s.topP !== 0.9) params.set('p', s.topP.toFixed(2));
    if (s.chapter === 'moe' && s.topK !== 2) params.set('k', String(s.topK));
    const q = params.toString();
    const nextHash = `#${s.chapter}/${s.step}${q ? `?${q}` : ''}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  });

  window.addEventListener('hashchange', () => {
    const parsed = parseHash();
    if (Object.keys(parsed).length > 0) {
      useSceneStore.setState({ ...parsed, playing: false, selected: null });
    }
  });
}

export const selectAtEnd = (s: SceneStore): boolean =>
  s.step >= stepCount(s.chapter) - 1;
