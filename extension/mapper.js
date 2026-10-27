/*
 * Turns the raw spec tables from extract.js into the app's Device shape.
 * Every field is optional. A value is set only when the page states it clearly;
 * anything else stays undefined and shows as "—" in the app.
 * GSMArena's "Price" is not stored as price_usd (it is not a reliable MSRP).
 */
(function (root) {
  const KNOWN_MULTI_WORD_BRANDS = ['Sony Ericsson', 'Garmin-Asus', 'Fujitsu Siemens', 'BenQ-Siemens'];

  /** First capture group of a regex, or undefined. */
  function first(text, re) {
    const m = re.exec(text || '');
    return m ? m[1] : undefined;
  }

  function num(s) {
    return s === undefined || s === null || s === '' ? undefined : Number(s);
  }

  /** Wired wattage from strings like "Wired, 65W, 50% in 18 min" or "65W wired". */
  function wiredWatts(text) {
    const m = /(\d+)\s*W\s*wired|wired,?\s*(\d+)\s*W/i.exec(text || '');
    return m ? Number(m[1] || m[2]) : undefined;
  }

  function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function brandAndModel(name) {
    const known = KNOWN_MULTI_WORD_BRANDS.find((b) => name.toLowerCase().startsWith(b.toLowerCase() + ' '));
    if (known) return { brand: known, model: name.slice(known.length + 1) };
    const i = name.indexOf(' ');
    return i > 0 ? { brand: name.slice(0, i), model: name.slice(i + 1) } : { brand: name, model: name };
  }

  function gsmId(url) {
    const m = /-(\d+)\.php/.exec(url || '');
    return m ? m[1] : null;
  }

  function toDevice(raw, opts = {}) {
    const cell = (c, label) => (raw.specs[c] || {})[label] || '';
    const cat = (c) => Object.values(raw.specs[c] || {}).join(' | ');
    const { brand, model } = brandAndModel(raw.name);
    const id = gsmId(raw.url) ? `saved-${gsmId(raw.url)}` : `saved-${slugify(brand + ' ' + model)}`;

    const launch = cat('Launch');
    const year = num(first(launch, /(19[89]\d|20\d\d)/));
    let status = 'announced';
    if (/discontinued/i.test(launch)) status = 'discontinued';
    else if (/available|released/i.test(launch)) status = 'released';

    const body = cat('Body');
    const dimsM = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*mm/.exec(cell('Body', 'Dimensions'));
    const ip = first(body, /IP\s?(\d{2}(?:X\d)?)/);

    const displayType = cell('Display', 'Type');
    const resM = /(\d+)\s*x\s*(\d+)\s*pixels/.exec(cell('Display', 'Resolution'));
    const nits = [...displayType.matchAll(/(\d+)\s*nits/g)].map((m) => Number(m[1]));
    const glass = cell('Display', 'Protection') || undefined;
    let panel;
    if (/OLED/i.test(displayType)) panel = 'OLED';
    else if (/LCD|IPS|TFT/i.test(displayType)) panel = 'LCD';

    const chipset = cell('Platform', 'Chipset').replace(/\s*\(\d+\s*nm\)\s*$/, '') || undefined;
    const memory = cat('Memory');
    const ramGb = num(first(memory, /(\d+)\s*GB\s*RAM/));
    // Storage in GB ("256GB", "1TB" -> 1024). Exact pairs such as "256GB 12GB RAM" are kept as variants.
    const toGb = (n, unit) => (/tb/i.test(unit) ? Number(n) * 1024 : Number(n));
    const storage = [...new Set([...memory.matchAll(/(\d+)\s*(GB|TB)(?!\s*RAM)/gi)].map((m) => toGb(m[1], m[2])))];
    const ramOptions = [...new Set([...memory.matchAll(/(\d+)\s*GB\s*RAM/gi)].map((m) => Number(m[1])))];
    const variants = [...memory.matchAll(/(\d+)\s*(GB|TB)\s+(\d+)\s*GB\s*RAM/gi)]
      .map((m) => ({ storage_gb: toGb(m[1], m[2]), ram_gb: Number(m[3]) }));
    const socBrand = /Snapdragon|Qualcomm/i.test(chipset) ? 'Snapdragon'
      : /Dimensity|MediaTek|Helio/i.test(chipset) ? 'Dimensity'
      : /Exynos/i.test(chipset) ? 'Exynos'
      : /Tensor/i.test(chipset) ? 'Tensor'
      : /Kirin/i.test(chipset) ? 'Kirin'
      : /Apple/i.test(chipset) || /^A\d+/.test(chipset) ? 'Apple'
      : undefined;

    // GSMArena packs every lens of a camera into one row, e.g.
    // "50 MP, f/1.8, 24mm (wide) ... 50 MP, f/2.8, 80mm (periscope telephoto) ...".
    // Split before each "NN MP" and classify each lens by its own text.
    const camera = {};
    for (const [label, value] of Object.entries(raw.specs['Main Camera'] || {})) {
      if (/^(features|video)$/i.test(label)) continue;
      const lenses = String(value).split(/(?=\b\d+(?:\.\d+)?\s*MP\b)/).map((x) => x.trim()).filter((x) => /MP\b/.test(x));
      for (const text of lenses) {
        const kind = /ultra/i.test(text) ? 'ultrawide' : /tele/i.test(text) ? 'telephoto' : 'main';
        if (camera[kind]) continue;
        const lens = {
          mp: num(first(text, /(\d+(?:\.\d+)?)\s*MP/)),
          aperture: first(text, /(f\/\d+(?:\.\d+)?)/),
          focal_mm: num(first(text, /(\d+(?:\.\d+)?)\s*mm/)),
        };
        if (kind === 'telephoto') lens.zoom_x = num(first(text, /(\d+(?:\.\d+)?)x\s*optical/i));
        if (/sensor[- ]shift/i.test(text)) lens.ois = 'sensor-shift';
        camera[kind] = Object.fromEntries(Object.entries(lens).filter(([, v]) => v !== undefined));
      }
    }
    const selfie = cat('Selfie camera');
    if (selfie) {
      camera.front = Object.fromEntries(
        Object.entries({
          mp: num(first(selfie, /(\d+(?:\.\d+)?)\s*MP/)),
          aperture: first(selfie, /(f\/\d+(?:\.\d+)?)/),
        }).filter(([, v]) => v !== undefined),
      );
    }

    const sound = cat('Sound');
    const features = cat('Features');
    const network = cat('Network');
    const battery = cat('Battery');
    const sarText = (label) => cell('Misc', label);
    const sar = (text, who) => num(first(text, new RegExp(`(\\d+(?:\\.\\d+)?)\\s*W/kg\\s*\\(${who}\\)`, 'i')));
    const charging = cell('Battery', 'Charging');
    const nfcValue = cell('Comms', 'NFC');

    const device = {
      id,
      brand,
      model,
      year: year ?? new Date().getFullYear(),
      status,
      body: {
        weight_g: num(first(cell('Body', 'Weight'), /(\d+(?:\.\d+)?)\s*g\b/)),
        dimensions_mm: dimsM ? [Number(dimsM[1]), Number(dimsM[2]), Number(dimsM[3])] : undefined,
        ip_rating: ip ? `IP${ip}` : undefined,
      },
      display: {
        type: displayType || undefined,
        size_in: num(first(cell('Display', 'Size'), /(\d+(?:\.\d+)?)\s*inches/)),
        resolution: resM ? [Number(resM[1]), Number(resM[2])] : undefined,
        ppi: num(first(cell('Display', 'Resolution'), /(\d+)\s*ppi/)),
        refresh_hz_max: num(first(displayType, /(\d+)\s*Hz/)),
        peak_nits: nits.length ? Math.max(...nits) : undefined,
        glass,
        panel_tech: panel,
      },
      soc: {
        brand: socBrand,
        chipset: chipset || undefined,
        process_nm: num(first(cell('Platform', 'Chipset'), /(\d+)\s*nm/)),
        cpu: cell('Platform', 'CPU') || undefined,
        gpu: cell('Platform', 'GPU') || undefined,
        ram_gb: ramGb,
        ram_options_gb: ramOptions.length ? ramOptions.sort((a, b) => a - b) : undefined,
        storage_gb: storage.length ? storage.sort((a, b) => a - b) : undefined,
        variants: variants.length ? variants : undefined,
      },
      camera,
      memory: { expandable: /microSD/i.test(memory) || undefined },
      audio: {
        stereo_speakers: /stereo/i.test(sound) || undefined,
        headphone_jack: /3\.5\s*mm/i.test(sound) ? true : undefined,
      },
      connectivity: {
        wifi: cell('Comms', 'WLAN') || undefined,
        bluetooth: cell('Comms', 'Bluetooth') || undefined,
        nfc: nfcValue ? /yes/i.test(nfcValue) : undefined,
        uwb: /UWB|ultra.?wide ?band/i.test(features) || undefined,
        ir_blaster: /infrared|IR blaster/i.test(features) || undefined,
        five_g: /\b5G\b/.test(network) || undefined,
      },
      battery: {
        capacity_mah: num(first(battery, /(\d{3,5})\s*mAh/)),
        // Keep the full name, e.g. "Si/C Li-Ion" (silicon-carbon anode), not just "Li-Ion".
        chemistry: first(battery, /((?:Si\/C|Si\/Gr|Silicon[- ]carbon)?\s*Li-?(?:Po|Ion)(?:\s*Polymer)?)/i)?.trim(),
        wired_w: wiredWatts(charging),
        wireless_w: num(first(charging, /(\d+)\s*W\s*wireless/i)),
        reverse_w: num(first(charging, /(\d+)\s*W\s*reverse/i)),
      },
      software: {
        launch_os: cell('Platform', 'OS') || undefined,
        os_family: /android/i.test(cell('Platform', 'OS')) ? 'Android' : /ios/i.test(cell('Platform', 'OS')) ? 'iOS' : undefined,
      },
      repair: {
        sar_head_eu_wkg: sar(sarText('SAR EU'), 'head'),
        sar_body_eu_wkg: sar(sarText('SAR EU'), 'body'),
        sar_head_us_wkg: sar(sarText('SAR'), 'head'),
        sar_body_us_wkg: sar(sarText('SAR'), 'body'),
      },
      source_url: raw.url,
      image: opts.imageDataUrl || undefined,
      gallery: opts.gallery || undefined,
      source_note: `Saved from GSMArena for personal offline use on ${(opts.savedOn || new Date().toISOString()).slice(0, 10)}`,
      raw_specs: raw.specs,
    };
    return device;
  }

  const api = { toDevice, brandAndModel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AetherMapper = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
