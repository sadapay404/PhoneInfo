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

export interface PriceEntry {
  id?: number;
  deviceId: string;
  ram_gb?: number;
  storage_gb?: number;
  price_pkr: number;
  shop?: string;
  /** Date you saw the price, YYYY-MM-DD. */
  observed_on: string;
  note?: string;
}

export class AetherDB extends Dexie {
  devices!: Table<Device, string>;
  meta!: Table<MetaRow, MetaRow['key']>;
  /** Phones saved by the browser extension. Kept apart from `devices`, which catalog sync replaces. */
  saved!: Table<Device, string>;
  /** Photos of saved phones as data URLs. id = `${deviceId}/${file}`. */
  photos!: Table<SavedPhoto, string>;
  /** Prices you enter by hand, per RAM and storage variant. Every entry is kept, so history is visible. */
  prices!: Table<PriceEntry, number>;

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
    this.version(4).stores({
      devices: 'id, brand, year',
      meta: 'key',
      saved: 'id, brand',
      photos: 'id, deviceId',
      prices: '++id, deviceId',
    });
  }
}

export const db = new AetherDB();
