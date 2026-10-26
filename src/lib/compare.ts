import type { Category, Device, SpecField } from '../data/types';
import { SPEC_FIELDS, getPath } from '../data/specs';

export type Weights = Partial<Record<Category, number>>;

export interface CompareRow {
  field: SpecField;
  values: unknown[];
  /** True when the devices disagree on this row (ignores rows where all are missing). */
  differs: boolean;
  /** Indices of devices that win this row (empty when not comparable). */
  winners: number[];
}

export interface CategorySummary {
  category: Category;
  /** Points per device: share of comparable fields won, 0..1. */
  shares: number[];
  /** Device indices with the top share, or [] when nothing is comparable. */
  winners: number[];
  comparable: number;
}

export interface CompareResult {
  rows: CompareRow[];
  categories: CategorySummary[];
  /** Weighted overall score per device (0..100). */
  overall: number[];
  overallWinners: number[];
}

function isPresent(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Winner indices for a single numeric field across devices. */
export function winnersFor(field: SpecField, values: unknown[]): number[] {
  if (!field.better) return [];
  const nums = values.map((v) => (typeof v === 'number' ? v : undefined));
  const present = nums.filter((n): n is number => n !== undefined);
  if (present.length < 2) return [];
  const best = field.better === 'higher' ? Math.max(...present) : Math.min(...present);
  const idx = nums.flatMap((n, i) => (n === best ? [i] : []));
  // If every device ties, nobody "wins" — that's not informative.
  return idx.length === nums.length ? [] : idx;
}

export function compareDevices(devices: Device[], weights: Weights = {}): CompareResult {
  const rows: CompareRow[] = SPEC_FIELDS.map((field) => {
    const values = devices.map((d) => getPath(d, field.path));
    const present = values.filter(isPresent);
    const differs = present.length > 0 && !values.every((v) => sameValue(v, values[0]));
    return { field, values, differs, winners: winnersFor(field, values) };
  });

  const categoryNames = Array.from(new Set(SPEC_FIELDS.map((f) => f.category)));
  const categories: CategorySummary[] = categoryNames.map((category) => {
    const comparableRows = rows.filter((r) => r.field.category === category && r.field.better);
    const wins = devices.map(() => 0);
    let comparable = 0;
    for (const r of comparableRows) {
      if (r.winners.length === 0) continue;
      comparable += 1;
      for (const i of r.winners) wins[i] += 1 / r.winners.length;
    }
    const shares = comparable ? wins.map((w) => w / comparable) : wins;
    const top = comparable ? Math.max(...shares) : 0;
    const winnersIdx = comparable ? shares.flatMap((s, i) => (s === top && top > 0 ? [i] : [])) : [];
    return { category, shares, winners: winnersIdx, comparable };
  });

  const active = categories.filter((c) => c.comparable > 0);
  const totalWeight = active.reduce((s, c) => s + (weights[c.category] ?? 1), 0);
  const overall = devices.map((_, i) =>
    totalWeight === 0
      ? 0
      : Math.round(
          (active.reduce((s, c) => s + (weights[c.category] ?? 1) * c.shares[i], 0) / totalWeight) * 1000,
        ) / 10,
  );
  const topOverall = overall.length ? Math.max(...overall) : 0;
  const overallWinners = overall.flatMap((s, i) => (s === topOverall && topOverall > 0 ? [i] : []));

  return { rows, categories, overall, overallWinners };
}
