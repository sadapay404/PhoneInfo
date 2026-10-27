// Run: node --test extension/test/body-stylus.check.mjs
// Synthetic input only. Checks the IP code and stylus flag from the Body section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
function load(file) {
  const module = { exports: {} };
  new Function('module', 'exports', readFileSync(path.join(here, '..', file), 'utf8'))(module, module.exports);
  return module.exports;
}
const { toDevice } = load('mapper.js');

test('IP rating is only the code, not the whole build text', () => {
  const d = toDevice({
    name: 'Acme Ultra', url: 'https://www.gsmarena.com/a-3.php', image_url: null,
    specs: { Body: { Build: 'Armor Aluminum 2, IP68 dust tight and water resistant (immersible up to 1.5m for 30 min)' } },
  });
  assert.equal(d.body.ip_rating, 'IP68');
});

test('stylus is detected from the Body or Features text', () => {
  const pen = toDevice({
    name: 'Acme Note', url: 'https://www.gsmarena.com/a-4.php', image_url: null,
    specs: { Body: { Stylus: 'Yes' } },
  });
  assert.equal(pen.body.stylus, true);
  const plain = toDevice({
    name: 'Acme Basic', url: 'https://www.gsmarena.com/a-5.php', image_url: null,
    specs: { Body: { Build: 'Glass front' } },
  });
  assert.equal(plain.body.stylus, undefined);
});
