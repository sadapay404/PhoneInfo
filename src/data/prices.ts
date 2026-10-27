import type { Device } from './types';
import { db, type PriceEntry } from './db';

export interface Variant {
  ram_gb?: number;
  storage_gb?: number;
}

/**
 * The RAM and storage combinations a phone comes in. Exact pairs from the page win;
 * otherwise every listed RAM size is combined with every storage size. A phone with
 * no variant data gets one row with no label.
 */
export function variantsFor(device: Device): Variant[] {
  const exact = device.soc.variants;
  if (exact && exact.length) return exact.map((v) => ({ ram_gb: v.ram_gb, storage_gb: v.storage_gb }));
  const rams = device.soc.ram_options_gb?.length ? device.soc.ram_options_gb : device.soc.ram_gb ? [device.soc.ram_gb] : [];
  const storages = device.soc.storage_gb ?? [];
  if (rams.length && storages.length) {
    return rams.flatMap((r) => storages.map((s) => ({ ram_gb: r, storage_gb: s })));
  }
  if (rams.length) return rams.map((r) => ({ ram_gb: r }));
  if (storages.length) return storages.map((s) => ({ storage_gb: s }));
  return [{}];
}

export function variantKey(v: Variant): string {
  return `${v.ram_gb ?? '-'}|${v.storage_gb ?? '-'}`;
}

export function variantLabel(v: Variant): string {
  const parts: string[] = [];
  if (v.ram_gb) parts.push(`${v.ram_gb} GB RAM`);
  if (v.storage_gb) parts.push(v.storage_gb >= 1024 ? `${v.storage_gb / 1024} TB` : `${v.storage_gb} GB`);
  return parts.length ? parts.join(' · ') : 'Standard model';
}

export function formatPkr(n: number): string {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`;
}

/** A price is "old" after 30 days, so the list shows when it needs checking. */
export function isOld(observedOn: string, today = new Date()): boolean {
  const seen = new Date(`${observedOn}T00:00:00`).getTime();
  return today.getTime() - seen > 30 * 24 * 60 * 60 * 1000;
}

export async function addPrice(entry: Omit<PriceEntry, 'id'>): Promise<void> {
  if (!Number.isFinite(entry.price_pkr) || entry.price_pkr <= 0 || entry.price_pkr > 100_000_000) {
    throw new Error('Enter a price in rupees between 1 and 100,000,000');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.observed_on)) throw new Error('Date must be YYYY-MM-DD');
  await db.prices.add({ ...entry, price_pkr: Math.round(entry.price_pkr) });
}

export async function pricesFor(deviceId: string): Promise<PriceEntry[]> {
  const rows = await db.prices.where('deviceId').equals(deviceId).toArray();
  // Newest first; ties broken by insert order (higher id is newer).
  return rows.sort((a, b) => (a.observed_on < b.observed_on ? 1 : a.observed_on > b.observed_on ? -1 : (b.id ?? 0) - (a.id ?? 0)));
}

/** Latest entry per variant, keyed by variantKey. */
export function latestByVariant(rows: PriceEntry[]): Map<string, PriceEntry> {
  const out = new Map<string, PriceEntry>();
  for (const r of rows) {
    const key = variantKey({ ram_gb: r.ram_gb, storage_gb: r.storage_gb });
    if (!out.has(key)) out.set(key, r); // rows are already newest first
  }
  return out;
}
