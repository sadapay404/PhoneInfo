import { describe, expect, it } from 'vitest';
import { estimateBackground, removeBackground } from './transparent';

const W = 20;
const H = 20;
const BODY: [number, number, number] = [60, 60, 70];
const WHITE: [number, number, number] = [255, 255, 255];

/** White studio background, a phone-body rectangle, a one-pixel 50% blend ring, and a white highlight inside. */
function studio(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, c: [number, number, number]) => {
    const p = (y * W + x) * 4;
    data[p] = c[0];
    data[p + 1] = c[1];
    data[p + 2] = c[2];
    data[p + 3] = 255;
  };
  const mix = (t: number): [number, number, number] => [0, 1, 2].map((k) => Math.round(WHITE[k] * (1 - t) + BODY[k] * t)) as [number, number, number];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(x, y, WHITE);
  for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) put(x, y, BODY);
  for (let x = 3; x < W - 3; x++) {
    put(x, 3, mix(0.5));
    put(x, H - 4, mix(0.5));
  }
  for (let y = 3; y < H - 3; y++) {
    put(3, y, mix(0.5));
    put(W - 4, y, mix(0.5));
  }
  put(9, 9, WHITE); // highlight inside the body, not connected to the background
  return data;
}

const at = (data: Uint8ClampedArray, x: number, y: number) => {
  const p = (y * W + x) * 4;
  return [data[p], data[p + 1], data[p + 2], data[p + 3]];
};

describe('estimateBackground', () => {
  it('finds a light studio background', () => {
    const bg = estimateBackground(studio(), W, H);
    expect(bg).not.toBeNull();
    expect(bg?.every((v) => v > 250)).toBe(true);
  });

  it('refuses a dark border (no studio background to remove)', () => {
    const data = new Uint8ClampedArray(W * H * 4).fill(40);
    expect(estimateBackground(data, W, H)).toBeNull();
  });
});

describe('removeBackground', () => {
  it('clears the studio background and keeps the phone body opaque', () => {
    const data = studio();
    const cleared = removeBackground(data, W, H);
    expect(cleared).toBeGreaterThan(0);
    expect(at(data, 0, 0)[3]).toBe(0);
    expect(at(data, W - 1, H - 1)[3]).toBe(0);
    expect(at(data, 10, 10)[3]).toBe(255);
  });

  it('keeps light areas that are not connected to the background', () => {
    const data = studio();
    removeBackground(data, W, H);
    expect(at(data, 9, 9)[3]).toBe(255);
  });

  it('gives edge pixels a partial alpha and removes the white tint from their colour', () => {
    const data = studio();
    removeBackground(data, W, H);
    const edge = at(data, 3, 10);
    expect(edge[3]).toBeGreaterThan(0);
    expect(edge[3]).toBeLessThan(255);
    // Without decontamination this pixel would be about (157, 157, 162); it should be close to the body colour.
    for (let c = 0; c < 3; c++) expect(Math.abs(edge[c] - BODY[c])).toBeLessThan(25);
  });

  it('leaves the image alone when there is no light background', () => {
    const data = new Uint8ClampedArray(W * H * 4).fill(40);
    const before = data.slice();
    expect(removeBackground(data, W, H)).toBe(0);
    expect(data).toEqual(before);
  });
});
