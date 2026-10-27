// Run: node --test extension/test/priceoye-extract.check.mjs
// Runs the real content script on an invented PriceOye-shaped page. Nothing is fetched; chrome is mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(path.join(here, '..', f), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGE = `<!doctype html><html><head><title>VGO-TEL NEW 10 Price in Pakistan 2026 | Priceoye</title></head><body>
<h1>VGO-TEL NEW 10</h1>
<img src="https://images.priceoye.pk/vgo-tel-new-10-pakistan-priceoye-8rw24-500x500.webp">
<img src="https://images.priceoye.pk/vgo-tel-new-10-pakistan-priceoye-m1ftv-100x100.webp">
<img src="https://images.priceoye.pk/other-phone-pakistan-priceoye-zzzzz-270x270.webp">
<div class="buy"><div id="price">Rs12,349 <s>Rs13,699</s></div>
  <div>
    <button onclick="setP(12349)"><span>32GB - 2GB RAM</span></button>
    <button onclick="setP(13999)"><span>64GB - 2GB RAM</span></button>
    <a href="/mobiles/vgo-tel/vgo-tel-new-10?v=3" onclick="setP(15999)"><span>128GB - 4GB RAM</span></a>
  </div>
</div>
<div>4.7 | 19 Reviews</div><div>DISCONTINUED</div>
<script>function setP(p){document.getElementById('price').textContent='Rs'+p.toLocaleString('en-US')+' Rs'+(p+1350).toLocaleString('en-US');}</script>
</body></html>`;

async function runPage({ store, failUrl }) {
  const dom = new JSDOM(PAGE, { url: 'https://priceoye.pk/mobiles/vgo-tel/vgo-tel-new-10', runScripts: 'dangerously' });
  const w = dom.window;
  const data = { ...store };
  const requested = [];
  w.chrome = {
    storage: {
      local: {
        async get(keys) {
          if (keys === null) return { ...data };
          if (typeof keys === 'string') return { [keys]: data[keys] };
          return Object.fromEntries(keys.map((k) => [k, data[k]]));
        },
        async set(obj) { Object.assign(data, obj); },
      },
    },
    runtime: {
      async sendMessage(msg) {
        requested.push(msg.url);
        if (failUrl && msg.url.includes(failUrl)) return { ok: false, error: 'HTTP 404' };
        return { ok: true, dataUrl: `data:image/webp;base64,${Buffer.from(msg.url).toString('base64')}` };
      },
    },
  };
  w.eval(read('priceoye-core.js'));
  w.eval(read('priceoye-extract.js'));
  const btn = w.document.getElementById('aetherphone-priceoye-extract');
  assert.ok(btn, 'button is added');
  btn.click();
  const note = w.document.body.lastElementChild.previousElementSibling;
  for (let i = 0; i < 100 && btn.disabled; i++) await sleep(50);
  return { data, requested, note: note.textContent, doc: w.document };
}

test('phone not saved yet: saves photos, the device, and every variant price', async () => {
  const { data, note, requested } = await runPage({ store: {}, failUrl: 'm1ftv-500x500' });
  assert.match(note, /Saved VGO-TEL NEW 10: 2 photos, 3 prices/);
  const phone = data['phone:priceoye-vgo-tel-new-10'];
  assert.equal(phone.brand, 'VGO-TEL');
  assert.equal(phone.model, 'NEW 10');
  assert.equal(phone.soc.variants.length, 3);
  assert.equal(phone.priceoye.discontinued, true);
  assert.equal(phone.priceoye.rating, 4.7);
  const photos = data['photos:priceoye-vgo-tel-new-10'];
  assert.equal(photos.length, 2);
  assert.ok(photos.every((p) => p.kind === 'official' && p.dataUrl.startsWith('data:image/webp')));
  // 500x500 was tried first, and the failed size fell back to the page's own size.
  assert.ok(requested.some((u) => u.endsWith('8rw24-500x500.webp')));
  assert.ok(requested.some((u) => u.endsWith('m1ftv-500x500.webp')));
  assert.ok(requested.some((u) => u.endsWith('m1ftv-100x100.webp')));
  assert.ok(!requested.some((u) => u.includes('zzzzz')), 'similar phones’ images are not taken');
  const prices = data['prices:priceoye-vgo-tel-new-10'];
  assert.deepEqual(JSON.parse(JSON.stringify(prices.map((p) => [p.ram_gb, p.storage_gb, p.price_pkr, p.shop]))), [
    [2, 32, 12349, 'PriceOye'], [2, 64, 13999, 'PriceOye'], [4, 128, 15999, 'PriceOye'],
  ]);
});

test('phone already saved from GSMArena: prices and extra facts only, no images', async () => {
  const gsm = { id: 'saved-77', brand: 'Vgotel', model: 'New 10', year: 2025, soc: {} };
  const { data, note, requested } = await runPage({ store: { 'phone:saved-77': gsm } });
  assert.match(note, /Already saved from GSMArena. Saved 3 new prices/);
  assert.equal(requested.length, 0, 'no image requests');
  assert.equal(data['photos:priceoye-vgo-tel-new-10'], undefined);
  assert.equal(data['phone:priceoye-vgo-tel-new-10'], undefined, 'no second copy of the phone');
  assert.equal(data['prices:saved-77'].length, 3);
  assert.equal(data['phone:saved-77'].priceoye.rating, 4.7);
  assert.equal(data['phone:saved-77'].model, 'New 10', 'GSMArena record is left as it was');
});

test('running again the same day does not duplicate price rows', async () => {
  const gsm = { id: 'saved-77', brand: 'Vgotel', model: 'New 10', year: 2025, soc: {} };
  const first = await runPage({ store: { 'phone:saved-77': gsm } });
  const second = await runPage({ store: first.data });
  assert.equal(second.data['prices:saved-77'].length, 3);
  assert.match(second.note, /Saved 0 new prices/);
});

test('a page that is not a phone page gets no button', () => {
  const dom = new JSDOM('<html><head><title>x</title></head><body></body></html>', { url: 'https://priceoye.pk/mobiles/compare/a-vs-b', runScripts: 'dangerously' });
  dom.window.chrome = { storage: { local: { get: async () => ({}) } }, runtime: {} };
  dom.window.eval(read('priceoye-core.js'));
  dom.window.eval(read('priceoye-extract.js'));
  assert.equal(dom.window.document.getElementById('aetherphone-priceoye-extract'), null);
});
