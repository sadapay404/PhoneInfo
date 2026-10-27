/* Saves the 3D viewer's image files (textures, lightmaps, render previews) for a GSMArena phone.
 * The 3D model file is not saved. The list comes from the browser's own record of what the
 * viewer loaded, so the exact folder and version numbers are used. Personal use only.
 * Runs on GSMArena pictures pages and in the Binkies viewer frame. The viewer may be in an
 * iframe, so each frame sends its list to the top page. */
(function () {
  const B = globalThis.AetherBinkiesCore;
  if (!B || !globalThis.chrome || !chrome.storage) return;
  const TAG = 'aetherphone-binkies';
  const isTop = window.top === window;
  const ownUrls = () => performance.getEntriesByType('resource').map((e) => e.name);

  // Every frame: answer the top page's request and pass it on to child frames.
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d[TAG] !== 'ask') return;
    for (const f of document.querySelectorAll('iframe')) {
      try { if (f.contentWindow) f.contentWindow.postMessage({ [TAG]: 'ask' }, '*'); } catch (_) { /* ignore */ }
    }
    if (!isTop) window.top.postMessage({ [TAG]: 'urls', urls: ownUrls() }, '*');
  });

  if (!isTop || !/-pictures-\d+\.php$/.test(location.pathname)) return;
  const phoneId = `saved-${/-pictures-(\d+)\.php$/.exec(location.pathname)[1]}`;

  function collectUrls() {
    return new Promise((resolve) => {
      const got = [...ownUrls()];
      const listen = (e) => {
        const d = e.data;
        if (d && typeof d === 'object' && d[TAG] === 'urls' && Array.isArray(d.urls)) got.push(...d.urls);
      };
      window.addEventListener('message', listen);
      for (const f of document.querySelectorAll('iframe')) {
        try { if (f.contentWindow) f.contentWindow.postMessage({ [TAG]: 'ask' }, '*'); } catch (_) { /* ignore */ }
      }
      setTimeout(() => { window.removeEventListener('message', listen); resolve(got); }, 1500);
    });
  }

  const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/vnd.radiance': 'hdr' };

  async function fetchFile(url) {
    const res = await chrome.runtime.sendMessage({ type: 'fetchImage', url });
    if (!res || !res.ok) throw new Error((res && res.error) || 'no response');
    return res.dataUrl;
  }

  async function run(status) {
    const stored = await chrome.storage.local.get(`phone:${phoneId}`);
    if (!stored[`phone:${phoneId}`]) {
      status('Save this phone first (“Save to AetherPhone” on its spec page), then press again.');
      return;
    }
    status('Looking for the 3D viewer’s image files…');
    const files = B.selectImages(await collectUrls());
    if (!files.length) {
      status('No 3D image files found. Click the 3D preview on this page, wait for it to load, then press again.');
      return;
    }
    const saved = [];
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      status(`Saving 3D image ${i + 1} of ${files.length}…`);
      try {
        const dataUrl = await fetchFile(files[i].url);
        const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
        const name = /\.\w+$/.test(files[i].name) ? files[i].name : `${files[i].name}.${EXT[mime] || 'bin'}`;
        saved.push({ name, dataUrl, source: files[i].url });
      } catch (_) {
        failed++;
      }
    }
    await chrome.storage.local.set({ [`binkies:${phoneId}`]: saved });
    status(`Saved ${saved.length} 3D image${saved.length === 1 ? '' : 's'}${failed ? ` (${failed} failed)` : ''}. The 3D model file itself is not saved.`);
  }

  function addButton() {
    if (document.getElementById('aetherphone-binkies-save')) return;
    const btn = document.createElement('button');
    btn.id = 'aetherphone-binkies-save';
    btn.type = 'button';
    btn.textContent = 'AetherPhone · Save 3D images';
    Object.assign(btn.style, {
      position: 'fixed', left: '16px', bottom: '16px', zIndex: '2147483647',
      padding: '10px 16px', borderRadius: '999px', border: '0', cursor: 'pointer',
      background: '#4338ca', color: '#fff', font: '600 14px system-ui, sans-serif',
      boxShadow: '0 6px 20px rgba(0,0,0,.25)', maxWidth: 'calc(100vw - 32px)',
    });
    const note = document.createElement('div');
    Object.assign(note.style, {
      position: 'fixed', left: '16px', bottom: '66px', zIndex: '2147483647', maxWidth: '340px',
      background: '#111827', color: '#fff', font: '13px/1.4 system-ui, sans-serif',
      padding: '8px 10px', borderRadius: '8px', display: 'none',
    });
    const status = (text) => { note.textContent = text; note.style.display = 'block'; };
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await run(status); } catch (err) { status(`Could not save: ${err && err.message ? err.message : err}`); }
      btn.disabled = false;
    });
    document.body.append(note, btn);
  }

  if (document.body) addButton();
  else document.addEventListener('DOMContentLoaded', addButton);
})();
