// Run: node --test extension/test/gallery.check.mjs
// SYNTHETIC pictures page. Image paths imitate GSMArena's layout; no real content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));

function load(file) {
  const module = { exports: {} };
  new Function('module', 'exports', readFileSync(path.join(here, '..', file), 'utf8'))(module, module.exports);
  return module.exports;
}
const extract = load('extract.js');
const zip = load('zip.js');

const DEVICE_URL = 'https://www.gsmarena.com/oneplus_15_5g-14206.php';

// The page lists this phone's photos AND other phones / unrelated images.
const PICTURES_HTML = `
<html><body>
<a href="https://fdn2.gsmarena.com/vv/pics/oneplus/oneplus-15-1.jpg"><img src="https://fdn2.gsmarena.com/vv/pics/oneplus/oneplus-15-1.jpg"></a>
<a href="https://fdn2.gsmarena.com/vv/pics/oneplus/oneplus-15-2.jpg"><img src="https://fdn2.gsmarena.com/vv/pics/oneplus/oneplus-15-2.jpg"></a>
<img src="https://fdn2.gsmarena.com/vv/bigpic/oneplus-15.jpg">
<img src="https://fdn.gsmarena.com/imgroot/reviews/25/oneplus-15/lifestyle/-1024w2/gsmarena_001.jpg">
<!-- other models that must NOT be saved -->
<img src="https://fdn2.gsmarena.com/vv/pics/oneplus/oneplus-15-pro-1.jpg">
<img src="https://fdn2.gsmarena.com/vv/bigpic/oneplus-15r.jpg">
<img src="https://fdn2.gsmarena.com/vv/pics/samsung/samsung-galaxy-s25-1.jpg">
<img src="https://fdn.gsmarena.com/imgroot/reviews/25/samsung-s25/lifestyle/-1024w2/gsmarena_003.jpg">
<img src="https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-16.jpg">
<img src="https://example.com/ad.jpg">
<div class="threed">
<img src="https://render.binkies3d.com/v1/image?bookmark=front&amp;modelFolder=21944-abc&amp;modelOptionUId=67PmQ3&amp;size=64">
<img src="https://render.binkies3d.com/v1/image?bookmark=right&amp;modelFolder=21944-abc&amp;modelOptionUId=67PmQ3&amp;size=64">
<img src="https://render.binkies3d.com/v1/image?bookmark=back&amp;modelFolder=21944-abc&amp;modelOptionUId=67PmQ3&amp;size=64">
<img src="https://render.binkies3d.com/v1/image?bookmark=left&amp;modelFolder=21944-abc&amp;modelOptionUId=67PmQ3&amp;size=64">
</div>
</body></html>`;

test('model slugs come from the device URL', () => {
  assert.deepEqual(extract.modelSlugs(DEVICE_URL), ['oneplus-15-5g', 'oneplus-15']);
  assert.deepEqual(extract.modelSlugs('https://www.gsmarena.com/apple_iphone_15-1.php'), ['apple-iphone-15']);
});

test('keeps only this phone\'s images, not other models or unrelated images', () => {
  const doc = new JSDOM(PICTURES_HTML).window.document;
  const slugs = extract.modelSlugs(DEVICE_URL);
  const urls = [...doc.querySelectorAll('a[href], img[src]')]
    .map((el) => el.getAttribute('href') || el.getAttribute('src'))
    .filter((u) => u.startsWith('http') && !u.includes('render.binkies3d'))
    .filter((u) => extract.isPhoneImage(u, slugs));
  const names = [...new Set(urls.map((u) => u.split('/').pop()))].sort();
  assert.deepEqual(names, ['gsmarena_001.jpg', 'oneplus-15-1.jpg', 'oneplus-15-2.jpg', 'oneplus-15.jpg']);
});

test('finds the four 3D preview views and skips the model itself', () => {
  const views = extract.findThreeDViews(PICTURES_HTML);
  assert.deepEqual(views.map((v) => v.view), ['front', 'right', 'back', 'left']);
  assert.match(views[0].url, /^https:\/\/render\.binkies3d\.com\/v1\/image\?bookmark=front&modelFolder=/);
});

test('folder names are the phone name, with safe characters only', () => {
  assert.equal(zip.safeName('OnePlus 15'), 'OnePlus 15');
  assert.equal(zip.safeName('Acme: Nova/9 <Pro>.'), 'Acme Nova9 Pro');
  assert.equal(zip.safeName('   '), 'Phone');
});

test('two phones with the same name get separate folders', () => {
  const names = zip.folderNames([
    { brand: 'OnePlus', model: '15' },
    { brand: 'OnePlus', model: '15' },
    { brand: 'Apple', model: 'iPhone 15' },
  ]);
  assert.deepEqual(names, ['OnePlus 15', 'OnePlus 15 (2)', 'Apple iPhone 15']);
});

// Regression: GSMArena file names can drop separators ("acme-nova60-pro-12.jpg" for
// "acme_nova_60_pro_5g"). The image's alt text (the full phone name) must still match.
test('keeps every photo of a phone whose file names drop separators', () => {
  const slugs = extract.modelSlugs('https://www.gsmarena.com/acme_nova_60_pro_5g-99998.php');
  const name = 'Acme Nova 60 Pro';
  const photo = (file) => `https://fdn2.gsmarena.com/vv/pics/acme/${file}`;
  assert.equal(extract.isPhoneImage(photo('acme-nova60-pro-12.jpg'), slugs, { name, alt: name }), true);
  assert.equal(extract.isPhoneImage(photo('acme-nova60-pro-11.jpg'), slugs, { name, alt: name }), true);
  assert.equal(extract.isPhoneImage('https://fdn2.gsmarena.com/vv/bigpic/acme-nova60-pro.jpg', slugs, { name, alt: name }), true);
  // Other models must still be rejected, even when their names start the same way.
  assert.equal(extract.isPhoneImage(photo('acme-nova-60-pro-max-1.jpg'), slugs, { name, alt: 'Acme Nova 60 Pro Max' }), false);
  assert.equal(extract.isPhoneImage(photo('acme-nova-60-1.jpg'), slugs, { name, alt: 'Acme Nova 60' }), false);
  // Alt text alone is not enough outside the photo folders (e.g. an ad host).
  assert.equal(extract.isPhoneImage('https://example.com/ad.jpg', slugs, { name, alt: name }), false);
});
