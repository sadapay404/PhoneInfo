import type { Device } from '../data/types';

/**
 * PhoneFinder filter engine. Pure functions, no DOM, fully unit-tested.
 * Text search is handled separately (Fuse.js) so typos still work; this module
 * applies the structured filters and sorting on top of those results.
 */

export interface Filters {
  brands: string[];
  yearMin?: number;
  yearMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  hzMin?: number;
  peakMin?: number;
  panel?: 'OLED' | 'LCD';
  socBrands: string[];
  ramMin?: number;
  storageMin?: number;
  batteryMin?: number;
  wiredMin?: number;
  wirelessMin?: number;
  mainMpMin?: number;
  zoomMin?: number;
  ipMin?: number;          // 67 or 68
  osFamilies: string[];
  weightMax?: number;
  /** Each true flag means "must have". */
  features: Partial<Record<FeatureKey, boolean>>;
  sort: SortKey;
}

export type FeatureKey = 'fiveG' | 'nfc' | 'uwb' | 'irBlaster' | 'headphoneJack' | 'stylus' | 'expandable' | 'wirelessCharge';
export type SortKey = 'newest' | 'battery' | 'brightness' | 'refresh' | 'camera' | 'lightest' | 'name';

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  fiveG: '5G',
  nfc: 'NFC',
  uwb: 'UWB',
  irBlaster: 'IR blaster',
  headphoneJack: '3.5 mm jack',
  stylus: 'Stylus',
  expandable: 'microSD slot',
  wirelessCharge: 'Wireless charging',
};

export const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest',
  battery: 'Biggest battery',
  brightness: 'Brightest screen',
  refresh: 'Smoothest screen',
  camera: 'Best main camera',
  lightest: 'Lightest',
  name: 'Name A–Z',
};

export const DEFAULT_FILTERS: Filters = {
  brands: [],
  socBrands: [],
  osFamilies: [],
  features: {},
  sort: 'newest',
};

/** Reset everything except the sort order, which is a preference rather than a filter. */
export function clearFilters(f: Filters): Filters {
  return { ...DEFAULT_FILTERS, sort: f.sort };
}

export function activeFilterCount(f: Filters): number {
  let n = 0;
  n += f.brands.length + f.socBrands.length + f.osFamilies.length;
  const scalars: (keyof Filters)[] = ['yearMin', 'yearMax', 'sizeMin', 'sizeMax', 'hzMin', 'peakMin', 'panel', 'ramMin', 'storageMin', 'batteryMin', 'wiredMin', 'wirelessMin', 'mainMpMin', 'zoomMin', 'ipMin', 'weightMax'];
  for (const k of scalars) if (f[k] !== undefined) n += 1;
  n += Object.values(f.features).filter(Boolean).length;
  return n;
}

const atLeast = (value: number | undefined, min: number | undefined) => min === undefined || (value !== undefined && value >= min);
const atMost = (value: number | undefined, max: number | undefined) => max === undefined || (value !== undefined && value <= max);

export function matches(d: Device, f: Filters): boolean {
  if (f.brands.length && !f.brands.includes(d.brand)) return false;
  if (!atLeast(d.year, f.yearMin) || !atMost(d.year, f.yearMax)) return false;
  if (!atLeast(d.display.size_in, f.sizeMin) || !atMost(d.display.size_in, f.sizeMax)) return false;
  if (!atLeast(d.display.refresh_hz_max, f.hzMin)) return false;
  if (!atLeast(d.display.peak_nits, f.peakMin)) return false;
  if (f.panel && d.display.panel_tech !== f.panel) return false;
  if (f.socBrands.length && (!d.soc.brand || !f.socBrands.includes(d.soc.brand))) return false;
  if (!atLeast(d.soc.ram_gb, f.ramMin)) return false;
  if (f.storageMin !== undefined) {
    const max = d.soc.storage_gb?.length ? Math.max(...d.soc.storage_gb) : undefined;
    if (!atLeast(max, f.storageMin)) return false;
  }
  if (!atLeast(d.battery.capacity_mah, f.batteryMin)) return false;
  if (!atLeast(d.battery.wired_w, f.wiredMin)) return false;
  if (!atLeast(d.battery.wireless_w, f.wirelessMin)) return false;
  if (!atLeast(d.camera.main?.mp, f.mainMpMin)) return false;
  if (!atLeast(d.camera.telephoto?.zoom_x, f.zoomMin)) return false;
  if (f.ipMin !== undefined) {
    const ip = d.body.ip_rating ? Number((/IP\d?(\d{2})/.exec(d.body.ip_rating) ?? [])[1]) : undefined;
    if (!atLeast(ip, f.ipMin)) return false;
  }
  if (f.osFamilies.length && (!d.software.os_family || !f.osFamilies.includes(d.software.os_family))) return false;
  if (!atMost(d.body.weight_g, f.weightMax)) return false;

  const must = (on: boolean | undefined) => on === true;
  for (const [key, wanted] of Object.entries(f.features) as [FeatureKey, boolean | undefined][]) {
    if (!wanted) continue;
    const ok = {
      fiveG: must(d.connectivity.five_g),
      nfc: must(d.connectivity.nfc),
      uwb: must(d.connectivity.uwb),
      irBlaster: must(d.connectivity.ir_blaster),
      headphoneJack: must(d.audio.headphone_jack),
      stylus: must(d.body.stylus),
      expandable: must(d.memory?.expandable),
      wirelessCharge: (d.battery.wireless_w ?? 0) > 0,
    }[key];
    if (!ok) return false;
  }
  return true;
}

