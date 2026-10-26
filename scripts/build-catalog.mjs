#!/usr/bin/env node
// Validates catalog/devices.json and emits compressed, content-addressed chunks
// plus a manifest into public/catalog/. The app syncs these files; the service
// worker prefetches them in the background.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import LZ from 'lz-string';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Default: the curated seed. Set CATALOG_SOURCE=data/export/devices.json for the full archive.
const SOURCE = process.env.CATALOG_SOURCE ? join(ROOT, process.env.CATALOG_SOURCE) : join(ROOT, 'catalog', 'devices.json');
const OUT = join(ROOT, 'public', 'catalog');
const CHUNK_SIZE = 50;
const SCHEMA_VERSION = 1;

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

function validate(devices) {
  const errors = [];
  const seen = new Set();
  devices.forEach((d, i) => {
    const where = `devices[${i}] (${d.id ?? 'no id'})`;
    if (!d.id || !/^[a-z0-9-]+$/.test(d.id)) errors.push(`${where}: id must be lowercase slug`);
    if (seen.has(d.id)) errors.push(`${where}: duplicate id`);
    seen.add(d.id);
    if (!d.brand || !d.model) errors.push(`${where}: brand and model are required`);
    if (!Number.isInteger(d.year) || d.year < 1990 || d.year > 2100) errors.push(`${where}: year out of range`);
    const mah = d.battery?.capacity_mah;
    if (mah !== undefined && (mah < 100 || mah > 30000)) errors.push(`${where}: battery capacity_mah out of range`);
    const hz = d.display?.refresh_hz_max;
    if (hz !== undefined && (hz < 1 || hz > 480)) errors.push(`${where}: refresh_hz_max out of range`);
    const price = d.price_usd;
    if (price !== undefined && (price <= 0 || price > 20000)) errors.push(`${where}: price_usd out of range`);
  });
  return errors;
}

const devices = JSON.parse(readFileSync(SOURCE, 'utf8'));
const errors = validate(devices);
if (errors.length) {
  console.error(`Catalog validation failed:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

// Sort by id so identical content always produces identical bytes and hashes.
devices.sort((a, b) => a.id.localeCompare(b.id));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Photos exported by the archiver sit next to the devices file (data/export/img/).
const IMG_SRC = join(dirname(SOURCE), 'img');
if (existsSync(IMG_SRC)) cpSync(IMG_SRC, join(OUT, 'img'), { recursive: true });

const chunks = [];
for (let i = 0; i * CHUNK_SIZE < devices.length; i++) {
  const part = devices.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  const text = LZ.compressToUTF16(JSON.stringify(part));
  const digest = sha256(text);
  const file = `chunk-${String(i).padStart(3, '0')}-${digest.slice(0, 12)}.lz16`;
  writeFileSync(join(OUT, file), text, 'utf8');
  chunks.push({ file, sha256: digest, count: part.length });
}

// Version = hash of chunk digests, so it changes only when content changes.
const version = sha256(chunks.map((c) => c.sha256).join('|')).slice(0, 16);
const manifest = {
  schemaVersion: SCHEMA_VERSION,
  version,
  generatedAt: new Date().toISOString(),
  deviceCount: devices.length,
  chunks,
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`catalog ${version}: ${devices.length} devices in ${chunks.length} chunk(s) from ${SOURCE.replace(ROOT + '/', '')}`);
