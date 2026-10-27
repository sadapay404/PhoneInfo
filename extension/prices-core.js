/* Price-log logic shared by the PriceOye panel, the popup export, and the tests.
 * Plain browser script. Pure functions only: no page access, no network.
 * Mirrors src/data/prices.ts, which the app uses. */
(function () {
  function variantsFor(device) {
    const soc = (device && device.soc) || {};
    if (Array.isArray(soc.variants) && soc.variants.length) {
      return soc.variants.map((v) => ({ ram_gb: v.ram_gb, storage_gb: v.storage_gb }));
    }
    const rams = soc.ram_options_gb && soc.ram_options_gb.length ? soc.ram_options_gb : soc.ram_gb ? [soc.ram_gb] : [];
    const storages = soc.storage_gb || [];
    if (rams.length && storages.length) {
      const out = [];
      for (const r of rams) for (const s of storages) out.push({ ram_gb: r, storage_gb: s });
      return out;
    }
    if (rams.length) return rams.map((r) => ({ ram_gb: r }));
    if (storages.length) return storages.map((s) => ({ storage_gb: s }));
    return [{}];
  }

  function variantKey(v) {
    return `${v.ram_gb == null ? '-' : v.ram_gb}|${v.storage_gb == null ? '-' : v.storage_gb}`;
  }

  function variantLabel(v) {
    const parts = [];
    if (v.ram_gb) parts.push(`${v.ram_gb} GB RAM`);
    if (v.storage_gb) parts.push(v.storage_gb >= 1024 ? `${v.storage_gb / 1024} TB` : `${v.storage_gb} GB`);
    return parts.length ? parts.join(' · ') : 'Standard model';
  }

  /** Turns the typed price text into a whole number of rupees, or null if it is not a valid price. */
  function parsePrice(text) {
    const digits = String(text == null ? '' : text).replace(/[,\s]/g, '');
    if (!/^\d+$/.test(digits)) return null;
    const n = Number(digits);
    return n >= 1 && n <= 100000000 ? n : null;
  }

  function isDate(text) {
    return /^\d{4}-\d{2}-\d{2}$/.test(text || '');
  }

  /**
   * Builds log entries from the rows the user filled in.
   * rows: [{ variant, priceText }]. Empty price boxes are skipped; invalid ones are reported.
   */
  function buildEntries({ deviceId, rows, shop, observed_on, note }) {
    const entries = [];
    const errors = [];
    if (!isDate(observed_on)) return { entries, errors: ['Date must be a real date'] };
    for (const row of rows) {
      if (!String(row.priceText || '').trim()) continue;
      const price = parsePrice(row.priceText);
      if (price === null) {
        errors.push(`${variantLabel(row.variant)}: enter the price in rupees, e.g. 185000`);
        continue;
      }
      const entry = { deviceId, price_pkr: price, observed_on };
      if (row.variant.ram_gb) entry.ram_gb = row.variant.ram_gb;
      if (row.variant.storage_gb) entry.storage_gb = row.variant.storage_gb;
      if (shop && shop.trim()) entry.shop = shop.trim();
      if (note && note.trim()) entry.note = note.trim();
      entries.push(entry);
    }
    return { entries, errors };
  }

  /** Newest entry per variant. entries: any order. */
  function latestByVariant(entries) {
    const sorted = entries.slice().sort((a, b) => (a.observed_on < b.observed_on ? 1 : a.observed_on > b.observed_on ? -1 : 0));
    const out = new Map();
    for (const e of sorted) {
      const key = variantKey({ ram_gb: e.ram_gb, storage_gb: e.storage_gb });
      if (!out.has(key)) out.set(key, e);
    }
    return out;
  }

  const api = { variantsFor, variantKey, variantLabel, parsePrice, isDate, buildEntries, latestByVariant };
  globalThis.AetherPrices = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
