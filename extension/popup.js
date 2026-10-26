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
    listEl.innerHTML = '<li class="empty" style="display:block">Open any phone page on gsmarena.com and click “Save to AetherPhone”.</li>';
    return;
  }
  for (const p of phones) {
    const li = document.createElement('li');
    const img = document.createElement('img');
    if (p.image) img.src = p.image; else img.className = 'ph';
    const label = document.createElement('div');
    label.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = `${p.brand} ${p.model}`;
    const small = document.createElement('small');
    small.textContent = `${p.year} · ${p.soc?.chipset ?? 'chipset —'}`;
    label.append(strong, small);
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      await chrome.storage.local.remove(`phone:${p.id}`);
      refresh();
    });
    li.append(img, label, del);
    listEl.append(li);
  }
}

async function refresh() {
  render(await loadPhones());
}

document.getElementById('export').addEventListener('click', async () => {
  const phones = await loadPhones();
  const blob = new Blob([JSON.stringify(phones)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aetherphone-saved.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

document.getElementById('clear').addEventListener('click', async () => {
  if (!confirm('Delete all saved phones from the extension?')) return;
  const keys = (await loadPhones()).map((p) => `phone:${p.id}`);
  await chrome.storage.local.remove(keys);
  refresh();
});

refresh();
