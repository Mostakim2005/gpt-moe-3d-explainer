import { create } from 'zustand';

export type TtsEngine = 'system' | 'kitten';
export type TtsPhase = 'idle' | 'downloading' | 'warming' | 'ready' | 'error';

const KITTEN_VOICES = ['Bella', 'Luna', 'Rosie', 'Kiki', 'Jasper', 'Bruno', 'Hugo', 'Leo'];

interface TtsStore {
  engine: TtsEngine;
  phase: TtsPhase;
  /** 0..1 during the model download. */
  progress: number;
  speaking: boolean;
  autoNarrate: boolean;
  rate: number;
  /** System voice URI, or a Kitten voice name. */
  systemVoice: string;
  kittenVoice: string;
  systemVoices: SpeechSynthesisVoice[];
  error: string | null;

  setEngine: (e: TtsEngine) => void;
  setRate: (r: number) => void;
  setSystemVoice: (v: string) => void;
  setKittenVoice: (v: string) => void;
  setAutoNarrate: (v: boolean) => void;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  preload: () => Promise<void>;
  dismissError: () => void;
}

/** Minimal client for the Kitten model worker plus its audio playback. */
class KittenClient {
  private worker: Worker | null = null;
  private audio: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private loading: Promise<void> | null = null;
  private reqId = 0;
  private cancelPending: (() => void) | null = null;
  private onSamples: ((samples: Float32Array, sampleRate: number) => void) | null = null;
  private onSpeakError: ((message: string) => void) | null = null;
  private onError: ((message: string) => void) | null = null;

  ensureLoaded(handlers: {
    onProgress: (progress: number) => void;
    onStage: (stage: TtsPhase) => void;
    onReady: () => void;
    onError: (message: string) => void;
  }): Promise<void> {
    if (this.loading) return this.loading;

    this.loading = new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('./kitten.worker.ts', import.meta.url), {
        type: 'module',
        name: 'kitten-tts',
      });
      this.worker = worker;

      const fail = (message: string) => {
        this.worker?.terminate();
        this.worker = null;
        this.loading = null;
        handlers.onError(message);
        reject(new Error(message));
      };

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data as {
          type: string;
          id?: number;
          loaded?: number;
          total?: number;
          stage?: TtsPhase;
          voices?: string[];
          samples?: Float32Array;
          sampleRate?: number;
          message?: string;
        };

        switch (msg.type) {
          case 'progress':
            if (msg.total) handlers.onProgress(Math.min(1, (msg.loaded ?? 0) / msg.total));
            break;
          case 'stage':
            if (msg.stage) handlers.onStage(msg.stage);
            break;
          case 'ready':
            handlers.onReady();
            resolve();
            break;
          case 'audio':
            if (msg.id === this.reqId && msg.samples && msg.sampleRate) {
              this.onSamples?.(msg.samples, msg.sampleRate);
            }
            break;
          case 'error':
            if (msg.id !== undefined) {
              if (msg.id === this.reqId) {
                this.onSpeakError?.(msg.message ?? 'Unknown TTS error');
              }
            } else {
              this.onError?.(msg.message ?? 'Unknown TTS error');
              fail(msg.message ?? 'Unknown TTS error');
            }
            break;
        }
      };

      worker.onerror = (event) => fail(event.message || 'Worker crashed');

      // ONNX Runtime Web ships ~15 MB of WASM. Load it from the CDN by default to
      // keep the repo small; set VITE_TTS_WASM_BASE=/ort/ to self-host instead.
      const wasmBase =
        (import.meta.env.VITE_TTS_WASM_BASE as string | undefined) ??
        'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
      worker.postMessage({ type: 'load', wasmBase });
    });

    return this.loading;
  }

  setErrorHandler(onError: (message: string) => void) {
    this.onError = onError;
  }

  private context(): AudioContext {
    if (!this.audio) this.audio = new AudioContext();
    if (this.audio.state === 'suspended') void this.audio.resume();
    return this.audio;
  }

  /** Synthesize one sentence and play it; resolves when playback finishes or is cancelled. */
  speak(text: string, voice: string, speed: number): Promise<void> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('Model not loaded'));

    this.cancelPending?.();
    const id = ++this.reqId;

    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (this.reqId === id) {
          this.onSamples = null;
          this.onSpeakError = null;
          this.cancelPending = null;
        }
        resolve();
      };

      this.cancelPending = finish;

      this.onSamples = (samples, sampleRate) => {
        if (this.reqId !== id) return;
        this.onSamples = null;
        const ctx = this.context();
        const buffer = ctx.createBuffer(1, samples.length, sampleRate);
        const channel = new Float32Array(samples.length);
        channel.set(samples);
        buffer.copyToChannel(channel, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = finish;
        this.source = source;
        source.start();
      };

      this.onSpeakError = (message) => {
        this.onError?.(message);
        finish();
      };

      worker.postMessage({ type: 'speak', id, text, voice, speed });
    });
  }

  stop() {
    this.reqId++;
    this.onSamples = null;
    this.onSpeakError = null;
    const cancel = this.cancelPending;
    this.cancelPending = null;
    try {
      this.source?.stop();
    } catch {
      /* already stopped */
    }
    this.source = null;
    cancel?.();
  }
}

