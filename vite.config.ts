import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // kitten-tts-js tries the Node ONNX runtime first and falls back to the web
    // one. The shim makes that first import throw so the fallback always runs,
    // and the WASM-only build of onnxruntime-web halves the runtime payload.
    alias: [
      {
        find: /^onnxruntime-node$/,
        replacement: fileURLToPath(new URL('./src/tts/ort-node-shim.ts', import.meta.url)),
      },
      { find: /^onnxruntime-web$/, replacement: 'onnxruntime-web/wasm' },
    ],
  },
  optimizeDeps: {
    exclude: ['kitten-tts-js'],
    // jszip's package.json maps "./lib/index" to "dist/jszip.min.js" under
    // "browser" — a UMD bundle with no ESM exports. In the main thread Vite
    // pre-bundles it into ESM, but the TTS worker's module graph is built
    // separately, so the worker saw the raw UMD file and died on
    // "does not provide an export named 'default'". Pre-bundling it explicitly
    // gives the worker the same CJS→ESM interop the main thread already gets.
    include: ['jszip'],
  },
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
