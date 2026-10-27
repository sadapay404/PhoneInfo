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

- **Phones** (`#/phones`): search, quick picks, filters (brand, year, screen, refresh, RAM,
  storage, battery, charging, camera, OS, must-have features) and sorting. Filters live in the
  URL, so a filtered view can be bookmarked.
- **Phone page** (`#/phone/<id>`): photos, key numbers, the full spec sheet, and PKR prices per
  RAM and storage variant (with a 30-day "check again" flag).
- **Compare** (`#/compare`): up to four phones, with a winner marked on each row and a
  differences-only filter.
- **Library** (`#/library`): add your AetherPhone ZIP (choose or drop). Phones, photos and PKR
  prices are kept on this device for offline use.
- **Tools** (`#/tools`): battery-life estimate and main camera sensor size.
- Light and dark themes with soft, low-glare colours (dark follows the system by default).

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
  ui/               Phones, PhonePage, ComparePage, LibraryPage, ToolsPage (2026 redesign)
```

## Save phones from GSMArena in your browser (no server)

The `extension/` folder is a Chrome/Edge extension. It runs entirely in your browser, with no
server and no data sent anywhere.

1. Open a phone page on gsmarena.com (any page with a spec table).
2. The phone is saved **automatically** when you open its page, if it is not saved yet. You can
   also click **Save to AetherPhone** (bottom right) to save or update it. The page's specs,
   every official photo (all angles and colours), and the review photos are copied into the
   extension. Only phone-specific images are kept. 3D: the four preview views are saved as links
   (they load online from Binkies 3D, the same as GSMArena's page), plus a link to the interactive
   viewer. The 3D models themselves are not downloaded. A phone you already saved is never
   overwritten by the automatic save. Turn automatic saving off in the extension's popup.
3. Click the extension icon, then **Export ZIP** to download `aetherphone-saved.zip`. Each
   phone gets its own folder named after the phone (for example `photos/OnePlus 15/`).
4. In the app, open **Library** and add the ZIP (or drop it anywhere in the app). All phones,
   photos and prices are saved on that device, and they appear in Phones and open offline.

Notes:
- Saved data stays on your device. Do not publish it or commit it to git.
- Browser storage is per site. Import in the same origin you run the app from (for
  example `localhost:3000`, not the Cloud Shell preview URL).
- Photos are downloaded through the extension's background worker (the page itself
  cannot fetch GSMArena's image host). Each phone can hold up to 80 photos.
- The field mapping is written against the GSMArena table layout. Check a saved phone's
  **Full spec sheet** against the source page once, and report any mismatch.

**3D viewer images (version 0.5.0).** On a GSMArena pictures page (the **Pictures** tab), open
the 3D view first and wait for it to load. Then click **AetherPhone · Save 3D images** (bottom
left). It saves the image files the viewer loaded: model textures, lightmaps and render previews.
The 3D model file itself is never saved. The files are exported in the ZIP under
`3d-images/<phone folder>/`. The app does not show them yet. The list comes from your browser's
own record of the viewer's requests, so nothing is guessed. Binkies 3D content is used under
the personal-use permission you have described; keep it for personal use only.

**PKR prices from PriceOye (version 0.6.0).** On a PriceOye phone page (`priceoye.pk/mobiles/brand/model`),
click **Save to AetherPhone** (bottom right, the same button and position as on GSMArena). It also
saves automatically once a day when you open a phone page, if automatic saving is on. The button
shows its progress as it works:

- If the phone is already saved from GSMArena (same brand and model), it saves the PKR price for
  every RAM/storage variant, plus facts GSMArena lacks (rating, review count, warranty, whether the
  phone is discontinued). No images are taken.
- If the phone is not saved yet, it saves the phone's own PriceOye photos (the product's
  photos only, not similar phones'), a device record with its RAM/storage variants, and the prices.
  Specs are not read from PriceOye, so the spec sheet stays empty for those phones.

The button clicks each RAM/storage option on the page to read its price, so the page may end up
showing the last option. It reads only what the page shows you, and it only runs when you click it.
Prices are exported in `aetherphone-prices.json` with the ZIP.

Written permission: you have said PriceOye gave you written permission for personal use. Keep
that email with your records. PriceOye's terms restrict collecting prices and using data
extraction tools, so the permission matters. This project does not give a legal opinion.
Check the page structure against a live page once: the variant and price detection is based on the
visible page text, which may change without notice.

Install: open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and
choose the `extension` folder. Run its tests with `for f in extension/test/*.mjs; do node --test "$f"; done` (run `npm ci` first, so `jsdom` is installed).

## Android APK (automatic build)

The Android app is the same web app wrapped with Capacitor (`capacitor.config.json`,
`android/`). `.github/workflows/android-apk.yml` builds a debug APK on GitHub Actions on every
push to an `arena/` branch or `main`, and on demand. Download it from the workflow run's
**Artifacts** list (`aetherphone-debug-apk`, kept 14 days).

Limits:
- The repository is public, and workflow artifacts can be downloaded by anyone with a GitHub
  account. The CI build therefore uses only the sample catalog in `catalog/devices.json`. Build
  the full catalog locally (for example in Cloud Shell) and keep that APK private.
- The APK is debug-signed. To install it, allow installs from unknown sources on the phone.
  A release build needs a signing key, which is not set up.

## Preview the app in Google Cloud Shell (before any APK build)

Run these in Cloud Shell (Google Cloud console → Activate Cloud Shell):

```bash
git clone https://github.com/sadapay404/PhoneInfo.git
cd PhoneInfo
git checkout arena/af213546-phoneinfo
npm ci
npm run dev
```

Then click **Web Preview → Preview on port 3000**. The app opens in a new tab. Use **Library** to add
your ZIP. The ZIP's data stays in that browser only.

To stop the preview, press Ctrl+C in the Cloud Shell terminal.

