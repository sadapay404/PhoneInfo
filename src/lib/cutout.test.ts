import { describe, expect, it } from 'vitest';
import { cacheKey, sharpenAlpha } from './cutout';

describe('sharpenAlpha', () => {
  it('clears near-background and keeps near-object', () => {
    expect(sharpenAlpha(0)).toBe(0);
    expect(sharpenAlpha(20)).toBe(0); // below the low cut
    expect(sharpenAlpha(255)).toBe(255);
    expect(sharpenAlpha(240)).toBe(255); // above the high cut
  });
  it('is monotonic, so edges stay smooth', () => {
    let last = -1;
    for (let v = 0; v <= 255; v++) {
      const a = sharpenAlpha(v);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
  });
});

describe('cacheKey', () => {
  it('is stable and differs for different sources', () => {
    expect(cacheKey('photos/a.jpg')).toBe(cacheKey('photos/a.jpg'));
    expect(cacheKey('photos/a.jpg')).not.toBe(cacheKey('photos/b.jpg'));
  });
});
