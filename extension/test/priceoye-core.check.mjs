// Run: node --test extension/test/priceoye-core.check.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'priceoye-core.js'), 'utf8');
const module = { exports: {} };
new Function('module', 'exports', 'globalThis', src)(module, module.exports, globalThis);
const C = module.exports;

test('name and brand come from the title and URL', () => {
  assert.equal(C.nameFromTitle('VGO-TEL NEW 10 Price in Pakistan 2026 | Priceoye'), 'VGO-TEL NEW 10');
  assert.deepEqual(C.productFromPath('/mobiles/vgo-tel/vgo-tel-new-10'), { brandSlug: 'vgo-tel', slug: 'vgo-tel-new-10' });
  assert.equal(C.productFromPath('/mobiles/compare/a-vs-b'), null);
  assert.equal(C.productFromPath('/mobiles/apple'), null);
  assert.deepEqual(C.splitBrand('VGO-TEL NEW 10', 'vgo-tel'), { brand: 'VGO-TEL', model: 'NEW 10' });
  assert.deepEqual(C.splitBrand('iPhone 15 Pro Max', 'apple'), { brand: 'Apple', model: 'iPhone 15 Pro Max' });
});

test('matching a saved GSMArena phone ignores case and spacing, and needs the same brand', () => {
  const saved = { id: 'saved-1', brand: 'Vgotel', model: 'New 10' };
  assert.ok(C.isSamePhone(saved, { brand: 'VGO-TEL', model: 'NEW 10' }));
  assert.equal(C.findSaved([saved], { brand: 'VGO-TEL', model: 'NEW 10' }).id, 'saved-1');
  assert.equal(C.findSaved([saved], { brand: 'Acme', model: 'New 10' }), null);
  assert.equal(C.findSaved([{ id: 'x', brand: 'Apple', model: 'iPhone 15 Pro Max' }], { brand: 'Apple', model: 'iPhone 15' }), null);
  assert.equal(C.findSaved([{ id: 'y', brand: 'Apple', model: 'iPhone 15 Pro Max' }], { brand: 'Apple', model: 'iPhone 15 Pro Max' }).id, 'y');
});

test('prices and variants', () => {
  assert.equal(C.parsePriceText('Rs12,349 Rs13,699'), 12349);
  assert.equal(C.parsePriceText('Rs. 185,000'), 185000);
  assert.equal(C.parsePriceText('Out of stock'), null);
  assert.deepEqual(C.parseVariant('32GB - 2GB RAM'), { storage_gb: 32, ram_gb: 2 });
  assert.deepEqual(C.parseVariant('1TB - 16GB RAM'), { storage_gb: 1024, ram_gb: 16 });
  assert.deepEqual(C.parseVariant('256GB'), { storage_gb: 256 });
  assert.equal(C.parseVariant('Yellow'), null);
});

test('extras: rating, reviews, discontinued', () => {
  assert.deepEqual(C.parseExtras('4.7 | 19 Reviews DISCONTINUED'), { rating: 4.7, reviews: 19, discontinued: true });
  assert.deepEqual(C.parseExtras('nothing here'), {});
});

test('only this product’s photos, one per photo, preferring 500x500', () => {
  const urls = [
    'https://images.priceoye.pk/vgo-tel-new-10-pakistan-priceoye-8rw24-500x500.webp',
    'https://images.priceoye.pk/vgo-tel-new-10-pakistan-priceoye-8rw24-100x100.webp',
    'https://images.priceoye.pk/vgo-tel-new-10-pakistan-priceoye-m1ftv-100x100.webp',
    'https://images.priceoye.pk/other-phone-pakistan-priceoye-zzzzz-270x270.webp',
  ];
  assert.deepEqual(C.uniqueImages(urls, 'vgo-tel-new-10'), [
    'https://images.priceoye.pk/vgo-tel-new-10-pakistan-priceoye-8rw24-500x500.webp',
    'https://images.priceoye.pk/vgo-tel-new-10-pakistan-priceoye-m1ftv-100x100.webp',
  ]);
  assert.equal(C.sizedUrl('https://a/x-pakistan-priceoye-ab-100x100.webp', '500x500'), 'https://a/x-pakistan-priceoye-ab-500x500.webp');
});

test('new device record and price rows, without duplicates', () => {
  const variants = [{ storage_gb: 32, ram_gb: 2, price: 12349 }, { storage_gb: 64, ram_gb: 2, price: 13999 }, { storage_gb: 128, ram_gb: 4, price: null }];
  const d = C.buildDevice({ id: 'priceoye-vgo-tel-new-10', brand: 'VGO-TEL', model: 'NEW 10', url: 'u', variants, photoCount: 2, extras: { rating: 4.7 }, today: '2026-10-27' });
  assert.equal(d.soc.storage_gb.join(','), '32,64,128');
  assert.equal(d.soc.ram_options_gb.join(','), '2,4');
  assert.equal(d.soc.variants.length, 3);
  assert.equal(d.gallery.photo_count, 2);
  assert.equal(d.priceoye.updated, '2026-10-27');
  const rows = C.newPriceEntries({ deviceId: d.id, variants, observed_on: '2026-10-27', shop: 'PriceOye', existing: [] });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { deviceId: d.id, price_pkr: 12349, observed_on: '2026-10-27', shop: 'PriceOye', ram_gb: 2, storage_gb: 32 });
  assert.equal(C.newPriceEntries({ deviceId: d.id, variants, observed_on: '2026-10-27', shop: 'PriceOye', existing: rows }).length, 0);
});
