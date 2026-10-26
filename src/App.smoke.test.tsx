// @vitest-environment jsdom
import { afterEach, describe, expect, it, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no matchMedia; the app uses it to detect touch-only devices.
window.matchMedia = (query: string) =>
  ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) as unknown as MediaQueryList;

const mounted: ReturnType<typeof createRoot>[] = [];

function render(hash: string) {
  window.location.hash = hash;
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  mounted.push(root);
  act(() => root.render(<App />));
  return { el, root };
}

afterEach(() => {
  while (mounted.length) {
    const root = mounted.pop()!;
    act(() => root.unmount());
  }
});

describe('app smoke', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('renders the catalog inside the phone frame on a wide desktop', () => {
    window.innerWidth = 1280;
    const { el } = render('#/catalog');
    expect(el.querySelector('.device')).not.toBeNull();
    expect(el.textContent).toContain('iPhone 15 Pro');
    expect(el.textContent).toContain('Galaxy S24 Ultra');
  });

  it('opens device detail with every category box', () => {
    window.innerWidth = 1280;
    const { el } = render('#/catalog/google-pixel-8-pro');
    const titles = Array.from(el.querySelectorAll('.box-title')).map((n) => n.textContent);
    expect(titles).toEqual(expect.arrayContaining(['Display', 'Cameras', 'Battery & Charging', 'Software']));
    expect(el.textContent).toContain('Tensor G3');
  });

  it('renders the compare matrix with highlighted winners', () => {
    window.innerWidth = 1280;
    const { el } = render('#/compare');
    expect(el.querySelectorAll('.matrix td.win').length).toBeGreaterThan(0);
  });

  it('renders all three tools without crashing', () => {
    window.innerWidth = 1280;
    const { el, root } = render('#/tools');
    expect(el.textContent).toContain('Battery endurance');
    const tabs = Array.from(el.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    for (const label of ['Sensor size', 'Value']) {
      act(() => tabs.find((t) => t.textContent === label)!.click());
      expect(el.querySelector('.tools')).not.toBeNull();
    }
    expect(root).toBeDefined();
  });

  it('falls back to bare app on narrow (phone) viewports', () => {
    window.innerWidth = 390;
    const { el } = render('#/catalog');
    expect(el.querySelector('.device')).toBeNull();
    expect(el.querySelector('.app')).not.toBeNull();
  });
});
