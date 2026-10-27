/* PriceOye extractor logic. Plain browser script, pure functions only: no page access,
 * no network, no storage. Shared by priceoye-extract.js and the tests.
 * Works from the page title, the URL, visible price text, and image file names, so it does
 * not depend on CSS class names that PriceOye may change. */
(function (root) {
  const api = {};

  api.alnum = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

  /** "VGO-TEL NEW 10 Price in Pakistan 2026 | Priceoye" -> "VGO-TEL NEW 10" */
  api.nameFromTitle = (title) => {
    const t = String(title || '').replace(/\s+/g, ' ').trim();
    const m = /^(.+?)\s+Price in Pakistan/i.exec(t);
    return (m ? m[1] : t.split('|')[0]).trim();
  };

  /** "/mobiles/vgo-tel/vgo-tel-new-10" -> { brandSlug, slug }. Anything else is not a phone page. */
  api.productFromPath = (pathname) => {
    const parts = String(pathname || '').split('/').filter(Boolean);
    if (parts.length !== 3 || parts[0] !== 'mobiles') return null;
    if (parts[1] === 'compare' || parts[1] === 'pricelist') return null;
    return { brandSlug: parts[1], slug: parts[2] };
  };

  /** Splits "VGO-TEL NEW 10" into brand "VGO-TEL" and model "NEW 10", using the URL brand slug. */
  api.splitBrand = (name, brandSlug) => {
    const words = String(name).split(/\s+/).filter(Boolean);
    const target = api.alnum(brandSlug);
    let acc = '';
    for (let i = 0; i < words.length; i++) {
      acc += api.alnum(words[i]);
      if (acc === target) {
        return { brand: words.slice(0, i + 1).join(' '), model: words.slice(i + 1).join(' ') };
      }
      if (acc.length >= target.length) break;
    }
    const brand = brandSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { brand, model: words.join(' ') };
  };

  /** True when a saved phone is the same device as the PriceOye one (brand and model, ignoring spacing and case). */
  api.isSamePhone = (saved, po) => {
    if (!saved || !po) return false;
    return api.alnum(saved.model) === api.alnum(po.model) && api.alnum(saved.brand) === api.alnum(po.brand) && api.alnum(po.model) !== '';
  };

  api.findSaved = (phones, po) => (phones || []).find((p) => api.isSamePhone(p, po)) || null;

  /** Parses "Rs12,349" (first amount in the text). Returns a whole number of rupees or null. */
  api.parsePriceText = (text) => {
    const m = /Rs\.?\s*(\d[\d,]*)/i.exec(String(text || ''));
    if (!m) return null;
    const n = Number(m[1].replace(/,/g, ''));
    return n >= 1 && n <= 100000000 ? n : null;
  };

  const toGb = (n, unit) => (/tb/i.test(unit) ? Number(n) * 1024 : Number(n));

  /** "32GB - 2GB RAM" -> { storage_gb: 32, ram_gb: 2 }; "1TB" -> { storage_gb: 1024 }. */
  api.parseVariant = (label) => {
    const s = String(label || '').replace(/\s+/g, ' ').trim();
    let m = /^(\d+)\s*(GB|TB)\s*[-–|/]\s*(\d+)\s*GB\s*RAM$/i.exec(s);
    if (m) return { storage_gb: toGb(m[1], m[2]), ram_gb: Number(m[3]) };
    m = /^(\d+)\s*(GB|TB)$/i.exec(s);
    if (m) return { storage_gb: toGb(m[1], m[2]) };
    return null;
  };

  /** Pulls rating, review count and status words from the visible page text. */
  api.parseExtras = (text) => {
    const t = String(text || '');
    const out = {};
    const r = /(\d\.\d)\s*\|?\s*(\d[\d,]*)\s*Reviews?/i.exec(t);
    if (r) {
      out.rating = Number(r[1]);
      out.reviews = Number(r[2].replace(/,/g, ''));
    }
    if (/DISCONTINUED/.test(t)) out.discontinued = true;
    const w = /No Warranty|\d+\s*(?:Months?|Years?|Year)\s*Warranty/i.exec(t);
    if (w) out.warranty = w[0];
    return out;
  };

  /** Keeps only this product's own photos. Similar-phone images use other slugs, so they are dropped. */
  api.isProductImage = (url, slug) => {
    const base = String(url || '').split('?')[0].split('/').pop();
    return base.startsWith(`${slug}-pakistan-priceoye-`) && /\.(webp|jpe?g|png)$/i.test(base);
  };

  /** Same photo at different sizes has the same key (the file name without the size). */
  api.imageKey = (url) => String(url).split('?')[0].split('/').pop().replace(/-\d+x\d+(\.\w+)$/, '$1');

  api.sizedUrl = (url, size) => String(url).replace(/-\d+x\d+(\.\w+)(\?.*)?$/, `-${size}$1`);

  /** Keeps one URL per photo, preferring 500x500 when the page offers it. */
  api.uniqueImages = (urls, slug) => {
    const seen = new Map();
    for (const u of urls) {
      if (!api.isProductImage(u, slug)) continue;
      const key = api.imageKey(u);
      if (!seen.has(key)) seen.set(key, u);
      else if (/-500x500\./.test(u)) seen.set(key, u);
    }
    return [...seen.values()];
  };

  const uniqSorted = (xs) => [...new Set(xs.filter((x) => x != null))].sort((a, b) => a - b);

  /** Builds the device record saved for a PriceOye-only phone (no GSMArena entry). Specs stay empty. */
  api.buildDevice = ({ id, brand, model, url, variants, photoCount, extras, today }) => {
    const priced = variants.filter((v) => v.storage_gb || v.ram_gb);
    return {
      id,
      brand,
      model,
      year: 0,
      status: 'released',
      body: {},
      display: {},
      soc: {
        storage_gb: uniqSorted(priced.map((v) => v.storage_gb)),
        ram_options_gb: uniqSorted(priced.map((v) => v.ram_gb)),
        variants: priced.map((v) => ({ ...(v.storage_gb ? { storage_gb: v.storage_gb } : {}), ...(v.ram_gb ? { ram_gb: v.ram_gb } : {}) })),
      },
      camera: {},
      audio: {},
      connectivity: {},
      battery: {},
      software: {},
      repair: {},
      note: 'Added from PriceOye. Specs were not read from PriceOye.',
      gallery: { photo_count: photoCount, has_3d: false, threed_views: [] },
      priceoye: { url, ...extras, updated: today },
    };
  };

  /** Log rows for PriceOye prices, in the same flat shape as prices-core.js.
   * Skips a row if the same device, variant, price, date and shop already exist. */
  api.newPriceEntries = ({ deviceId, variants, observed_on, shop, existing }) => {
    const keyOf = (e) => `${e.observed_on}|${e.shop || ''}|${e.price_pkr}|${e.ram_gb || '-'}/${e.storage_gb || '-'}`;
    const have = new Set((existing || []).map(keyOf));
    const out = [];
    for (const v of variants) {
      if (!v.price) continue;
      const e = { deviceId, price_pkr: v.price, observed_on, shop };
      if (v.ram_gb) e.ram_gb = v.ram_gb;
      if (v.storage_gb) e.storage_gb = v.storage_gb;
      if (!have.has(keyOf(e))) out.push(e);
    }
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AetherPriceOyeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
