/// <reference lib="webworker" />
/**
 * Kitten TTS worker.
 *
 * Kitten TTS Nano is a 15M-parameter StyleTTS-2 model (~25 MB ONNX, 8 English
 * voices) — the smallest neural TTS that is still intelligible, which is why it
 * is the optional voice for this explainer. Everything runs locally in ONNX
 * Runtime Web inside this worker, so the render loop never blocks.
 */
import * as ort from 'onnxruntime-web';
import { KittenTTS } from 'kitten-tts-js';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const MODEL_ID = 'KittenML/kitten-tts-nano-0.8';

/**
 * Force single-threaded WASM for the duration of a model load.
 *
 * Multi-threaded ONNX Runtime requires `crossOriginIsolated`, which needs COOP
 * and COEP response headers. This app deliberately does not send them: COEP
 * would require every cross-origin asset to opt in with CORP, and the model is
 * fetched from the HuggingFace CDN, so isolation would block the download
 * outright. Without isolation, ORT warns and falls back to one thread anyway.
 *
 * `kitten-tts-js` assigns `numThreads = navigator.hardwareConcurrency` right
 * before it creates the session, so setting `ort.env.wasm.numThreads` ourselves
 * has no effect. The only lever at that point is the value it reads.
 */
async function withSingleThread<T>(fn: () => Promise<T>): Promise<T> {
  const nav = navigator as unknown as { hardwareConcurrency: number };
  const original = nav.hardwareConcurrency;
  try {
    Object.defineProperty(nav, 'hardwareConcurrency', {
      value: 1,
      configurable: true,
      writable: true,
    });
  } catch {
    // Older engines may refuse; ORT falls back on its own.
  }
  try {
    return await fn();
  } finally {
    try {
      Object.defineProperty(nav, 'hardwareConcurrency', {
        value: original,
        configurable: true,
        writable: true,
      });
    } catch {
      /* restore is best-effort */
    }
  }
}

ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

type Incoming =
  | { type: 'load'; wasmBase: string }
  | { type: 'speak'; id: number; text: string; voice: string; speed: number };

interface ProgressMsg {
  type: 'progress';
  loaded: number;
  total: number;
}

/**
 * Track download progress for the model files.
 *
 * kitten-tts-js fetches straight from the HuggingFace CDN, so we wrap fetch to
 * count bytes for the .onnx / .npz payloads and report a real percentage
 * instead of an endless spinner on the first visit.
 */
const nativeFetch = ctx.fetch.bind(ctx);
let loadedBytes = 0;
let totalBytes = 0;
let lastReport = 0;

function reportProgress(force = false) {
  if (!totalBytes) return;
  const now = Date.now();
  if (!force && now - lastReport < 120) return;
  lastReport = now;
  const msg: ProgressMsg = {
    type: 'progress',
    loaded: loadedBytes,
    total: totalBytes,
  };
  ctx.postMessage(msg);
}

ctx.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await nativeFetch(input as RequestInfo, init);
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

  if (!/\.(onnx|npz)(\?|$)/.test(url) || !response.body) return response;

  totalBytes += Number(response.headers.get('content-length') ?? 0);
  const reader = response.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        reportProgress(true);
        return;
      }
      loadedBytes += value.byteLength;
      reportProgress();
      controller.enqueue(value);
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });

  return new Response(stream, { status: response.status, headers: response.headers });
};

let tts: KittenTTS | null = null;

ctx.onmessage = async (event: MessageEvent<Incoming>) => {
  const msg = event.data;

  if (msg.type === 'load') {
    ort.env.wasm.wasmPaths = msg.wasmBase;
    if (tts) {
      ctx.postMessage({ type: 'ready', voices: tts.list_voices() });
      return;
    }
    loadedBytes = 0;
    totalBytes = 0;
    lastReport = 0;
    try {
      ctx.postMessage({ type: 'stage', stage: 'downloading' });
      tts = await withSingleThread(() => KittenTTS.from_pretrained(MODEL_ID, {}));
      ctx.postMessage({ type: 'stage', stage: 'warming' });
      // Warm the graph so the first spoken sentence is not noticeably slower.
      await tts.generate('Ready.', { voice: 'Bella', speed: 1 });
      ctx.postMessage({ type: 'ready', voices: tts.list_voices() });
    } catch (error) {
      ctx.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (msg.type === 'speak') {
    if (!tts) {
      ctx.postMessage({ type: 'error', id: msg.id, message: 'Model not loaded' });
      return;
    }
    try {
      const audio = await tts.generate(msg.text, {
        voice: msg.voice,
        speed: msg.speed,
      });
      const samples = new Float32Array(audio.data);
      ctx.postMessage(
        { type: 'audio', id: msg.id, samples, sampleRate: audio.sampling_rate },
        [samples.buffer],
      );
    } catch (error) {
      ctx.postMessage({
        type: 'error',
        id: msg.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
