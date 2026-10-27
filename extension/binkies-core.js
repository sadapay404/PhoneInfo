/* Binkies 3D image selection. Plain browser script, pure functions only.
 * Input: the URLs the browser loaded for the 3D viewer (from the Resource Timing list).
 * Output: image files only. The 3D model file itself (scene.mdm.br) is never selected. */
(function (root) {
  const api = {};
  const HOSTS = new Set(['engage-content.binkies3d.com', 'engage-content2.binkies3d.com', 'render.binkies3d.com']);
  const IMAGE_EXT = /\.(jpe?g|png|webp|hdr|ktx2?|dds)$/i;

  /** True for an image the 3D viewer loads from Binkies (textures, lightmaps, render previews). */
  api.isBinkiesImage = (raw) => {
    let u;
    try { u = new URL(raw); } catch (_) { return false; }
    if (u.protocol !== 'https:' || !HOSTS.has(u.hostname)) return false;
    if (u.hostname === 'render.binkies3d.com') return u.pathname.startsWith('/v1/image');
    return IMAGE_EXT.test(u.pathname);
  };

  const clean = (s) => String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim();

  /** Returns [{ url, name }] with unique, readable file names. name has no extension for render previews. */
  api.selectImages = (urls) => {
    const out = [];
    const seenUrl = new Set();
    const seenName = new Set();
    for (const raw of urls || []) {
      if (!api.isBinkiesImage(raw) || seenUrl.has(raw)) continue;
      seenUrl.add(raw);
      const u = new URL(raw);
      let base;
      if (u.hostname === 'render.binkies3d.com') {
        base = `render-${u.searchParams.get('bookmark') || 'view'}-${u.searchParams.get('modelOptionUId') || 'x'}-${u.searchParams.get('size') || 'x'}`;
      } else {
        base = decodeURIComponent(u.pathname.split('/').pop());
      }
      let name = clean(base);
      if (!name) continue;
      if (seenName.has(name.toLowerCase())) {
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let n = 2;
        while (seenName.has(`${stem}-${n}${ext}`.toLowerCase())) n++;
        name = `${stem}-${n}${ext}`;
      }
      seenName.add(name.toLowerCase());
      out.push({ url: raw, name });
    }
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AetherBinkiesCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
