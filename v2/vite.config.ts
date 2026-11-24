import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'public',
  build: { outDir: 'dist/public', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
});
