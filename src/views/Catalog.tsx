import { useMemo } from 'react';
import type { Device, Category } from '../data/types';
import { CATEGORIES, SPEC_FIELDS, formatValue, getPath } from '../data/specs';
import { compareDevices } from '../lib/compare';
import { DEVICES } from '../data/devices';
import { Box } from '../components/Box';

interface CatalogProps {
  devices: Device[];
  onOpen: (id: string) => void;
  onToggleCompare: (id: string) => void;
  compareIds: string[];
}

export function CatalogList({ devices, onOpen, onToggleCompare, compareIds }: CatalogProps) {
  if (devices.length === 0) {
    return <p className="empty">No devices match that search.</p>;
  }
  return (
    <div className="grid">
      {devices.map((d) => {
        const inCompare = compareIds.includes(d.id);
        return (
          <article key={d.id} className="card device-card">
            <button className="card-main" onClick={() => onOpen(d.id)}>
              <span className="eyebrow">{d.brand} · {d.year}</span>
              <h3>{d.model}</h3>
              <dl>
                <dt>Chipset</dt><dd>{d.soc.chipset ?? '—'}</dd>
                <dt>Display</dt><dd>{d.display.size_in ? `${d.display.size_in}" ${d.display.refresh_hz_max ?? ''}${d.display.refresh_hz_max ? 'Hz' : ''}` : '—'}</dd>
                <dt>Battery</dt><dd>{d.battery.capacity_mah ? `${d.battery.capacity_mah} mAh` : '—'}</dd>
                <dt>Price</dt><dd>{d.price_usd ? `$${d.price_usd}` : '—'}</dd>
              </dl>
            </button>
            <button className={`chip ${inCompare ? 'on' : ''}`} onClick={() => onToggleCompare(d.id)} aria-pressed={inCompare}>
              {inCompare ? '✓ In compare' : '+ Compare'}
            </button>
          </article>
        );
      })}
    </div>
  );
}

/** Which categories this device leads across the catalog (computed once). */
const CATALOG_LEADS: Map<string, Category[]> = (() => {
  const result = compareDevices(DEVICES);
  const map = new Map<string, Category[]>();
  DEVICES.forEach((d, i) => {
    const leads = result.categories.filter((c) => c.winners.includes(i)).map((c) => c.category);
    map.set(d.id, leads);
  });
  return map;
})();

export function DeviceDetail({ device, onBack }: { device: Device; onBack: () => void }) {
  const leads = CATALOG_LEADS.get(device.id) ?? [];
  const byCategory = useMemo(() => {
    return CATEGORIES.map((category) => ({
      category,
      fields: SPEC_FIELDS.filter((f) => f.category === category),
    }));
  }, []);

  return (
    <div className="detail">
      <button className="link-btn" onClick={onBack}>← All devices</button>
      <header className="detail-head">
        <span className="eyebrow">{device.brand} · {device.year} · {device.status}</span>
        <h2>{device.model}</h2>
        <div className="badges">
          {leads.map((c) => <span key={c} className="badge accent">Leads {c}</span>)}
          {device.body.ip_rating && <span className="badge">{device.body.ip_rating}</span>}
          {device.price_usd && <span className="badge">${device.price_usd} launch</span>}
        </div>
        {device.source_note && <p className="note">{device.source_note}</p>}
      </header>

      {byCategory.map(({ category, fields }) => {
        const missing = fields.filter((f) => getPath(device, f.path) === undefined).length;
        return (
          <Box key={category} title={category} badges={missing ? [`${missing} missing`] : []} defaultOpen={category !== 'Body & SAR'}>
            <table className="spec-table">
              <tbody>
                {fields.map((f) => (
                  <tr key={f.path} className={getPath(device, f.path) === undefined ? 'muted' : ''}>
                    <th scope="row">{f.label}</th>
                    <td>{formatValue(f, getPath(device, f.path))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        );
      })}
    </div>
  );
}
