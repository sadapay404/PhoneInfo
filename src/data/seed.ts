import type { Device } from './types';
import seed from '../../catalog/devices.json';

/**
 * Bundled copy of the catalog. Used only on a first visit before any sync has
 * succeeded. After that, IndexedDB is the source of truth.
 */
export const SEED_DEVICES = seed as unknown as Device[];
