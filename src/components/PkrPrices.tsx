import { useEffect, useMemo, useState } from 'react';
import type { Device } from '../data/types';
import type { PriceEntry } from '../data/db';
import {
  addPrice, formatPkr, isOld, latestByVariant, pricesFor, variantKey, variantLabel, variantsFor,
} from '../data/prices';

const todayIso = () => new Date().toLocaleDateString('en-CA');

/** Manual PKR price log, one row per RAM and storage variant. Nothing here is fetched from a shop. */
export function PkrPrices({ device }: { device: Device }) {
  const variants = useMemo(() => variantsFor(device), [device]);
  const [rows, setRows] = useState<PriceEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ variant: 0, price: '', shop: '', date: todayIso(), note: '' });
  const [open, setOpen] = useState<string | null>(null);

  const reload = () => pricesFor(device.id).then(setRows).catch(() => setRows([]));
  useEffect(() => { void reload(); setDraft((d) => ({ ...d, variant: 0 })); setOpen(null); }, [device.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = useMemo(() => latestByVariant(rows), [rows]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = variants[draft.variant] ?? {};
    try {
      await addPrice({
        deviceId: device.id,
        ram_gb: v.ram_gb,
        storage_gb: v.storage_gb,
        price_pkr: Number(draft.price.replace(/[, ]/g, '')),
        shop: draft.shop.trim() || undefined,
        observed_on: draft.date,
        note: draft.note.trim() || undefined,
      });
      setError(null);
      setDraft((d) => ({ ...d, price: '', note: '' }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the price');
    }
  }

  return (
    <section className="prices" aria-labelledby="prices-title">
      <h2 id="prices-title">Prices in Pakistan (PKR)</h2>
      <p className="muted small">
        You type these in from shops you visit. Prices are not collected automatically. A price older than 30 days is flagged.
      </p>

      <ul className="price-list">
        {variants.map((v) => {
          const p = latest.get(variantKey(v));
          const key = variantKey(v);
          const history = rows.filter((r) => variantKey({ ram_gb: r.ram_gb, storage_gb: r.storage_gb }) === key);
          return (
            <li key={key} className="price-row">
              <div className="price-main">
                <span className="price-variant">{variantLabel(v)}</span>
                {p ? (
                  <span className="price-value">
                    {formatPkr(p.price_pkr)}
                    {isOld(p.observed_on) && <span className="tag tag-warn">Check price</span>}
                  </span>
                ) : (
                  <span className="muted small">No price yet</span>
                )}
              </div>
              {p && (
                <div className="muted small">
                  Seen {p.observed_on}{p.shop ? ` at ${p.shop}` : ''}
                  {history.length > 1 && (
                    <button type="button" className="link-btn" onClick={() => setOpen(open === key ? null : key)}>
                      {open === key ? 'Hide history' : `History (${history.length})`}
                    </button>
                  )}
                </div>
              )}
              {open === key && (
                <ol className="price-history">
                  {history.map((h) => (
                    <li key={h.id}>{h.observed_on} · {formatPkr(h.price_pkr)}{h.shop ? ` · ${h.shop}` : ''}{h.note ? ` · ${h.note}` : ''}</li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>

      <form className="price-form" onSubmit={save}>
        <label>
          Variant
          <select value={draft.variant} onChange={(e) => setDraft({ ...draft, variant: Number(e.target.value) })}>
            {variants.map((v, i) => <option key={variantKey(v)} value={i}>{variantLabel(v)}</option>)}
          </select>
        </label>
        <label>
          Price (PKR)
          <input inputMode="numeric" required value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="e.g. 185000" />
        </label>
        <label>
          Shop
          <input value={draft.shop} onChange={(e) => setDraft({ ...draft, shop: e.target.value })} placeholder="optional" />
        </label>
        <label>
          Date seen
          <input type="date" required value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </label>
        <label className="price-note">
          Note
          <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="optional, e.g. official, grey market" />
        </label>
        <button type="submit" className="btn">Save price</button>
        {error && <p role="alert" className="error small">{error}</p>}
      </form>
    </section>
  );
}
