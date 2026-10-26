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

  const api = { extractPage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AetherExtract = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
