import { useCallback, useEffect, useState } from 'react';
import type { Device } from '../data/types';
import { SEED_DEVICES } from '../data/seed';
import { loadLocalCatalog, readSyncTimes, syncCatalog } from '../data/catalogSync';

export type CatalogSource = 'seed' | 'local' | 'network';

export interface CatalogState {
  devices: Device[];
  source: CatalogSource;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
}

const byName = (a: Device, b: Device) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);

/**
 * Offline-first catalog: render immediately from IndexedDB (or the bundled seed
 * on first visit), then sync in the background whenever we are online.
 */
export function useCatalog(): CatalogState & { refresh: () => void } {
  const [state, setState] = useState<CatalogState>({
    devices: [...SEED_DEVICES].sort(byName),
    source: 'seed',
    syncing: false,
    lastSync: null,
    error: null,
  });

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setState((s) => ({ ...s, syncing: true }));
    try {
      const result = await syncCatalog();
      const [local, times] = await Promise.all([loadLocalCatalog(), readSyncTimes()]);
      setState((s) => ({
        ...s,
        devices: local.length ? local.sort(byName) : s.devices,
        source: result === 'updated' || s.source !== 'seed' ? 'network' : s.source,
        lastSync: times.lastSync,
        error: null,
      }));
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Sync failed' }));
    } finally {
      setState((s) => ({ ...s, syncing: false }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [local, times] = await Promise.all([loadLocalCatalog(), readSyncTimes()]);
        if (!cancelled && local.length) {
          setState((s) => ({ ...s, devices: local.sort(byName), source: 'local', lastSync: times.lastSync }));
        }
      } catch {
        // IndexedDB unavailable (private mode, etc.): keep the bundled seed.
      }
      if (!cancelled) void runSync();
    })();
    const onOnline = () => void runSync();
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
  }, [runSync]);

  return { ...state, refresh: () => void runSync() };
}
