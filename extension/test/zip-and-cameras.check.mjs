// Run: node --test extension/test/zip-and-cameras.check.mjs
// Synthetic inputs only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const here = path.dirname(fileURLToPath(import.meta.url));

function load(file) {
  const module = { exports: {} };
  new Function('module', 'exports', readFileSync(path.join(here, '..', file), 'utf8'))(module, module.exports);
  return module.exports;
}
const { toDevice } = load('mapper.js');
const zipLib = load('zip.js');

test('ZIP writer output opens with JSZip and keeps every file byte-for-byte', async () => {
  const enc = new TextEncoder();
  const photo = zipLib.dataUrlToBytes('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==');
  const bytes = zipLib.buildZip([
    { name: 'aetherphone-saved.json', data: enc.encode('[{"id":"saved-1"}]') },
    { name: 'photos/saved-1/01-official.jpg', data: photo },
  ]);
  const zip = await JSZip.loadAsync(bytes);
  assert.deepEqual(Object.keys(zip.files).sort(), ['aetherphone-saved.json', 'photos/saved-1/01-official.jpg']);
  assert.equal(await zip.file('aetherphone-saved.json').async('string'), '[{"id":"saved-1"}]');
  assert.deepEqual(new Uint8Array(await zip.file('photos/saved-1/01-official.jpg').async('uint8array')), photo);
});

test('splits a multi-lens camera row into main, telephoto, and ultrawide', () => {
  const row = '50 MP, f/1.8, 24mm (wide), 1/1.56", 1.0µm, multi-directional PDAF, OIS '
    + '50 MP, f/2.8, 80mm (periscope telephoto), 1/2.76", 0.64µm, 3.5x optical zoom, PDAF, OIS '
    + '50 MP, f/2.0, 16mm, 116˚ (ultrawide), 1/2.88", 0.61µm, PDAF';
  const d = toDevice({
    name: 'Acme Trio', url: 'https://www.gsmarena.com/a-1.php', image_url: null,
    specs: { 'Main Camera': { Triple: row, Features: 'LED flash' } },
  });
  assert.deepEqual(d.camera.main, { mp: 50, aperture: 'f/1.8', focal_mm: 24 });
  assert.deepEqual(d.camera.telephoto, { mp: 50, aperture: 'f/2.8', focal_mm: 80, zoom_x: 3.5 });
  assert.deepEqual(d.camera.ultrawide, { mp: 50, aperture: 'f/2.0', focal_mm: 16 });
});

test('gallery info is stored on the device', () => {
  const d = toDevice(
    { name: 'Acme Nova', url: 'https://www.gsmarena.com/a-2.php', image_url: null, specs: { Launch: { Status: 'Available' } } },
    { gallery: { has_3d: true, pictures_url: 'https://www.gsmarena.com/a-pictures-2.php', photo_count: 12 } },
  );
  assert.deepEqual(d.gallery, { has_3d: true, pictures_url: 'https://www.gsmarena.com/a-pictures-2.php', photo_count: 12 });
});
