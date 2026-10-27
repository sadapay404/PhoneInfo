// Run: node --test extension/test/prices-core.check.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'prices-core.js'), 'utf8');
const module = { exports: {} };
new Function('module', 'exports', src)(module, module.exports);
const P = module.exports;

test('variants: exact pairs first, then the cross product, then a single row', () => {
  assert.deepEqual(P.variantsFor({ soc: { variants: [{ ram_gb: 12, storage_gb: 256 }] } }), [{ ram_gb: 12, storage_gb: 256 }]);
  assert.equal(P.variantsFor({ soc: { ram_options_gb: [8, 12], storage_gb: [128, 256] } }).length, 4);
  assert.deepEqual(P.variantsFor({ soc: {} }), [{}]);
});

test('labels and keys', () => {
  assert.equal(P.variantLabel({ ram_gb: 16, storage_gb: 1024 }), '16 GB RAM · 1 TB');
  assert.equal(P.variantLabel({}), 'Standard model');
  assert.equal(P.variantKey({ ram_gb: 8 }), '8|-');
});

test('price text: commas and spaces allowed, junk and zero refused', () => {
  assert.equal(P.parsePrice('1,85,000'), 185000);
  assert.equal(P.parsePrice(' 185 000 '), 185000);
  assert.equal(P.parsePrice('abc'), null);
  assert.equal(P.parsePrice('12.5'), null);
  assert.equal(P.parsePrice('0'), null);
  assert.equal(P.parsePrice(''), null);
});

test('buildEntries skips empty boxes, reports bad ones, and keeps the variant', () => {
  const rows = [
    { variant: { ram_gb: 8, storage_gb: 128 }, priceText: '150000' },
    { variant: { ram_gb: 12, storage_gb: 256 }, priceText: '' },
    { variant: { ram_gb: 12, storage_gb: 512 }, priceText: 'lots' },
  ];
  const { entries, errors } = P.buildEntries({ deviceId: 'd', rows, shop: ' PriceOye ', observed_on: '2026-10-27' });
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], { deviceId: 'd', price_pkr: 150000, observed_on: '2026-10-27', ram_gb: 8, storage_gb: 128, shop: 'PriceOye' });
  assert.equal(errors.length, 1);
});

test('buildEntries refuses a bad date', () => {
  const { entries, errors } = P.buildEntries({ deviceId: 'd', rows: [{ variant: {}, priceText: '1000' }], observed_on: '27/10/2026' });
  assert.equal(entries.length, 0);
  assert.match(errors[0], /Date/);
});

test('latestByVariant keeps the newest entry per variant', () => {
  const m = P.latestByVariant([
    { ram_gb: 8, storage_gb: 128, price_pkr: 1, observed_on: '2026-01-01' },
    { ram_gb: 8, storage_gb: 128, price_pkr: 2, observed_on: '2026-03-01' },
  ]);
  assert.equal(m.get('8|128').price_pkr, 2);
});
