import type { Device } from '../data/types';

const BASE = import.meta.env.BASE_URL;

/** Stable hue per brand, so placeholders still look intentional. */
function hueFor(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/**
 * Phone photo when the archive has one; otherwise a tidy placeholder
 * (brand-tinted silhouette) rather than a broken image.
 */
export function DeviceImage({ device, className = '', eager = false }: { device: Device; className?: string; eager?: boolean }) {
  if (device.image) {
    return (
      <img
        className={`device-img ${className}`}
        src={`${BASE}catalog/${device.image}`}
        alt={`${device.brand} ${device.model}`}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    );
  }
  const hue = hueFor(device.brand);
  return (
    <div className={`device-img placeholder ${className}`} style={{ ['--h' as string]: hue }} role="img" aria-label={`${device.brand} ${device.model} (no photo yet)`}>
      <svg viewBox="0 0 60 110" aria-hidden="true">
        <rect x="6" y="2" width="48" height="106" rx="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".35" />
        <rect x="11" y="10" width="38" height="80" rx="3" fill="currentColor" opacity=".12" />
        <circle cx="30" cy="99" r="3" fill="currentColor" opacity=".35" />
      </svg>
      <span className="placeholder-name"><small>{device.brand}</small>{device.model}</span>
    </div>
  );
}
