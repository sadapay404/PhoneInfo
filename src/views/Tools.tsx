import { useMemo, useState } from 'react';
import type { Device } from '../data/types';
import { Box } from '../components/Box';
import { estimateEndurance, pointsPer100Usd, sensorGeometry } from '../lib/estimators';

type ToolId = 'battery' | 'sensor' | 'value';
const TOOLS: { id: ToolId; label: string; blurb: string }[] = [
  { id: 'battery', label: 'Battery endurance', blurb: 'Estimate screen-on time from your usage.' },
  { id: 'sensor', label: 'Sensor size', blurb: 'Main camera sensors drawn to the same scale.' },
  { id: 'value', label: 'Price vs performance', blurb: 'Benchmark points per $100.' },
];

export function Tools({ devices }: { devices: Device[] }) {
  const [tool, setTool] = useState<ToolId>('battery');
  const current = TOOLS.find((t) => t.id === tool)!;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tools</h1>
          <p className="muted">{current.blurb}</p>
        </div>
      </div>
      <div className="segmented" role="tablist">
        {TOOLS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tool === t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)}>
            {t.label}
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
    <div className="tool-layout">
      <Box title="Your usage" collapsible={false}>
        <div className="sliders">
          <label>Screen-on time per day <output>{screenOn} h</output>
            <input type="range" min={1} max={12} value={screenOn} onChange={(e) => setScreenOn(Number(e.target.value))} />
          </label>
          <label>Brightness <output>{brightness}%</output>
            <input type="range" min={10} max={100} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
          </label>
          <label>Workload <output>{load}%</output>
            <input type="range" min={0} max={100} value={load} onChange={(e) => setLoad(Number(e.target.value))} />
          </label>
          <label>Refresh rate <output>{refresh} Hz</output>
            <select value={refresh} onChange={(e) => setRefresh(Number(e.target.value))}>
              {[60, 90, 120].map((hz) => <option key={hz} value={hz}>{hz} Hz (capped per device)</option>)}
            </select>
          </label>
        </div>
        <p className="note">Screen power + SoC load, weighted by daily duty cycle, plus standby drain. An estimate for relative comparison, not a lab measurement.</p>
      </Box>

      <Box title="Estimated screen-on time per charge" collapsible={false}>
        <ol className="rank-list">
          {rows.map(({ d, r }) => (
            <li key={d.id}>
              <div className="rank-label"><strong>{d.model}</strong><span className="muted">{r.daysPerCharge.toFixed(2)} days at this usage</span></div>
              <span className="bar"><span style={{ width: `${(r.screenOnHoursPerCharge / maxHours) * 100}%` }} /></span>
              <span className="rank-value">{r.screenOnHoursPerCharge.toFixed(1)} h</span>
            </li>
          ))}
        </ol>
      </Box>
    </div>
  );
}

function SensorTool({ devices }: { devices: Device[] }) {
  const items = devices
    .map((d) => ({ d, g: sensorGeometry(d.camera.main?.sensor_format) }))
    .filter((x): x is { d: Device; g: NonNullable<ReturnType<typeof sensorGeometry>> } => Boolean(x.g));
  if (items.length === 0) return <p className="empty-state">No sensor formats in the catalog yet.</p>;

  const largest = Math.max(...items.map((x) => x.g.areaMm2));
  const scale = 26; // px per mm, shared origin so sizes compare directly
  const width = Math.max(...items.map((x) => x.g.widthMm)) * scale + 20;
  const height = Math.max(...items.map((x) => x.g.heightMm)) * scale + 20;

  return (
    <div className="tool-layout">
      <Box title="Drawn to scale" collapsible={false}>
        <svg className="sensor-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sensor size comparison">
          {items.map(({ d, g }, i) => {
            const hue = (i * 97) % 360;
            return (
              <rect key={d.id} x={10} y={10} width={g.widthMm * scale} height={g.heightMm * scale} rx={4}
                fill={`hsla(${hue}, 85%, 60%, 0.14)`} stroke={`hsl(${hue}, 85%, 65%)`} strokeWidth={1.5}>
                <title>{d.model}</title>
              </rect>
            );
          })}
        </svg>
      </Box>
      <Box title="Relative area" collapsible={false}>
        <ol className="rank-list">
          {items.slice().sort((a, b) => b.g.areaMm2 - a.g.areaMm2).map(({ d, g }) => (
            <li key={d.id}>
              <div className="rank-label"><strong>{d.model}</strong><span className="muted">{d.camera.main?.sensor_format}</span></div>
              <span className="bar"><span style={{ width: `${(g.areaMm2 / largest) * 100}%` }} /></span>
              <span className="rank-value">{((g.areaMm2 / largest) * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ol>
        <p className="note">Diagonal ≈ 13.2 mm ÷ format denominator, 4:3 active area. Approximate: real sensors differ from nominal optical formats.</p>
      </Box>
    </div>
  );
}

function ValueTool({ devices }: { devices: Device[] }) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});

  const rows = devices
    .map((d) => {
      const score = Number(scores[d.id]);
      const price = prices[d.id] !== undefined ? Number(prices[d.id]) : d.price_usd;
      return { d, value: pointsPer100Usd(score > 0 ? score : undefined, price), price };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  return (
    <Box title="Enter your benchmark scores" collapsible={false}>
      <p className="note">No benchmark scores are bundled yet. Enter a multi-core score from a source you trust (for example Geekbench) to rank value.</p>
      <div className="matrix-scroll">
        <table className="value-table">
          <thead>
            <tr><th>Device</th><th>Price (USD)</th><th>Benchmark score</th><th className="num">Points / $100</th></tr>
          </thead>
          <tbody>
            {rows.map(({ d, value }) => (
              <tr key={d.id}>
                <th scope="row">{d.brand} {d.model}</th>
                <td><input type="number" min={0} inputMode="numeric" placeholder="—" value={prices[d.id] ?? d.price_usd ?? ''} onChange={(e) => setPrices({ ...prices, [d.id]: e.target.value })} /></td>
                <td><input type="number" min={0} inputMode="numeric" placeholder="enter score" value={scores[d.id] ?? ''} onChange={(e) => setScores({ ...scores, [d.id]: e.target.value })} /></td>
                <td className="num accent-text">{value === undefined ? '—' : value.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Box>
  );
}
