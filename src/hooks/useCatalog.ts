import { useCallback, useEffect, useState } from 'react';
import type { Device } from '../data/types';
import { SEED_DEVICES } from '../data/seed';
import { loadLocalCatalog, readSyncTimes, syncCatalog } from '../data/catalogSync';
import { loadSavedPhones, SAVED_CHANGED } from '../data/savedPhones';

export type CatalogSource = 'seed' | 'local' | 'network';

export interface CatalogState {
  devices: Device[];
  source: CatalogSource;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
}

const byName = (a: Device, b: Device) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);

/** Catalog phones plus phones saved from the extension (saved wins on id clash). */
async function loadAll(): Promise<Device[]> {
  const [local, saved] = await Promise.all([loadLocalCatalog(), loadSavedPhones()]);
  const byId = new Map<string, Device>();
  for (const d of local) byId.set(d.id, d);
  for (const d of saved) byId.set(d.id, d);
  return [...byId.values()];
}

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
      const [all, times] = await Promise.all([loadAll(), readSyncTimes()]);
      setState((s) => ({
        ...s,
        devices: all.length ? all.sort(byName) : s.devices,
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

  /** Re-read IndexedDB without a network sync (used after saving phones from the extension). */
  const reloadLocal = useCallback(async () => {
    try {
      const [all, times] = await Promise.all([loadAll(), readSyncTimes()]);
      setState((s) => ({ ...s, devices: all.sort(byName), lastSync: times.lastSync }));
    } catch {
      // IndexedDB unavailable: keep what is on screen.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [all, times] = await Promise.all([loadAll(), readSyncTimes()]);
        if (!cancelled && all.length) {
          setState((s) => ({ ...s, devices: all.sort(byName), source: 'local', lastSync: times.lastSync }));
        }
      } catch {
        // IndexedDB unavailable (private mode, etc.): keep the bundled seed.
      }
      if (!cancelled) void runSync();
    })();
    const onOnline = () => void runSync();
    const onSaved = () => void reloadLocal();
    window.addEventListener('online', onOnline);
    window.addEventListener(SAVED_CHANGED, onSaved);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener(SAVED_CHANGED, onSaved);
    };
  }, [runSync, reloadLocal]);

  return { ...state, refresh: () => void runSync() };
}
