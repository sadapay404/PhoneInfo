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

function formatSync(ts: number | null): string {
  if (!ts) return 'Not synced yet';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'Synced just now';
  if (mins < 60) return `Synced ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `Synced ${hrs}h ago` : `Synced ${new Date(ts).toLocaleDateString()}`;
}

function StatusPill({ online, syncing, lastSync }: Pick<ShellProps, 'online' | 'syncing' | 'lastSync'>) {
  const label = syncing ? 'Syncing…' : online ? formatSync(lastSync) : 'Offline · local data';
  return (
    <span className={`status ${online ? 'is-online' : 'is-offline'}`} title={label}>
      <Icon name={online ? 'cloud' : 'cloudOff'} size={14} />
      <span>{label}</span>
    </span>
  );
}

export function Shell({ nav, active, onNavigate, online, syncing, lastSync, theme, onToggleTheme, children }: ShellProps) {
  const themeButton = (
    <button className="icon-btn" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <span>AetherPhone</span>
        </div>
        <nav className="side-nav" aria-label="Main">
          {nav.map((item) => (
            <button key={item.id} className={`side-link ${active === item.id ? 'on' : ''}`} onClick={() => onNavigate(item.id)} aria-current={active === item.id ? 'page' : undefined}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.count !== undefined && <span className="count">{item.count}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <StatusPill online={online} syncing={syncing} lastSync={lastSync} />
          {themeButton}
        </div>
      </aside>

      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <span>AetherPhone</span>
        </div>
        <div className="topbar-actions">
          <StatusPill online={online} syncing={syncing} lastSync={lastSync} />
          {themeButton}
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="bottom-nav" aria-label="Main">
        {nav.map((item) => (
          <button key={item.id} className={active === item.id ? 'on' : ''} onClick={() => onNavigate(item.id)} aria-current={active === item.id ? 'page' : undefined}>
            <span className="bn-icon">
              <Icon name={item.icon} size={22} />
              {item.count !== undefined && item.count > 0 && <span className="dot-count">{item.count}</span>}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
