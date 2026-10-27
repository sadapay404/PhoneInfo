// Run: node --test extension/test/priceoye-panel.check.mjs
// Uses an invented phone and an invented PriceOye-like page. Nothing real is stored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(path.join(here, '..', f), 'utf8');
const sleep = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const phone = {
  id: 'saved-77', brand: 'Acme', model: 'Nova 9', year: 2025,
  soc: { ram_options_gb: [8, 12], storage_gb: [128, 256] },
};

function makeChrome(initial) {
  const store = { ...initial };
  return {
    store,
    storage: {
      local: {
        async get(keys) {
          if (keys === null) return { ...store };
          if (typeof keys === 'string') return { [keys]: store[keys] };
          return Object.fromEntries(keys.map((k) => [k, store[k]]));
        },
        async set(obj) { Object.assign(store, obj); },
        async remove(keys) { for (const k of [].concat(keys)) delete store[k]; },
      },
    },
  };
}

const PAGE = `<!doctype html><html><body>
  <main id="product"><h1>Acme Nova 9 8GB 128GB</h1><p class="price">Rs 1,99,999</p></main>
</body></html>`;

async function openPanel(chrome) {
  const dom = new JSDOM(PAGE, { url: 'https://priceoye.pk/acme-nova-9', runScripts: 'outside-only' });
  const { window } = dom;
  window.chrome = chrome;
  const before = window.document.getElementById('product').outerHTML;
  window.eval(read('prices-core.js'));
  window.eval(read('priceoye.js'));
  return { window, document: window.document, before };
}

test('adds only its own button and panel, and leaves the page unchanged', async () => {
  const { document, before } = await openPanel(makeChrome({ [`phone:${phone.id}`]: phone }));
  assert.ok(document.getElementById('aether-prices-btn'));
  assert.ok(document.getElementById('aether-prices-panel'));
  assert.equal(document.getElementById('product').outerHTML, before);
});

test('the panel never reads the PriceOye page', () => {
  const src = read('priceoye.js');
  assert.doesNotMatch(src, /querySelector|innerText|outerHTML|getElementsBy|innerHTML\s*\+/);
  assert.doesNotMatch(src, /document\.(body|documentElement|title)\b(?!\.append)/);
});

test('saves typed prices per variant with shop and date', async () => {
  const chrome = makeChrome({ [`phone:${phone.id}`]: phone });
  const { document, window } = await openPanel(chrome);
  document.getElementById('aether-prices-btn').click();
  await sleep();
  const select = document.querySelector('#aether-prices-panel select');
  select.value = phone.id;
  select.dispatchEvent(new window.Event('change'));
  await sleep();

  const inputs = [...document.querySelectorAll('#aether-prices-panel input[placeholder="Price in Rs"]')];
  assert.equal(inputs.length, 4, 'one box per RAM and storage variant');
  inputs[0].value = '1,85,000';
  inputs[3].value = '210000';
  const save = [...document.querySelectorAll('#aether-prices-panel button')].find((b) => b.textContent === 'Save prices');
  save.click();
  await sleep();

  const saved = JSON.parse(JSON.stringify(chrome.store[`prices:${phone.id}`]));
  assert.equal(saved.length, 2);
  assert.deepEqual(saved.map((e) => e.price_pkr).sort((a, b) => a - b), [185000, 210000]);
  assert.equal(saved[0].shop, 'PriceOye');
  assert.match(saved[0].observed_on, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(saved.some((e) => e.ram_gb === 8 && e.storage_gb === 128));
  assert.ok(saved.some((e) => e.ram_gb === 12 && e.storage_gb === 256));
});

test('refuses an invalid price and saves nothing', async () => {
  const chrome = makeChrome({ [`phone:${phone.id}`]: phone });
  const { document, window } = await openPanel(chrome);
  document.getElementById('aether-prices-btn').click();
  await sleep();
  const select = document.querySelector('#aether-prices-panel select');
  select.value = phone.id;
  select.dispatchEvent(new window.Event('change'));
  await sleep();
  const inputs = [...document.querySelectorAll('#aether-prices-panel input[placeholder="Price in Rs"]')];
  inputs[0].value = 'abc';
  [...document.querySelectorAll('#aether-prices-panel button')].find((b) => b.textContent === 'Save prices').click();
  await sleep();
  assert.equal(chrome.store[`prices:${phone.id}`], undefined);
});
