// Run: node --test extension/test/extension.check.mjs
// Uses the SYNTHETIC fixture (invented phone), so no third-party content is stored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));

// The extension files are plain browser scripts. Load them with a CommonJS
// wrapper so the same code runs here as in the browser.
function load(file) {
  const module = { exports: {} };
  new Function('module', 'exports', readFileSync(path.join(here, '..', file), 'utf8'))(module, module.exports);
  return module.exports;
}
const { extractPage } = load('extract.js');
const { toDevice, brandAndModel } = load('mapper.js');
const html = readFileSync(path.join(here, '../../scraper/tests/fixtures/synthetic_device.html'), 'utf8');
const dom = new JSDOM(html);
const url = 'https://www.gsmarena.com/acme_nova_9_pro_max-99999.php';
const raw = extractPage(dom.window.document, url);

test('extracts name, url, and categories with labels', () => {
  assert.equal(raw.name, 'Acme Nova 9 Pro Max');
  assert.equal(raw.url, url);
  assert.equal(raw.specs.Body.Weight, '205 g (7.23 oz)');
  assert.equal(raw.specs.Launch.Announced, '2024, March 5');
  assert.match(raw.specs.Body['Details'], /IP68/);
});

test('splits brand and model', () => {
  assert.deepEqual(brandAndModel('Acme Nova 9 Pro Max'), { brand: 'Acme', model: 'Nova 9 Pro Max' });
  assert.deepEqual(brandAndModel('Sony Ericsson Xperia Arc'), { brand: 'Sony Ericsson', model: 'Xperia Arc' });
});

test('maps the page into the app Device shape', () => {
  const d = toDevice(raw, { savedOn: '2026-10-26T00:00:00Z' });
  assert.equal(d.id, 'saved-99999');
  assert.equal(d.brand, 'Acme');
  assert.equal(d.model, 'Nova 9 Pro Max');
  assert.equal(d.year, 2024);
  assert.equal(d.status, 'released');
  assert.equal(d.body.weight_g, 205);
  assert.deepEqual(d.body.dimensions_mm, [180.5, 80.2, 8.1]);
  assert.equal(d.body.ip_rating, 'IP68');
  assert.equal(d.display.size_in, 6.6);
  assert.equal(d.display.refresh_hz_max, 120);
  assert.equal(d.display.panel_tech, 'OLED');
  assert.equal(d.battery.capacity_mah, 5000);
  assert.equal(d.battery.wired_w, 65);
  assert.equal(d.battery.wireless_w, 50);
  assert.equal(d.battery.reverse_w, 5);
  assert.equal(d.connectivity.nfc, true);
  assert.equal(d.audio.headphone_jack, undefined);
  assert.equal(d.price_usd, undefined, 'GSMArena prices are not used as MSRP');
  assert.equal(d.source_url, url);
  assert.match(d.source_note, /personal offline use on 2026-10-26/);
  assert.ok(d.raw_specs.Battery, 'full raw spec sheet is kept');
});

test('unknown values stay undefined instead of guessed', () => {
  const d = toDevice({ name: 'Acme Empty', url: 'https://www.gsmarena.com/x-1.php', image_url: null, specs: {} });
  assert.equal(d.soc.chipset, undefined);
  assert.equal(d.battery.capacity_mah, undefined);
  assert.equal(d.camera.main, undefined);
  assert.equal(d.status, 'announced');
});
