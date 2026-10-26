import { useMemo, useState } from 'react';
import type { Device } from '../data/types';
import { Box } from '../components/Box';
import { estimateEndurance, pointsPer100Usd, sensorGeometry } from '../lib/estimators';
import { SavedPhones } from '../components/SavedPhones';

type ToolId = 'battery' | 'sensor' | 'value' | 'saved';
const TOOLS: { id: ToolId; label: string; blurb: string }[] = [
  { id: 'saved', label: 'Saved phones', blurb: 'Import phones saved from GSMArena with the browser extension.' },
  { id: 'battery', label: 'Battery endurance', blurb: 'Estimate screen-on time for your usage.' },
  { id: 'sensor', label: 'Camera sensor size', blurb: 'Main sensors drawn to the same scale.' },
  { id: 'value', label: 'Value per dollar', blurb: 'Benchmark points per $100 of price.' },
];

export function Tools({ devices, onOpen }: { devices: Device[]; onOpen: (id: string) => void }) {
  const [tool, setTool] = useState<ToolId>('battery');
  const current = TOOLS.find((t) => t.id === tool)!;
  return (
    <div className="tools">
      <header className="page-head">
        <div>
          <h1>Tools</h1>
          <p className="muted">{current.blurb}</p>
        </div>
      </header>
      <div className="segmented" role="tablist">
        {TOOLS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tool === t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)}>{t.label}</button>
        ))}
      </div>
      {tool === 'battery' && <BatteryTool devices={devices} />}
      {tool === 'sensor' && <SensorTool devices={devices} />}
      {tool === 'value' && <ValueTool devices={devices} />}
      {tool === 'saved' && <SavedPhones onOpen={onOpen} />}
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
        .sort((a, b) => b.r.screenOnHoursPerCharge - a.r.screenOnHoursPerCharge)
        .slice(0, 60),
    [devices, screenOn, brightness, load, refresh],
  );
  const maxHours = Math.max(1, ...rows.map((x) => x.r.screenOnHoursPerCharge));

  return (
    <div className="tool-grid">
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
              {[60, 90, 120].map((hz) => <option key={hz} value={hz}>{hz} Hz (capped per phone)</option>)}
            </select>
          </label>
        </div>
        <p className="note">Screen power + SoC load, weighted by daily duty cycle, plus standby drain. An estimate for comparing phones, not a lab test.</p>
      </Box>

      <Box title="Estimated screen-on time per charge" collapsible={false}>
        <ol className="rank">
          {rows.map(({ d, r }) => (
            <li key={d.id}>
              <div className="rank-label"><strong>{d.brand} {d.model}</strong><span className="muted">{r.daysPerCharge.toFixed(2)} days at this usage</span></div>
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
  if (items.length === 0) return <div className="empty"><p>No sensor formats in the catalog yet.</p></div>;

  const largest = Math.max(...items.map((x) => x.g.areaMm2));
  const scale = 26;
  const width = Math.max(...items.map((x) => x.g.widthMm)) * scale + 20;
  const height = Math.max(...items.map((x) => x.g.heightMm)) * scale + 20;

  return (
    <div className="tool-grid">
      <Box title="Drawn to scale" collapsible={false}>
        <svg className="sensor-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sensor size comparison">
          {items.map(({ d, g }, i) => {
            const hue = (i * 97) % 360;
            return (
              <rect key={d.id} x={10} y={10} width={g.widthMm * scale} height={g.heightMm * scale} rx={4}
                fill={`hsla(${hue}, 80%, 55%, 0.12)`} stroke={`hsl(${hue}, 80%, 55%)`} strokeWidth={1.5}>
                <title>{d.model}</title>
              </rect>
            );
          })}
        </svg>
      </Box>
      <Box title="Relative area" collapsible={false}>
        <ol className="rank">
          {items.slice().sort((a, b) => b.g.areaMm2 - a.g.areaMm2).slice(0, 60).map(({ d, g }) => (
            <li key={d.id}>
              <div className="rank-label"><strong>{d.model}</strong><span className="muted">{d.camera.main?.sensor_format}</span></div>
              <span className="bar"><span style={{ width: `${(g.areaMm2 / largest) * 100}%` }} /></span>
              <span className="rank-value">{((g.areaMm2 / largest) * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ol>
        <p className="note">Diagonal ≈ 13.2 mm ÷ format denominator, 4:3 active area. Approximate; real sensors differ from nominal formats.</p>
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
      return { d, value: pointsPer100Usd(score > 0 ? score : undefined, price) };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
    .slice(0, 80);

  return (
    <Box title="Enter benchmark scores and prices" collapsible={false}>
      <p className="note">The archive has no benchmark scores yet. Enter a multi-core score from a source you trust, such as Geekbench, to rank value. Prices default to the launch price when known.</p>
      <div className="table-scroll">
        <table className="value-table">
          <thead><tr><th>Phone</th><th>Price (USD)</th><th>Benchmark score</th><th className="num">Points / $100</th></tr></thead>
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
