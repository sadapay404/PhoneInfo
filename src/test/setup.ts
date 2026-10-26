import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

// Serve the real generated catalog from public/ so tests exercise the actual sync path.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost/');
  if (url.origin === 'http://localhost' && url.pathname.startsWith('/catalog/')) {
    const file = join(PUBLIC_DIR, url.pathname);
    if (existsSync(file)) return new Response(readFileSync(file, 'utf8'), { status: 200 });
    return new Response('not found', { status: 404 });
  }
  return realFetch(input, init);
}) as typeof fetch;
