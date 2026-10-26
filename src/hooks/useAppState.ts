import { useEffect, useState } from 'react';

export type Tab = 'catalog' | 'compare' | 'tools';
export type Theme = 'dark' | 'light';

export interface Route {
  tab: Tab;
  id: string | null;
}

export function parseHash(hash: string): Route {
  const [tab = 'catalog', id = null] = hash.replace(/^#\/?/, '').split('/');
  const safe: Tab = tab === 'compare' || tab === 'tools' ? tab : 'catalog';
  return { tab: safe, id: id ? decodeURIComponent(id) : null };
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

export function useCompareSelection(validIds: Set<string>, defaults: string[]): [string[], (ids: string[]) => void] {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? 'null') as string[] | null;
      if (Array.isArray(saved)) return saved;
    } catch {
      // ignore corrupt storage
    }
    return defaults;
  });
  useEffect(() => {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids));
  }, [ids]);
  // Drop ids that no longer exist in the catalog (e.g., after a catalog update).
  const cleaned = ids.filter((id) => validIds.has(id));
  return [cleaned, setIds];
}
