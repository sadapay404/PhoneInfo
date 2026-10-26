import { useEffect, useMemo, useState } from 'react';
import { createDeviceSearch } from './lib/search';
import { useCatalog } from './hooks/useCatalog';
import { useCompareSelection, useHashRoute, useOnline, useTheme, type Tab } from './hooks/useAppState';
import { Shell, type NavItem } from './components/Shell';
import { CatalogList, DeviceDetail } from './views/Catalog';
import { Compare } from './views/Compare';
import { Tools } from './views/Tools';

const DEFAULT_COMPARE = ['apple-iphone-15-pro', 'samsung-galaxy-s24-ultra'];

export function App() {
  const route = useHashRoute();
  const online = useOnline();
  const [theme, toggleTheme] = useTheme();
  const catalog = useCatalog();
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState<string | null>(null);

  const validIds = useMemo(() => new Set(catalog.devices.map((d) => d.id)), [catalog.devices]);
  const [compareIds, setCompareIds] = useCompareSelection(validIds, DEFAULT_COMPARE);

  const search = useMemo(() => createDeviceSearch(catalog.devices), [catalog.devices]);
  const results = useMemo(
    () => search(query).filter((d) => !brand || d.brand === brand),
    [search, query, brand],
  );
  const selected = route.id ? catalog.devices.find((d) => d.id === route.id) : undefined;

  useEffect(() => {
    document.title = selected ? `${selected.brand} ${selected.model} · AetherPhone` : 'AetherPhone DB';
  }, [selected]);

  const go = (path: string) => {
    window.location.hash = path;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };
  const navigate = (tab: Tab) => go(tab);

  const toggleCompare = (id: string) => {
    if (compareIds.includes(id)) setCompareIds(compareIds.filter((x) => x !== id));
    else if (compareIds.length < 4) setCompareIds([...compareIds, id]);
  };

  const nav: NavItem[] = [
    { id: 'catalog', label: 'Catalog', icon: 'grid', count: catalog.devices.length },
    { id: 'compare', label: 'Compare', icon: 'compare', count: compareIds.length },
    { id: 'tools', label: 'Tools', icon: 'tools' },
  ];

  let page;
  if (route.tab === 'catalog' && selected) {
    page = (
      <DeviceDetail
        device={selected}
        allDevices={catalog.devices}
        onBack={() => go('catalog')}
        onCompare={() => toggleCompare(selected.id)}
        inCompare={compareIds.includes(selected.id)}
      />
    );
  } else if (route.tab === 'catalog') {
    page = (
      <CatalogList
        devices={results}
        allDevices={catalog.devices}
        query={query}
        onQuery={setQuery}
        brand={brand}
        onBrand={setBrand}
        compareIds={compareIds}
        onToggleCompare={toggleCompare}
        onOpen={(id) => go(`catalog/${id}`)}
      />
    );
  } else if (route.tab === 'compare') {
    page = (
      <Compare devices={catalog.devices} selectedIds={compareIds} onChange={setCompareIds} onOpen={(id) => go(`catalog/${id}`)} />
    );
  } else {
    page = <Tools devices={catalog.devices} />;
  }

  return (
    <Shell
      nav={nav}
      active={route.tab}
      onNavigate={navigate}
      online={online}
      syncing={catalog.syncing}
      lastSync={catalog.lastSync}
      theme={theme}
      onToggleTheme={toggleTheme}
    >
      {catalog.error && online && (
        <div className="banner" role="status">Couldn’t refresh the catalog ({catalog.error}). Showing the last saved copy.</div>
      )}
      {page}
    </Shell>
  );
}
