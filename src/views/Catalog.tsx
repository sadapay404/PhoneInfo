import { useMemo } from 'react';
import type { Device } from '../data/types';
import { CATEGORIES, SPEC_FIELDS, formatValue, getPath } from '../data/specs';
import { compareDevices } from '../lib/compare';
import { Box, Stat } from '../components/Box';
import { Icon } from '../components/Icon';
import { MAX_COMPARE } from '../hooks/useAppState';

interface CatalogProps {
  devices: Device[];
  allDevices: Device[];
  query: string;
  onQuery: (q: string) => void;
  brand: string | null;
  onBrand: (b: string | null) => void;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onOpen: (id: string) => void;
}

export function CatalogList({ devices, allDevices, query, onQuery, brand, onBrand, compareIds, onToggleCompare, onOpen }: CatalogProps) {
  const brands = useMemo(() => Array.from(new Set(allDevices.map((d) => d.brand))).sort(), [allDevices]);
  const full = compareIds.length >= MAX_COMPARE;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Catalog</h1>
          <p className="muted">{allDevices.length} devices · searchable offline</p>
        </div>
      </div>

      <label className="search">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Search brand, model or chipset"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Search devices"
        />
        {query && (
          <button className="search-clear" onClick={() => onQuery('')} aria-label="Clear search">
            <Icon name="close" size={16} />
          </button>
        )}
      </label>

      <div className="filters" role="group" aria-label="Filter by brand">
        <button className={`pill ${brand === null ? 'on' : ''}`} onClick={() => onBrand(null)}>All brands</button>
        {brands.map((b) => (
          <button key={b} className={`pill ${brand === b ? 'on' : ''}`} onClick={() => onBrand(brand === b ? null : b)}>{b}</button>
        ))}
      </div>

      {devices.length === 0 ? (
        <p className="empty-state">No devices match “{query}”.</p>
      ) : (
        <div className="device-grid">
          {devices.map((d) => {
            const inCompare = compareIds.includes(d.id);
            const disabled = !inCompare && full;
            return (
              <article key={d.id} className="device-card">
                <button className="device-card-main" onClick={() => onOpen(d.id)}>
                  <span className="eyebrow">{d.brand} · {d.year}</span>
                  <h3>{d.model}</h3>
                  <ul className="mini-specs">
                    <li><span>Chipset</span><strong>{d.soc.chipset ?? '—'}</strong></li>
                    <li><span>Display</span><strong>{d.display.size_in ? `${d.display.size_in}″ · ${d.display.refresh_hz_max ?? '—'}Hz` : '—'}</strong></li>
                    <li><span>Battery</span><strong>{d.battery.capacity_mah ? `${d.battery.capacity_mah.toLocaleString()} mAh` : '—'}</strong></li>
                  </ul>
                </button>
                <div className="device-card-foot">
                  <span className="price">{d.price_usd ? `$${d.price_usd}` : 'Price n/a'}</span>
                  <button
                    className={`btn-small ${inCompare ? 'on' : ''}`}
                    onClick={() => onToggleCompare(d.id)}
                    disabled={disabled}
                    aria-pressed={inCompare}
                    title={disabled ? `Compare holds up to ${MAX_COMPARE}` : undefined}
                  >
                    <Icon name={inCompare ? 'check' : 'plus'} size={14} />
                    {inCompare ? 'Added' : 'Compare'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Which categories each device leads across the whole catalog (computed once per catalog). */
function computeLeads(devices: Device[]): Map<string, string[]> {
  const result = compareDevices(devices);
  const map = new Map<string, string[]>();
  devices.forEach((d, i) => {
    map.set(d.id, result.categories.filter((c) => c.winners.includes(i)).map((c) => c.category));
  });
  return map;
}

export function DeviceDetail({ device, allDevices, onBack, onCompare, inCompare }: {
  device: Device;
  allDevices: Device[];
  onBack: () => void;
  onCompare: () => void;
  inCompare: boolean;
}) {
  const leads = useMemo(() => computeLeads(allDevices).get(device.id) ?? [], [allDevices, device.id]);
  const totalMissing = SPEC_FIELDS.filter((f) => getPath(device, f.path) === undefined).length;

  return (
    <div className="page">
      <button className="back" onClick={onBack}><Icon name="back" size={16} /> All devices</button>

      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">{device.brand} · {device.year} · {device.status}</span>
          <h1>{device.model}</h1>
          <div className="badges">
            {leads.map((c) => <span key={c} className="badge accent">Leads {c}</span>)}
            {device.body.ip_rating && <span className="badge">{device.body.ip_rating}</span>}
            <span className="badge">{totalMissing} fields unknown</span>
          </div>
        </div>
        <button className={`btn ${inCompare ? 'ghost' : ''}`} onClick={onCompare}>
          <Icon name={inCompare ? 'check' : 'plus'} size={16} />
          {inCompare ? 'In compare' : 'Add to compare'}
        </button>
      </section>

      <div className="stats">
        <Stat label="Launch price" value={device.price_usd ? `$${device.price_usd}` : '—'} />
        <Stat label="Battery" value={formatValue(SPEC_FIELDS.find((f) => f.path === 'battery.capacity_mah')!, device.battery.capacity_mah)} />
        <Stat label="Peak brightness" value={formatValue(SPEC_FIELDS.find((f) => f.path === 'display.peak_nits')!, device.display.peak_nits)} />
        <Stat label="RAM" value={formatValue(SPEC_FIELDS.find((f) => f.path === 'soc.ram_gb')!, device.soc.ram_gb)} />
      </div>

      {device.source_note && <p className="note"><Icon name="check" size={14} /> {device.source_note}</p>}

      <div className="box-grid">
        {CATEGORIES.map((category) => {
          const fields = SPEC_FIELDS.filter((f) => f.category === category);
          const missing = fields.filter((f) => getPath(device, f.path) === undefined).length;
          return (
            <Box
              key={category}
              title={category}
              subtitle={missing ? `${missing} unknown` : 'Complete'}
              defaultOpen={category !== 'Body & SAR'}
            >
              <dl className="spec-list">
                {fields.map((f) => {
                  const v = getPath(device, f.path);
                  return (
                    <div key={f.path} className={`spec-row ${v === undefined ? 'unknown' : ''}`}>
                      <dt>{f.label}</dt>
                      <dd>{formatValue(f, v)}</dd>
                    </div>
                  );
                })}
              </dl>
            </Box>
          );
        })}
      </div>
    </div>
  );
}
