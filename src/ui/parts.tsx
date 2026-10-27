import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Device } from '../data/types';
import { cutoutUrl } from '../lib/cutout';

/* ---------- Icons: one stroke style, 24px grid ---------- */

const ICONS = {
  phones: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></>,
  compare: <><rect x="3" y="4" width="7.5" height="16" rx="1.5" /><rect x="13.5" y="4" width="7.5" height="16" rx="1.5" /></>,
  library: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><rect x="3" y="11" width="18" height="5" rx="1.5" /><path d="M6 19h12" /></>,
  tools: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M15 18l-6-6 6-6" />,
  next: <path d="M9 18l6-6-6-6" />,
  upload: <><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4 15v4h16v-4" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5H5V6h5" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}

/* ---------- Buttons and chips ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'danger'; small?: boolean };

export function Button({ variant = 'quiet', small, className = '', ...rest }: BtnProps) {
  return <button type="button" className={`btn btn-${variant} ${small ? 'btn-sm' : ''} ${className}`} {...rest} />;
}

export function Chip({ active, onClick, children, title }: { active?: boolean; onClick?: () => void; children: ReactNode; title?: string }) {
  return (
    <button type="button" className={`chip ${active ? 'is-active' : ''}`} aria-pressed={!!active} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

/* ---------- Layout helpers ---------- */

export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

/* ---------- Phone images: real photo when we have one, a calm monogram otherwise ---------- */

export function imageSrc(image?: string): string | undefined {
  if (!image) return undefined;
  return image.startsWith('data:') ? image : `${import.meta.env.BASE_URL}catalog/${image}`;
}

/**
 * Thumbnail: a clean cut-out with the studio background removed. Processing starts only when the
 * card is on screen (visible cards go first). While it is pending, a neutral placeholder shows,
 * never the photo with its background. The original photo appears only if the engine cannot run.
 */
export function CleanImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    let made: string | null = null;
    cutoutUrl(src).then((u) => {
      if (!live) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      if (u) {
        made = u;
        setOut(u);
      } else {
        setFailed(true);
      }
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [src, visible]);

  if (out) return <img className={`photo ${className}`} src={out} alt={alt} decoding="async" />;
  if (failed) return <img className={`photo ${className}`} src={src} alt={alt} loading="lazy" decoding="async" />;
  return <div ref={ref} className={`photo photo-empty photo-pending ${className}`} role="img" aria-label={alt} />;
}

/**
 * Phone image for a card or header. Thumbnails (`thumb`, default) get the transparent
 * cut-out. Large views pass `thumb={false}` and show the original photo.
 */
export function Photo({ device, src, className = '', thumb = true }: { device: Device; src?: string; className?: string; thumb?: boolean }) {
  const url = src ?? imageSrc(device.image);
  if (url) {
    const alt = `${device.brand} ${device.model}`;
    return thumb ? (
      <CleanImage src={url} alt={alt} className={`photo ${className}`} />
    ) : (
      <img className={`photo ${className}`} src={url} alt={alt} loading="lazy" decoding="async" />
    );
  }
  return (
    <div className={`photo photo-empty ${className}`} aria-label={`${device.brand} ${device.model}`} role="img">
      <span>{device.brand.slice(0, 1)}</span>
    </div>
  );
}
