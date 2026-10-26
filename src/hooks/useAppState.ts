import { useEffect, useState } from 'react';

export type Tab = 'finder' | 'compare' | 'tools';
export type View = Tab | 'device';
export type Theme = 'dark' | 'light';

export interface Route {
  view: View;
  id: string | null;
  query: string;
}

/** #/finder?x=y · #/device/<id> · #/compare · #/tools (legacy #/catalog maps to finder). */
export function parseHash(hash: string): Route {
  const [pathPart, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [head = 'finder', id = null] = pathPart.split('/');
  if (head === 'device' && id) return { view: 'device', id: decodeURIComponent(id), query };
  if (head === 'compare') return { view: 'compare', id: null, query };
  if (head === 'tools') return { view: 'tools', id: null, query };
  return { view: 'finder', id: null, query };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function useOnline(): boolean {
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

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('aetherphone.theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('aetherphone.theme', theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

const COMPARE_KEY = 'aetherphone.compare';
export const MAX_COMPARE = 4;

/** Compare selection persists across visits; ids that no longer exist are dropped. */
export function useCompareSelection(validIds: Set<string>, defaults: string[]): [string[], (ids: string[]) => void] {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? 'null') as string[] | null;
      if (Array.isArray(saved)) return saved;
    } catch {
      // corrupt storage: fall back to defaults
    }
    return defaults;
  });
  useEffect(() => {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
  }, [ids]);
  return [ids.filter((id) => validIds.has(id)).slice(0, MAX_COMPARE), setIds];
}
