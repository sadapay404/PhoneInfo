import { useMemo, useState } from 'react';
import type { Device } from '../data/types';
import { estimateEndurance } from '../lib/estimators';
import { sensorGeometry } from '../lib/estimators';
import { Empty, PageHead, Stat } from './parts';

export function ToolsPage({ devices }: { devices: Device[] }) {
  const withBattery = useMemo(() => devices.filter((d) => d.battery.capacity_mah).sort((a, b) => a.model.localeCompare(b.model)), [devices]);
  const [id, setId] = useState<string>(() => withBattery[0]?.id ?? '');
  const device = withBattery.find((d) => d.id === id) ?? withBattery[0];

  const [screenHours, setScreenHours] = useState(5);
  const [brightness, setBrightness] = useState(50);
  const [refresh, setRefresh] = useState(60);
  const [load, setLoad] = useState(40);

  if (!device) {
    return (
      <>
        <PageHead title="Tools" />
        <Empty title="No phones with battery data yet">
          <p>Save phones from the extension or add one from the Library.</p>
        </Empty>
      </>
    );
  }

  const result = estimateEndurance(device.battery.capacity_mah ?? 0, {
    screenOnHours: screenHours,
    brightness: brightness / 100,
    refreshHz: refresh,
    load: load / 100,
  });
  const sensor = sensorGeometry(device.camera.main?.sensor_format);

  return (
    <>
      <PageHead title="Tools" lead="Estimates from the saved specs. They are not lab results." />

      <section className="block tool">
        <div className="block-head">
          <h2>Battery life</h2>
          <label className="inline-select">
            <span className="sr-only">Phone</span>
            <select value={device.id} onChange={(e) => setId(e.target.value)}>
              {withBattery.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.brand} {d.model}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="tool-grid">
          <Slider label="Screen on per day" value={screenHours} min={1} max={12} step={0.5} onChange={setScreenHours} format={(v) => `${v} h`} />
          <Slider label="Brightness" value={brightness} min={10} max={100} step={5} onChange={setBrightness} format={(v) => `${v}%`} />
          <Slider label="Refresh rate" value={refresh} min={60} max={120} step={60} onChange={setRefresh} format={(v) => `${v} Hz`} />
          <Slider label="Heavy use" value={load} min={0} max={100} step={5} onChange={setLoad} format={(v) => (v < 30 ? 'Light' : v < 70 ? 'Medium' : 'Gaming')} />
        </div>

        <div className="stats">
          <Stat label="Days per charge" value={result.daysPerCharge.toFixed(1)} sub={`${device.battery.capacity_mah?.toLocaleString()} mAh rated`} />
          <Stat label="Screen-on hours per charge" value={result.screenOnHoursPerCharge.toFixed(1)} />
        </div>
      </section>

      <section className="block tool">
        <h2>Main camera sensor</h2>
        {sensor ? (
          <div className="stats">
            <Stat label="Sensor diagonal" value={`${sensor.diagonalMm.toFixed(2)} mm`} sub={device.camera.main?.sensor_format} />
            <Stat label="Sensor area" value={`${sensor.areaMm2.toFixed(1)} mm²`} sub="Bigger area usually means better low light" />
          </div>
        ) : (
          <p className="muted">This phone has no sensor size saved.</p>
        )}
      </section>
    </>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{label}</span>
        <strong>{format(value)}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
