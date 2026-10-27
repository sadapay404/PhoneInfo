import JSZip from 'jszip';
import type { Device } from './types';
import { db, type SavedPhoto } from './db';

/** Fired on window after saved phones change, so the catalog hook can reload. */
export const SAVED_CHANGED = 'aether:saved-changed';

function notify() {
  window.dispatchEvent(new Event(SAVED_CHANGED));
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function loadSavedPhones(): Promise<Device[]> {
  return db.saved.toArray();
}

/** Accept only objects that look like our Device shape. Anything else is rejected, not guessed. */
export function parseSavedJson(text: string): Device[] {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Expected a JSON array of phones');
  return data.map((item) => {
    const d = item as Partial<Device>;
    if (!d || typeof d.id !== 'string' || typeof d.brand !== 'string' || typeof d.model !== 'string') {
      throw new Error('Some entries are missing id, brand or model');
    }
    return {
      status: 'released',
      year: 0,
      body: {},
      display: {},
      soc: {},
      camera: {},
      audio: {},
      connectivity: {},
      battery: {},
      software: {},
      repair: {},
      ...d,
    } as Device;
  });
}

/**
 * Import a file from the AetherPhone Saver extension: a .zip (phones + photos),
 * or a plain .json (phones only, from the older export). Returns how many phones were stored.
 */
export async function importSavedFile(file: File): Promise<number> {
  const isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip';
  if (!isZip) {
    const devices = parseSavedJson(await file.text());
    await db.saved.bulkPut(devices);
    notify();
    return devices.length;
  }

  const zip = await JSZip.loadAsync(file);
  const jsonEntry = zip.file('aetherphone-saved.json');
  if (!jsonEntry) throw new Error('This ZIP has no aetherphone-saved.json');
  const devices = parseSavedJson(await jsonEntry.async('string'));

  const photos: SavedPhoto[] = [];
  const cleaned: Device[] = [];
  for (const d of devices) {
    const { photos: refs, ...rest } = d as Device & { photos?: { kind: 'official' | 'review'; file: string; source?: string }[] };
    let image: string | undefined;
    let order = 0;
    for (const ref of refs ?? []) {
      const entry = zip.file(ref.file);
      if (!entry) continue;
      const ext = ref.file.split('.').pop()?.toLowerCase() ?? 'jpg';
      const b64 = await entry.async('base64');
      const dataUrl = `data:${MIME[ext] ?? 'image/jpeg'};base64,${b64}`;
      photos.push({ id: `${d.id}/${ref.file}`, deviceId: d.id, kind: ref.kind, order: order++, dataUrl, source: ref.source });
      if (!image && ref.kind === 'official') image = dataUrl;
    }
    if (!image && photos.some((p) => p.deviceId === d.id)) {
      image = photos.find((p) => p.deviceId === d.id)?.dataUrl;
    }
    cleaned.push({ ...rest, image });
  }

  await db.transaction('rw', db.saved, db.photos, async () => {
    await db.saved.bulkPut(cleaned);
    // Replace photos of re-imported phones so an updated export does not leave old files behind.
    for (const d of cleaned) await db.photos.where('deviceId').equals(d.id).delete();
    await db.photos.bulkPut(photos);
  });
  notify();
  return cleaned.length;
}

export async function deleteSavedPhone(id: string): Promise<void> {
  await db.transaction('rw', db.saved, db.photos, async () => {
    await db.saved.delete(id);
    await db.photos.where('deviceId').equals(id).delete();
  });
  notify();
}

export async function clearSavedPhones(): Promise<void> {
  await db.transaction('rw', db.saved, db.photos, async () => {
    await db.saved.clear();
    await db.photos.clear();
  });
  notify();
}

export async function loadPhotos(deviceId: string): Promise<SavedPhoto[]> {
  return db.photos.where('deviceId').equals(deviceId).sortBy('order');
}
