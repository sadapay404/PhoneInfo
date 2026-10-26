# AetherPhone DB

An offline-first phone encyclopedia: a typed, granular device schema, fuzzy local search,
boxed spec cards, a compare matrix with per-category winners, and a few analysis tools.
It runs as a static site with a service worker, so the app keeps working without a network.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000  (desktop shows the phone-frame simulator)
npm test           # unit + smoke tests (Vitest)
npm run build      # type-check + production build to dist/
```

Open the dev server in a desktop browser and you get the phone-frame wrapper:
iOS/Android bezel, notch or punch-hole, live status-bar clock, home indicator,
rotate, zoom, screen-size presets, and "Hide frame". On a real phone, or any narrow
window (<720px) or touch-only device, the frame is skipped and the app runs full-screen.
Append `?frameless` to the URL to skip it on desktop.

## What is built

| Area | Status |
| --- | --- |
| Phone-frame simulator (iOS/Android, notch/punch-hole, clock, rotate, zoom, sizes, hide) | Done |
| Device ontology (`src/data/types.ts`): display, SoC, cameras, audio, connectivity, battery, software, body/SAR | Done, many fields optional |
| Field registry (`src/data/specs.ts`) driving detail cards, compare, and winner logic | Done |
| Fuzzy search (Fuse.js, typo tolerant, fully local) | Done |
| Boxed, collapsible category cards with missing-field badges and "Leads X" badges | Done |
| Compare matrix: highlight differences, only-differences filter, winner per category, weighted overall score | Done (up to 4 devices) |
| Battery endurance estimator (`src/lib/estimators.ts`) | Done (transparent model, not lab data) |
| Camera sensor size visualizer (SVG, drawn to a shared scale) | Done (approximate geometry) |
| Price-to-performance calculator | Done (user-supplied benchmark scores) |
| Dark OLED (#000) and light themes, neon glass accents | Done |
| Offline: service worker caches the app shell and assets; online/offline indicator | Done |
| Catalog size | 4 seed devices |

## Data provenance: read this

The seed entries in `src/data/devices.ts` were entered from memory of manufacturer
spec sheets. **They have not been checked against primary sources yet.** Each device
carries a `source_note` saying so. Fields that were uncertain were left out on purpose,
and the UI shows "—" for them. Verify values before you rely on them.

No benchmark scores are bundled. The Value tool asks you to enter scores from a source you trust.

## Not built yet (honest roadmap)

The original brief describes a much larger system. These parts are deliberately not
done yet, for the reasons given:

1. **Catalog scale (10,000+ devices).** Needs a data pipeline with a licensed or
   permitted source, plus a validation step. Scraping a site like GSMArena should be
   checked against its terms first.
2. **Background ingestion daemon** (Background Sync / Background Fetch for new releases
   and image assets). The browser APIs need a real backend feed to be useful.
3. **Storage layer.** The catalog is bundled as TypeScript for now. For a larger catalog,
   move to IndexedDB (Dexie) or wa-sqlite, with lz-string chunks for the bulk payload.
4. **Benchmark radar (Geekbench / AnTuTu / 3DMark vs. battery drain).** Needs verified
   benchmark data first.
5. **Richer schema** for SAR per-band values, exact 5G/4G band and CA lists, thermal
   throttling curves, and iFixit/modularity data. The type shape allows these; the data isn't entered.
6. **Image assets and WebP compression pipeline.**

## Layout

```
src/
  data/       types.ts (ontology), specs.ts (field registry), devices.ts (seed catalog)
  lib/        search.ts (Fuse), compare.ts (winners + weights), estimators.ts (tools) + tests
  components/ PhoneFrame.tsx (device simulator), Box.tsx (collapsible card)
  views/      Catalog.tsx, Compare.tsx, Tools.tsx
  App.tsx     shell, hash routing (#/catalog/<id>, #/compare, #/tools), theme, offline state
public/       sw.js (offline service worker), manifest, icon
```
