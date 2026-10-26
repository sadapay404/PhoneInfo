import { useMemo, useState } from 'react';
import type { Category, Device } from '../data/types';
import { CATEGORIES, formatValue } from '../data/specs';
import { compareDevices, type Weights } from '../lib/compare';
import { Box } from '../components/Box';

const MAX_COMPARE = 4;

interface CompareProps {
  devices: Device[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function Compare({ devices, selectedIds, onChange }: CompareProps) {
  const [highlightDiff, setHighlightDiff] = useState(true);
  const [weights, setWeights] = useState<Weights>({});
  const [onlyDiff, setOnlyDiff] = useState(false);

  const selected = selectedIds.map((id) => devices.find((d) => d.id === id)).filter((d): d is Device => Boolean(d));
  const result = useMemo(() => compareDevices(selected, weights), [selected, weights]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else if (selectedIds.length < MAX_COMPARE) onChange([...selectedIds, id]);
  };

  const setWeight = (c: Category, v: number) => setWeights({ ...weights, [c]: v });

  return (
    <div className="compare">
      <Box title={`Pick devices (${selected.length}/${MAX_COMPARE})`}>
        <div className="chips">
          {devices.map((d) => {
            const on = selectedIds.includes(d.id);
            const disabled = !on && selectedIds.length >= MAX_COMPARE;
            return (
              <button key={d.id} className={`chip ${on ? 'on' : ''}`} onClick={() => toggle(d.id)} disabled={disabled} aria-pressed={on}>
                {d.brand} {d.model}
              </button>
            );
          })}
        </div>
      </Box>

      {selected.length < 2 ? (
        <p className="empty">Select at least two devices to compare.</p>
      ) : (
        <>
          <Box title="Overall">
            <ol className="ranking">
              {selected
                .map((d, i) => ({ d, score: result.overall[i], win: result.overallWinners.includes(i) }))
                .sort((a, b) => b.score - a.score)
                .map(({ d, score, win }) => (
                  <li key={d.id}>
                    <span>{d.brand} {d.model}{win ? ' 🏆' : ''}</span>
                    <span className="bar"><span style={{ width: `${score}%` }} /></span>
                    <strong>{score}</strong>
                  </li>
                ))}
            </ol>
          </Box>

          <Box title="Weights" defaultOpen={false}>
            <p className="note">Set how much each category counts toward the overall score (0 = ignore, 5 = heavy).</p>
            <div className="weights">
              {CATEGORIES.map((c) => (
                <label key={c} className="weight">
                  <span>{c}</span>
                  <input type="range" min={0} max={5} step={1} value={weights[c] ?? 1} onChange={(e) => setWeight(c, Number(e.target.value))} />
                  <output>{weights[c] ?? 1}</output>
                </label>
              ))}
            </div>
          </Box>

          <div className="toolbar-row">
            <label className="toggle"><input type="checkbox" checked={highlightDiff} onChange={(e) => setHighlightDiff(e.target.checked)} /> Highlight differences</label>
            <label className="toggle"><input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Only differences</label>
          </div>

          {CATEGORIES.map((category) => {
            const rows = result.rows.filter((r) => r.field.category === category && (!onlyDiff || r.differs));
            if (rows.length === 0) return null;
            const cat = result.categories.find((c) => c.category === category);
            const badges = cat && cat.comparable > 0 ? [`Winner: ${cat.winners.map((i) => selected[i].model).join(' / ')}`] : [];
            return (
              <Box key={category} title={category} badges={badges}>
                <div className="matrix-scroll">
                  <table className="matrix">
                    <thead>
                      <tr>
                        <th />
                        {selected.map((d) => <th key={d.id} scope="col">{d.model}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.field.path} className={highlightDiff && r.differs ? 'diff' : ''}>
                          <th scope="row">{r.field.label}</th>
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
