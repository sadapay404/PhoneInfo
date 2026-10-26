import { useState, type ReactNode } from 'react';
import { FEATURE_LABELS, PRESETS, applyPreset, activeFilterCount, type FeatureKey, type Filters } from '../lib/finder';
import { Icon } from './Icon';

export interface Facets {
  brands: string[];
  socBrands: string[];
  osFamilies: string[];
}

interface Props {
  filters: Filters;
  facets: Facets;
  onChange: (next: Filters) => void;
  onClear: () => void;
}

const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="fgroup" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <Icon name="chevron" size={16} className="chev" />
      </summary>
      <div className="fgroup-body">{children}</div>
    </details>
  );
}

function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="chip-grid">
      {options.map((o) => (
        <button key={o} className={`fchip ${selected.includes(o) ? 'on' : ''}`} aria-pressed={selected.includes(o)} onClick={() => onToggle(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

/** A minimum-value control: slider + number, with "any" as the empty state. */
function MinField({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number | undefined; min: number; max: number; step?: number; unit: string; onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="rangefield">
      <span className="rf-label">{label}<output>{value === undefined ? 'Any' : `${value}${unit}`}</output></span>
      <input type="range" min={min} max={max} step={step} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} />
      {value !== undefined && <button className="link-btn small" onClick={() => onChange(undefined)}>Reset</button>}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function FilterPanel({ filters: f, facets, onChange, onClear }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch });
  const setFeature = (k: FeatureKey, v: boolean) => set({ features: { ...f.features, [k]: v || undefined } });
  const [showAllBrands, setShowAllBrands] = useState(false);
  const brands = showAllBrands ? facets.brands : facets.brands.slice(0, 14);
  const count = activeFilterCount(f);

  return (
    <div className="filters">
      <div className="filters-head">
        <h2>Filters{count > 0 && <span className="count-pill">{count}</span>}</h2>
        {count > 0 && <button className="link-btn" onClick={onClear}>Clear all</button>}
      </div>

      <div className="presets" aria-label="Quick presets">
        {PRESETS.map((p) => (
          <button key={p.id} className="preset" title={p.hint} onClick={() => onChange(applyPreset(f, p.apply))}>
            <span>{p.label}</span>
            <small>{p.hint}</small>
          </button>
        ))}
      </div>

      <Group title="Brand">
        <Chips options={brands} selected={f.brands} onToggle={(v) => set({ brands: toggleIn(f.brands, v) })} />
        {facets.brands.length > 14 && (
          <button className="link-btn small" onClick={() => setShowAllBrands(!showAllBrands)}>{showAllBrands ? 'Show fewer' : `Show all ${facets.brands.length}`}</button>
        )}
      </Group>

      <Group title="Release year">
        <div className="pair">
          <MinField label="From" value={f.yearMin} min={2010} max={2026} unit="" onChange={(v) => set({ yearMin: v })} />
          <MinField label="To" value={f.yearMax} min={2010} max={2026} unit="" onChange={(v) => set({ yearMax: v })} />
        </div>
      </Group>

      <Group title="Display">
        <MinField label="Screen size up to" value={f.sizeMax} min={4.5} max={7.5} step={0.1} unit="″" onChange={(v) => set({ sizeMax: v })} />
        <MinField label="Refresh rate" value={f.hzMin} min={60} max={144} step={12} unit=" Hz" onChange={(v) => set({ hzMin: v })} />
        <MinField label="Peak brightness" value={f.peakMin} min={500} max={3000} step={100} unit=" nits" onChange={(v) => set({ peakMin: v })} />
        <div className="seg-row" role="group" aria-label="Panel type">
          {(['OLED', 'LCD'] as const).map((p) => (
            <button key={p} className={f.panel === p ? 'on' : ''} aria-pressed={f.panel === p} onClick={() => set({ panel: f.panel === p ? undefined : p })}>{p}</button>
          ))}
        </div>
      </Group>

      <Group title="Performance" defaultOpen={false}>
        <div className="chip-grid">
          {facets.socBrands.map((s) => (
            <button key={s} className={`fchip ${f.socBrands.includes(s) ? 'on' : ''}`} aria-pressed={f.socBrands.includes(s)} onClick={() => set({ socBrands: toggleIn(f.socBrands, s) })}>{s}</button>
          ))}
        </div>
        <MinField label="RAM" value={f.ramMin} min={4} max={16} step={2} unit=" GB" onChange={(v) => set({ ramMin: v })} />
        <MinField label="Storage option" value={f.storageMin} min={64} max={1024} step={64} unit=" GB" onChange={(v) => set({ storageMin: v })} />
        <div className="chip-grid">
          {facets.osFamilies.map((o) => (
            <button key={o} className={`fchip ${f.osFamilies.includes(o) ? 'on' : ''}`} aria-pressed={f.osFamilies.includes(o)} onClick={() => set({ osFamilies: toggleIn(f.osFamilies, o) })}>{o}</button>
          ))}
        </div>
      </Group>

      <Group title="Battery & charging" defaultOpen={false}>
        <MinField label="Capacity" value={f.batteryMin} min={3000} max={7000} step={250} unit=" mAh" onChange={(v) => set({ batteryMin: v })} />
        <MinField label="Wired charging" value={f.wiredMin} min={15} max={120} step={5} unit=" W" onChange={(v) => set({ wiredMin: v })} />
        <MinField label="Wireless charging" value={f.wirelessMin} min={5} max={50} step={5} unit=" W" onChange={(v) => set({ wirelessMin: v })} />
      </Group>

      <Group title="Camera" defaultOpen={false}>
        <MinField label="Main sensor" value={f.mainMpMin} min={12} max={200} step={4} unit=" MP" onChange={(v) => set({ mainMpMin: v })} />
        <MinField label="Telephoto zoom" value={f.zoomMin} min={2} max={10} step={1} unit="x" onChange={(v) => set({ zoomMin: v })} />
      </Group>

      <Group title="Build" defaultOpen={false}>
        <MinField label="Weight up to" value={f.weightMax} min={120} max={260} step={5} unit=" g" onChange={(v) => set({ weightMax: v })} />
        <div className="seg-row" role="group" aria-label="Water resistance">
          {([undefined, 67, 68] as const).map((ip) => (
            <button key={String(ip)} className={f.ipMin === ip ? 'on' : ''} aria-pressed={f.ipMin === ip} onClick={() => set({ ipMin: ip })}>
              {ip ? `IP${ip}+` : 'Any'}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Features">
        <div className="switches">
          {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((k) => (
            <Toggle key={k} label={FEATURE_LABELS[k]} checked={!!f.features[k]} onChange={(v) => setFeature(k, v)} />
          ))}
        </div>
      </Group>
    </div>
  );
}
