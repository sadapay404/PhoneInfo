// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(async () => {
  document.body.innerHTML = '';
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  await db.delete();
  await db.open();
});

afterEach(() => {
  while (mounted.length) {
    const { root } = mounted.pop()!;
    act(() => root.unmount());
  }
});

describe('app smoke', () => {
  it('renders the catalog with navigation and search', () => {
    const el = render('#/catalog');
    expect(el.querySelector('.device-grid')).not.toBeNull();
    expect(el.textContent).toContain('iPhone 15 Pro');
    expect(el.querySelector('.bottom-nav')).not.toBeNull();
    expect(el.querySelector('input[type="search"]')).not.toBeNull();
  });

  it('syncs the catalog into IndexedDB on first load', async () => {
    render('#/catalog');
    const count = await waitForAsync(() => db.devices.count(), (n) => n === 4);
    expect(count).toBe(4);
    expect((await db.meta.get('catalogVersion'))?.value).toMatch(/^[0-9a-f]{16}$/);
  });

  it('opens device detail with every category box', () => {
    const el = render('#/catalog/google-pixel-8-pro');
    const titles = Array.from(el.querySelectorAll('.box-title')).map((n) => n.textContent);
    expect(titles).toEqual(expect.arrayContaining(['Display', 'Cameras', 'Battery & Charging', 'Software']));
    expect(el.textContent).toContain('Tensor G3');
  });

  it('renders the compare matrix with winners marked', () => {
    const el = render('#/compare');
    expect(el.querySelectorAll('.matrix td.win').length).toBeGreaterThan(0);
  });

  it('renders each tool tab', () => {
    const el = render('#/tools');
    expect(el.textContent).toContain('Battery endurance');
    const tabs = Array.from(el.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    for (const label of ['Sensor size', 'Price vs performance']) {
      act(() => tabs.find((t) => t.textContent === label)!.click());
      expect(el.querySelector('.tool-layout, .value-table')).not.toBeNull();
    }
  });
});

async function waitForAsync<T>(get: () => Promise<T>, ok: (v: T) => boolean, timeout = 3000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await get();
    if (ok(v)) return v;
    if (Date.now() - start > timeout) throw new Error(`timed out; last value ${String(v)}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
}
