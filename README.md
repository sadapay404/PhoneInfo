# AetherPhone DB

An offline-first phone encyclopedia. It has a typed device schema, instant fuzzy search,
boxed spec sheets, a compare matrix with per-category winners, and a few analysis tools.
It works on any screen size: a sidebar on desktop, a bottom tab bar on phones.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # regenerates the catalog, type-checks, builds to dist/
npm run preview      # serve the production build (service worker enabled here)
npm test             # Vitest: estimators, compare logic, search, catalog pipeline, app smoke tests
```

To simulate a phone, use your browser's device mode. The layout adapts with no frame.

## Architecture

```
catalog/devices.json          source of truth (edit this)
        │  npm run catalog:build  (validates, chunks, compresses, hashes)
        ▼
public/catalog/manifest.json  version + per-chunk SHA-256 + counts
public/catalog/chunk-*.lz16   LZ-string (UTF-16) compressed, content-addressed chunks
        │
        ├── app (useCatalog → syncCatalog): verify, decode, write to IndexedDB (Dexie)
        └── service worker (Background Sync / Periodic Sync): prefetch chunks into cache
```

**Storage.** IndexedDB via Dexie holds the decompressed catalog. The app renders from it
immediately on every visit, then syncs in the background when online. On the very first
visit, before any sync, it uses the bundled copy in `catalog/devices.json`.

**Ingestion.** `syncCatalog()` compares the manifest version with the stored version.
If they differ, it downloads only the changed chunks, verifies each checksum, and
swaps the table in one transaction. A failed sync keeps the last good data and shows a banner.

**Background.** The service worker registers `sync` and `periodicsync` handlers for the
`catalog-sync` tag. Chromium runs these when connectivity returns, or periodically for
installed PWAs with permission. They prefetch the newest chunks into the cache, so a
later offline visit works even if the page never synced.

**Search.** Fuse.js runs in memory over the local catalog, so it is typo-tolerant and offline.

## Data provenance: read this

The seed entries were entered from memory of manufacturer spec sheets. **They are not
verified against primary sources yet.** Each entry has a `source_note` saying so. Uncertain
fields were left out, and the UI shows them as "unknown". Check values before relying on them.
No benchmark scores are bundled. Enter your own in the Price vs performance tool.

## Adding devices

1. Add an object to `catalog/devices.json` (keep `id` a lowercase slug).
2. Run `npm run catalog:build`. Validation errors stop the build with a clear message.
3. Commit `catalog/devices.json` and `public/catalog/`. Clients pick up the new version on their next sync.

## Still not built

- **Catalog scale.** Ten thousand devices needs a permitted, verified data source plus
  a review process. This repo has 4 devices. Scraping a third-party site should be
  checked against its terms first.
- **Benchmark radar** (Geekbench / AnTuTu / 3DMark against battery drain). Needs verified data.
- **Richer schema** for per-band SAR, exact 5G/4G band and CA lists, throttling curves, and
  iFixit/modularity scores. The type allows these fields, but no data is entered.
- **Image pipeline** (WebP compression of device photos).
- **Background Fetch** for large image downloads. Only the catalog data is prefetched so far.

## Layout

```
catalog/            devices.json (source of truth)
scripts/            build-catalog.mjs (validate + chunk + manifest)
public/             sw.js, manifest, icon, catalog/ (generated)
src/
  data/             types.ts, specs.ts (field registry), seed.ts, db.ts (Dexie), catalogSync.ts
  hooks/            useCatalog.ts (offline-first loading), useAppState.ts (routing, theme, compare)
  lib/              search.ts (Fuse), compare.ts (winners + weights), estimators.ts (tools)
  components/       Shell.tsx (responsive layout), Box.tsx, Icon.tsx
  views/            Catalog.tsx, Compare.tsx, Tools.tsx
  test/             setup.ts (fake IndexedDB, serves generated catalog to tests)
```
