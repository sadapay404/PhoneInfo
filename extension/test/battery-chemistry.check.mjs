// Run: node --test extension/test/battery-chemistry.check.mjs
// Synthetic input only. Checks the battery chemistry keeps its full name.
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

function phone(type) {
  return toDevice({
    name: 'Acme Cell', url: 'https://www.gsmarena.com/a-2.php', image_url: null,
    specs: { Battery: { Type: type, Charging: '100W wired' } },
  });
}

test('silicon-carbon battery keeps "Si/C" in the chemistry', () => {
  assert.equal(phone('Si/C Li-Ion 9000 mAh').battery.chemistry, 'Si/C Li-Ion');
});

test('plain Li-Ion and Li-Po are still read correctly', () => {
  assert.equal(phone('Li-Ion 5000 mAh').battery.chemistry, 'Li-Ion');
  assert.equal(phone('Li-Po 4500mAh').battery.chemistry, 'Li-Po');
  assert.equal(phone('Si/Gr Li-Ion 6000 mAh').battery.chemistry, 'Si/Gr Li-Ion');
});
