// Run: node --test extension/test/binkies-core.check.mjs
// Uses invented file names. Nothing is fetched.
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
const src = read('binkies-core.js');
const module = { exports: {} };
new Function('module', 'exports', 'globalThis', src)(module, module.exports, globalThis);
const B = module.exports;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('selects textures, lightmaps and render previews, never the model file', () => {
  const urls = [
    'https://engage-content2.binkies3d.com/folder-a/7/Body_albedo.jpg',
    'https://engage-content2.binkies3d.com/folder-a/7/scene.mdm.br',
    'https://engage-content2.binkies3d.com/folder-a/7/gloss%20map.png',
    'https://engage-content.binkies3d.com/lightmaps/js/env_01.webp',
    'https://render.binkies3d.com/v1/image?bookmark=front&modelFolder=folder-a&modelOptionUId=6&size=64',
    'https://embed.binkies3d.com/content/abc/def/',
    'https://www.gsmarena.com/x.jpg',
    'http://engage-content2.binkies3d.com/folder-a/7/insecure.jpg',
  ];
  assert.deepEqual(B.selectImages(urls), [
    { url: 'https://engage-content2.binkies3d.com/folder-a/7/Body_albedo.jpg', name: 'Body_albedo.jpg' },
    { url: 'https://engage-content2.binkies3d.com/folder-a/7/gloss%20map.png', name: 'gloss map.png' },
    { url: 'https://engage-content.binkies3d.com/lightmaps/js/env_01.webp', name: 'env_01.webp' },
    { url: 'https://render.binkies3d.com/v1/image?bookmark=front&modelFolder=folder-a&modelOptionUId=6&size=64', name: 'render-front-6-64' },
  ]);
});

test('same file name in two folders gets a unique name; duplicate URLs are dropped', () => {
  const out = B.selectImages([
    'https://engage-content2.binkies3d.com/a/1/tex.jpg',
    'https://engage-content2.binkies3d.com/a/1/tex.jpg',
    'https://engage-content2.binkies3d.com/b/1/tex.jpg',
  ]);
  assert.deepEqual(out.map((f) => f.name), ['tex.jpg', 'tex-2.jpg']);
});

test('picture page: asks for the phone first, and explains when no 3D viewer has loaded', async () => {
  const mk = (store) => {
    const dom = new JSDOM('<html><body></body></html>', { url: 'https://www.gsmarena.com/acme_nova_9-pictures-99999.php', runScripts: 'dangerously' });
    const w = dom.window;
    w.performance.getEntriesByType = () => []; // JSDOM has no Resource Timing; a browser's list is empty here too
    const data = { ...store };
    w.chrome = {
      storage: { local: {
        async get(k) { return typeof k === 'string' ? { [k]: data[k] } : { ...data }; },
        async set(o) { Object.assign(data, o); },
      } },
      runtime: { async sendMessage() { return { ok: true, dataUrl: 'data:image/jpeg;base64,AA==' }; } },
    };
    w.eval(read('binkies-core.js'));
    w.eval(read('binkies.js'));
    return { w, data, btn: w.document.getElementById('aetherphone-binkies-save') };
  };
  const notice = (w) => w.document.body.lastElementChild.previousElementSibling.textContent;

  const notSaved = mk({});
  assert.ok(notSaved.btn);
  notSaved.btn.click();
  await sleep(20);
  assert.match(notice(notSaved.w), /Save this phone first/);

  const saved = mk({ 'phone:saved-99999': { id: 'saved-99999' } });
  saved.btn.click();
  for (let i = 0; i < 100 && saved.btn.disabled; i++) await sleep(50);
  assert.match(notice(saved.w), /No 3D image files found/);
  assert.equal(saved.data['binkies:saved-99999'], undefined);
});
