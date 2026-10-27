/*
 * Reads a GSMArena device page that is already open in the browser.
 * Pure DOM code: no network, no storage. Runs in the content script and in tests.
 *
 * Output: { name, url, image_url, specs: { [category]: { [label]: value } } }
 * Table layout: <div id="specs-list"> holds tables. A <th> starts a category and
 * spans rows; each row has <td class="ttl"> (label) and <td class="nfo"> (value).
 */
(function (root) {
  function clean(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  /** Text of a value cell, with <br> turned into a separator. */
  function valueText(cell) {
    const copy = cell.cloneNode(true);
    copy.querySelectorAll('br').forEach((br) => br.replaceWith(' · '));
    return clean(copy.textContent).replace(/(\s*·\s*)+/g, ' · ').replace(/^·\s*|\s*·$/g, '');
  }

  function extractPage(doc, pageUrl) {
    const nameEl = doc.querySelector('h1.specs-phone-name-title') || doc.querySelector('h1');
    const name = clean(nameEl && nameEl.textContent);

    const specs = {};
    let category = 'Other';
    doc.querySelectorAll('#specs-list table').forEach((table) => {
      table.querySelectorAll('tr').forEach((tr) => {
        const th = tr.querySelector('th');
        if (th) category = clean(th.textContent);
        const nfo = tr.querySelector('td.nfo');
        if (!nfo) return;
        const ttl = tr.querySelector('td.ttl');
        const label = clean(ttl && ttl.textContent) || 'Details';
        const value = valueText(nfo);
        if (!value) return;
        specs[category] = specs[category] || {};
        const prev = specs[category][label];
        specs[category][label] = prev ? `${prev} | ${value}` : value;
      });
    });

    const img = doc.querySelector('.specs-photo-main img') || doc.querySelector('.specs-photo-main a img');
    const image_url = img && img.getAttribute('src') ? new URL(img.getAttribute('src'), pageUrl).href : null;
    return { name, url: pageUrl, image_url, specs };
  }

  /**
   * Name variants GSMArena uses in image paths, from the device page URL:
   * "oneplus_15_5g-14206.php" -> ["oneplus-15-5g", "oneplus-15"].
   */
  function modelSlugs(deviceUrl) {
    const m = /\/([^/]+)-(\d+)\.php/.exec(deviceUrl || '');
    if (!m) return [];
    const full = m[1].replace(/_/g, '-').toLowerCase();
    const out = [full];
    const stripped = full.replace(/-\d+g$/, '');
    if (stripped !== full) out.push(stripped);
    return out;
  }

  /**
   * True only for images that belong to this phone. The Pictures page also shows
   * other phones, ads, and related images, so the file name or folder must match
   * the phone's own slug exactly. "oneplus-15-pro-1.jpg" does NOT match "oneplus-15".
   */
  function isPhoneImage(url, slugs) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    if (!/^fdn2?\.gsmarena\.com$/.test(u.hostname)) return false;
    const path = u.pathname.toLowerCase();
    const base = path.split('/').pop();
    const dirs = path.split('/');
    return slugs.some((slug) => {
      const esc = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (/\/vv\/pics\//.test(path) && new RegExp(`^${esc}-\\d+\\.(jpe?g|png|webp)$`).test(base)) return true;
      if (/\/vv\/bigpic\//.test(path) && new RegExp(`^${esc}\\.(jpe?g|png|webp)$`).test(base)) return true;
      if (/\/imgroot\/reviews\//.test(path) && dirs.includes(slug)) return true;
      return false;
    });
  }

  /** The four Binkies 3D preview renders (front, back, left, right) that GSMArena shows on the Pictures page. */
  function findThreeDViews(html) {
    const views = new Map();
    for (const m of String(html).matchAll(/https?:\/\/render\.binkies3d\.com\/v1\/image\?[^"'\s<>)]+/g)) {
      const url = m[0].replace(/&amp;/g, '&');
      const bm = /bookmark=([a-z0-9_-]+)/i.exec(url);
      const view = bm ? bm[1].toLowerCase() : `view-${views.size + 1}`;
      if (!views.has(view)) views.set(view, url);
    }
    return [...views].map(([view, url]) => ({ view, url }));
  }

  const api = { extractPage, modelSlugs, isPhoneImage, findThreeDViews };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AetherExtract = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
