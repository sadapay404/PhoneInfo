import type { Device } from './types';

/**
 * Rows of the saved spec sheet that the spec table already shows. Anything else in the
 * sheet (stylus, RedMagic triggers, build, SIM, coatings, sensors...) is an extra feature.
 * '*' means the whole category is already covered.
 */
const COVERED: Record<string, '*' | string[]> = {
  Launch: '*',
  Network: '*',
  Memory: '*',
  Battery: '*',
  Sound: '*',
  'Main Camera': '*',
  'Selfie camera': '*',
  Platform: ['OS', 'Chipset', 'CPU', 'GPU'],
  Display: ['Type', 'Size', 'Resolution', 'Protection'],
  Body: ['Dimensions', 'Weight'],
  Comms: ['WLAN', 'Bluetooth', 'NFC'],
};

/** Phrases inside the display type that describe a feature, e.g. "dual-layer anti-reflective coating". */
const FEATURE_PHRASE = /coat|anti[- ]?(?:glare|reflect)|privacy|eye ?comfort/i;

export interface ExtraItem {
  category: string;
  label: string;
  value: string;
}

/** Extra features of a phone, in the order of its spec sheet. Works for phones saved before this section existed. */
export function extrasFor(device: Device): ExtraItem[] {
  const raw = device.raw_specs ?? {};
  const items: ExtraItem[] = [];

  for (const [category, rows] of Object.entries(raw)) {
    const covered = COVERED[category];
    for (const [label, value] of Object.entries(rows)) {
      const text = String(value ?? '').trim();
      if (!text) continue;
      if (covered === '*' || (Array.isArray(covered) && covered.includes(label))) continue;
      items.push({ category, label, value: text });
    }
  }

  const displayType = raw.Display?.Type ?? '';
  for (const part of displayType.split(',')) {
    const phrase = part.trim();
    if (phrase && FEATURE_PHRASE.test(phrase)) items.push({ category: 'Display', label: 'Feature', value: phrase });
  }

  return items;
}

/** Groups extras by category, keeping order. */
export function groupExtras(items: ExtraItem[]): { category: string; rows: { label: string; value: string }[] }[] {
  const map = new Map<string, { label: string; value: string }[]>();
  for (const it of items) {
    const rows = map.get(it.category) ?? [];
    rows.push({ label: it.label, value: it.value });
    map.set(it.category, rows);
  }
  return [...map.entries()].map(([category, rows]) => ({ category, rows }));
}
