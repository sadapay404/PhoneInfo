// @vitest-environment jsdom
import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { parsePriceExport } from './prices';
import { importSavedFile } from './savedPhones';

async function zipFile(files: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [name, text] of Object.entries(files)) zip.file(name, text);
  const bytes = await zip.generateAsync({ type: 'arraybuffer' });
  return new File([bytes], 'aetherphone-saved.zip', { type: 'application/zip' });
}

const device = { id: 'saved-1', brand: 'Acme', model: 'Nova', year: 2025 };

describe('price export import', () => {
  beforeEach(async () => {
    await db.saved.clear();
    await db.photos.clear();
    await db.prices.clear();
  });

  it('imports the price history from the extension ZIP and replaces older rows', async () => {
    await db.prices.add({ deviceId: 'saved-1', price_pkr: 1, observed_on: '2025-01-01' });
    const prices = [
      { deviceId: 'saved-1', ram_gb: 8, storage_gb: 128, price_pkr: 150000, observed_on: '2026-10-01', shop: 'PriceOye' },
      { deviceId: 'saved-1', ram_gb: 8, storage_gb: 256, price_pkr: 165000, observed_on: '2026-10-02', shop: 'PriceOye' },
    ];
    const file = await zipFile({
      'aetherphone-saved.json': JSON.stringify([device]),
      'aetherphone-prices.json': JSON.stringify(prices),
    });
    expect(await importSavedFile(file)).toBe(1);
    const rows = await db.prices.where('deviceId').equals('saved-1').toArray();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.price_pkr).sort()).toEqual([150000, 165000]);
  });

  it('imports phones without a price file and leaves the price log alone', async () => {
    await db.prices.add({ deviceId: 'saved-1', price_pkr: 1, observed_on: '2025-01-01' });
    const file = await zipFile({ 'aetherphone-saved.json': JSON.stringify([device]) });
    await importSavedFile(file);
    expect(await db.prices.count()).toBe(1);
  });

  it('rejects malformed price rows instead of guessing', () => {
    expect(() => parsePriceExport('{}')).toThrow(/array/);
    expect(() => parsePriceExport(JSON.stringify([{ deviceId: 'a', price_pkr: 'lots', observed_on: '2026-01-01' }]))).toThrow(/missing/);
    expect(() => parsePriceExport(JSON.stringify([{ deviceId: 'a', price_pkr: 12.5, observed_on: '2026-01-01' }]))).toThrow(/Invalid price/);
    expect(() => parsePriceExport(JSON.stringify([{ deviceId: 'a', price_pkr: 100, observed_on: '01-01-2026' }]))).toThrow(/Invalid date/);
  });
});
