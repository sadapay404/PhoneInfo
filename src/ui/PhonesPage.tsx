import { useMemo, useState, type ReactNode } from 'react';
import type { Device } from '../data/types';
import { createDeviceSearch } from '../lib/search';
import {
  applyFilters,
  activeFilterCount,
  applyPreset,
  DEFAULT_FILTERS,
  FEATURE_LABELS,
  filtersFromQuery,
  filtersToQuery,
  PRESETS,
  SORT_LABELS,
  sortDevices,
  type Filters,
  type FeatureKey,
  type SortKey,
} from '../lib/finder';
import { Button, Chip, Empty, Icon, PageHead, Photo } from './parts';
import { navigate } from './state';

function writeUrl(q: string, f: Filters) {
  const p = new URLSearchParams(filtersToQuery(f));
  if (q) p.set('q', q);
  const qs = p.toString();
  navigate(`phones${qs ? `?${qs}` : ''}`, true);
}

export function PhonesPage({ devices, query }: { devices: Device[]; query: URLSearchParams }) {
  const q = query.get('q') ?? '';
  const filters = useMemo(() => filtersFromQuery(query.toString()), [query]);
  const [panelOpen, setPanelOpen] = useState(false);

  const search = useMemo(() => createDeviceSearch(devices), [devices]);
  const results = useMemo(() => sortDevices(applyFilters(search(q), filters), filters.sort), [search, q, filters]);
  const active = activeFilterCount(filters);

  const setFilters = (next: Filters) => writeUrl(q, next);
  const setQuery = (text: string) => writeUrl(text, filters);

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of devices) counts.set(d.brand, (counts.get(d.brand) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [devices]);

  const years = useMemo(() => [...new Set(devices.map((d) => d.year).filter((y) => y > 0))].sort((a, b) => b - a), [devices]);

  const toggleList = (key: 'brands' | 'socBrands' | 'osFamilies', value: string) => {
    const list = filters[key] as string[];
    const next = list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
    setFilters({ ...filters, [key]: next });
  };
  const toggleNum = <K extends 'sizeMax' | 'hzMin' | 'ramMin' | 'storageMin' | 'batteryMin' | 'wiredMin' | 'mainMpMin'>(key: K, value: number) => {
    setFilters({ ...filters, [key]: filters[key] === value ? undefined : value });
  };
  const toggleFeature = (key: FeatureKey) => {
    const features = { ...filters.features, [key]: !filters.features[key] };
    setFilters({ ...filters, features });
  };

  return (
    <>
      <PageHead title="Phones" lead={`${results.length} of ${devices.length} phones match. Everything works offline.`}>
        <Button className="show-filters" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
          <Icon name="filter" size={18} /> Filters{active ? ` · ${active}` : ''}
        </Button>
      </PageHead>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={18} />
          <span className="sr-only">Search phones</span>
          <input
            type="search"
            placeholder="Search brand, model or chip"
            value={q}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="sort">
          <span className="sr-only">Sort by</span>
          <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortKey })}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="presets" role="group" aria-label="Quick picks">
        {PRESETS.map((p) => (
          <Chip key={p.id} title={p.hint} onClick={() => setFilters(applyPreset(DEFAULT_FILTERS, p.apply))}>
            {p.label}
          </Chip>
        ))}
        {active > 0 && (
          <Button small variant="quiet" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>
            <Icon name="close" size={16} /> Clear all
          </Button>
        )}
      </div>

      <div className={`finder ${panelOpen ? 'panel-open' : ''}`}>
        <aside className="filters" aria-label="Filters">
          <div className="filters-head">
            <h2>Filters</h2>
            <button type="button" className="icon-btn panel-close" onClick={() => setPanelOpen(false)} aria-label="Close filters">
              <Icon name="close" />
            </button>
          </div>

          <FilterGroup title="Brand">
            <div className="check-list">
              {brands.map(([brand, count]) => (
                <label key={brand} className="check">
                  <input type="checkbox" checked={filters.brands.includes(brand)} onChange={() => toggleList('brands', brand)} />
                  <span>{brand}</span>
                  <span className="check-count">{count}</span>
                </label>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Released">
            <div className="year-row">
              <select
                aria-label="From year"
                value={filters.yearMin ?? ''}
                onChange={(e) => setFilters({ ...filters, yearMin: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Any</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <span className="muted">to</span>
              <select
                aria-label="To year"
                value={filters.yearMax ?? ''}
                onChange={(e) => setFilters({ ...filters, yearMax: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Any</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </FilterGroup>

          <ChipGroup title="Screen size" options={[6.2, 6.5, 6.8]} value={filters.sizeMax} format={(v) => `${v}″ or less`} onPick={(v) => toggleNum('sizeMax', v)} />
          <ChipGroup title="Refresh rate" options={[60, 90, 120, 144]} value={filters.hzMin} format={(v) => `${v} Hz+`} onPick={(v) => toggleNum('hzMin', v)} />
          <FilterGroup title="Panel">
            <div className="chip-row">
              <Chip active={!filters.panel} onClick={() => setFilters({ ...filters, panel: undefined })}>
                Any
              </Chip>
              {(['OLED', 'LCD'] as const).map((p) => (
                <Chip key={p} active={filters.panel === p} onClick={() => setFilters({ ...filters, panel: p })}>
                  {p}
                </Chip>
              ))}
            </div>
          </FilterGroup>
          <ChipGroup title="RAM" options={[4, 6, 8, 12, 16]} value={filters.ramMin} format={(v) => `${v} GB+`} onPick={(v) => toggleNum('ramMin', v)} />
          <ChipGroup title="Storage" options={[64, 128, 256, 512, 1024]} value={filters.storageMin} format={(v) => (v >= 1024 ? `${v / 1024} TB+` : `${v} GB+`)} onPick={(v) => toggleNum('storageMin', v)} />
          <ChipGroup title="Battery" options={[4000, 5000, 6000]} value={filters.batteryMin} format={(v) => `${v.toLocaleString()} mAh+`} onPick={(v) => toggleNum('batteryMin', v)} />
          <ChipGroup title="Wired charging" options={[18, 33, 65, 100]} value={filters.wiredMin} format={(v) => `${v} W+`} onPick={(v) => toggleNum('wiredMin', v)} />
          <ChipGroup title="Main camera" options={[12, 48, 50, 200]} value={filters.mainMpMin} format={(v) => `${v} MP+`} onPick={(v) => toggleNum('mainMpMin', v)} />

          <FilterGroup title="Software">
            <div className="chip-row">
              {(['Android', 'iOS'] as const).map((os) => (
                <Chip key={os} active={filters.osFamilies.includes(os)} onClick={() => toggleList('osFamilies', os)}>
                  {os}
                </Chip>
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Must have">
            <div className="check-list">
              {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => (
                <label key={key} className="check">
                  <input type="checkbox" checked={!!filters.features[key]} onChange={() => toggleFeature(key)} />
                  <span>{FEATURE_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </FilterGroup>
        </aside>

        <section className="results" aria-live="polite">
          {results.length === 0 ? (
            <Empty title="No phones match">
              <p>Try removing a filter, or search with fewer words.</p>
              {active > 0 && (
                <Button onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>Clear filters</Button>
              )}
            </Empty>
          ) : (
            <ul className="phone-grid">
              {results.map((d) => (
                <li key={d.id}>
                  <PhoneCard device={d} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function PhoneCard({ device: d }: { device: Device }) {
  const ram = d.soc.ram_options_gb?.length ? Math.max(...d.soc.ram_options_gb) : d.soc.ram_gb;
  const storage = d.soc.storage_gb?.length ? Math.max(...d.soc.storage_gb) : undefined;
  const facts: string[] = [];
  if (d.display.size_in) facts.push(`${d.display.size_in}″`);
  if (d.display.refresh_hz_max) facts.push(`${d.display.refresh_hz_max} Hz`);
  if (d.battery.capacity_mah) facts.push(`${d.battery.capacity_mah.toLocaleString()} mAh`);
  if (d.camera.main?.mp) facts.push(`${d.camera.main.mp} MP`);
  return (
    <a className="phone-card" href={`#/phone/${encodeURIComponent(d.id)}`}>
      <div className="phone-card-media">
        <Photo device={d} />
      </div>
      <div className="phone-card-body">
        <span className="eyebrow">
          {d.brand}
          {d.year ? ` · ${d.year}` : ''}
          {d.status === 'discontinued' ? ' · discontinued' : ''}
        </span>
        <h3>{d.model}</h3>
        <p className="phone-card-facts">{facts.join('  ·  ') || 'Specs not saved yet'}</p>
        {(ram || storage) && (
          <p className="phone-card-meta">
            {ram ? `Up to ${ram} GB RAM` : ''}
            {ram && storage ? ' · ' : ''}
            {storage ? `${storage >= 1024 ? `${storage / 1024} TB` : `${storage} GB`} storage` : ''}
          </p>
        )}
      </div>
    </a>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="filter-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ChipGroup({
  title,
  options,
  value,
  format,
  onPick,
}: {
  title: string;
  options: number[];
  value: number | undefined;
  format: (v: number) => string;
  onPick: (v: number) => void;
}) {
  return (
    <FilterGroup title={title}>
      <div className="chip-row">
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onPick(o)}>
            {format(o)}
          </Chip>
        ))}
      </div>
    </FilterGroup>
  );
}
