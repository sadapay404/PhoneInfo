import { useMemo, useState } from 'react';
import type { Category, Device } from '../data/types';
import { CATEGORIES, formatValue } from '../data/specs';
import { compareDevices, type Weights } from '../lib/compare';
import { Box } from '../components/Box';
import { Icon } from '../components/Icon';
import { MAX_COMPARE } from '../hooks/useAppState';

interface CompareProps {
  devices: Device[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onOpen: (id: string) => void;
}

export function Compare({ devices, selectedIds, onChange, onOpen }: CompareProps) {
  const [highlight, setHighlight] = useState(true);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [weights, setWeights] = useState<Weights>({});

  const selected = selectedIds.map((id) => devices.find((d) => d.id === id)).filter((d): d is Device => Boolean(d));
  const result = useMemo(() => compareDevices(selected, weights), [selected, weights]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else if (selectedIds.length < MAX_COMPARE) onChange([...selectedIds, id]);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Compare</h1>
          <p className="muted">Pick up to {MAX_COMPARE} devices. The best value in each row is marked.</p>
        </div>
        {selected.length > 0 && <button className="btn ghost" onClick={() => onChange([])}>Clear all</button>}
      </div>

      <div className="chips" role="group" aria-label="Devices to compare">
        {devices.map((d) => {
          const on = selectedIds.includes(d.id);
          const disabled = !on && selectedIds.length >= MAX_COMPARE;
          return (
            <button key={d.id} className={`pill ${on ? 'on' : ''}`} onClick={() => toggle(d.id)} disabled={disabled} aria-pressed={on}>
              {on && <Icon name="check" size={14} />} {d.brand} {d.model}
            </button>
          );
        })}
      </div>

      {selected.length < 2 ? (
        <p className="empty-state">Select at least two devices to see a comparison.</p>
      ) : (
        <>
          <div className="verdict">
            {selected
              .map((d, i) => ({ d, score: result.overall[i], win: result.overallWinners.includes(i), i }))
              .sort((a, b) => b.score - a.score)
              .map(({ d, score, win, i }) => (
                <button key={d.id} className={`verdict-card ${win ? 'winner' : ''}`} onClick={() => onOpen(d.id)}>
                  <span className="eyebrow">{win ? 'Overall winner' : `Rank ${i + 1}`}</span>
                  <strong>{d.model}</strong>
                  <span className="score">{score}<small>/100</small></span>
                  <span className="bar"><span style={{ width: `${score}%` }} /></span>
                </button>
              ))}
          </div>

          <div className="toolbar">
            <label className="toggle"><input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> Highlight differences</label>
            <label className="toggle"><input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Only differences</label>
          </div>

          <Box title="Category weights" subtitle="Affects the overall score" defaultOpen={false}>
            <div className="weights">
              {CATEGORIES.map((c) => (
                <label key={c} className="weight">
                  <span>{c}</span>
                  <input type="range" min={0} max={5} step={1} value={weights[c] ?? 1} onChange={(e) => setWeights({ ...weights, [c]: Number(e.target.value) })} />
                  <output>{weights[c] ?? 1}</output>
                </label>
              ))}
            </div>
          </Box>

          {CATEGORIES.map((category: Category) => {
            const rows = result.rows.filter((r) => r.field.category === category && (!onlyDiff || r.differs));
            if (rows.length === 0) return null;
            const cat = result.categories.find((c) => c.category === category);
            const subtitle = cat && cat.comparable > 0 ? `Leader: ${cat.winners.map((i) => selected[i].model).join(' / ')}` : 'No comparable fields';
            return (
              <Box key={category} title={category} subtitle={subtitle}>
                <div className="matrix-scroll">
                  <table className="matrix">
                    <thead>
                      <tr>
                        <th className="sticky-col" />
                        {selected.map((d) => <th key={d.id} scope="col">{d.model}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.field.path} className={highlight && r.differs ? 'diff' : ''}>
                          <th scope="row" className="sticky-col">{r.field.label}</th>
                          {r.values.map((v, i) => (
                            <td key={i} className={r.winners.includes(i) ? 'win' : ''}>{formatValue(r.field, v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Box>
            );
          })}
        </>
      )}
    </div>
  );
}
