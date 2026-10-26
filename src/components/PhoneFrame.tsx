import { useEffect, useState, type ReactNode } from 'react';

export type Platform = 'ios' | 'android';

export interface ScreenPreset {
  id: string;
  label: string;
  width: number;  // portrait CSS px
  height: number;
}

export const SCREEN_PRESETS: ScreenPreset[] = [
  { id: 'iphone-15-pro', label: 'iPhone 15 Pro · 393×852', width: 393, height: 852 },
  { id: 'iphone-se', label: 'iPhone SE · 375×667', width: 375, height: 667 },
  { id: 'pixel-8-pro', label: 'Pixel 8 Pro · 412×915', width: 412, height: 915 },
  { id: 'galaxy-s24-ultra', label: 'Galaxy S24 Ultra · 412×919', width: 412, height: 919 },
];

interface FrameConfig {
  platform: Platform;
  landscape: boolean;
  zoom: number;
  preset: string;
  visible: boolean;
}

const STORAGE_KEY = 'aetherphone.frame';
const DEFAULT_CFG: FrameConfig = { platform: 'ios', landscape: false, zoom: 1, preset: 'iphone-15-pro', visible: true };
const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.15];

function loadConfig(): FrameConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_CFG, ...JSON.parse(raw) } : DEFAULT_CFG;
  } catch {
    return DEFAULT_CFG;
  }
}

function isNarrowOrTouch(): boolean {
  return window.innerWidth < 720 || window.matchMedia('(pointer: coarse)').matches;
}

/** Live clock for the status bar, updated every 15 seconds. */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusBar({ platform, time }: { platform: Platform; time: string }) {
  return (
    <div className={`status-bar status-${platform}`} aria-hidden="true">
      <span className="status-time">{time}</span>
      <span className="status-icons">
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="6" rx="1" /><rect x="10" y="2.5" width="3" height="8.5" rx="1" /><rect x="15" y="0" width="3" height="11" rx="1" /></svg>
        <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 10.5 L5.5 7.6 A3.6 3.6 0 0 1 10.5 7.6 Z" /><path d="M2.6 5.2 A7.6 7.6 0 0 1 13.4 5.2 L12 6.6 A5.6 5.6 0 0 0 4 6.6 Z" opacity=".9" /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="16" height="8" rx="1.8" /><rect x="23.5" y="4" width="2" height="4" rx="1" opacity=".5" /></svg>
      </span>
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<FrameConfig>(loadConfig);
  const [narrow, setNarrow] = useState(isNarrowOrTouch);
  const time = useClock();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }, [cfg]);

  useEffect(() => {
    const onResize = () => setNarrow(isNarrowOrTouch());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const forceFrameless = new URLSearchParams(window.location.search).has('frameless');
  const preset = SCREEN_PRESETS.find((p) => p.id === cfg.preset) ?? SCREEN_PRESETS[0];
  const screenW = cfg.landscape ? preset.height : preset.width;
  const screenH = cfg.landscape ? preset.width : preset.height;

  // Real phones (or narrow windows) always get the bare app; the frame is a desktop tool.
  if (narrow || forceFrameless || !cfg.visible) {
    return (
      <>
        <div className="frameless-app">{children}</div>
        {!narrow && !forceFrameless && (
          <button className="show-frame-btn" onClick={() => setCfg({ ...cfg, visible: true })}>
            Show device frame
          </button>
        )}
      </>
    );
  }

  const setZoom = (dir: -1 | 1) => {
    const idx = ZOOM_STEPS.indexOf(cfg.zoom);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (idx < 0 ? 3 : idx) + dir))];
    setCfg({ ...cfg, zoom: next });
  };

  return (
    <div className="frame-stage">
      <div className="frame-toolbar" role="toolbar" aria-label="Device frame controls">
        <div className="seg" role="group" aria-label="Platform">
          {(['ios', 'android'] as Platform[]).map((p) => (
            <button key={p} className={cfg.platform === p ? 'on' : ''} onClick={() => setCfg({ ...cfg, platform: p })}>
              {p === 'ios' ? 'iOS' : 'Android'}
            </button>
          ))}
        </div>
        <select aria-label="Screen size" value={cfg.preset} onChange={(e) => setCfg({ ...cfg, preset: e.target.value })}>
          {SCREEN_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <button onClick={() => setCfg({ ...cfg, landscape: !cfg.landscape })} aria-label="Rotate">⟳ Rotate</button>
        <div className="seg" role="group" aria-label="Zoom">
          <button onClick={() => setZoom(-1)} aria-label="Zoom out">−</button>
          <span className="zoom-label">{Math.round(cfg.zoom * 100)}%</span>
          <button onClick={() => setZoom(1)} aria-label="Zoom in">+</button>
        </div>
        <button onClick={() => setCfg({ ...cfg, visible: false })}>Hide frame</button>
      </div>

      <div className="frame-zoom" style={{ zoom: cfg.zoom }}>
        <div className={`device device-${cfg.platform} ${cfg.landscape ? 'is-landscape' : ''}`}>
          <div className="device-buttons" aria-hidden="true">
            <span className="btn-action" />
            <span className="btn-vol-up" />
            <span className="btn-vol-down" />
            <span className="btn-power" />
          </div>
          <div className="device-body" style={{ width: screenW, height: screenH }}>
            <div className="screen">
              {cfg.platform === 'ios' ? <div className="island" aria-hidden="true" /> : <div className="punch" aria-hidden="true" />}
              <StatusBar platform={cfg.platform} time={time} />
              <div className="screen-content">{children}</div>
              <div className="home-indicator" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
