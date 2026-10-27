import { useMemo, useState } from 'react';
import type { Device, Category } from '../data/types';
import { compareDevices } from '../lib/compare';
import { createDeviceSearch } from '../lib/search';
import { CATEGORIES } from '../data/specs';
import { Button, Empty, Icon, PageHead, Photo } from './parts';
import { MAX_COMPARE, navigate, useCompareIds } from './state';
import { formatValue } from '../data/specs';

export function ComparePage({ devices }: { devices: Device[] }) {
  const [storedIds, setIds] = useCompareIds();
  const byId = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const selected = storedIds.map((id) => byId.get(id)).filter((d): d is Device => !!d);

  const [text, setText] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const search = useMemo(() => createDeviceSearch(devices), [devices]);
  const suggestions = useMemo(
    () => search(text).filter((d) => !storedIds.includes(d.id)).slice(0, 8),
    [search, text, storedIds],
  );

  const add = (id: string) => {
    if (storedIds.length < MAX_COMPARE && !storedIds.includes(id)) setIds([...storedIds, id]);
  };
  const remove = (id: string) => setIds(storedIds.filter((x) => x !== id));

  const result = useMemo(() => (selected.length >= 2 ? compareDevices(selected) : null), [selected]);

  return (
    <>
      <PageHead title="Compare" lead={`Pick up to ${MAX_COMPARE} phones. The better value in each row is marked.`} />

      <section className="picker block">
        <div className="picked">
          {selected.map((d) => (
            <div className="picked-item" key={d.id}>
              <Photo device={d} className="picked-photo" />
              <div>
                <strong>{d.model}</strong>
                <span className="muted">{d.brand}</span>
              </div>
              <button type="button" className="icon-btn" onClick={() => remove(d.id)} aria-label={`Remove ${d.model}`}>
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
          {selected.length < MAX_COMPARE && (
            <div className="picked-slot muted">{selected.length === 0 ? 'Add phones below' : 'Add another phone'}</div>
          )}
        </div>

        {selected.length < MAX_COMPARE && (
          <div className="add-phone">
            <label className="search">
              <Icon name="search" size={18} />
              <span className="sr-only">Find a phone to add</span>
              <input type="search" placeholder="Find a phone to add" value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            {suggestions.length > 0 && (
              <ul className="suggest">
                {suggestions.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => add(d.id)}>
                      <span>
                        {d.brand} {d.model}
                      </span>
                      <span className="muted">{d.year || ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {!result && (
        <Empty title="Choose at least two phones">
          <p>Compare shows every spec side by side, with a winner for each row.</p>
          <Button onClick={() => navigate('phones')}>Browse phones</Button>
        </Empty>
      )}

      {result && selected.length >= 2 && (
        <>
          <section className="verdicts">
            {result.categories.map((c) => (
              <div className="verdict" key={c.category}>
                <span className="eyebrow">{c.category}</span>
                <strong>
                  {c.winners.length === 1 ? selected[c.winners[0]].model : c.winners.length > 1 ? 'Tie' : 'Not enough data'}
                </strong>
              </div>
            ))}
          </section>

          <div className="compare-controls">
            <label className="check">
              <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
              <span>Show differences only</span>
            </label>
          </div>

          <div className="table-scroll">
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col">Spec</th>
                  {selected.map((d) => (
                    <th scope="col" key={d.id}>
                      <a href={`#/phone/${encodeURIComponent(d.id)}`}>{d.model}</a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat: Category) => {
                  const rows = result.rows.filter((r) => r.field.category === cat && (!onlyDiff || r.differs));
                  if (rows.length === 0) return null;
                  return (
                    <Section key={cat} cat={cat} colSpan={selected.length + 1}>
                      {rows.map((r) => (
                        <tr key={r.field.path}>
                          <th scope="row">{r.field.label}</th>
                          {r.values.map((v, i) => (
                            <td key={i} className={r.winners.includes(i) ? 'win' : ''}>
                              {formatValue(r.field, v)}
                              {r.winners.includes(i) && <span className="sr-only"> (better)</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Section>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Section({ cat, colSpan, children }: { cat: Category; colSpan: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="cat-row">
        <th colSpan={colSpan} scope="colgroup">
          {cat}
        </th>
      </tr>
      {children}
    </>
  );
}