export function applyFilters(devices: Device[], f: Filters): Device[] {
  return devices.filter((d) => matches(d, f));
}

export function sortDevices(devices: Device[], sort: SortKey): Device[] {
  const desc = (get: (d: Device) => number | undefined) => (a: Device, b: Device) => (get(b) ?? -Infinity) - (get(a) ?? -Infinity);
  const asc = (get: (d: Device) => number | undefined) => (a: Device, b: Device) => (get(a) ?? Infinity) - (get(b) ?? Infinity);
  const byName = (a: Device, b: Device) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);
  const cmp: Record<SortKey, (a: Device, b: Device) => number> = {
    newest: (a, b) => b.year - a.year || byName(a, b),
    battery: desc((d) => d.battery.capacity_mah),
    brightness: desc((d) => d.display.peak_nits),
    refresh: desc((d) => d.display.refresh_hz_max),
    camera: desc((d) => d.camera.main?.mp),
    lightest: asc((d) => d.body.weight_g),
    name: byName,
  };
  return [...devices].sort(cmp[sort]);
}

/* ---------- URL state: filters live in the hash query so views are shareable ---------- */

const LIST_KEYS = ['brands', 'socBrands', 'osFamilies'] as const;
const NUM_KEYS = ['yearMin', 'yearMax', 'sizeMin', 'sizeMax', 'hzMin', 'peakMin', 'ramMin', 'storageMin', 'batteryMin', 'wiredMin', 'wirelessMin', 'mainMpMin', 'zoomMin', 'ipMin', 'weightMax'] as const;

export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  for (const k of LIST_KEYS) if (f[k].length) p.set(k, f[k].join(','));
  for (const k of NUM_KEYS) if (f[k] !== undefined) p.set(k, String(f[k]));
  if (f.panel) p.set('panel', f.panel);
  for (const [k, v] of Object.entries(f.features)) if (v) p.set(`f_${k}`, '1');
  if (f.sort !== 'newest') p.set('sort', f.sort);
  return p.toString();
}

export function filtersFromQuery(query: string): Filters {
  const p = new URLSearchParams(query);
  const f: Filters = { ...DEFAULT_FILTERS, features: {}, brands: [], socBrands: [], osFamilies: [] };
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(',').filter(Boolean) : []);
  f.brands = list('brands');
  f.socBrands = list('socBrands');
  f.osFamilies = list('osFamilies');
  for (const k of NUM_KEYS) {
    const raw = p.get(k);
    if (raw !== null && raw !== '' && !Number.isNaN(Number(raw))) (f as unknown as Record<string, number>)[k] = Number(raw);
  }
  const panel = p.get('panel');
  if (panel === 'OLED' || panel === 'LCD') f.panel = panel;
  for (const key of Object.keys(FEATURE_LABELS) as FeatureKey[]) {
    if (p.get(`f_${key}`) === '1') f.features[key] = true;
  }
  const sort = p.get('sort') as SortKey | null;
  if (sort && sort in SORT_LABELS) f.sort = sort;
  return f;
}

/* ---------- Presets: one-tap starting points, like "Best battery" ---------- */

export const PRESETS: { id: string; label: string; hint: string; apply: Partial<Filters> }[] = [
  { id: 'battery', label: 'Marathon battery', hint: '5,000 mAh+', apply: { batteryMin: 5000, sort: 'battery' } },
  { id: 'camera', label: 'Camera flagships', hint: '48 MP main, 3x+ zoom', apply: { mainMpMin: 48, zoomMin: 3, sort: 'camera' } },
  { id: 'screen', label: 'Smooth + bright', hint: '120 Hz, 1500 nits+', apply: { hzMin: 120, peakMin: 1500, sort: 'brightness' } },
  { id: 'compact', label: 'One-hand size', hint: 'Screen 6.2″ or less', apply: { sizeMax: 6.2, sort: 'lightest' } },
  { id: 'oled-5g', label: 'OLED + 5G', hint: 'Modern essentials', apply: { panel: 'OLED', features: { fiveG: true } } },
  { id: 'fast-charge', label: 'Fast charging', hint: '65 W wired+', apply: { wiredMin: 65, sort: 'battery' } },
];

export function applyPreset(base: Filters, preset: Partial<Filters>): Filters {
  return { ...base, ...preset, features: { ...base.features, ...(preset.features ?? {}) } };
}
