import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface BoxProps {
  title: string;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

/** A surface card with a header; optionally collapsible. */
export function Box({ title, subtitle, defaultOpen = true, collapsible = true, children, className = '', actions }: BoxProps) {
  const [open, setOpen] = useState(defaultOpen);
  const headerContent = (
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
            {headerContent}
            <Icon name="chevron" size={16} className={`chevron ${open ? 'open' : ''}`} />
          </button>
        ) : (
          <div className="box-toggle static">{headerContent}</div>
        )}
        {actions}
      </header>
      {open && <div className="box-body">{children}</div>}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
