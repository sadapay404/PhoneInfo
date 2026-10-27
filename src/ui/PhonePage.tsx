import { useEffect, useMemo, useState } from 'react';
import type { Device } from '../data/types';
import { CATEGORIES, SPEC_FIELDS, formatValue, getPath, ipCode } from '../data/specs';
import { loadPhotos } from '../data/savedPhones';
import { extrasFor, groupExtras } from '../data/extras';
import type { SavedPhoto } from '../data/db';
import { addPrice, formatPkr, isOld, latestByVariant, pricesFor, variantKey, variantLabel, variantsFor, type Variant } from '../data/prices';
import type { PriceEntry } from '../data/db';
import { Button, Empty, Icon, Photo, Stat, imageSrc } from './parts';
import { MAX_COMPARE, navigate, useCompareIds } from './state';

function hasValue(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
}

export function PhonePage({ devices, id }: { devices: Device[]; id: string }) {
  const device = devices.find((d) => d.id === id);
  if (!device) {
    return (
      <Empty title="Phone not found">
        <p>It may have been removed. Search for it on the Phones page.</p>
        <Button onClick={() => navigate('phones')}>Back to phones</Button>
      </Empty>
    );
  }
  return <Detail device={device} />;
}

function Detail({ device: d }: { device: Device }) {
  const [compareIds, setCompareIds] = useCompareIds();
  const inCompare = compareIds.includes(d.id);
  const full = compareIds.length >= MAX_COMPARE;

  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  useEffect(() => {
    let live = true;
    loadPhotos(d.id).then((p) => live && setPhotos(p)).catch(() => live && setPhotos([]));
    return () => {
      live = false;
    };
  }, [d.id]);

  const gallery = useMemo(() => {
    const fromFile = photos.map((p) => ({ src: p.dataUrl, kind: p.kind }));
    if (fromFile.length) return fromFile;
    const main = imageSrc(d.image);
    return main ? [{ src: main, kind: 'official' as const }] : [];
  }, [photos, d.image]);

  const statItems: ({ label: string; value: string; sub?: string } | null)[] = [
    d.display.size_in ? { label: 'Screen', value: `${d.display.size_in}″`, sub: [d.display.type, d.display.refresh_hz_max ? `${d.display.refresh_hz_max} Hz` : ''].filter(Boolean).join(' · ') } : null,
    d.battery.capacity_mah ? { label: 'Battery', value: `${d.battery.capacity_mah.toLocaleString()} mAh`, sub: d.battery.wired_w ? `${d.battery.wired_w} W charging` : undefined } : null,
    d.camera.main?.mp ? { label: 'Main camera', value: `${d.camera.main.mp} MP`, sub: d.camera.main.sensor_model } : null,
    d.soc.chipset ? { label: 'Chip', value: d.soc.chipset, sub: d.soc.ram_options_gb?.length ? `RAM ${d.soc.ram_options_gb.join(' / ')} GB` : undefined } : null,
    d.body.weight_g ? { label: 'Weight', value: `${d.body.weight_g} g`, sub: d.body.ip_rating ? ipCode(d.body.ip_rating) : undefined } : null,
  ];
  const stats = statItems.flatMap((s) => (s ? [s] : []));

  return (
    <article className="detail">
      <a className="back" href="#/phones">
        <Icon name="back" size={18} /> All phones
      </a>

      <section className="hero">
        <div className="hero-media">
          <Photo device={d} src={gallery[0]?.src} className="hero-photo" thumb={false} />
        </div>
        <div className="hero-body">
          <span className="eyebrow">
            {d.brand}
            {d.year ? ` · ${d.year}` : ''}
            {d.status !== 'released' ? ` · ${d.status}` : ''}
          </span>
          <h1>{d.model}</h1>
          {d.price_usd ? <p className="lead">Launch price ${d.price_usd.toLocaleString()}</p> : null}
          {d.soc.chipset && <p className="muted">{d.soc.chipset}</p>}

          <div className="hero-actions">
            <Button
              variant={inCompare ? 'primary' : 'quiet'}
              disabled={!inCompare && full}
              title={!inCompare && full ? `Compare holds up to ${MAX_COMPARE} phones` : undefined}
              onClick={() => setCompareIds(inCompare ? compareIds.filter((x) => x !== d.id) : [...compareIds, d.id])}
            >
              <Icon name={inCompare ? 'check' : 'plus'} size={18} />
              {inCompare ? 'In compare' : 'Add to compare'}
            </Button>
            {inCompare && (
              <Button variant="quiet" onClick={() => navigate('compare')}>
                Open compare
              </Button>
            )}
          </div>

          {d.note && <p className="note">{d.note}</p>}

          <div className="links">
            {d.source_url && (
              <a href={d.source_url} target="_blank" rel="noreferrer">
                Source page <Icon name="external" size={14} />
              </a>
            )}
            {d.priceoye?.url && (
              <a href={d.priceoye.url} target="_blank" rel="noreferrer">
                PriceOye <Icon name="external" size={14} />
              </a>
            )}
            {d.gallery?.threed_views?.map((v) => (
              <a key={v.url} href={v.url} target="_blank" rel="noreferrer">
                3D · {v.view} <Icon name="external" size={14} />
              </a>
            ))}
          </div>
        </div>
      </section>

      {stats.length > 0 && (
        <section className="stats" aria-label="Key numbers">
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} sub={s.sub} />
          ))}
        </section>
      )}

      {gallery.length > 1 && <Gallery items={gallery} name={`${d.brand} ${d.model}`} />}

      <PriceBook device={d} />

      <SpecSheet device={d} />

      <ExtraSection device={d} />

      {d.raw_specs && Object.keys(d.raw_specs).length > 0 && (
        <section className="block">
          <h2>Full spec sheet</h2>
          <p className="muted">Exactly as saved from the source page.</p>
          {Object.entries(d.raw_specs).map(([group, rows]) => (
            <details key={group} className="raw">
              <summary>{group}</summary>
              <dl className="kv">
                {Object.entries(rows).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </section>
      )}
    </article>
  );
}

/** Features that are not in the main spec table (stylus, gaming triggers, coatings, build...). */
function ExtraSection({ device: d }: { device: Device }) {
  const groups = groupExtras(extrasFor(d));
  if (groups.length === 0) return null;
  return (
    <section className="block">
      <h2>Extra features</h2>
      <p className="muted">Details that are specific to this phone and not in the main table.</p>
      <div className="spec-grid">
        {groups.map((g) => (
          <div className="spec-card" key={g.category}>
            <h3>{g.category}</h3>
            <dl className="kv">
              {g.rows.map((r, i) => (
                <div key={`${r.label}-${i}`}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function SpecSheet({ device: d }: { device: Device }) {
  const groups = CATEGORIES.map((cat) => {
    const rows = SPEC_FIELDS.filter((f) => f.category === cat)
      .map((f) => ({ label: f.label, value: getPath(d, f.path), field: f }))
      .filter((r) => hasValue(r.value));
    return { cat, rows };
  }).filter((g) => g.rows.length > 0);

  if (groups.length === 0) {
    return (
      <section className="block">
        <h2>Specifications</h2>
        <p className="muted">No specs are saved for this phone yet.</p>
      </section>
    );
  }

  return (
    <section className="block">
      <h2>Specifications</h2>
      <div className="spec-grid">
        {groups.map((g) => (
          <div className="spec-card" key={g.cat}>
            <h3>{g.cat}</h3>
            <dl className="kv">
              {g.rows.map((r) => (
                <div key={r.field.path}>
                  <dt>{r.label}</dt>
                  <dd>{formatValue(r.field, r.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function Gallery({ items, name }: { items: { src: string; kind: string }[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? null : (i + 1) % items.length));
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? null : (i - 1 + items.length) % items.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items.length]);

  return (
    <section className="block">
      <h2>Photos</h2>
      <p className="muted">{items.length} photos saved for offline viewing.</p>
      <ul className="gallery">
        {items.map((it, i) => (
          <li key={i}>
            <button type="button" className="gallery-thumb" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${items.length}`}>
              <img src={it.src} alt={`${name} photo ${i + 1}`} loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>

      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setOpen(null)}>
          <img src={items[open].src} alt={`${name} photo ${open + 1}`} />
          <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <Button variant="quiet" small onClick={() => setOpen((open - 1 + items.length) % items.length)} aria-label="Previous photo">
              <Icon name="back" size={18} />
            </Button>
            <span>
              {open + 1} / {items.length}
            </span>
            <Button variant="quiet" small onClick={() => setOpen((open + 1) % items.length)} aria-label="Next photo">
              <Icon name="next" size={18} />
            </Button>
            <Button variant="quiet" small onClick={() => setOpen(null)} aria-label="Close">
              <Icon name="close" size={18} />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

function PriceBook({ device: d }: { device: Device }) {
  const variants = useMemo(() => variantsFor(d), [d]);
  const [history, setHistory] = useState<PriceEntry[]>([]);
  const [variantIndex, setVariantIndex] = useState(0);
  const [price, setPrice] = useState('');
  const [shop, setShop] = useState('PriceOye');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const reload = () => {
    pricesFor(d.id)
      .then(setHistory)
      .catch(() => setHistory([]));
  };
  useEffect(reload, [d.id]);

  const latest = useMemo(() => latestByVariant(history), [history]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v: Variant = variants[variantIndex] ?? {};
    setError(null);
    setSaved(false);
    try {
      await addPrice({
        deviceId: d.id,
        ram_gb: v.ram_gb,
        storage_gb: v.storage_gb,
        price_pkr: Number(price),
        shop: shop.trim() || undefined,
        observed_on: date,
      });
      setPrice('');
      setSaved(true);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the price');
    }
  };

  return (
    <section className="block" id="prices">
      <h2>Prices in Pakistan</h2>
      <p className="muted">Type the price you see at a shop. Prices are not fetched automatically. Prices older than 30 days are flagged.</p>

      {variants.length > 0 && (
        <div className="price-table" role="table" aria-label="Latest price per variant">
          <div className="price-row price-head" role="row">
            <span role="columnheader">Variant</span>
            <span role="columnheader">Latest price</span>
            <span role="columnheader">Seen</span>
          </div>
          {variants.map((v) => {
            const row = latest.get(variantKey(v));
            const stale = row ? isOld(row.observed_on) : false;
            return (
              <div className="price-row" role="row" key={variantKey(v)}>
                <span role="cell">{variantLabel(v)}</span>
                <span role="cell" className="price-value">
                  {row ? formatPkr(row.price_pkr) : <span className="muted">Not entered</span>}
                  {row?.shop && <span className="muted"> · {row.shop}</span>}
                </span>
                <span role="cell">
                  {row ? (
                    <span className={stale ? 'badge badge-warn' : 'muted'}>
                      {row.observed_on}
                      {stale ? ' · check again' : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <form className="price-form" onSubmit={submit}>
        <label>
          <span>Variant</span>
          <select value={variantIndex} onChange={(e) => setVariantIndex(Number(e.target.value))}>
            {variants.map((v, i) => (
              <option key={variantKey(v)} value={i}>
                {variantLabel(v)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Price (Rs)</span>
          <input inputMode="numeric" placeholder="e.g. 149999" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} required />
        </label>
        <label>
          <span>Shop</span>
          <input value={shop} onChange={(e) => setShop(e.target.value)} maxLength={40} />
        </label>
        <label>
          <span>Date seen</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="price-form-actions">
          <Button variant="primary" type="submit">
            Save price
          </Button>
          {saved && <span className="ok">Saved</span>}
          {error && <span className="error" role="alert">{error}</span>}
        </div>
      </form>

      {history.length > 0 && (
        <details className="raw">
          <summary>Price history ({history.length})</summary>
          <ul className="history">
            {history.map((h) => (
              <li key={h.id}>
                <span>{h.observed_on}</span>
                <span>{variantLabel({ ram_gb: h.ram_gb, storage_gb: h.storage_gb })}</span>
                <span className="price-value">{formatPkr(h.price_pkr)}</span>
                <span className="muted">{h.shop ?? ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
