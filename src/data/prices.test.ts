// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addPrice, formatPkr, isOld, latestByVariant, pricesFor, variantLabel, variantsFor } from './prices';
import type { Device } from './types';

const base = (soc: Partial<Device['soc']>): Device =>
  ({ id: 'x', brand: 'Acme', model: 'Nova', year: 2025, soc: { ...soc } } as unknown as Device);

describe('variantsFor', () => {
  it('uses exact pairs when the page lists them', () => {
    const d = base({ variants: [{ storage_gb: 256, ram_gb: 12 }], ram_options_gb: [8, 12], storage_gb: [128, 256] });
    expect(variantsFor(d)).toEqual([{ ram_gb: 12, storage_gb: 256 }]);
  });

  it('crosses RAM options with storage sizes when no exact pairs exist', () => {
    const d = base({ ram_options_gb: [8, 12], storage_gb: [128, 256] });
    expect(variantsFor(d)).toHaveLength(4);
    expect(variantsFor(d)).toContainEqual({ ram_gb: 8, storage_gb: 128 });
  });

  it('falls back to a single row when there is no memory data', () => {
    expect(variantsFor(base({}))).toEqual([{}]);
    expect(variantLabel({})).toBe('Standard model');
  });

  it('labels TB storage', () => {
    expect(variantLabel({ ram_gb: 16, storage_gb: 1024 })).toBe('16 GB RAM · 1 TB');
  });
});

describe('price log', () => {
  beforeEach(async () => {
    await db.prices.clear();
  });

  it('keeps history and reports the latest price per variant', async () => {
    await addPrice({ deviceId: 'd1', ram_gb: 8, storage_gb: 128, price_pkr: 150000, observed_on: '2026-01-05' });
    await addPrice({ deviceId: 'd1', ram_gb: 8, storage_gb: 128, price_pkr: 145000, observed_on: '2026-03-01', shop: 'Shop A' });
    await addPrice({ deviceId: 'd1', ram_gb: 12, storage_gb: 256, price_pkr: 180000, observed_on: '2026-02-01' });
    const rows = await pricesFor('d1');
    expect(rows).toHaveLength(3);
    const latest = latestByVariant(rows);
    expect(latest.get('8|128')?.price_pkr).toBe(145000);
    expect(latest.get('12|256')?.price_pkr).toBe(180000);
  });

  it('rejects invalid prices and dates', async () => {
    await expect(addPrice({ deviceId: 'd1', price_pkr: 0, observed_on: '2026-01-01' })).rejects.toThrow(/price/);
    await expect(addPrice({ deviceId: 'd1', price_pkr: 100, observed_on: '01/01/2026' })).rejects.toThrow(/YYYY-MM-DD/);
  });

  it('flags prices older than 30 days', () => {
    const now = new Date('2026-10-27T12:00:00');
    expect(isOld('2026-09-01', now)).toBe(true);
    expect(isOld('2026-10-20', now)).toBe(false);
  });

  it('formats rupees with grouping', () => {
    expect(formatPkr(185000)).toMatch(/^Rs 1,?85,?000$/);
  });
});
