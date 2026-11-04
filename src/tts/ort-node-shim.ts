/**
 * Browser stand-in for `onnxruntime-node`.
 *
 * kitten-tts-js prefers the Node runtime and falls back to `onnxruntime-web`
 * when that import fails. In a browser bundle we alias the Node package to this
 * module: the throw is what makes the fallback happen.
 */
throw new Error('onnxruntime-node is not available in the browser');

export {};
