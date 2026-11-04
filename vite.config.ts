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
  },
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
