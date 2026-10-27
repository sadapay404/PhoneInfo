/* "Save to AetherPhone" on GSMArena device pages.
 * Reads the open page, then its Pictures page (official photos, colour variants,
 * review photos), downloads each image through the background worker, and stores
 * everything in the extension's local storage. Nothing is sent to any server. */
(function () {
  if (!/-\d+\.php$/.test(location.pathname) || !document.querySelector('#specs-list')) return;
  if (document.getElementById('aether-save')) return;

  const PAUSE_MS = 300;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Official photos and review photos from the Pictures page, plus whether a 3D view exists. */
  async function collectGallery(deviceUrl) {
    const picUrl = deviceUrl.replace(/-(\d+)\.php(?:[?#].*)?$/, '-pictures-$1.php');
    const res = await fetch(picUrl, { credentials: 'omit' });
    if (!res.ok) return { items: [], has_3d: false, pictures_url: picUrl };
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const seen = new Set();
    const items = [];
    const add = (raw) => {
      if (!raw) return;
      let u;
      try {
        u = new URL(raw, picUrl).href;
      } catch {
        return;
      }
      if (!/\.(jpe?g|png|webp)(\?.*)?$/i.test(u)) return;
      const kind = /\/imgroot\/reviews\//.test(u) ? 'review' : /fdn2?\.gsmarena\.com\/vv\/(pics|bigpic)\//.test(u) ? 'official' : null;
      if (!kind) return;
      const key = u.split('?')[0].split('/').pop(); // same file, different size: keep the first (links come first)
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ kind, url: u });
    };
    // Links to full-size images come first, so they win over thumbnails.
    doc.querySelectorAll('a[href]').forEach((a) => add(a.getAttribute('href')));
    doc.querySelectorAll('img[src]').forEach((img) => add(img.getAttribute('src')));

    return { items: items.slice(0, 80), has_3d: /binkies3d/i.test(html), pictures_url: picUrl };
  }

  async function fetchPhoto(url) {
    const reply = await chrome.runtime.sendMessage({ type: 'fetchImage', url });
    return reply && reply.ok ? reply.dataUrl : undefined;
  }

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
    try {
      const raw = window.AetherExtract.extractPage(document, location.href);
      if (!raw.name || Object.keys(raw.specs).length === 0) throw new Error('No specs found on this page');

      button.textContent = 'Finding photos…';
      const gallery = await collectGallery(location.href);
      const photos = [];
      let done = 0;
      for (const item of gallery.items) {
        button.textContent = `Saving photos ${done + 1}/${gallery.items.length}…`;
        const dataUrl = await fetchPhoto(item.url);
        if (dataUrl) photos.push({ kind: item.kind, source: item.url, dataUrl });
        done++;
        await sleep(PAUSE_MS);
      }
      if (photos.length === 0 && raw.image_url) {
        const dataUrl = await fetchPhoto(raw.image_url);
        if (dataUrl) photos.push({ kind: 'official', source: raw.image_url, dataUrl });
      }

      const main = photos.find((p) => p.kind === 'official') || photos[0];
      const device = window.AetherMapper.toDevice(raw, {
        imageDataUrl: main ? main.dataUrl : undefined,
        savedOn: new Date().toISOString(),
        gallery: { has_3d: gallery.has_3d, pictures_url: gallery.pictures_url, photo_count: photos.length },
      });
      // Photos live under their own key so the phone list stays small.
      const stored = photos.map((p, i) => ({ ...p, file: `${String(i + 1).padStart(2, '0')}-${p.kind}` }));
      await chrome.storage.local.set({
        [`phone:${device.id}`]: device,
        [`photos:${device.id}`]: stored,
      });
      button.textContent = `Saved ${device.brand} ${device.model} · ${photos.length} photos`;
      button.style.background = '#1f8a4c';
    } catch (err) {
      button.textContent = `Failed: ${err.message}`;
      button.style.background = '#b42318';
    } finally {
      button.disabled = false;
    }
  });

  document.body.appendChild(button);
})();
