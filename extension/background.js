/* Fetches GSMArena image files for the content script. Runs in the extension's
 * service worker, which has host permissions, so the page's cross-site limits do not apply.
 * Only GSMArena image hosts are allowed. */
const ALLOWED_HOSTS = new Set(['www.gsmarena.com', 'fdn.gsmarena.com', 'fdn2.gsmarena.com']);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function bytesToBase64(bytes) {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

async function fetchImage(urlText) {
  const url = new URL(urlText);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error('host not allowed');
  }
  const res = await fetch(url.href, { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('image too large');
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  const b64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  return `data:${type};base64,${b64}`;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'fetchImage') return false;
  fetchImage(msg.url)
    .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
    .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
  return true; // keep the channel open for the async response
});
