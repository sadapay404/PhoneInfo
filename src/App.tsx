import { useEffect, useMemo, useRef, useState } from 'react';
import { createDeviceSearch } from './lib/search';
import { applyFilters, filtersFromQuery, filtersToQuery, type Filters } from './lib/finder';
import { useCatalog } from './hooks/useCatalog';
import { parseHash, useCompareSelection, useHashRoute, useOnline, useTheme, type Tab } from './hooks/useAppState';
import { Shell, type NavItem } from './components/Shell';
import { Finder } from './views/Finder';
import { Detail } from './views/Detail';
import { Compare } from './views/Compare';
import { Tools } from './views/Tools';
import type { Facets } from './components/FilterPanel';
import type { Device } from './data/types';

const DEFAULT_COMPARE = ['apple-iphone-15-pro', 'samsung-galaxy-s24-ultra'];

function countBy(values: (string | undefined)[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
}

function buildFacets(devices: Device[]): Facets {
  return {
    brands: countBy(devices.map((d) => d.brand)),
    socBrands: countBy(devices.map((d) => d.soc.brand)),
    osFamilies: countBy(devices.map((d) => d.software.os_family)),
  };
}

/** Finder state lives in the URL hash, so a filtered view can be bookmarked or shared. */
function writeFinderUrl(filters: Filters, query: string) {
  const p = new URLSearchParams(filtersToQuery(filters));
  if (query.trim()) p.set('q', query.trim());
  const qs = p.toString();
  history.replaceState(null, '', `#/finder${qs ? `?${qs}` : ''}`);
  return qs;
}

export function App() {
  const route = useHashRoute();
  const online = useOnline();
  const [theme, toggleTheme] = useTheme();
  const catalog = useCatalog();

  const initial = parseHash(window.location.hash);
  const [filters, setFilters] = useState<Filters>(() => filtersFromQuery(initial.query));
  const [query, setQuery] = useState(() => new URLSearchParams(initial.query).get('q') ?? '');
  const lastFinderQs = useRef(window.location.hash.split('?')[1] ?? '');

  const validIds = useMemo(() => new Set(catalog.devices.map((d) => d.id)), [catalog.devices]);
  const [compareIds, setCompareIds] = useCompareSelection(validIds, DEFAULT_COMPARE);

  // Back/forward and typed URLs update the finder. Our own replaceState does not fire hashchange.
  useEffect(() => {
    const onHash = () => {
      const r = parseHash(window.location.hash);
      if (r.view === 'finder') {
        setFilters(filtersFromQuery(r.query));
        setQuery(new URLSearchParams(r.query).get('q') ?? '');
        lastFinderQs.current = r.query;
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const search = useMemo(() => createDeviceSearch(catalog.devices), [catalog.devices]);
  const results = useMemo(
    () => applyFilters(query.trim() ? search(query) : catalog.devices, filters),
    [search, query, catalog.devices, filters],
  );
  const facets = useMemo(() => buildFacets(catalog.devices), [catalog.devices]);
  const selected = route.id ? catalog.devices.find((d) => d.id === route.id) : undefined;

  useEffect(() => {
    document.title = selected ? `${selected.brand} ${selected.model} · AetherPhone` : 'AetherPhone · PhoneFinder';
  }, [selected]);

  const go = (path: string) => {
    window.location.hash = path;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };
  const navigate = (tab: Tab) => {
    if (tab === 'finder') {
      window.location.hash = `#/finder${lastFinderQs.current ? `?${lastFinderQs.current}` : ''}`;
    } else {
      go(tab);
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const updateFilters = (next: Filters) => {
    setFilters(next);
    lastFinderQs.current = writeFinderUrl(next, query);
  };
  const updateQuery = (q: string) => {
    setQuery(q);
    lastFinderQs.current = writeFinderUrl(filters, q);
  };

  const toggleCompare = (id: string) => {
    if (compareIds.includes(id)) setCompareIds(compareIds.filter((x) => x !== id));
    else if (compareIds.length < 4) setCompareIds([...compareIds, id]);
  };

  const nav: NavItem[] = [
    { id: 'finder', label: 'Finder', icon: 'finder', count: undefined },
    { id: 'compare', label: 'Compare', icon: 'compare', count: compareIds.length },
    { id: 'tools', label: 'Tools', icon: 'tools' },
  ];

  let page;
  if (route.view === 'device' && selected) {
    page = (
      <Detail
        device={selected}
        all={catalog.devices}
        inCompare={compareIds.includes(selected.id)}
        onBack={() => navigate('finder')}
        onToggleCompare={() => toggleCompare(selected.id)}
      />
    );
  } else if (route.view === 'compare') {
    page = <Compare devices={catalog.devices} selectedIds={compareIds} onChange={setCompareIds} onOpen={(id) => go(`device/${id}`)} />;
  } else if (route.view === 'tools') {
    page = <Tools devices={catalog.devices} />;
  } else {
    page = (
      <Finder
        results={results}
        total={catalog.devices.length}
        filters={filters}
        onFilters={updateFilters}
        query={query}
        onQuery={updateQuery}
        facets={facets}
        compareIds={compareIds}
        onToggleCompare={toggleCompare}
        onOpen={(id) => go(`device/${id}`)}
      />
    );
  }

  return (
    <Shell
      nav={nav}
      active={route.view === 'device' ? 'finder' : route.view}
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

