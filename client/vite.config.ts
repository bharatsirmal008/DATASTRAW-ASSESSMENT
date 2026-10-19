import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_');
  if (process.env.VERCEL) {
    let validOrigin = false;
    try {
      const url = new URL(environment.VITE_API_URL);
      validOrigin = url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;
    } catch { /* Report the configuration requirement without printing its value. */ }
    if (!validOrigin) throw new Error('Set VITE_API_URL to the deployed server HTTPS origin (without /api) in the client Vercel project, then rebuild.');
  }
  return {
    server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
    plugins: [react(), tailwindcss()],
  };
});
