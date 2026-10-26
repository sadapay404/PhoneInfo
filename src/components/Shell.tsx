import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import type { Tab, Theme } from '../hooks/useAppState';

export interface NavItem {
  id: Tab;
  label: string;
  icon: IconName;
  count?: number;
}

interface ShellProps {
  nav: NavItem[];
  active: Tab;
  onNavigate: (tab: Tab) => void;
  online: boolean;
  syncing: boolean;
  lastSync: number | null;
  theme: Theme;
  onToggleTheme: () => void;
  children: ReactNode;
}

function syncLabel(ts: number | null): string {
  if (!ts) return 'Not synced yet';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 2) return 'Up to date';
  if (mins < 60) return `Synced ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `Synced ${hrs} h ago` : `Synced ${new Date(ts).toLocaleDateString()}`;
}

function StatusPill({ online, syncing, lastSync }: Pick<ShellProps, 'online' | 'syncing' | 'lastSync'>) {
  const text = syncing ? 'Updating…' : online ? syncLabel(lastSync) : 'Offline';
  return (
    <span className={`status ${online ? 'ok' : 'off'}`} title={online ? 'Connected' : 'Using saved data'}>
      <span className="status-dot" />
      <span className="status-text">{text}</span>
    </span>
  );
}

export function Shell({ nav, active, onNavigate, online, syncing, lastSync, theme, onToggleTheme, children }: ShellProps) {
  return (
    <div className="shell">
      <header className="site-header">
        <div className="site-header-inner">
          <button className="brand" onClick={() => onNavigate('finder')} aria-label="AetherPhone home">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18.5h2" /></svg>
            </span>
            <span className="brand-name">AetherPhone</span>
          </button>
          <nav className="top-nav" aria-label="Main">
            {nav.map((item) => (
              <button key={item.id} className={active === item.id ? 'on' : ''} onClick={() => onNavigate(item.id)} aria-current={active === item.id ? 'page' : undefined}>
                <Icon name={item.icon} size={16} />
                {item.label}
                {item.count !== undefined && item.count > 0 && <span className="count">{item.count}</span>}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <StatusPill online={online} syncing={syncing} lastSync={lastSync} />
            <button className="icon-btn" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="bottom-nav" aria-label="Main">
        {nav.map((item) => (
          <button key={item.id} className={active === item.id ? 'on' : ''} onClick={() => onNavigate(item.id)} aria-current={active === item.id ? 'page' : undefined}>
            <span className="bn-icon">
              <Icon name={item.icon} size={22} />
              {item.count !== undefined && item.count > 0 && <span className="bn-count">{item.count}</span>}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
