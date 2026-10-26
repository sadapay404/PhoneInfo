# AetherPhone

A phone finder with a database of specs and photos. Filter by hundreds of attributes,
compare up to four phones, and browse the full spec sheet. Everything runs offline once
the catalog has synced.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 (regenerates the catalog first)
npm test             # filter engine, estimators, catalog pipeline, UI smoke tests
npm run build        # regenerates the catalog, type-checks, builds to dist/
npm run preview      # serve the production build (service worker enabled here)
```

On a phone, or in your browser's device mode, the layout switches to a bottom tab bar and
a filter sheet. There is no phone frame.

## What you get

- **PhoneFinder** (`#/finder`): search (typo-tolerant), 20+ filter groups, quick presets
  ("Marathon battery", "Camera flagships", "One-hand size"…), sorting, and active-filter chips.
  Filters live in the URL, so a filtered view can be bookmarked or shared.
- **Phone pages** (`#/device/<id>`): photo, headline numbers, and every known spec in
  categorized cards. Unknown fields are shown as unknown, never guessed.
- **Compare** (`#/compare`): up to four phones, with a per-row winner, a "differences only"
  filter, and adjustable category weights for the overall score.
- **Tools**: battery endurance estimate, camera sensor size, and value per dollar.

## Architecture

```
catalog/devices.json           hand-curated seed (4 devices, unverified: see notes)
scraper/                       personal archive builder (GSMArena) → data/export/devices.json + photos
        │  npm run catalog:build[:full]   validates, chunks, compresses, hashes
        ▼
public/catalog/manifest.json   version + per-chunk SHA-256
public/catalog/chunk-*.lz16    compressed, content-addressed device chunks
public/catalog/img/*.webp      phone photos (generated; git-ignored)
        │
        ├── app: syncs on every online open into IndexedDB (Dexie); works offline after that
        └── service worker: Background Sync / Periodic Sync prefetch new chunks
```

- **Filtering** (`src/lib/finder.ts`) is a pure function over devices, fully unit-tested.
  Unknown values fail a filter the user actually set (strict matching), so results never
  quietly include phones that don't match.
- **Search** uses Fuse.js in memory.
- **Images** load lazily from the catalog folder. Phones without a photo get a neutral
  brand-tinted placeholder.

## Data sources: what is allowed

Only sources whose terms allow this use are crawled. Checked on each site's own terms
pages, not from memory.

| Source | Status | Why |
| --- | --- | --- |
| GSMArena | Used for **personal** archive | Terms allow personal, non-commercial copies of documents and graphics. Not for redistribution. |
| PhoneDB | **Licensed import only** | Sells database licenses through its contact form. Its free search is limited. Not crawled. |
| NanoReview | **Not yet** | No terms page found (404). Ask before crawling. |
| GizmoChina | **Excluded** | Terms prohibit copying, storing in a database, or archiving content. |
| Manufacturer spec pages | Possible | Read individual pages, cite each value's source URL. |

For more sources, the route is licenses or permission, not crawling. The importer
(`python scraper/crawl.py import --source licensed-phonedb --file dump.json`) merges any
licensed dump with per-field priority. GSMArena wins conflicts, and a licensed source fills
the gaps. Every field records its source.

## Personal use only

The archive, its photos, and anything built from them are for your own offline use.
Keep them out of git and out of any public deployment. `data/` and `public/catalog/` are
git-ignored for this reason. To publish or share, you need permission from the source sites.

## Data notes

- The seed entries in `catalog/devices.json` were entered from memory and are not verified.
- GSMArena's listed "Price" is not a reliable MSRP, so it is not used for price filters.
  A price filter needs a licensed price source.
- No benchmark scores are bundled. Enter your own in the value tool.

## Layout

```
catalog/            seed devices (hand-curated)
scraper/            archive builder, parser, merge + import, tests
scripts/            build-catalog.mjs (validate, chunk, copy photos)
public/             sw.js, manifest, icon (catalog/ is generated)
src/
  lib/              finder.ts (filters, sort, URL state, presets), search.ts, compare.ts, estimators.ts
  data/             types.ts, specs.ts (field registry), seed.ts, db.ts (Dexie), catalogSync.ts
  hooks/            useCatalog (offline-first loading), useAppState (routing, theme, compare)
  components/       Shell, FilterPanel, DeviceImage, Box, Icon
  views/            Finder, Detail, Compare, Tools
```

## Save phones from GSMArena in your browser (no server)

The `extension/` folder is a Chrome/Edge extension. It runs entirely in your browser, with no
server and no data sent anywhere.

1. Open a phone page on gsmarena.com (any page with a spec table).
2. Click **Save to AetherPhone** (bottom right). The page is read, its photo is copied in,
   and the phone is stored in the extension.
3. Click the extension icon, then **Export JSON** to download `aetherphone-saved.json`.
4. In the app, open **Tools → Saved phones** and **Import JSON**. Saved phones appear in
   PhoneFinder and work offline on that device.

Notes:
- Saved data stays on your device. Do not publish it or commit it to git.
- Browser storage is per site. Import in the same origin you run the app from (for
  example `localhost:3000`, not the Cloud Shell preview URL).
- The field mapping is written against the GSMArena table layout. Check a saved phone's
  **Full spec sheet** against the source page once, and report any mismatch.

Install: open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and
choose the `extension` folder. Run its tests with `node --test extension/test/extension.check.mjs`.
