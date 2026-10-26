import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import LZ from 'lz-string';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CATALOG_DIR = join(ROOT, 'public', 'catalog');

describe('generated catalog pipeline', () => {
  const manifest = JSON.parse(readFileSync(join(CATALOG_DIR, 'manifest.json'), 'utf8'));
  const source = JSON.parse(readFileSync(join(ROOT, 'catalog', 'devices.json'), 'utf8'));

  it('is up to date with catalog/devices.json (run npm run catalog:build)', () => {
    expect(manifest.deviceCount).toBe(source.length);
  });

  it('every chunk matches its checksum and count', () => {
    for (const chunk of manifest.chunks) {
      const text = readFileSync(join(CATALOG_DIR, chunk.file), 'utf8');
      expect(createHash('sha256').update(text, 'utf8').digest('hex')).toBe(chunk.sha256);
      const devices = JSON.parse(LZ.decompressFromUTF16(text) as string);
      expect(devices).toHaveLength(chunk.count);
    }
  });

  it('contains exactly the source devices, with no duplicates', () => {
    const ids = manifest.chunks.flatMap((c: { file: string }) =>
      (JSON.parse(LZ.decompressFromUTF16(readFileSync(join(CATALOG_DIR, c.file), 'utf8')) as string) as { id: string }[]).map((d) => d.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(source.map((d: { id: string }) => d.id).sort());
  });

  it('does not leave chunks from superseded versions behind', () => {
    const files = readdirSync(CATALOG_DIR).filter((f) => f.endsWith('.lz16'));
    expect(files.sort()).toEqual(manifest.chunks.map((c: { file: string }) => c.file).sort());
  });
});
