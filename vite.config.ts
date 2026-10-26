import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Dev previews are served through a proxied sandbox host; allow it.
    allowedHosts: true,
  },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['src/test/setup.ts'] },
});
