import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface BoxProps {
  title: string;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** A surface card with a header; optionally collapsible. */
export function Box({ title, subtitle, defaultOpen = true, collapsible = true, className = '', actions, children }: BoxProps) {
  const [open, setOpen] = useState(defaultOpen);
  const head = (
    <>
      <span className="box-title">{title}</span>
      {subtitle && <span className="box-subtitle">{subtitle}</span>}
    </>
  );
  return (
    <section className={`box ${className}`}>
      <header className="box-head">
        {collapsible ? (
          <button className="box-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {head}
            <Icon name="chevron" size={16} className={`chev ${open ? 'open' : ''}`} />
          </button>
        ) : (
          <div className="box-toggle static">{head}</div>
        )}
        {actions}
      </header>
      {open && <div className="box-body">{children}</div>}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
