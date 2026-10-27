import { useEffect, useState } from 'react';

/* ---------- Routing: plain hash URLs, so every screen can be bookmarked ---------- */

export type Page = 'phones' | 'phone' | 'compare' | 'library' | 'tools';

export interface Route {
  page: Page;
  id: string | null;
  query: URLSearchParams;
}

const ROUTE_EVENT = 'aether:route';

export function parseRoute(hash: string): Route {
  const [path, qs = ''] = hash.replace(/^#\/?/, '').split('?');
  const [head = '', ...rest] = path.split('/');
  const query = new URLSearchParams(qs);
  if (head === 'phone' && rest[0]) return { page: 'phone', id: decodeURIComponent(rest[0]), query };
  if (head === 'compare' || head === 'library' || head === 'tools') return { page: head, id: null, query };
  return { page: 'phones', id: null, query };
}

/** How many in-app entries are behind the current screen (pushed by navigate, popped by back). */
export let historyDepth = 0;
/** True when the current screen was reached with the browser/Android back button. */
let arrivedByBack = false;
export function wasArrivedByBack(): boolean {
  return arrivedByBack;
}
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    historyDepth = Math.max(0, historyDepth - 1);
    arrivedByBack = true;
  });
}

/** Navigate. Uses replaceState so typing in a search box does not fill the back button. */
export function navigate(path: string, replace = false) {
  const url = `${window.location.pathname}${window.location.search}#/${path}`;
  arrivedByBack = false;
  if (replace) {
    window.history.replaceState(null, '', url);
  } else {
    window.location.hash = `/${path}`;
    historyDepth++;
  }
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', update);
    window.addEventListener(ROUTE_EVENT, update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener(ROUTE_EVENT, update);
    };
  }, []);
  return route;
}

/* ---------- Theme: soft colours by default, follows the system until you choose ---------- */

export type ThemeMode = 'system' | 'dark' | 'light';
const THEME_KEY = 'aetherphone.theme';

const LIGHT_QUERY = '(prefers-color-scheme: light)';

function systemPrefersLight(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_QUERY).matches;
}

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  return systemPrefersLight() ? 'light' : 'dark';
}

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  });

  useEffect(() => {
    const apply = () => {
      const t = resolveTheme(mode);
      document.documentElement.dataset.theme = t;
      document.documentElement.style.colorScheme = t;
    };
    apply();
    window.localStorage.setItem(THEME_KEY, mode);
    if (mode !== 'system' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(LIGHT_QUERY);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);

  return [mode, setMode];
}

/* ---------- Compare list: remembered on this device, up to four phones ---------- */

export const MAX_COMPARE = 4;
const COMPARE_KEY = 'aetherphone.compare';
const COMPARE_EVENT = 'aether:compare';

function readCompare(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(COMPARE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

export function useCompareIds(): [string[], (ids: string[]) => void] {
  const [ids, setIds] = useState<string[]>(readCompare);
  useEffect(() => {
    const sync = () => setIds(readCompare());
    window.addEventListener(COMPARE_EVENT, sync);
    return () => window.removeEventListener(COMPARE_EVENT, sync);
  }, []);
  const update = (next: string[]) => {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(next.slice(0, MAX_COMPARE)));
    window.dispatchEvent(new Event(COMPARE_EVENT));
  };
  return [ids, update];
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
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
