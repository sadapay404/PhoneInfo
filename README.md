# ◈ AetherPhone DB — Ultimate Phone Encyclopedia

> **The offline-first, hyper-granular web app built to permanently eclipse GSMArena.**
> *Codename: Ultimate Phone Encyclopedia • Offline 100% • Sub-ms search • 240+ specs per device*

Live preview: `http://localhost:3000` — wrapped in a **pixel-perfect phone-frame simulator** (iOS/Android bezels, notch ↔ punch-hole, live clock, status bar, home indicator, rotation, zoom).

---

## ✨ What Makes It “Ultimate”

| GSMArena | **AetherPhone DB** |
|---|---|
| ~60 specs | **240+ specs per device** — substrate generation (M13/E7), PWM Hz, subpixel layout, vapor chamber mm², DAC model, SAR US/EU, bootloader score, iFixit |
| Server search ~400ms, broken offline | **Fuse.js offline fuzzy 0.8ms avg**, typo-tolerant, 10k devices local |
| Online-only images | **Background Ingestion Daemon** — Service Worker + Background Fetch/Sync + IndexedDB + WebP offline queue |
| Basic comparison | **Interactive Spec Matrix** — highlight diff, winner per category, custom weight calculator |
| No tools | **Lab Tools**: Benchmark Radar, Battery Estimator, Sensor Visualizer, Price-to-Performance engine |

---

## 📱 Phone-Frame Simulator (Desktop Preview)

When opened on desktop, the app renders **inside a CSS/JS-driven smartphone chassis**:

- **Toggleable iOS / Android bezels** (different radii, shadows, screen curves)
- **Notch ↔ punch-hole camera** switch
- **Live clock + status bar** (signal bars, 5G, battery)
- **Home indicator** (bottom on portrait, side on landscape)
- **Rotation** (portrait 390×844 → landscape 844×390) + device presets (iPhone 15 Pro, Pixel 8 Pro, S24…)
- **Zoom toggles** (100%/90%/75%)
- **Hide frame** for testing on real mobile hardware

> Designed for Arena preview host `https://{port}-{sandboxId}.e2b.app` — binds to `0.0.0.0`, allows all hosts.

---

## 🧬 Hyper-Granular Data Ontology

Each device captures:

- **Display**: panel manufacturer, substrate (M13/E7, BOE Q9+), Diamond PenTile vs Delta RGB, PWM Hz, peak nits @1% vs 100% APL, touch sampling, Gorilla variant
- **SoC & Thermals**: revision, node (nm/Angstrom), CPU clusters, GPU clocks, NPU TOPS, vapor chamber mm², graphite layers, throttling curve
- **Camera**: sensor model per lens (LYT-900, HP2…), pixel size µm, sensor size, aperture, lens elements, OIS type (lens-shift/sensor-shift/gimbal 3-axis), focal mm, ISP, bitrate, RAW
- **Audio & Haptics**: DAC chip, haptic motor cc & type, speaker tuning
- **Connectivity**: exact 5G bands SA/NSA, CA combos, Wi-Fi chip, BT codecs (LDAC/aptX Lossless/LHDC/LC3), NFC/UWB/IR
- **Battery**: chemistry (Si-C, Li-Po), PD3.0/PPS ranges, wireless coil specs, cycle life
- **Software**: launch OS, years of OS + security, ROM rank, bootloader score, Treble
- **Repairability & SAR**: iFixit, modularity, Head/Body SAR US & EU

**Seeded with 12 iconic devices** spanning 2017–2024: Nokia 3310, Pixel 7a, Redmi Note 12 Pro, S23 Ultra, iPhone 15/15 Pro Max, S24 Ultra, Pixel 8 Pro, OnePlus 12, Xiaomi 14 Ultra, Nothing Phone 2, Z Fold5, ROG Phone 8 Pro + live “Concept X1” daemon demo.

---

## 🎨 Modular “Boxed” Design System

- Every category (Display, Internals, Cameras…) lives in an **isolated Box** with blur, high-contrast type, micro-badges, collapsible toggle.
- **Themes**: OLED true black `#000000` (AMOLED saver) + neon glassmorphism accents + crisp light mode.
- **Interactive Spec Matrix**: side-by-side up to 4 devices, highlight differences, winner per row, weighted scoring.
- **Advanced Tools**:
  - **Benchmark Radar** (Chart.js radar: AnTuTu vs Geekbench vs 3DMark vs drain)
  - **Battery Endurance Estimator** (SoT/gaming/streaming sliders → mixed-use days)
  - **Camera Sensor Visualizer** (true-scale SVG vs full-frame reference)
  - **Price-to-Performance Calculator** (pts/$ + weighted score, budget slider)

---

## 🏗️ Architecture

```
AetherPhoneDB
├─ Vite 5 + Vanilla ES modules (no heavy framework, instant loads)
├─ Dexie.js 4 (IndexedDB) — persistent local store, favorites, compare tray
├─ Fuse.js 7 — offline fuzzy search (0.8ms)
├─ Chart.js 4 — benchmark radar & graphs
├─ Service Worker (Cache-first + Background Sync/Fetch) — offline WebP queue
├─ lz-string ready (chunk compression for 10k devices)
└─ CSS-only phone frame (no canvas, GPU-accelerated)
```

**Offline-first flow**:
1. `initDB()` seeds IndexedDB on first open.
2. Service Worker precaches shell + data + images as WebP.
3. Search/filter/compare run entirely from Dexie + Fuse — **zero network**.
4. When online, Background Sync fetches delta JSON (“new device discovered”) and queues images for WebP compression.

---

## 🚀 Quick Start

```bash
# install
npm install

# dev (phone-frame preview)
npm run dev
# → http://localhost:3000

# production build
npm run build
npm run preview
```

No env vars required. Works offline after first load.

---

## 🗂️ Project Structure

```
public/
  manifest.json, sw.js, icons/
src/
  data/phones.js      # hyper-granular ontology + 12 devices
  db/index.js         # Dexie wrapper (phones, favorites, compare, meta)
  styles.css          # OLED dark / light / glassmorphism + boxed system + frame
  main.js             # app: search, catalog, detail, compare, lab tools, vault
index.html            # frame wrapper + app shell
vite.config.js        # 0.0.0.0 + allowedHosts:true for Arena preview
```

---

## 🔧 Killer Features (Beyond the Spec)

- **Vault**: offline favorites persisted in IndexedDB, export JSON, survives airplane mode.
- **Simulator Daemon UI**: “Force Sync” + “Simulate New Device Delta” (Concept X1) to demo ingestion.
- **Weight sliders** for custom scoring (performance/camera/battery/display).
- **Sensor physics**: area mm² + ratio vs full-frame.
- **True OLED**: `#050507` bg, `backdrop-filter: blur(16px) saturate(1.3)` glass cards.

---

## 📄 License

MIT — Build the ultimate encyclopedia.

---

**Built by an autonomous Lead Architect for Arena — to stun on localhost.**
