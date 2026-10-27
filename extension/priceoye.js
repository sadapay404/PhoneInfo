/* "PKR prices" panel for PriceOye pages.
 * This script does NOT read the PriceOye page. It only adds its own button and panel.
 * The variant rows come from a phone you saved from GSMArena. You type each price yourself.
 * Entries go to this extension's local storage and are included in the export. */
(function () {
  if (document.getElementById('aether-prices-btn')) return;
  const P = globalThis.AetherPrices;
  if (!P) return;

  const todayIso = () => new Date().toLocaleDateString('en-CA');
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    const { style, ...rest } = props;
    Object.assign(node, rest);
    if (style) Object.assign(node.style, style);
    for (const c of children) node.append(c);
    return node;
  };

  async function loadPhones() {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all)
      .filter(([k]) => k.startsWith('phone:'))
      .map(([, v]) => v)
      .sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  }

  async function loadPrices(deviceId) {
    const got = await chrome.storage.local.get(`prices:${deviceId}`);
    return got[`prices:${deviceId}`] || [];
  }

  async function appendPrices(deviceId, entries) {
    const key = `prices:${deviceId}`;
    const got = await chrome.storage.local.get(key);
    const list = (got[key] || []).concat(entries.map((e) => ({ ...e, saved_at: new Date().toISOString() })));
    await chrome.storage.local.set({ [key]: list });
  }

  const BTN_STYLE = {
    position: 'fixed', left: '16px', bottom: '16px', zIndex: '2147483647',
    padding: '10px 16px', borderRadius: '999px', border: '0', cursor: 'pointer',
    background: '#1f8a4c', color: '#fff', font: '600 14px system-ui, sans-serif',
    boxShadow: '0 6px 20px rgba(0,0,0,.25)',
  };

  const button = el('button', { id: 'aether-prices-btn', textContent: 'AetherPhone · PKR prices' }, []);
  Object.assign(button.style, BTN_STYLE);

  const panel = el('div', { id: 'aether-prices-panel' });
  Object.assign(panel.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647', background: 'rgba(0,0,0,.45)',
    display: 'none', alignItems: 'center', justifyContent: 'center', padding: '12px',
    boxSizing: 'border-box', font: '14px system-ui, sans-serif', color: '#111',
  });

  const card = el('div');
  Object.assign(card.style, {
    background: '#fff', borderRadius: '14px', width: 'min(520px, 100%)', maxHeight: '90vh',
    overflow: 'auto', padding: '16px', boxSizing: 'border-box', boxShadow: '0 12px 40px rgba(0,0,0,.3)',
  });

  const title = el('strong', { textContent: 'Enter PKR prices', style: { fontSize: '16px' } });
  const close = el('button', { textContent: '×', title: 'Close' });
  Object.assign(close.style, { border: '0', background: 'none', fontSize: '22px', cursor: 'pointer', lineHeight: '1' });
  const head = el('div', {}, [title, close]);
  Object.assign(head.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' });

  const select = el('select');
  Object.assign(select.style, fieldStyle());
  const note = el('p', { textContent: '', style: {} });
  Object.assign(note.style, { color: '#6b7280', fontSize: '12px', margin: '6px 0 10px' });
  note.textContent = 'Variants come from the phone you saved from GSMArena. Type only the prices you see.';

  const table = el('div');
  const shopInput = el('input', { value: 'PriceOye', placeholder: 'Shop' });
  const dateInput = el('input', { type: 'date', value: todayIso() });
  Object.assign(shopInput.style, fieldStyle());
  Object.assign(dateInput.style, fieldStyle());
  const labelStyle = { display: 'grid', gap: '4px', fontSize: '12px', color: '#374151' };
  const meta = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0' } }, [
    el('label', { style: labelStyle }, [el('span', { textContent: 'Shop' }), shopInput]),
    el('label', { style: labelStyle }, [el('span', { textContent: 'Date seen' }), dateInput]),
  ]);

  const save = el('button', { textContent: 'Save prices' });
  Object.assign(save.style, { padding: '9px 16px', borderRadius: '8px', border: '0', background: '#2f5bea', color: '#fff', font: '600 14px system-ui, sans-serif', cursor: 'pointer' });
  const status = el('p', {});
  Object.assign(status.style, { margin: '8px 0 0', fontSize: '13px', minHeight: '18px' });

  card.append(head, select, note, table, meta, save, status);
  panel.append(card);

  function fieldStyle() {
    return { width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '8px', border: '1px solid #c9ced6', font: 'inherit', minWidth: '0' };
  }

  let rowInputs = [];
  let currentVariants = [];
  let currentDevice = null;

  async function renderRows() {
    table.innerHTML = '';
    rowInputs = [];
    if (!currentDevice) return;
    const history = await loadPrices(currentDevice.id);
    const latest = P.latestByVariant(history);
    currentVariants = P.variantsFor(currentDevice);
    const grid = el('div');
    Object.assign(grid.style, { display: 'grid', gap: '6px' });
    for (const v of currentVariants) {
      const key = P.variantKey(v);
      const last = latest.get(key);
      const hint = last ? `Last: Rs ${last.price_pkr.toLocaleString('en-PK')} on ${last.observed_on}` : 'No price yet';
      const input = el('input', { inputMode: 'numeric', placeholder: 'Price in Rs' });
      Object.assign(input.style, fieldStyle());
      rowInputs.push({ variant: v, input });
      const row = el('div', {}, [
        el('div', { textContent: P.variantLabel(v), style: { fontWeight: '600' } }),
        el('div', { textContent: hint, style: { color: '#6b7280', fontSize: '12px' } }),
        input,
      ]);
      Object.assign(row.style, { display: 'grid', gridTemplateColumns: '1fr', gap: '4px', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '10px' });
      grid.append(row);
    }
    table.append(grid);
  }

  async function fillPhones() {
    const phones = await loadPhones();
    select.innerHTML = '';
    if (!phones.length) {
      select.append(el('option', { textContent: 'No saved phones. Save one from GSMArena first.', value: '' }));
      currentDevice = null;
      await renderRows();
      return;
    }
    select.append(el('option', { textContent: 'Choose a saved phone', value: '' }));
    for (const p of phones) select.append(el('option', { textContent: `${p.brand} ${p.model}`, value: p.id }));
    currentDevice = null;
    await renderRows();
  }

  select.addEventListener('change', async () => {
    const phones = await loadPhones();
    currentDevice = phones.find((p) => p.id === select.value) || null;
    status.textContent = '';
    await renderRows();
  });

  save.addEventListener('click', async () => {
    if (!currentDevice) { status.style.color = '#b42318'; status.textContent = 'Choose a phone first.'; return; }
    const rows = rowInputs.map((r) => ({ variant: r.variant, priceText: r.input.value }));
    const { entries, errors } = P.buildEntries({
      deviceId: currentDevice.id, rows, shop: shopInput.value, observed_on: dateInput.value,
    });
    if (errors.length) { status.style.color = '#b42318'; status.textContent = errors.join(' · '); return; }
    if (!entries.length) { status.style.color = '#b42318'; status.textContent = 'Type at least one price.'; return; }
    await appendPrices(currentDevice.id, entries);
    status.style.color = '#1f8a4c';
    status.textContent = `Saved ${entries.length} price${entries.length === 1 ? '' : 's'}.`;
    rowInputs.forEach((r) => { r.input.value = ''; });
    await renderRows();
  });

  button.addEventListener('click', async () => {
    panel.style.display = 'flex';
    await fillPhones();
  });
  close.addEventListener('click', () => { panel.style.display = 'none'; });
  panel.addEventListener('click', (e) => { if (e.target === panel) panel.style.display = 'none'; });

  document.body.append(button, panel);
})();
