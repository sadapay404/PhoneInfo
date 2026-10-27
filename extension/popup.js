const listEl = document.getElementById('list');
const countEl = document.getElementById('count');

async function loadPhones() {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith('phone:'))
    .map(([, v]) => v)
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
}

function render(phones) {
  countEl.textContent = `${phones.length} saved`;
  listEl.innerHTML = '';
  if (!phones.length) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="empty">Open any phone page on gsmarena.com and click “Save to AetherPhone”.</span>';
    listEl.append(li);
    return;
  }
  for (const p of phones) {
    const li = document.createElement('li');
    const img = document.createElement('img');
    if (p.image) img.src = p.image; else img.className = 'ph';
    const label = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `${p.brand} ${p.model}`;
    const small = document.createElement('small');
    const photos = p.gallery?.photo_count ?? 0;
    small.textContent = `${p.year} · ${photos} photos${p.gallery?.has_3d ? ' · 3D view' : ''}`;
    label.append(strong, small);
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      await chrome.storage.local.remove([`phone:${p.id}`, `photos:${p.id}`, `prices:${p.id}`]);
      refresh();
    });
    li.append(img, label, del);
    listEl.append(li);
  }
}

async function refresh() {
  render(await loadPhones());
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

document.getElementById('export').addEventListener('click', async () => {
  const phones = await loadPhones();
  const store = await chrome.storage.local.get(null);
  const entries = [];
  const out = [];
  const folders = AetherZip.folderNames(phones); // "OnePlus 15", not the internal id
  phones.forEach((p, i) => {
    const { image, ...rest } = p; // the data URL goes into the ZIP as a file instead
    const files = [];
    for (const ph of store[`photos:${p.id}`] || []) {
      const mime = ph.dataUrl.slice(5, ph.dataUrl.indexOf(';'));
      const path = `photos/${folders[i]}/${ph.file}.${EXT[mime] || 'jpg'}`;
      entries.push({ name: path, data: AetherZip.dataUrlToBytes(ph.dataUrl) });
      files.push({ kind: ph.kind, file: path, source: ph.source });
    }
    const main = files.find((f) => f.kind === 'official') || files[0];
    out.push({ ...rest, image: main ? main.file : undefined, photos: files });
  });
  // Price log (typed by you on PriceOye, or as entered in the app). One flat list, with the device id on each row.
  const prices = [];
  for (const p of phones) prices.push(...(store[`prices:${p.id}`] || []));
  entries.unshift({ name: 'aetherphone-saved.json', data: new TextEncoder().encode(JSON.stringify(out)) });
  if (prices.length) entries.push({ name: 'aetherphone-prices.json', data: new TextEncoder().encode(JSON.stringify(prices)) });
  const zip = AetherZip.buildZip(entries);
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aetherphone-saved.zip';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

document.getElementById('clear').addEventListener('click', async () => {
  if (!confirm('Delete all saved phones and photos from the extension?')) return;
  const keys = (await loadPhones()).flatMap((p) => [`phone:${p.id}`, `photos:${p.id}`, `prices:${p.id}`]);
  await chrome.storage.local.remove(keys);
  refresh();
});

refresh();