const kitten = new KittenClient();
let speakSeq = 0;

function systemVoiceList(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => Number(b.localService) - Number(a.localService));
}

function speakSystem(text: string, voiceUri: string, rate: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof speechSynthesis === 'undefined') {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = speechSynthesis.getVoices().find((v) => v.voiceURI === voiceUri);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });
}

export const useTtsStore = create<TtsStore>((set, get) => ({
  engine: 'system',
  phase: 'idle',
  progress: 0,
  speaking: false,
  autoNarrate: false,
  rate: 1,
  systemVoice: '',
  kittenVoice: 'Bella',
  systemVoices: [],
  error: null,

  setEngine: (engine) => {
    get().stop();
    set({ engine, error: null });
  },
  setRate: (rate) => set({ rate }),
  setSystemVoice: (systemVoice) => set({ systemVoice }),
  setKittenVoice: (kittenVoice) => set({ kittenVoice }),
  setAutoNarrate: (autoNarrate) => set({ autoNarrate }),
  dismissError: () => set({ error: null }),

  preload: async () => {
    const p = get().phase;
    if (p === 'ready' || p === 'downloading' || p === 'warming') return;
    set({ phase: 'downloading', progress: 0, error: null });
    try {
      await kitten.ensureLoaded({
        onProgress: (progress) => set({ progress }),
        onStage: (phase) => set({ phase }),
        onReady: () => set({ phase: 'ready', progress: 1 }),
        onError: (message) => set({ phase: 'error', error: message }),
      });
    } catch {
      /* error already surfaced through onError */
    }
  },

  speak: async (text) => {
    get().stop();
    const seq = ++speakSeq;
    const { engine, rate, systemVoice, kittenVoice, phase } = get();

    if (engine === 'system') {
      if (typeof speechSynthesis === 'undefined') {
        set({ error: 'This browser has no speech synthesis.' });
        return;
      }
      set({ speaking: true });
      await speakSystem(text, systemVoice, rate);
      if (seq === speakSeq) set({ speaking: false });
      return;
    }

    if (phase !== 'ready') {
      await get().preload();
      if (seq !== speakSeq || get().phase !== 'ready') return;
    }

    set({ speaking: true });
    try {
      await kitten.speak(text, kittenVoice, rate);
    } catch (error) {
      if (seq === speakSeq) {
        set({ error: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      if (seq === speakSeq) set({ speaking: false });
    }
  },

  stop: () => {
    speakSeq++;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    kitten.stop();
    set({ speaking: false });
  },
}));

if (typeof speechSynthesis !== 'undefined') {
  const sync = () => {
    const voices = systemVoiceList();
    useTtsStore.setState((state) => ({
      systemVoices: voices,
      systemVoice:
        state.systemVoice || voices.find((v) => v.default)?.voiceURI || voices[0]?.voiceURI || '',
    }));
  };
  sync();
  speechSynthesis.addEventListener('voiceschanged', sync);
}

kitten.setErrorHandler((message) =>
  useTtsStore.setState({ phase: 'error', error: message }),
);

export { KITTEN_VOICES };
