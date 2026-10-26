import Fuse from 'fuse.js';
import type { Device } from '../data/types';

/**
 * In-memory fuzzy search. The Fuse index is built once per catalog and
 * queried locally, so it works fully offline.
 */
export function createDeviceSearch(devices: Device[]) {
  const fuse = new Fuse(devices, {
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    keys: [
      { name: 'brand', weight: 0.3 },
      { name: 'model', weight: 0.4 },
      { name: 'soc.chipset', weight: 0.2 },
      { name: 'software.launch_os', weight: 0.05 },
      { name: 'display.type', weight: 0.05 },
    ],
  });
  return (query: string): Device[] => {
    const q = query.trim();
    if (!q) return devices;
    return fuse.search(q).map((r) => r.item);
  };
}
