import { describe, expect, it } from 'vitest';
import type { Device } from '../data/types';
import {
  DEFAULT_FILTERS, PRESETS, activeFilterCount, applyFilters, applyPreset, filtersFromQuery, filtersToQuery,
  sortDevices, type Filters,
} from './finder';

const base = (over: Partial<Device>): Device => ({
  id: 'x', brand: 'Acme', model: 'X', year: 2024, status: 'released',
  body: {}, display: {}, soc: {}, camera: {}, audio: {}, connectivity: {}, battery: {}, software: {}, repair: {},
  ...over,
});

const phones: Device[] = [
  base({
    id: 'a', brand: 'Apple', model: 'One', year: 2023,
    body: { weight_g: 187, ip_rating: 'IP68' },
    display: { size_in: 6.1, refresh_hz_max: 120, peak_nits: 2000, panel_tech: 'OLED' },
    soc: { brand: 'Apple', ram_gb: 8, storage_gb: [128, 256, 512] },
    camera: { main: { mp: 48 }, telephoto: { zoom_x: 3 } },
    audio: { headphone_jack: false },
    connectivity: { five_g: true, nfc: true, uwb: true, ir_blaster: false },
    battery: { capacity_mah: 3274, wired_w: 27, wireless_w: 15 },
    software: { os_family: 'iOS' },
  }),
  base({
    id: 'b', brand: 'Samsung', model: 'Two', year: 2024,
    body: { weight_g: 232, ip_rating: 'IP68', stylus: true },
    display: { size_in: 6.8, refresh_hz_max: 120, peak_nits: 2600, panel_tech: 'OLED' },
    soc: { brand: 'Snapdragon', ram_gb: 12, storage_gb: [256, 512, 1024] },
    camera: { main: { mp: 200 }, telephoto: { zoom_x: 5 } },
    audio: { headphone_jack: false },
    connectivity: { five_g: true, nfc: true, uwb: true, ir_blaster: true },
    battery: { capacity_mah: 5000, wired_w: 45, wireless_w: 15 },
    memory: { expandable: false },
    software: { os_family: 'Android' },
  }),
  base({
    id: 'c', brand: 'Xiaomi', model: 'Three', year: 2022,
    body: { weight_g: 190, ip_rating: 'IP53' },
    display: { size_in: 6.4, refresh_hz_max: 60, peak_nits: 800, panel_tech: 'LCD' },
    soc: { brand: 'Dimensity', ram_gb: 6, storage_gb: [128] },
    camera: { main: { mp: 64 } },
    audio: { headphone_jack: true },
    connectivity: { five_g: false, nfc: false },
    battery: { capacity_mah: 4500, wired_w: 33 },
    memory: { expandable: true },
    software: { os_family: 'Android' },
  }),
  base({ id: 'd', brand: 'Mystery', model: 'Four', year: 2024 }), // almost nothing known
];

const ids = (list: Device[]) => list.map((d) => d.id);
const f = (over: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, features: {}, ...over });

