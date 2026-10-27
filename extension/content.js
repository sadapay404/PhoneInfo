/* "Save to AetherPhone" on GSMArena device pages.
 * Reads the open page, then its Pictures page (official photos, colour variants,
 * review photos), downloads each image through the background worker, and stores
 * everything in the extension's local storage. Nothing is sent to any server. */
(function () {
  if (!/-\d+\.php$/.test(location.pathname) || !document.querySelector('#specs-list')) return;
  if (document.getElementById('aether-save')) return;

  const PAUSE_MS = 300;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Photos that belong to THIS phone only, from its Pictures page, plus its 3D preview views.
   * The page also lists other phones and unrelated images; those are filtered out by file name.
   */
  async function collectGallery(deviceUrl, phoneName) {
    const picUrl = deviceUrl.replace(/-(\d+)\.php(?:[?#].*)?$/, '-pictures-$1.php');
    const threed = [];
    const res = await fetch(picUrl, { credentials: 'omit' });
    if (!res.ok) return { items: [], has_3d: false, threed_views: threed, pictures_url: picUrl };
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const slugs = window.AetherExtract.modelSlugs(deviceUrl);

    const seen = new Set();
    const items = [];
    const add = (raw, alt) => {
      if (!raw) return;
      let u;
      try {
        u = new URL(raw, picUrl).href.split('?')[0];
      } catch {
        return;
      }
      if (!/\.(jpe?g|png|webp)$/i.test(u)) return;
      if (!window.AetherExtract.isPhoneImage(u, slugs, { name: phoneName, alt })) return;
      const key = u.split('/').pop().toLowerCase(); // same file at another size: keep the first seen
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ kind: /\/imgroot\/reviews\//.test(u) ? 'review' : 'official', url: u });
    };
    // Full-size links come first, so they win over thumbnails.
    doc.querySelectorAll('a[href]').forEach((a) => add(a.getAttribute('href'), a.querySelector('img') && a.querySelector('img').getAttribute('alt')));
    doc.querySelectorAll('img[src]').forEach((img) => add(img.getAttribute('src'), img.getAttribute('alt')));

    threed.push(...window.AetherExtract.findThreeDViews(html));
    return {
      items: items.slice(0, 80),
      has_3d: threed.length > 0,
      threed_views: threed,
      pictures_url: picUrl,
    };
  }

  async function fetchPhoto(url) {
    const reply = await chrome.runtime.sendMessage({ type: 'fetchImage', url });
    return reply && reply.ok ? reply.dataUrl : undefined;
  }

  /** Reads the page, its photos and 3D views, and stores the phone. Used by the button and by auto-save. */
  async function saveCurrentPage(status) {
    const raw = window.AetherExtract.extractPage(document, location.href);
    if (!raw.name || Object.keys(raw.specs).length === 0) throw new Error('No specs found on this page');

    status('Finding photos…');
    const gallery = await collectGallery(location.href, raw.name);
    const photos = [];
    let done = 0;
    for (const item of gallery.items) {
      status(`Saving photos ${done + 1}/${gallery.items.length}…`);
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
      gallery: { has_3d: gallery.has_3d, pictures_url: gallery.pictures_url, photo_count: photos.length, threed_views: gallery.threed_views },
    });
    // Photos live under their own key so the phone list stays small.
    const stored = photos.map((p, i) => ({ ...p, file: `${String(i + 1).padStart(2, '0')}-${p.kind}` }));
    await chrome.storage.local.set({
      [`phone:${device.id}`]: device,
      [`photos:${device.id}`]: stored,
    });
    return { device, photoCount: photos.length };
  }

  const gsmPhoneId = () => {
    const m = /-(\d+)\.php/.exec(location.href);
    return m ? `saved-${m[1]}` : null;
  };

  const button = document.createElement('button');
  button.id = 'aether-save';
  button.textContent = 'Save to AetherPhone';
  Object.assign(button.style, {
    position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
    padding: '10px 16px', borderRadius: '999px', border: '0', cursor: 'pointer',
    background: '#2f5bea', color: '#fff', font: '600 14px system-ui, sans-serif',
    boxShadow: '0 6px 20px rgba(0,0,0,.25)',
  });

  const setStatus = (text, color) => {
    button.textContent = text;
    if (color) button.style.background = color;
  };

  async function runSave(auto) {
    button.disabled = true;
    try {
      const { device, photoCount } = await saveCurrentPage((t) => setStatus(t));
      setStatus(`${auto ? 'Auto-saved' : 'Saved'} ${device.brand} ${device.model} · ${photoCount} photos`, '#1f8a4c');
    } catch (err) {
      setStatus(`Failed: ${err.message}`, '#b42318');
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener('click', () => runSave(false));

  // Automatic save: when the phone is not saved yet and the setting is on. A phone already saved is left alone.
  async function autoSaveIfNew() {
    const settings = (await chrome.storage.local.get('settings')).settings || {};
    if (settings.autoSave === false) return;
    const id = gsmPhoneId();
    if (!id) return;
    const already = (await chrome.storage.local.get(`phone:${id}`))[`phone:${id}`];
    if (already) return;
    await sleep(1500); // let the page finish loading first
    await runSave(true);
  }

  document.body.appendChild(button);
  void autoSaveIfNew();
})();
