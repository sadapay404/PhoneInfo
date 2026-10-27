import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { historyDepth } from '../ui/state';

const EXIT_WINDOW_MS = 2000;

function toast(message: string) {
  const el = document.createElement('div');
  el.className = 'back-toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), EXIT_WINDOW_MS);
}

/**
 * Android back button. Inside the app it goes back one screen (the previous section).
 * On the first screen, the first press shows a hint and a second press within 2 seconds
 * closes the app. Does nothing in a normal browser.
 */
export function initNativeBack(): void {
  if (!Capacitor.isNativePlatform()) return;
  let lastPress = 0;
  void App.addListener('backButton', () => {
    if (historyDepth > 0) {
      window.history.back();
      return;
    }
    const now = Date.now();
    if (now - lastPress < EXIT_WINDOW_MS) {
      void App.exitApp();
      return;
    }
    lastPress = now;
    toast('Press back again to close');
  });
}
