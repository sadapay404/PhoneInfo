import { useState, type ReactNode } from 'react';

interface BoxProps {
  title: string;
  badges?: string[];
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A glassy, collapsible spec container. */
export function Box({ title, badges = [], defaultOpen = true, children }: BoxProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="box">
      <button className="box-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="box-title">{title}</span>
        <span className="box-badges">
          {badges.map((b) => (
            <span key={b} className="badge">{b}</span>
          ))}
        </span>
        <span className={`chevron ${open ? 'open' : ''}`} aria-hidden="true">⌄</span>
      </button>
      {open && <div className="box-body">{children}</div>}
    </section>
  );
}
