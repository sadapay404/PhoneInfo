import type { ReactNode } from 'react';
import { Icon, type IconName } from './parts';
import { navigate, useOnline, useTheme, type Page, type ThemeMode, useCompareIds, MAX_COMPARE } from './state';

const NAV: { page: Page; label: string; icon: IconName; path: string }[] = [
  { page: 'phones', label: 'Phones', icon: 'phones', path: 'phones' },
  { page: 'compare', label: 'Compare', icon: 'compare', path: 'compare' },
  { page: 'library', label: 'Library', icon: 'library', path: 'library' },
  { page: 'tools', label: 'Tools', icon: 'tools', path: 'tools' },
];

const THEME_ICON: Record<ThemeMode, IconName> = { system: 'sun', light: 'sun', dark: 'moon' };
const THEME_NEXT: Record<ThemeMode, ThemeMode> = { system: 'dark', dark: 'light', light: 'system' };
const THEME_LABEL: Record<ThemeMode, string> = { system: 'Auto', dark: 'Dark', light: 'Light' };

export function Layout({ page, phoneCount, children }: { page: Page; phoneCount: number; children: ReactNode }) {
  const [theme, setTheme] = useTheme();
  const [compareIds] = useCompareIds();
  const online = useOnline();
  const activePage = page === 'phone' ? 'phones' : page;

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/phones" aria-label="AetherPhone home">
          <span className="brand-mark" aria-hidden="true">A</span>
          <span className="brand-name">AetherPhone</span>
        </a>

        <nav className="nav-top" aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.page}
              href={`#/${item.path}`}
              className={`nav-link ${activePage === item.page ? 'is-current' : ''}`}
              aria-current={activePage === item.page ? 'page' : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.page === 'compare' && compareIds.length > 0 && <span className="count">{compareIds.length}</span>}
            </a>
          ))}
        </nav>

        <div className="topbar-end">
          <span className={`status ${online ? '' : 'is-offline'}`} title={online ? 'Online' : 'Offline: everything still works'}>
            <span className="dot" aria-hidden="true" />
            <span className="status-text">{online ? 'Online' : 'Offline'}</span>
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme(THEME_NEXT[theme])}
            aria-label={`Theme: ${THEME_LABEL[theme]}. Switch theme`}
            title={`Theme: ${THEME_LABEL[theme]}`}
          >
            <Icon name={THEME_ICON[theme]} />
          </button>
        </div>
      </header>

      <main className="main" id="main">
        {children}
      </main>

      <footer className="footer">
        <span>{phoneCount} phones on this device</span>
        <span className="muted">Your data stays in this browser.</span>
      </footer>

      <nav className="nav-bottom" aria-label="Main mobile">
        {NAV.map((item) => (
          <button
            key={item.page}
            type="button"
            className={`nav-bottom-link ${activePage === item.page ? 'is-current' : ''}`}
            onClick={() => navigate(item.path)}
            aria-current={activePage === item.page ? 'page' : undefined}
          >
            <span className="nav-bottom-icon">
              <Icon name={item.icon} size={22} />
              {item.page === 'compare' && compareIds.length > 0 && <span className="count">{compareIds.length}</span>}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <span className="sr-only">Compare holds up to {MAX_COMPARE} phones.</span>
    </div>
  );
}
