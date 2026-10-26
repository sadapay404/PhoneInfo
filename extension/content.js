/* Adds a "Save to AetherPhone" button on GSMArena device pages.
 * Everything happens in the browser: the page you already opened is read,
 * its photo is copied into local storage, and nothing is sent to any server. */
(function () {
  if (!/-\d+\.php$/.test(location.pathname) || !document.querySelector('#specs-list')) return;
  if (document.getElementById('aether-save')) return;

  const MAX_IMAGE_BYTES = 400 * 1024;

  async function imageToDataUrl(url) {
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) return undefined;
      const blob = await res.blob();
      if (blob.size > MAX_IMAGE_BYTES) return undefined;
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
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
    button.textContent = 'Saving…';
    try {
      const raw = window.AetherExtract.extractPage(document, location.href);
      if (!raw.name || Object.keys(raw.specs).length === 0) throw new Error('No specs found on this page');
      const image = raw.image_url ? await imageToDataUrl(raw.image_url) : undefined;
      const device = window.AetherMapper.toDevice(raw, { imageDataUrl: image, savedOn: new Date().toISOString() });
      await chrome.storage.local.set({ [`phone:${device.id}`]: device });
      button.textContent = `Saved: ${device.brand} ${device.model}`;
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
