import { useEffect, useMemo, useState } from 'react';
import { loadPhotos } from '../data/savedPhones';
import type { SavedPhoto } from '../data/db';
import type { Device } from '../data/types';
import { CATEGORIES, SPEC_FIELDS, formatValue, getPath } from '../data/specs';
import { compareDevices } from '../lib/compare';
import { Box, Stat } from '../components/Box';
import { DeviceImage } from '../components/DeviceImage';
import { PkrPrices } from '../components/PkrPrices';
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
  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void loadPhotos(device.id).then((p) => live && setPhotos(p)).catch(() => live && setPhotos([]));
    return () => {
      live = false;
    };
  }, [device.id]);
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

      <PkrPrices device={device} />

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

      {(photos.length > 0 || device.gallery?.has_3d) && (
        <section className="gallery">
          <div className="gallery-head">
            <h2>Photos {photos.length > 0 && <span className="muted small">({photos.length})</span>}</h2>
            {device.gallery?.has_3d && device.gallery.pictures_url && (
              <a className="btn-outline" href={device.gallery.pictures_url} target="_blank" rel="noopener noreferrer">
                <Icon name="plus" size={16} /> Open interactive 3D on GSMArena
              </a>
            )}
          </div>
          {device.gallery?.threed_views && device.gallery.threed_views.length > 0 && (
            <div className="threed-views">
              <h3>3D views</h3>
              <p className="muted small">Rendered by Binkies 3D through GSMArena. These load from the internet, not from this device.</p>
              <div className="threed-grid">
                {device.gallery.threed_views.map((v) => (
                  <figure key={v.view}>
                    <img src={v.url} alt={`3D model, ${v.view} view`} loading="lazy" />
                    <figcaption>{v.view}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
          {photos.length > 0 ? (
            <div className="gallery-grid">
              {photos.map((p, i) => (
                <button key={p.id} className="gallery-item" onClick={() => setLightbox(i)} aria-label={`Open photo ${i + 1}`}>
                  <img src={p.dataUrl} alt={`${device.brand} ${device.model} photo ${i + 1}`} loading="lazy" />
                  {p.kind === 'review' && <span className="gallery-tag">Our photo</span>}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small">The 3D model is shown by GSMArena and needs an internet connection.</p>
          )}
          {lightbox !== null && photos[lightbox] && (
            <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
              <img src={photos[lightbox].dataUrl} alt="" onClick={(e) => e.stopPropagation()} />
              <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
                <button className="btn-outline" onClick={() => setLightbox((lightbox - 1 + photos.length) % photos.length)}>Previous</button>
                <span>{lightbox + 1} / {photos.length}</span>
                <button className="btn-outline" onClick={() => setLightbox((lightbox + 1) % photos.length)}>Next</button>
                <button className="btn" onClick={() => setLightbox(null)}>Close</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
