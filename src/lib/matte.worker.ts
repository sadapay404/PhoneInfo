/// <reference lib="webworker" />
// On-device background matting. Runs ISNet (MIT) through ONNX Runtime Web (WebAssembly, one thread,
// so no special cross-origin headers are needed). Works offline once the model is cached.
// Types only: the runtime itself is loaded from public/ort/ at start-up (see init below), so
// Vite does not bundle a second copy of the WebAssembly files.
import type * as Ort from 'onnxruntime-web';

let ort: typeof Ort;

const SIZE = 1024; // the model's fixed input size

type InitMsg = { type: 'init'; base: string; modelUrl: string };
type RunMsg = { type: 'run'; id: number; pixels: ArrayBuffer; width: number; height: number };
type Msg = InitMsg | RunMsg;

let session: Promise<Ort.InferenceSession> | null = null;

async function loadModel(modelUrl: string): Promise<Ort.InferenceSession> {
  const cache = await caches.open('phoneinfo-models');
  let res = await cache.match(modelUrl);
  if (!res) {
    res = await fetch(modelUrl);
    if (!res.ok) throw new Error(`model HTTP ${res.status}`);
    await cache.put(modelUrl, res.clone());
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
}

/** Resamples RGBA pixels to the model size and returns normalised CHW floats. */
function toInput(pixels: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): Float32Array {
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const src = new OffscreenCanvas(width, height);
  src.getContext('2d')!.putImageData(new ImageData(pixels, width, height), 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, SIZE, SIZE);
  const rgba = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const n = SIZE * SIZE;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[i * 4] / 255 - 0.5;
    out[n + i] = rgba[i * 4 + 1] / 255 - 0.5;
    out[2 * n + i] = rgba[i * 4 + 2] / 255 - 0.5;
  }
  return out;
}

async function matte(pixels: ArrayBuffer, width: number, height: number): Promise<Uint8Array> {
  const s = await session!;
  const input = new ort.Tensor('float32', toInput(new Uint8ClampedArray(pixels) as Uint8ClampedArray<ArrayBuffer>, width, height), [1, 3, SIZE, SIZE]);
  const result = await s.run({ [s.inputNames[0]]: input });
  const raw = result[s.outputNames[0]].data as Float32Array;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of raw) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const mask = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) mask[i] = Math.round(((raw[i] - lo) / span) * 255);
  return mask;
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    const base = new URL(msg.base, self.location.href).href;
    session = (async () => {
      ort = (await import(/* @vite-ignore */ `${base}ort/ort.wasm.min.mjs`)) as typeof Ort;
      ort.env.wasm.wasmPaths = `${base}ort/`;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      return loadModel(msg.modelUrl);
    })();
    session.catch(() => undefined);
    return;
  }
  try {
    if (!session) throw new Error('model not initialised');
    const mask = await matte(msg.pixels, msg.width, msg.height);
    (self as unknown as Worker).postMessage({ id: msg.id, ok: true, mask }, [mask.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: msg.id, ok: false, error: String(err) });
  }
};
