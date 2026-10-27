// Run: node --test extension/test/autosave.check.mjs
// Opens the SYNTHETIC GSMArena-style fixture (invented phone) and checks automatic saving.
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
const fixture = readFileSync(path.join(here, '../../scraper/tests/fixtures/synthetic_device.html'), 'utf8');
const URL_ = 'https://www.gsmarena.com/acme_nova_9_pro_max-99999.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openPage({ store = {} }) {
  const dom = new JSDOM(fixture, { url: URL_, runScripts: 'dangerously' });
  const w = dom.window;
  const data = { ...store };
  w.fetch = async () => ({ ok: false, text: async () => '' }); // no Pictures page in the fixture: no photos
  w.chrome = {
    storage: { local: {
      async get(keys) {
        if (keys === null) return { ...data };
        if (typeof keys === 'string') return { [keys]: data[keys] };
        return Object.fromEntries(keys.map((k) => [k, data[k]]));
      },
      async set(obj) { Object.assign(data, obj); },
    } },
    runtime: { async sendMessage() { return { ok: false, error: 'no network in test' }; } },
  };
  w.eval(read('extract.js'));
  w.eval(read('mapper.js'));
  w.eval(read('content.js'));
  return { w, data, button: w.document.getElementById('aether-save') };
}

test('a phone not saved yet is saved automatically when the page opens', async () => {
  const { data, button } = await openPage({});
  assert.ok(button, 'button is still there');
  for (let i = 0; i < 60 && !data['phone:saved-99999']; i++) await sleep(50);
  assert.ok(data['phone:saved-99999'], 'phone saved without pressing the button');
  assert.match(button.textContent, /Auto-saved/);
});

test('a phone already saved is left alone on open', async () => {
  const before = { id: 'saved-99999', brand: 'Acme', model: 'Nova 9 Pro Max (mine)', year: 2025 };
  const { data } = await openPage({ store: { 'phone:saved-99999': before } });
  await sleep(1800);
  assert.deepEqual(data['phone:saved-99999'], before);
});

test('with automatic saving turned off, nothing is saved on open', async () => {
  const { data } = await openPage({ store: { settings: { autoSave: false } } });
  await sleep(1800);
  assert.equal(data['phone:saved-99999'], undefined);
});
