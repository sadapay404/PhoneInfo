import { useEffect, useMemo, useState } from 'react';
import { DEVICES } from './data/devices';
import { createDeviceSearch } from './lib/search';
import { PhoneFrame } from './components/PhoneFrame';
import { CatalogList, DeviceDetail } from './views/Catalog';
import { Compare } from './views/Compare';
import { Tools } from './views/Tools';

type Tab = 'catalog' | 'compare' | 'tools';
type Theme = 'dark' | 'light';

const DEFAULT_COMPARE = ['apple-iphone-15-pro', 'samsung-galaxy-s24-ultra'];

function parseHash(): { tab: Tab; id: string | null } {
  const [tab = 'catalog', id = null] = window.location.hash.replace(/^#\/?/, '').split('/');
  const safeTab: Tab = tab === 'compare' || tab === 'tools' ? tab : 'catalog';
  return { tab: safeTab, id: id || null };
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('aetherphone.theme') as Theme) || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('aetherphone.theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export function App() {
  const { tab, id } = useHashRoute();
  const online = useOnline();
  const [theme, toggleTheme] = useTheme();
  const [query, setQuery] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>(DEFAULT_COMPARE);
  const search = useMemo(() => createDeviceSearch(DEVICES), []);
  const results = useMemo(() => search(query), [search, query]);
  const selected = id ? DEVICES.find((d) => d.id === id) : undefined;

  const go = (path: string) => {
    window.location.hash = path;
    window.scrollTo({ top: 0 });
  };

  const toggleCompare = (deviceId: string) => {
    setCompareIds((ids) => {
      if (ids.includes(deviceId)) return ids.filter((x) => x !== deviceId);
      return ids.length >= 4 ? ids : [...ids, deviceId];
    });
  };

  return (
    <PhoneFrame>
      <div className="app">
        <header className="topbar">
          <button className="brand" onClick={() => go('catalog')}>
            <span className="logo" aria-hidden="true" />
            AetherPhone
          </button>
          <div className="top-actions">
            <span className={`net ${online ? 'online' : 'offline'}`} title={online ? 'Online' : 'Offline: using local catalog'}>
              {online ? 'Online' : 'Offline'}
            </span>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? '☀' : '☾'}</button>
          </div>
        </header>

        <nav className="tabs" role="tablist">
          {([['catalog', 'Catalog'], ['compare', `Compare (${compareIds.length})`], ['tools', 'Tools']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => go(t)}>
              {label}
            </button>
          ))}
        </nav>

        <main className="content">
          {tab === 'catalog' && !selected && (
            <>
              <div className="search">
                <input
                  type="search"
                  placeholder="Search brand, model, chipset… (typos OK)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search devices"
                />
                <span className="muted">{results.length}/{DEVICES.length}</span>
              </div>
              <CatalogList
                devices={results}
                onOpen={(d) => go(`catalog/${d}`)}
                onToggleCompare={toggleCompare}
                compareIds={compareIds}
              />
            </>
          )}
          {tab === 'catalog' && selected && <DeviceDetail device={selected} onBack={() => go('catalog')} />}
          {tab === 'compare' && <Compare devices={DEVICES} selectedIds={compareIds} onChange={setCompareIds} />}
          {tab === 'tools' && <Tools devices={DEVICES} />}
        </main>
      </div>
    </PhoneFrame>
  );
}
