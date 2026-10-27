import Dexie, { type Table } from 'dexie';
import type { Device } from './types';

export interface MetaRow {
  key: 'catalogVersion' | 'lastSync' | 'lastCheck';
  value: string | number;
}

/** Local persistent store. Devices are kept decompressed for fast indexed reads. */
export interface SavedPhoto {
  id: string;
  deviceId: string;
  kind: 'official' | 'review';
  order: number;
  dataUrl: string;
  source?: string;
}

export class AetherDB extends Dexie {
  devices!: Table<Device, string>;
  meta!: Table<MetaRow, MetaRow['key']>;
  /** Phones saved by the browser extension. Kept apart from `devices`, which catalog sync replaces. */
  saved!: Table<Device, string>;
  /** Photos of saved phones as data URLs. id = `${deviceId}/${file}`. */
  photos!: Table<SavedPhoto, string>;

  constructor(name = 'aetherphone') {
    super(name);
    this.version(1).stores({
      devices: 'id, brand, year',
      meta: 'key',
    });
    this.version(2).stores({
      devices: 'id, brand, year',
      meta: 'key',
      saved: 'id, brand',
    });
    this.version(3).stores({
      devices: 'id, brand, year',
      meta: 'key',
      saved: 'id, brand',
      photos: 'id, deviceId',
    });
  }
}

export const db = new AetherDB();
