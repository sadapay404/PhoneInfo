import LZ from 'lz-string';
import type { Device } from './types';
import { db } from './db';

const BASE = import.meta.env.BASE_URL;

export interface Manifest {
  schemaVersion: number;
  version: string;
  generatedAt: string;
  deviceCount: number;
  chunks: { file: string; sha256: string; count: number }[];
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Decode one chunk body, verifying its checksum when Web Crypto is available. */
export async function decodeChunk(text: string, expectedSha: string, expectedCount: number): Promise<Device[]> {
  if (globalThis.crypto?.subtle && (await sha256Hex(text)) !== expectedSha) {
    throw new Error('Checksum mismatch in catalog chunk');
  }
  const devices = JSON.parse(LZ.decompressFromUTF16(text) ?? 'null') as Device[] | null;
  if (!Array.isArray(devices) || devices.length !== expectedCount) {
    throw new Error('Catalog chunk is corrupt');
  }
  return devices;
}

/**
 * Pull the manifest and, if its version differs from what we hold, download
 * every chunk, verify it, and swap the local table in one transaction.
 * Returns whether local data changed.
 */
export async function syncCatalog(): Promise<'updated' | 'current'> {
  const res = await fetch(`${BASE}catalog/manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Manifest request failed (${res.status})`);
  const manifest = (await res.json()) as Manifest;
  if (manifest.schemaVersion !== 1) throw new Error(`Unsupported catalog schema ${manifest.schemaVersion}`);

  const current = await db.meta.get('catalogVersion');
  if (current?.value === manifest.version) {
    await db.meta.put({ key: 'lastCheck', value: Date.now() });
    return 'current';
  }

  const devices: Device[] = [];
  for (const chunk of manifest.chunks) {
    // Chunk names embed their content hash, so they are safe to cache aggressively.
    const r = await fetch(`${BASE}catalog/${chunk.file}`, { cache: 'force-cache' });
    if (!r.ok) throw new Error(`Chunk ${chunk.file} failed (${r.status})`);
    devices.push(...(await decodeChunk(await r.text(), chunk.sha256, chunk.count)));
  }

  await db.transaction('rw', db.devices, db.meta, async () => {
    await db.devices.clear();
    await db.devices.bulkPut(devices);
    await db.meta.bulkPut([
      { key: 'catalogVersion', value: manifest.version },
      { key: 'lastSync', value: Date.now() },
      { key: 'lastCheck', value: Date.now() },
    ]);
  });
  return 'updated';
}

export async function loadLocalCatalog(): Promise<Device[]> {
  return db.devices.toArray();
}

export async function readSyncTimes(): Promise<{ lastSync: number | null }> {
  const row = await db.meta.get('lastSync');
  return { lastSync: typeof row?.value === 'number' ? row.value : null };
}
