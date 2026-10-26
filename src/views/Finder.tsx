import { useMemo, useState } from 'react';
import type { Device } from '../data/types';
import { DeviceImage } from '../components/DeviceImage';
import { FilterPanel, type Facets } from '../components/FilterPanel';
import { Icon } from '../components/Icon';
import { FEATURE_LABELS, SORT_LABELS, activeFilterCount, clearFilters, sortDevices, type Filters, type SortKey } from '../lib/finder';
import { MAX_COMPARE } from '../hooks/useAppState';

interface FinderProps {
  results: Device[];
  total: number;
  filters: Filters;
  onFilters: (f: Filters) => void;
  query: string;
  onQuery: (q: string) => void;
  facets: Facets;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onOpen: (id: string) => void;
}

interface ActiveChip {
  key: string;
  label: string;
  /** Patch that removes this chip from the filters. */
  patch: Partial<Filters>;
}

function chipsFor(f: Filters): ActiveChip[] {
  const out: ActiveChip[] = [];
  f.brands.forEach((b) => out.push({ key: `b-${b}`, label: b, patch: { brands: f.brands.filter((x) => x !== b) } }));
  f.socBrands.forEach((b) => out.push({ key: `s-${b}`, label: b, patch: { socBrands: f.socBrands.filter((x) => x !== b) } }));
  f.osFamilies.forEach((b) => out.push({ key: `o-${b}`, label: b, patch: { osFamilies: f.osFamilies.filter((x) => x !== b) } }));
  const scalar: [keyof Filters, string, string][] = [
    ['yearMin', 'From', ''], ['yearMax', 'To', ''], ['sizeMax', 'Screen ≤', '″'], ['hzMin', 'Refresh ≥', ' Hz'],
    ['peakMin', 'Brightness ≥', ' nits'], ['ramMin', 'RAM ≥', ' GB'], ['storageMin', 'Storage ≥', ' GB'], ['batteryMin', 'Battery ≥', ' mAh'],
    ['wiredMin', 'Wired ≥', ' W'], ['wirelessMin', 'Wireless ≥', ' W'], ['mainMpMin', 'Main ≥', ' MP'], ['zoomMin', 'Zoom ≥', 'x'],
    ['weightMax', 'Weight ≤', ' g'], ['ipMin', 'IP', '+'], ['panel', 'Panel', ''],
  ];
  for (const [k, label, unit] of scalar) {
    const v = f[k];
    if (v !== undefined) out.push({ key: String(k), label: `${label} ${v}${unit}`, patch: { [k]: undefined } as Partial<Filters> });
  }
  for (const [k, on] of Object.entries(f.features)) {
    if (on) out.push({ key: `f-${k}`, label: FEATURE_LABELS[k as keyof typeof FEATURE_LABELS], patch: { features: { ...f.features, [k]: undefined } } });
  }
  return out;
}

export function Finder({ results, total, filters, onFilters, query, onQuery, facets, compareIds, onToggleCompare, onOpen }: FinderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sorted = useMemo(() => sortDevices(results, filters.sort), [results, filters.sort]);
  const count = activeFilterCount(filters);
  const chips = chipsFor(filters);
  const clear = () => onFilters(clearFilters(filters));

  return (
    <div className="finder">
      <aside className="finder-side">
        <FilterPanel filters={filters} facets={facets} onChange={onFilters} onClear={clear} />
      </aside>

      <section className="finder-main">
        <div className="finder-toolbar">
          <label className="search">
            <Icon name="search" size={18} />
            <input type="search" placeholder="Search brand, model or chipset" value={query} onChange={(e) => onQuery(e.target.value)} aria-label="Search phones" />
          </label>
          <button className="btn-outline mobile-only" onClick={() => setMobileOpen(true)}>
            <Icon name="sliders" size={16} /> Filters{count > 0 && <span className="count-pill">{count}</span>}
          </button>
          <label className="sort">
            <span>Sort</span>
            <select value={filters.sort} onChange={(e) => onFilters({ ...filters, sort: e.target.value as SortKey })}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
            </select>
          </label>
        </div>

        <div className="result-line">
          <p><strong>{sorted.length.toLocaleString()}</strong> of {total.toLocaleString()} phones</p>
          {compareIds.length > 0 && <span className="muted">{compareIds.length}/{MAX_COMPARE} in compare</span>}
        </div>

        {chips.length > 0 && (
          <div className="active-chips">
            {chips.map((c) => (
              <button key={c.key} className="achip" onClick={() => onFilters({ ...filters, ...c.patch })} aria-label={`Remove ${c.label}`}>
                {c.label} <Icon name="x" size={12} />
              </button>
            ))}
            <button className="link-btn small" onClick={clear}>Clear all</button>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="empty">
            <p>No phones match these filters.</p>
            <button className="btn-outline" onClick={clear}>Clear filters</button>
          </div>
        ) : (
          <ul className="phone-grid">
            {sorted.slice(0, 240).map((d) => {
              const inCompare = compareIds.includes(d.id);
              return (
                <li key={d.id} className="phone-card">
                  <button className="phone-card-main" onClick={() => onOpen(d.id)}>
                    <div className="phone-card-media">
                      <DeviceImage device={d} />
                    </div>
                    <div className="phone-card-body">
                      <span className="eyebrow">{d.brand} · {d.year}</span>
                      <h3>{d.model}</h3>
                      <ul className="kv">
                        <li><span>Battery</span><strong>{d.battery.capacity_mah ? `${d.battery.capacity_mah.toLocaleString()} mAh` : '—'}</strong></li>
                        <li><span>Screen</span><strong>{d.display.size_in ? `${d.display.size_in}″ · ${d.display.refresh_hz_max ?? '—'} Hz` : '—'}</strong></li>
                        <li><span>Chip</span><strong>{d.soc.chipset ?? '—'}</strong></li>
                      </ul>
                    </div>
                  </button>
                  <button className={`compare-toggle ${inCompare ? 'on' : ''}`} onClick={() => onToggleCompare(d.id)} aria-pressed={inCompare} disabled={!inCompare && compareIds.length >= MAX_COMPARE}>
                    <Icon name={inCompare ? 'check' : 'plus'} size={14} />
                    {inCompare ? 'In compare' : 'Compare'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {sorted.length > 240 && <p className="muted center">Showing the first 240. Narrow your filters to see the rest.</p>}
      </section>

      {mobileOpen && (
        <div className="sheet-backdrop" onClick={() => setMobileOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Filters" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <strong>Filters</strong>
              <button className="icon-btn" onClick={() => setMobileOpen(false)} aria-label="Close filters"><Icon name="x" /></button>
            </div>
            <div className="sheet-body">
              <FilterPanel filters={filters} facets={facets} onChange={onFilters} onClear={clear} />
            </div>
            <div className="sheet-foot">
              <button className="btn" onClick={() => setMobileOpen(false)}>Show {sorted.length} phones</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
