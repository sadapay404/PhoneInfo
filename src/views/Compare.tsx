import { useMemo, useState } from 'react';
import type { Category, Device } from '../data/types';
import { CATEGORIES, formatValue } from '../data/specs';
import { compareDevices, type CompareRow, type Weights } from '../lib/compare';
import { DeviceImage } from '../components/DeviceImage';
import { Icon } from '../components/Icon';
import { MAX_COMPARE } from '../hooks/useAppState';

interface CompareProps {
  devices: Device[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onOpen: (id: string) => void;
}

export function Compare({ devices, selectedIds, onChange, onOpen }: CompareProps) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [weights, setWeights] = useState<Weights>({});
  const [picker, setPicker] = useState('');

  const selected = selectedIds.map((id) => devices.find((d) => d.id === id)).filter((d): d is Device => Boolean(d));
  const result = useMemo(() => compareDevices(selected, weights), [selected, weights]);
  const options = useMemo(
    () => devices.filter((d) => !selectedIds.includes(d.id) && `${d.brand} ${d.model}`.toLowerCase().includes(picker.toLowerCase())).slice(0, 25),
    [devices, selectedIds, picker],
  );

  const remove = (id: string) => onChange(selectedIds.filter((x) => x !== id));
  const add = (id: string) => {
    if (selectedIds.length < MAX_COMPARE) onChange([...selectedIds, id]);
    setPicker('');
  };

  return (
    <div className="compare">
      <header className="page-head">
        <div>
          <h1>Compare</h1>
          <p className="muted">Up to {MAX_COMPARE} phones. The best value in each row is highlighted.</p>
        </div>
      </header>

      <div className="compare-tray">
        {selected.map((d) => (
          <div key={d.id} className="tray-card">
            <button className="tray-thumb" onClick={() => onOpen(d.id)} aria-label={`Open ${d.model}`}>
              <DeviceImage device={d} />
            </button>
            <div>
              <span className="eyebrow">{d.brand}</span>
              <strong>{d.model}</strong>
            </div>
            <button className="icon-btn small" onClick={() => remove(d.id)} aria-label={`Remove ${d.model}`}><Icon name="x" size={14} /></button>
          </div>
        ))}
        {selected.length < MAX_COMPARE && (
          <div className="tray-add">
            <input type="search" placeholder="Add a phone…" value={picker} onChange={(e) => setPicker(e.target.value)} aria-label="Add a phone to compare" />
            {picker && (
              <ul className="picker">
                {options.map((d) => (
                  <li key={d.id}><button onClick={() => add(d.id)}>{d.brand} {d.model} <small>{d.year}</small></button></li>
                ))}
                {options.length === 0 && <li className="muted small">No match</li>}
              </ul>
            )}
          </div>
        )}
      </div>

      {selected.length < 2 ? (
        <div className="empty">
          <p>Pick at least two phones to compare. Use the Compare buttons in the Finder, or add one above.</p>
        </div>
      ) : (
        <>
          <section className="verdict-row" aria-label="Overall score">
            {selected
              .map((d, i) => ({ d, score: result.overall[i], win: result.overallWinners.includes(i) }))
              .sort((a, b) => b.score - a.score)
              .map(({ d, score, win }) => (
                <div key={d.id} className={`verdict ${win ? 'winner' : ''}`}>
                  <div className="verdict-top"><span>{d.model}</span>{win && <span className="tag accent">Top pick</span>}</div>
                  <div className="verdict-score">{score}<small>/100</small></div>
                  <div className="bar"><span style={{ width: `${score}%` }} /></div>
                </div>
              ))}
          </section>

          <div className="compare-tools">
            <label className="switch"><input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /><span className="track" aria-hidden="true" /><span>Only show differences</span></label>
            <details className="weights-panel">
              <summary>Category weights</summary>
              <div className="weights">
                {CATEGORIES.map((c) => (
                  <label key={c} className="weight">
                    <span>{c}</span>
                    <input type="range" min={0} max={5} step={1} value={weights[c] ?? 1} onChange={(e) => setWeights({ ...weights, [c]: Number(e.target.value) })} />
                    <output>{weights[c] ?? 1}</output>
                  </label>
                ))}
              </div>
            </details>
          </div>

          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th className="sticky" scope="col">Spec</th>
                  {selected.map((d) => <th key={d.id} scope="col">{d.model}</th>)}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((category: Category) => {
                  const rows = result.rows.filter((r) => r.field.category === category && (!onlyDiff || r.differs));
                  if (rows.length === 0) return null;
                  return (
                    <Section key={category} category={category} rows={rows} n={selected.length} />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}


function Section({ category, rows, n }: { category: Category; rows: CompareRow[]; n: number }) {
  return (
    <>
      <tr className="group-row"><th colSpan={n + 1} scope="colgroup">{category}</th></tr>
      {rows.map((r) => (
        <tr key={r.field.path} className={r.differs ? 'diff' : ''}>
          <th className="sticky" scope="row">{r.field.label}</th>
          {r.values.map((v, i) => (
            <td key={i} className={r.winners.includes(i) ? 'win' : ''}>
              {formatValue(r.field, v)}
              {r.winners.includes(i) && <Icon name="check" size={13} className="win-mark" />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
