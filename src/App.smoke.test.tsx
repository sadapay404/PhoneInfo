// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import { db } from './data/db';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: { root: Root; el: HTMLElement }[] = [];

function render(hash: string) {
  window.location.hash = hash;
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  mounted.push({ root, el });
  act(() => root.render(<App />));
  return el;
}

async function waitFor(check: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('timed out waiting for the UI');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  window.localStorage.clear();
});

afterEach(() => {
  for (const { root, el } of mounted.splice(0)) {
    act(() => root.unmount());
    el.remove();
  }
});

describe('new interface', () => {
  it('lists phones with search and a sort control', async () => {
    const el = render('#/phones');
    await waitFor(() => el.querySelectorAll('.phone-card').length > 0);
    expect(el.querySelector('.toolbar input[type="search"]')).not.toBeNull();
    expect(el.querySelector('.sort select')).not.toBeNull();
    expect(el.querySelector('.bottom-nav, .nav-bottom')).not.toBeNull();
  });

  it('opens a phone page with specs and the price book', async () => {
    const el = render('#/phone/google-pixel-8-pro');
    await waitFor(() => el.querySelector('h1') !== null && el.textContent?.includes('Specifications') === true);
    expect(el.querySelector('.stats')).not.toBeNull();
    expect(el.querySelector('#prices')).not.toBeNull();
    expect(el.textContent).toContain('Prices in Pakistan');
  });

  it('shows the not-found state for an unknown phone', async () => {
    const el = render('#/phone/does-not-exist');
    await waitFor(() => el.textContent?.includes('Phone not found') === true);
  });

  it('renders compare, library and tools', async () => {
    const compare = render('#/compare');
    await waitFor(() => compare.textContent?.includes('Choose at least two phones') === true);

    const library = render('#/library');
    await waitFor(() => library.textContent?.includes('Choose ZIP files') === true);

    const tools = render('#/tools');
    await waitFor(() => tools.querySelector('.tool-grid') !== null);
  });
});
