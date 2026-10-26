import Dexie, { type Table } from 'dexie';
import type { Device } from './types';

export interface MetaRow {
  key: 'catalogVersion' | 'lastSync' | 'lastCheck';
  value: string | number;
}

/** Local persistent store. Devices are kept decompressed for fast indexed reads. */
export class AetherDB extends Dexie {
  devices!: Table<Device, string>;
  meta!: Table<MetaRow, MetaRow['key']>;

  constructor(name = 'aetherphone') {
    super(name);
    this.version(1).stores({
      devices: 'id, brand, year',
      meta: 'key',
    });
  }
}

export const db = new AetherDB();