describe('filters', () => {
  it('no filters keeps everything, including devices with unknown fields', () => {
    expect(ids(applyFilters(phones, DEFAULT_FILTERS))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('numeric minimums exclude devices with an unknown value (strict)', () => {
    expect(ids(applyFilters(phones, f({ batteryMin: 4000 })))).toEqual(['b', 'c']);
  });

  it('brand and SoC brand filters are OR within a group', () => {
    expect(ids(applyFilters(phones, f({ brands: ['Apple', 'Xiaomi'] })))).toEqual(['a', 'c']);
    expect(ids(applyFilters(phones, f({ socBrands: ['Dimensity', 'Apple'] })))).toEqual(['a', 'c']);
  });

  it('filters combine with AND across groups', () => {
    expect(ids(applyFilters(phones, f({ hzMin: 120, peakMin: 2500 })))).toEqual(['b']);
  });

  it('feature flags require the feature', () => {
    expect(ids(applyFilters(phones, f({ features: { stylus: true } })))).toEqual(['b']);
    expect(ids(applyFilters(phones, f({ features: { headphoneJack: true } })))).toEqual(['c']);
    expect(ids(applyFilters(phones, f({ features: { fiveG: true, irBlaster: true } })))).toEqual(['b']);
  });

  it('wireless charging means a known wireless wattage above zero', () => {
    expect(ids(applyFilters(phones, f({ features: { wirelessCharge: true } })))).toEqual(['a', 'b']);
  });

  it('expandable storage uses the memory section', () => {
    expect(ids(applyFilters(phones, f({ features: { expandable: true } })))).toEqual(['c']);
  });

  it('IP rating threshold parses the number', () => {
    expect(ids(applyFilters(phones, f({ ipMin: 68 })))).toEqual(['a', 'b']);
    expect(ids(applyFilters(phones, f({ ipMin: 67 })))).toEqual(['a', 'b']);
  });

  it('storage filter uses the largest storage option', () => {
    expect(ids(applyFilters(phones, f({ storageMin: 1000 })))).toEqual(['b']);
  });

  it('screen size range and panel type', () => {
    expect(ids(applyFilters(phones, f({ sizeMax: 6.2 })))).toEqual(['a']);
    expect(ids(applyFilters(phones, f({ panel: 'LCD' })))).toEqual(['c']);
  });

  it('weight ceiling', () => {
    expect(ids(applyFilters(phones, f({ weightMax: 200 })))).toEqual(['a', 'c']);
  });

  it('year range', () => {
    expect(ids(applyFilters(phones, f({ yearMin: 2024 })))).toEqual(['b', 'd']);
    expect(ids(applyFilters(phones, f({ yearMin: 2023, yearMax: 2023 })))).toEqual(['a']);
  });

  it('counts active filters for the badge', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount(f({ brands: ['Apple'], batteryMin: 4000, features: { nfc: true, fiveG: false } }))).toBe(3);
  });
});

describe('sorting', () => {
  it('sorts by battery, brightness and camera (largest first, unknowns last)', () => {
    expect(ids(sortDevices(phones, 'battery'))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(sortDevices(phones, 'brightness'))).toEqual(['b', 'a', 'c', 'd']);
    expect(ids(sortDevices(phones, 'camera'))).toEqual(['b', 'c', 'a', 'd']);
  });

  it('lightest first puts unknown weights last', () => {
    expect(ids(sortDevices(phones, 'lightest'))).toEqual(['a', 'c', 'b', 'd']);
  });

  it('newest puts the latest year first, then name', () => {
    expect(ids(sortDevices(phones, 'newest'))).toEqual(['d', 'b', 'a', 'c']); // 2024 first; Mystery before Samsung
  });

  it('name sorts by brand then model', () => {
    expect(ids(sortDevices(phones, 'name'))).toEqual(['a', 'd', 'b', 'c']);
  });
});

describe('URL state', () => {
  it('round-trips every filter kind', () => {
    const original = f({
      brands: ['Apple', 'Samsung'], socBrands: ['Snapdragon'], osFamilies: ['Android'],
      batteryMin: 5000, peakMin: 2000, sizeMax: 6.5, ipMin: 68, panel: 'OLED',
      features: { fiveG: true, stylus: true }, sort: 'battery',
    });
    const back = filtersFromQuery(filtersToQuery(original));
    expect(back).toEqual(original);
  });

  it('ignores garbage in the URL instead of crashing', () => {
    const back = filtersFromQuery('batteryMin=abc&panel=PLASMA&sort=nonsense&brands=');
    expect(back.batteryMin).toBeUndefined();
    expect(back.panel).toBeUndefined();
    expect(back.sort).toBe('newest');
    expect(back.brands).toEqual([]);
  });

  it('default state produces an empty query string', () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe('');
  });
});

describe('presets', () => {
  it('every preset yields a valid, non-empty filter state', () => {
    for (const p of PRESETS) {
      const next = applyPreset(DEFAULT_FILTERS, p.apply);
      expect(activeFilterCount(next)).toBeGreaterThan(0);
      expect(filtersFromQuery(filtersToQuery(next))).toEqual(next);
    }
  });

  it('applying a preset keeps existing feature flags', () => {
    const base0 = f({ features: { nfc: true } });
    const next = applyPreset(base0, { features: { fiveG: true } });
    expect(next.features).toEqual({ nfc: true, fiveG: true });
  });
});
