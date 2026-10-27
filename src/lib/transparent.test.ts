import { describe, expect, it } from 'vitest';
import { isBackgroundPixel, removeEdgeBackground } from './transparent';

/** Builds an RGBA image: white border, a grey phone body, and a white highlight inside the body. */
function sample(w: number, h: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const p = (y * w + x) * 4;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
    data[p + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, 255, 255, 255);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) set(x, y, 60, 60, 70);
  set(4, 4, 255, 255, 255); // highlight, not connected to the edge
  return data;
}

const alphaAt = (data: Uint8ClampedArray, w: number, x: number, y: number) => data[(y * w + x) * 4 + 3];

describe('isBackgroundPixel', () => {
  it('accepts white and light grey, rejects colours and dark pixels', () => {
    expect(isBackgroundPixel(255, 255, 255)).toBe(true);
    expect(isBackgroundPixel(236, 236, 238)).toBe(true);
    expect(isBackgroundPixel(200, 200, 200)).toBe(false);
    expect(isBackgroundPixel(255, 200, 200)).toBe(false);
  });
});

describe('removeEdgeBackground', () => {
  it('makes the edge background transparent and keeps the phone', () => {
    const w = 12;
    const h = 12;
    const data = sample(w, h);
    const cleared = removeEdgeBackground(data, w, h);
    expect(cleared).toBeGreaterThan(0);
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, 11, 5)).toBe(0);
    expect(alphaAt(data, w, 6, 6)).toBe(255);
  });

  it('keeps light areas that are not connected to the edge', () => {
    const w = 12;
    const h = 12;
    const data = sample(w, h);
    removeEdgeBackground(data, w, h);
    expect(alphaAt(data, w, 4, 4)).toBe(255);
  });
});
