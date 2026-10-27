/* PriceOye extractor: one button on a PriceOye phone page, like the GSMArena "Save" button.
 *  - Phone already saved from GSMArena (same brand and model): saves PKR prices for every
 *    RAM/storage variant, plus extra facts GSMArena lacks (rating, reviews, warranty, status).
 *    No images are taken.
 *  - Phone not saved yet: saves its PriceOye photos, a device record with its variants, and prices.
 * Personal use only. Reads the page as the visitor sees it; it does not fetch PriceOye pages itself. */
(function () {
  const C = globalThis.AetherPriceOyeCore;
  if (!C || !globalThis.chrome || !chrome.storage) return;

  const SHOP = 'PriceOye';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const todayIso = () => new Date().toLocaleDateString('en-CA');
  const block = (e) => e.preventDefault(); // stops a variant link from navigating while we select variants

  /** Visible storage/RAM choices. Each is a leaf element whose whole text is e.g. "32GB - 2GB RAM". */
  function variantCandidates(doc) {
    const out = [];
    const seen = new Set();
    doc.querySelectorAll('body *').forEach((el) => {
      if (el.children.length || /^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(el.tagName)) return;
      const label = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const v = C.parseVariant(label);
      if (!v || seen.has(label)) return;
      seen.add(label);
      out.push({ el, label, v });
    });
    return out;
  }

  /** The price shown after selecting a variant: the first Rs amount in the nearest block that has one. */
  function priceNear(el) {
    let node = el;
    for (let i = 0; i < 8 && node; i++, node = node.parentElement) {
      const p = C.parsePriceText(node.textContent);
      if (p) return p;
    }
    return null;
  }

  async function extractPage(doc, loc) {
    const path = C.productFromPath(loc.pathname);
    if (!path) return null;
    const name = C.nameFromTitle(doc.title) || ((doc.querySelector('h1') || {}).textContent || '').trim();
    if (!name) return null;
    const { brand, model } = C.splitBrand(name, path.brandSlug);

    const urls = [...doc.querySelectorAll('img')]
      .map((img) => img.currentSrc || img.src || img.getAttribute('data-src') || '')
      .filter(Boolean);
    const images = C.uniqueImages(urls, path.slug);
    const pageText = (doc.body.textContent || '').replace(/\s+/g, ' ');
    const extras = C.parseExtras(pageText);

    const cands = variantCandidates(doc);
    const variants = [];
    if (cands.length) {
      doc.addEventListener('click', block, true);
      try {
        for (const c of cands) {
          const target = c.el.closest('button,label,[role=button],[role=option],li') || c.el;
          target.click();
          await sleep(450); // give the page time to show this variant's price
          variants.push({ ...c.v, price: priceNear(c.el) });
        }
      } finally {
        doc.removeEventListener('click', block, true);
      }
    } else {
      variants.push({ price: C.parsePriceText(pageText) });
    }

    // Keep one row per RAM/storage pair.
    const uniq = [];
    const keys = new Set();
    for (const v of variants) {
      const k = `${v.ram_gb || '-'}/${v.storage_gb || '-'}`;
      if (keys.has(k)) continue;
      keys.add(k);
      uniq.push(v);
    }
    return { name, brand, model, slug: path.slug, url: loc.href, images, variants: uniq, extras };
  }

  async function savedPhones() {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all).filter(([k]) => k.startsWith('phone:')).map(([, v]) => v);
  }

  async function fetchOne(url) {
    const res = await chrome.runtime.sendMessage({ type: 'fetchImage', url });
    if (!res || !res.ok) throw new Error((res && res.error) || 'no response');
    return res.dataUrl;
  }

  /** Prefers the 500x500 copy; falls back to the URL the page uses. */
  async function fetchPhoto(url) {
    const big = C.sizedUrl(url, '500x500');
    if (big !== url) {
      try { return await fetchOne(big); } catch (_) { /* use the page's size */ }
    }
    return fetchOne(url);
  }

  async function run(status) {
    status('Reading this page…');
    const raw = await extractPage(document, location);
    if (!raw) {
      status('Open a PriceOye phone page (priceoye.pk/mobiles/brand/model).');
      return;
    }
    const priced = raw.variants.filter((v) => v.price).length;
    const today = todayIso();
    const phones = await savedPhones();
    const match = C.findSaved(phones, { brand: raw.brand, model: raw.model });

    if (match) {
      const key = `prices:${match.id}`;
      const existing = (await chrome.storage.local.get(key))[key] || [];
      const rows = C.newPriceEntries({ deviceId: match.id, variants: raw.variants, observed_on: today, shop: SHOP, existing });
      const device = { ...match, priceoye: { url: raw.url, ...raw.extras, updated: today } };
      await chrome.storage.local.set({ [`phone:${match.id}`]: device, [key]: [...existing, ...rows] });
      status(`Already saved from GSMArena. Saved ${rows.length} new price${rows.length === 1 ? '' : 's'} (${priced} variant${priced === 1 ? '' : 's'} read). No images taken.`);
      return;
    }

    const id = `priceoye-${raw.slug}`;
    const photos = [];
    let failed = 0;
    for (let i = 0; i < raw.images.length; i++) {
      status(`Saving photo ${i + 1} of ${raw.images.length}…`);
      try {
        const dataUrl = await fetchPhoto(raw.images[i]);
        photos.push({ kind: 'official', file: `priceoye-${String(i + 1).padStart(2, '0')}`, dataUrl, source: raw.images[i] });
      } catch (_) {
        failed++;
      }
    }
    const device = C.buildDevice({
      id, brand: raw.brand, model: raw.model, url: raw.url, variants: raw.variants,
      photoCount: photos.length, extras: raw.extras, today,
    });
    if (photos[0]) device.image = photos[0].dataUrl;
    const key = `prices:${id}`;
    const existing = (await chrome.storage.local.get(key))[key] || [];
    const rows = C.newPriceEntries({ deviceId: id, variants: raw.variants, observed_on: today, shop: SHOP, existing });
    await chrome.storage.local.set({ [`phone:${id}`]: device, [`photos:${id}`]: photos, [key]: [...existing, ...rows] });
    status(`Saved ${raw.brand} ${raw.model}: ${photos.length} photo${photos.length === 1 ? '' : 's'}${failed ? ` (${failed} failed)` : ''}, ${rows.length} price${rows.length === 1 ? '' : 's'}.`);
  }

  // Same button as the GSMArena page: bottom right, same label and style. Progress shows on the button.
  function addButton() {
    if (document.getElementById('aether-save')) return;
    const button = document.createElement('button');
    button.id = 'aether-save';
    button.textContent = 'Save to AetherPhone';
    Object.assign(button.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
      padding: '10px 16px', borderRadius: '999px', border: '0', cursor: 'pointer',
      background: '#2f5bea', color: '#fff', font: '600 14px system-ui, sans-serif',
      boxShadow: '0 6px 20px rgba(0,0,0,.25)',
    });
    button.addEventListener('click', async () => {
      button.disabled = true;
      const status = (text) => { button.textContent = text; };
      try { await run(status); } catch (err) { status(`Failed: ${err && err.message ? err.message : err}`); }
      button.disabled = false;
    });
    document.body.append(button);
  }

  /** Automatic run: once per phone per day, when the setting is on. Same work as pressing the button. */
  async function autoRunIfDue() {
    const settings = (await chrome.storage.local.get('settings')).settings || {};
    if (settings.autoSave === false) return;
    const slug = C.productFromPath(location.pathname).slug;
    const key = `autoPriceOye:${slug}`;
    const today = todayIso();
    if ((await chrome.storage.local.get(key))[key] === today) return;
    await sleep(2000); // let the page finish loading first
    const button = document.getElementById('aether-save');
    if (!button || button.disabled) return;
    button.disabled = true;
    try {
      await run((t) => { button.textContent = t; });
      await chrome.storage.local.set({ [key]: today });
    } catch (err) {
      button.textContent = `Failed: ${err && err.message ? err.message : err}`;
    } finally {
      button.disabled = false;
    }
  }

  if (!C.productFromPath(location.pathname)) return; // only on phone pages
  const start = () => { addButton(); void autoRunIfDue(); };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
