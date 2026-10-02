import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' يجعل الموقع يعمل من أي مجلد (Netlify / GitHub Pages / Vercel)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
});
