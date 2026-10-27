/**
 * Phone cut-outs for thumbnails. The studio background is removed on the device with the
 * ISNet model (see matte.worker.ts). Results are cached in Cache Storage as PNG, so each photo
 * is processed once and then loads instantly, offline too. Any failure resolves to null and the
 * caller shows the original photo.
 */

const MODEL_PATH = 'models/isnet-medium.onnx';
const CACHE = 'phoneinfo-cutouts';
const MASK_SIZE = 1024;

/** Sharpens the model's soft mask: near-background goes to 0, near-object goes to 255, edges stay smooth. */
export function sharpenAlpha(v: number): number {
  const lo = 0.12;
  const hi = 0.85;
  const t = (v / 255 - lo) / (hi - lo);
  return Math.round(Math.min(1, Math.max(0, t)) * 255);
}

/** FNV-1a hash of the source string, used as the cache key. */
export function cacheKey(src: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}-${src.length}`;
}

type Pending = { resolve: (m: Uint8Array) => void; reject: (e: Error) => void };
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./matte.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.mask as Uint8Array);
    else p.reject(new Error(e.data.error));
  };
  w.onerror = () => {
    for (const p of pending.values()) p.reject(new Error('matte worker failed'));
    pending.clear();
  };
  const base = import.meta.env.BASE_URL;
  w.postMessage({ type: 'init', base, modelUrl: new URL(base + MODEL_PATH, location.href).href });
  worker = w;
  return w;
}

function matteOnWorker(pixels: Uint8ClampedArray, width: number, height: number): Promise<Uint8Array> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const copy = pixels.slice().buffer;
    getWorker().postMessage({ type: 'run', id, pixels: copy, width, height }, [copy]);
  });
}

async function renderCutout(src: string): Promise<Blob> {
  const blob = await (await fetch(src)).blob();
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  // Read the pixels at the photo's own size, then matte at the model size.
  const probe = new OffscreenCanvas(width, height);
  const pctx = probe.getContext('2d', { willReadFrequently: true })!;
  pctx.drawImage(bitmap, 0, 0);
  const pixels = pctx.getImageData(0, 0, width, height).data;
  const mask = await matteOnWorker(pixels, width, height);

  const alphaCanvas = new OffscreenCanvas(MASK_SIZE, MASK_SIZE);
  const actx = alphaCanvas.getContext('2d')!;
  const img = actx.createImageData(MASK_SIZE, MASK_SIZE);
  for (let i = 0; i < mask.length; i++) {
    img.data[i * 4 + 3] = sharpenAlpha(mask[i]);
  }
  actx.putImageData(img, 0, 0);

  const out = new OffscreenCanvas(width, height);
  const octx = out.getContext('2d')!;
  octx.drawImage(bitmap, 0, 0);
  octx.globalCompositeOperation = 'destination-in';
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(alphaCanvas, 0, 0, width, height);
  return out.convertToBlob({ type: 'image/png' });
}

async function cached(key: string): Promise<Blob | null> {
  if (!('caches' in self)) return null;
  const hit = await (await caches.open(CACHE)).match(`https://cutout.local/${key}`);
  return hit ? hit.blob() : null;
}

async function store(key: string, blob: Blob): Promise<void> {
  if (!('caches' in self)) return;
  await (await caches.open(CACHE)).put(`https://cutout.local/${key}`, new Response(blob, { headers: { 'content-type': 'image/png' } }));
}

/** Resolves to a URL of the transparent PNG for `src`, or null if it cannot be made. */
export function cutoutUrl(src: string): Promise<string | null> {
  const key = cacheKey(src);
  const run = async (): Promise<string | null> => {
    const hit = await cached(key);
    if (hit) return URL.createObjectURL(hit);
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
    const png = await renderCutout(src);
    await store(key, png);
    return URL.createObjectURL(png);
  };
  // One photo at a time: a phone-class CPU should not run several models at once.
  const next = queue.then(run, run).catch(() => null);
  queue = next;
  return next;
}
