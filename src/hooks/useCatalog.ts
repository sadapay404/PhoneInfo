import { useCallback, useEffect, useState } from 'react';
import type { Device } from '../data/types';
import { loadSavedPhones, SAVED_CHANGED } from '../data/savedPhones';

const byName = (a: Device, b: Device) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model);

/**
 * The phones shown in the app are only the ones the user saved (imported ZIPs).
 * The sample catalog bundled with the code is not shown.
 */
export function useCatalog(): { devices: Device[]; refresh: () => void } {
  const [devices, setDevices] = useState<Device[]>([]);

  const reload = useCallback(() => {
    loadSavedPhones()
      .then((list) => setDevices([...list].sort(byName)))
      .catch(() => setDevices([]));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(SAVED_CHANGED, reload);
    return () => window.removeEventListener(SAVED_CHANGED, reload);
  }, [reload]);

  return { devices, refresh: reload };
}
