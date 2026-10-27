/**
 * Cut-out for product thumbnails: removes the studio background so the phone sits on
 * the card colour. Three steps, so edges look clean instead of jagged or haloed:
 *
 *  1. Estimate the background colour from the image border (must be light and even).
 *  2. Flood-fill from the border through pixels that match that colour closely.
 *     Those pixels become fully transparent.
 *  3. Along the boundary, pixels that are partly background get a soft alpha ramp,
 *     and their colour is "decontaminated" (the background tint is subtracted), so no
 *     white fringe is left around the phone.
 *
 * Only edge-connected background is removed, so light areas inside the phone body stay.
 * The pixel step is pure and tested. If anything fails, the original image is used.
 */

const HARD = 14; // distance from background considered fully background
const SOFT = 56; // minimum object distance used for the ramp (guards very pale objects)
const BAND = 3; // pixels either side of the cut-out that get a soft edge
const MIN_BORDER_LIGHTNESS = 190; // border must be this bright to count as a studio background
const MAX_SIDE = 1400; // decode size limit

type Rgb = [number, number, number];

/** Largest channel difference from the background colour. */
function distance(data: Uint8ClampedArray, p: number, bg: Rgb): number {
  return Math.max(Math.abs(data[p] - bg[0]), Math.abs(data[p + 1] - bg[1]), Math.abs(data[p + 2] - bg[2]));
}

/** Average colour of the light, low-saturation pixels on the border. Null if the border is not a studio background. */
export function estimateBackground(data: Uint8ClampedArray, width: number, height: number): Rgb | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  let total = 0;
  const take = (i: number) => {
    total++;
    const p = i * 4;
    const mn = Math.min(data[p], data[p + 1], data[p + 2]);
    const mx = Math.max(data[p], data[p + 1], data[p + 2]);
    if (mn >= MIN_BORDER_LIGHTNESS && mx - mn <= 24) {
      r += data[p];
      g += data[p + 1];
      b += data[p + 2];
      n++;
    }
  };
  for (let x = 0; x < width; x++) {
    take(x);
    take((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    take(y * width);
    take(y * width + width - 1);
  }
  if (total === 0 || n < total * 0.6) return null;
  return [r / n, g / n, b / n];
}

/**
 * Makes the studio background transparent in place. Returns how many pixels were cleared
 * fully (the soft edge pixels are not counted).
 */
export function removeBackground(data: Uint8ClampedArray, width: number, height: number): number {
  const bg = estimateBackground(data, width, height);
  if (!bg) return 0;
  const count = width * height;

  // 1. Flood fill the background region from the border.
  const region = new Uint8Array(count);
  const regionList: number[] = [];
  const queue: number[] = [];
  const seed = (i: number) => {
    if (region[i]) return;
    if (distance(data, i * 4, bg) > HARD) return;
    region[i] = 1;
    queue.push(i);
    regionList.push(i);
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  let cleared = 0;
  while (queue.length) {
    const i = queue.pop() as number;
    cleared++;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (y > 0) seed(i - width);
    if (y < height - 1) seed(i + width);
  }

  // 2. Band depth: how many pixels away from the background each non-background pixel is.
  const depth = new Uint8Array(count);
  let frontier = regionList;
  for (let level = 1; level <= BAND && frontier.length; level++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % width;
      const y = (i - x) / width;
      const visit = (j: number) => {
        if (region[j] || depth[j]) return;
        depth[j] = level;
        next.push(j);
      };
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (y > 0) visit(i - width);
      if (y < height - 1) visit(i + width);
    }
    frontier = next;
  }

  // 3. The object's own colour distance, measured on pixels deeper than the band.
  const interior: number[] = [];
  for (let i = 0; i < count; i++) if (!region[i] && !depth[i]) interior.push(distance(data, i * 4, bg));
  if (interior.length === 0) {
    for (let i = 0; i < count; i++) if (region[i]) data[i * 4 + 3] = 0;
    return cleared;
  }
  interior.sort((a, b) => a - b);
  const objectDist = Math.max(SOFT, interior[Math.floor(interior.length / 2)]);

  // 4. Band pixels: alpha ramps from 0 (background colour) to 1 (object colour), and the
  //    background tint is removed from their colour so no white fringe remains.
  for (let i = 0; i < count; i++) {
    if (!depth[i]) continue;
    const p = i * 4;
    const d = distance(data, p, bg);
    const a = Math.min(1, Math.max(0, (d - HARD) / (objectDist - HARD)));
    if (a >= 1) continue;
    const alpha = Math.max(a, 0.06);
    for (let c = 0; c < 3; c++) {
      // observed = alpha * fg + (1 - alpha) * bg  =>  fg = (observed - (1 - alpha) * bg) / alpha
      const fg = (data[p + c] - (1 - alpha) * bg[c]) / alpha;
      data[p + c] = Math.min(255, Math.max(0, Math.round(fg)));
    }
    data[p + 3] = Math.round(a * 255);
  }

  // 5. Fully background pixels become transparent.
  for (const i of regionList) data[i * 4 + 3] = 0;
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
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(src);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        const pixels = ctx.getImageData(0, 0, w, h);
        const cleared = removeBackground(pixels.data, w, h);
        if (cleared === 0) return resolve(src); // no studio background found: keep the original
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
