import { useMemo } from 'react';
import type { Device } from '../data/types';
import { CATEGORIES, SPEC_FIELDS, formatValue, getPath } from '../data/specs';
import { compareDevices } from '../lib/compare';
import { Box, Stat } from '../components/Box';
import { DeviceImage } from '../components/DeviceImage';
import { Icon } from '../components/Icon';

/** Categories this phone leads across the whole catalog (computed once per catalog). */
function useLeads(all: Device[], id: string): string[] {
  return useMemo(() => {
    const result = compareDevices(all);
    const i = all.findIndex((d) => d.id === id);
    if (i < 0) return [];
    return result.categories.filter((c) => c.winners.includes(i)).map((c) => c.category);
  }, [all, id]);
}

const specOf = (path: string) => SPEC_FIELDS.find((f) => f.path === path)!;

export function Detail({ device, all, inCompare, onBack, onToggleCompare }: {
  device: Device;
  all: Device[];
  inCompare: boolean;
  onBack: () => void;
  onToggleCompare: () => void;
}) {
  const leads = useLeads(all, device.id);
  const unknown = SPEC_FIELDS.filter((f) => getPath(device, f.path) === undefined).length;

  return (
    <div className="detail">
      <button className="back" onClick={onBack}><Icon name="back" size={16} /> All phones</button>

      <section className="detail-hero">
        <div className="detail-media"><DeviceImage device={device} eager /></div>
        <div className="detail-info">
          <span className="eyebrow">{device.brand} · {device.year}{device.status !== 'released' ? ` · ${device.status}` : ''}</span>
          <h1>{device.model}</h1>
          <div className="tags">
            {leads.map((c) => <span key={c} className="tag accent">Leads {c}</span>)}
            {device.body.ip_rating && <span className="tag">{device.body.ip_rating}</span>}
            {device.connectivity.five_g && <span className="tag">5G</span>}
            {device.display.panel_tech && <span className="tag">{device.display.panel_tech}</span>}
          </div>
          <div className="stats">
            <Stat label="Battery" value={formatValue(specOf('battery.capacity_mah'), device.battery.capacity_mah)} />
            <Stat label="Peak brightness" value={formatValue(specOf('display.peak_nits'), device.display.peak_nits)} />
            <Stat label="Refresh" value={formatValue(specOf('display.refresh_hz_max'), device.display.refresh_hz_max)} />
            <Stat label="Main camera" value={formatValue(specOf('camera.main.mp'), device.camera.main?.mp)} />
          </div>
          <div className="detail-actions">
            <button className={`btn ${inCompare ? 'btn-outline' : ''}`} onClick={onToggleCompare}>
              <Icon name={inCompare ? 'check' : 'plus'} size={16} />
              {inCompare ? 'In compare' : 'Add to compare'}
            </button>
            <span className="muted small">{unknown} spec fields not yet known</span>
          </div>
          {device.source_note && <p className="source-note">{device.source_note}</p>}
        </div>
      </section>

      <div className="spec-grid">
        {CATEGORIES.map((category) => {
          const fields = SPEC_FIELDS.filter((f) => f.category === category);
          const missing = fields.filter((f) => getPath(device, f.path) === undefined).length;
          return (
            <Box key={category} title={category} subtitle={missing ? `${missing} unknown` : 'Complete'} defaultOpen={category !== 'Body & SAR'}>
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

      {device.raw_specs && (
        <section className="raw-specs">
          <h2>Full spec sheet</h2>
          <p className="muted small">As saved from the source page, for personal offline use.</p>
          <div className="raw-grid">
            {Object.entries(device.raw_specs).map(([cat, rows]) => (
              <div key={cat} className="raw-cat">
                <h3>{cat}</h3>
                <dl>
                  {Object.entries(rows).map(([label, value]) => (
                    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
