import { useMemo, useState } from 'react';
import type { Device } from '../data/types';
import { Box } from '../components/Box';
import { estimateEndurance, pointsPer100Usd, sensorGeometry } from '../lib/estimators';

type ToolId = 'battery' | 'sensor' | 'value';

export function Tools({ devices }: { devices: Device[] }) {
  const [tool, setTool] = useState<ToolId>('battery');
  return (
    <div className="tools">
      <div className="seg wide" role="tablist">
        {([['battery', 'Battery endurance'], ['sensor', 'Sensor size'], ['value', 'Value']] as [ToolId, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tool === id} className={tool === id ? 'on' : ''} onClick={() => setTool(id)}>
            {label}
          </button>
        ))}
      </div>
      {tool === 'battery' && <BatteryTool devices={devices} />}
      {tool === 'sensor' && <SensorTool devices={devices} />}
      {tool === 'value' && <ValueTool devices={devices} />}
    </div>
  );
}

function BatteryTool({ devices }: { devices: Device[] }) {
  const [screenOn, setScreenOn] = useState(5);
  const [brightness, setBrightness] = useState(50);
  const [load, setLoad] = useState(40);
  const [refresh, setRefresh] = useState(120);

  const rows = useMemo(
    () =>
      devices
        .filter((d) => d.battery.capacity_mah)
        .map((d) => ({
          d,
          r: estimateEndurance(d.battery.capacity_mah!, {
            screenOnHours: screenOn,
            brightness: brightness / 100,
            refreshHz: Math.min(refresh, d.display.refresh_hz_max ?? refresh),
            load: load / 100,
          }),
        }))
        .sort((a, b) => b.r.screenOnHoursPerCharge - a.r.screenOnHoursPerCharge),
    [devices, screenOn, brightness, load, refresh],
  );
  const maxHours = Math.max(1, ...rows.map((x) => x.r.screenOnHoursPerCharge));

  return (
    <Box title="Usage profile">
      <div className="form-grid">
        <label>Screen-on time / day: <strong>{screenOn} h</strong>
          <input type="range" min={1} max={12} value={screenOn} onChange={(e) => setScreenOn(Number(e.target.value))} />
        </label>
        <label>Brightness: <strong>{brightness}%</strong>
          <input type="range" min={10} max={100} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
        </label>
        <label>Workload: <strong>{load}%</strong>
          <input type="range" min={0} max={100} value={load} onChange={(e) => setLoad(Number(e.target.value))} />
        </label>
        <label>Refresh rate: <strong>{refresh} Hz</strong> <span className="muted">(capped per device)</span>
          <select value={refresh} onChange={(e) => setRefresh(Number(e.target.value))}>
            {[60, 90, 120].map((hz) => <option key={hz} value={hz}>{hz} Hz</option>)}
          </select>
        </label>
      </div>
      <p className="note">Model: screen power + SoC load × duty cycle, with standby drain. An estimate for relative comparison, not a lab measurement.</p>
      <table className="bar-table">
        <tbody>
          {rows.map(({ d, r }) => (
            <tr key={d.id}>
              <th scope="row">{d.model}</th>
              <td className="bar-cell"><span className="bar"><span style={{ width: `${(r.screenOnHoursPerCharge / maxHours) * 100}%` }} /></span></td>
              <td className="num">{r.screenOnHoursPerCharge.toFixed(1)} h screen-on</td>
              <td className="num">{r.daysPerCharge.toFixed(2)} d / charge</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function SensorTool({ devices }: { devices: Device[] }) {
  const items = devices
    .map((d) => ({ d, g: sensorGeometry(d.camera.main?.sensor_format) }))
    .filter((x): x is { d: Device; g: NonNullable<ReturnType<typeof sensorGeometry>> } => Boolean(x.g));
  const largest = Math.max(...items.map((x) => x.g.areaMm2), 1);
  const scale = 22; // px per mm, so the sensors line up on a shared origin

  return (
    <Box title="Main camera sensors, drawn to scale">
      {items.length === 0 ? (
        <p className="empty">No sensor formats in the catalog yet.</p>
      ) : (
        <>
          <svg className="sensor-svg" viewBox={`0 0 ${Math.max(...items.map((x) => x.g.widthMm)) * scale + 20} ${Math.max(...items.map((x) => x.g.heightMm)) * scale + 20}`} role="img" aria-label="Sensor size comparison">
            {items.map(({ d, g }, i) => (
              <g key={d.id}>
                <rect x={10} y={10} width={g.widthMm * scale} height={g.heightMm * scale} rx={3}
                  fill={`hsla(${(i * 97) % 360}, 90%, 60%, 0.18)`} stroke={`hsl(${(i * 97) % 360}, 90%, 65%)`} strokeWidth={1.5}>
                  <title>{d.model}</title>
                </rect>
              </g>
            ))}
          </svg>
          <ul className="ranking">
            {items
              .slice()
              .sort((a, b) => b.g.areaMm2 - a.g.areaMm2)
              .map(({ d, g }) => (
                <li key={d.id}>
                  <span>{d.model} · {d.camera.main?.sensor_format}</span>
                  <span className="bar"><span style={{ width: `${(g.areaMm2 / largest) * 100}%` }} /></span>
                  <strong>{((g.areaMm2 / largest) * 100).toFixed(0)}%</strong>
                </li>
              ))}
          </ul>
          <p className="note">Diagonal ≈ 13.2 mm ÷ format denominator, 4:3 active area. Approximate; sensors differ from nominal optical formats.</p>
        </>
      )}
    </Box>
  );
}

function ValueTool({ devices }: { devices: Device[] }) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});

  const rows = devices
    .map((d) => {
      const score = Number(scores[d.id]);
      const price = prices[d.id] !== undefined ? Number(prices[d.id]) : d.price_usd;
      return { d, score: score > 0 ? score : undefined, price, value: pointsPer100Usd(score, price) };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  return (
    <Box title="Price-to-performance">
      <p className="note">No benchmark scores are bundled yet. Enter a multi-core score from a source you trust (e.g. Geekbench) to rank value.</p>
      <div className="matrix-scroll">
        <table className="value-table">
          <thead>
            <tr><th>Device</th><th>Price (USD)</th><th>Benchmark score</th><th>Points / $100</th></tr>
          </thead>
          <tbody>
            {rows.map(({ d, value }) => (
              <tr key={d.id}>
                <th scope="row">{d.brand} {d.model}</th>
                <td><input type="number" min={0} placeholder="—" value={prices[d.id] ?? d.price_usd ?? ''} onChange={(e) => setPrices({ ...prices, [d.id]: e.target.value })} /></td>
                <td><input type="number" min={0} placeholder="enter score" value={scores[d.id] ?? ''} onChange={(e) => setScores({ ...scores, [d.id]: e.target.value })} /></td>
                <td className="num">{value === undefined ? '—' : value.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Box>
  );
}
