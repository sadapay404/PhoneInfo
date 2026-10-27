import { describe, expect, it } from 'vitest';
import { parseSavedJson } from './savedPhones';
import { extrasFor, groupExtras } from './extras';

const phone = (raw: Record<string, Record<string, string>>) =>
  parseSavedJson(JSON.stringify([{ id: 'x', brand: 'A', model: 'B', raw_specs: raw }]))[0];

describe('extrasFor', () => {
  it('keeps stylus, build and other uncovered rows as extras, and drops covered rows', () => {
    const d = phone({
      Body: { Dimensions: '160 x 75 mm', Weight: '210 g', Build: 'Glass front, Armor Aluminum 2, IP68 dust tight', Stylus: 'Yes' },
      Launch: { Status: 'Available' },
    });
    const extras = extrasFor(d);
    expect(extras).toEqual([
      { category: 'Body', label: 'Build', value: 'Glass front, Armor Aluminum 2, IP68 dust tight' },
      { category: 'Body', label: 'Stylus', value: 'Yes' },
    ]);
  });

  it('pulls coating phrases out of the display type', () => {
    const d = phone({ Display: { Type: 'LTPO OLED, 1000 nits, dual-layer anti-reflective coating' } });
    expect(extrasFor(d)).toEqual([{ category: 'Display', label: 'Feature', value: 'dual-layer anti-reflective coating' }]);
  });

  it('returns nothing for phones without a spec sheet', () => {
    expect(extrasFor(phone({}))).toEqual([]);
  });

  it('groups by category in order', () => {
    const groups = groupExtras([
      { category: 'Body', label: 'Build', value: 'a' },
      { category: 'Misc', label: 'Price', value: 'b' },
      { category: 'Body', label: 'SIM', value: 'c' },
    ]);
    expect(groups.map((g) => g.category)).toEqual(['Body', 'Misc']);
    expect(groups[0].rows).toHaveLength(2);
  });
});
