/**
 * Makes the light background of a product photo transparent, so phones sit on the
 * card colour instead of a white box. Only background that touches the image edge
 * is removed (flood fill), so light parts inside the phone body are kept.
 *
 * The pixel step is pure and tested. The browser step converts an image to a PNG
 * data URL and caches the result. If anything fails, the original image is used.
 */

const LIGHT_MIN = 228; // every channel at least this bright
const CHROMA_MAX = 22; // and nearly grey (max - min channel)
const MAX_SIDE = 1400; // keep decoded images a sensible size

export function isBackgroundPixel(r: number, g: number, b: number): boolean {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mn >= LIGHT_MIN && mx - mn <= CHROMA_MAX;
}

/** Sets alpha to 0 for edge-connected background pixels. Returns how many were cleared. */
export function removeEdgeBackground(data: Uint8ClampedArray, width: number, height: number): number {
  const mark = new Uint8Array(width * height);
  const queue: number[] = [];

  const tryPush = (i: number) => {
    if (mark[i]) return;
    const p = i * 4;
    if (!isBackgroundPixel(data[p], data[p + 1], data[p + 2])) return;
    mark[i] = 1;
    queue.push(i);
  };

  for (let x = 0; x < width; x++) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    tryPush(y * width);
    tryPush(y * width + width - 1);
  }

  let cleared = 0;
  while (queue.length) {
    const i = queue.pop() as number;
    data[i * 4 + 3] = 0;
    cleared++;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) tryPush(i - 1);
    if (x < width - 1) tryPush(i + 1);
    if (y > 0) tryPush(i - width);
    if (y < height - 1) tryPush(i + width);
  }
  return cleared;
}

const cache = new Map<string, Promise<string>>();

/** Resolves to a PNG data URL with a transparent background, or the original src on failure. */
export function toTransparentPng(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return hit;

  const work = new Promise<string>((resolve) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      resolve(src);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, w, h);
        const pixels = ctx.getImageData(0, 0, w, h);
        removeEdgeBackground(pixels.data, w, h);
        ctx.putImageData(pixels, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        // Tainted canvas or unsupported format: show the original.
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

  cache.set(src, work);
  return work;
}
