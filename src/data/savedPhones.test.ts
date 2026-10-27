// @vitest-environment jsdom
import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteSavedPhone, importFiles, importSavedFile, loadPhotos, parseSavedJson } from './savedPhones';

// A valid 1x1 PNG (synthetic test image).
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('parseSavedJson', () => {
  it('accepts an export and fills missing groups', () => {
    const [d] = parseSavedJson(JSON.stringify([{ id: 'saved-1', brand: 'Acme', model: 'Nova', year: 2024 }]));
    expect(d.brand).toBe('Acme');
    expect(d.battery).toEqual({});
    expect(d.camera).toEqual({});
  });

  it('rejects non-array input and entries without id, brand, or model', () => {
    expect(() => parseSavedJson('{}')).toThrow(/array/);
    expect(() => parseSavedJson(JSON.stringify([{ brand: 'Acme' }]))).toThrow(/missing/);
  });
});

describe('importSavedFile (ZIP with photos)', () => {
  beforeEach(async () => {
    await db.saved.clear();
    await db.photos.clear();
  });

  it('stores phones and their photos, and removes them with the phone', async () => {
    const zip = new JSZip();
    zip.file('aetherphone-saved.json', JSON.stringify([{
      id: 'saved-42', brand: 'Acme', model: 'Nova 9', year: 2024,
      photos: [
        { kind: 'official', file: 'photos/saved-42/01-official.png', source: 'https://fdn2.gsmarena.com/x.png' },
        { kind: 'review', file: 'photos/saved-42/02-review.png' },
      ],
      image: 'photos/saved-42/01-official.png',
    }]));
    zip.file('photos/saved-42/01-official.png', PNG_1PX, { base64: true });
    zip.file('photos/saved-42/02-review.png', PNG_1PX, { base64: true });
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'aetherphone-saved.zip', { type: 'application/zip' });

    expect(await importSavedFile(file)).toBe(1);

    const [phone] = await db.saved.toArray();
    expect(phone.image?.startsWith('data:image/png;base64,')).toBe(true);
    const photos = await loadPhotos('saved-42');
    expect(photos.map((p) => p.kind)).toEqual(['official', 'review']);
    expect(photos[0].dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    await deleteSavedPhone('saved-42');
    expect(await db.saved.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
  });

  it('rejects a ZIP without the phone file', async () => {
    const zip = new JSZip();
    zip.file('something.txt', 'hi');
    const file = new File([await zip.generateAsync({ type: 'blob' })], 'bad.zip', { type: 'application/zip' });
    await expect(importSavedFile(file)).rejects.toThrow(/aetherphone-saved\.json/);
  });
});

describe('importFiles (save everything for offline use)', () => {
  beforeEach(async () => {
    await db.saved.clear();
    await db.photos.clear();
    await db.prices.clear();
  });

  it('imports several ZIPs, counts phones, photos and prices, and skips a bad file', async () => {
    const zip = new JSZip();
    zip.file('aetherphone-saved.json', JSON.stringify([{
      id: 'saved-7', brand: 'Acme', model: 'Nova 7', year: 2024,
      photos: [{ kind: 'official', file: 'photos/Acme/01.png' }],
    }]));
    zip.file('photos/Acme/01.png', PNG_1PX, { base64: true });
    zip.file('aetherphone-prices.json', JSON.stringify([
      { deviceId: 'saved-7', price_pkr: 99000, observed_on: '2026-10-01', shop: 'PriceOye', ram_gb: 8, storage_gb: 128 },
    ]));
    const good = new File([await zip.generateAsync({ type: 'arraybuffer' })], 'aetherphone-saved.zip', { type: 'application/zip' });
    const broken = new File(['not a zip'], 'broken.zip', { type: 'application/zip' });

    const result = await importFiles([good, broken]);
    expect(result.files).toBe(1);
    expect(result.phones).toBe(1);
    expect(result.photos).toBe(1);
    expect(result.prices).toBe(1);
    expect(result.failed.map((f) => f.name)).toEqual(['broken.zip']);
    expect(await db.saved.count()).toBe(1);
    expect(await db.prices.count()).toBe(1);
  });
});
