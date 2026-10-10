import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// VITE_API_BASE is set per-deployment in Vercel's environment variables.
// Example: https://kapebara-pos.onrender.com
// Leave blank for local dev (proxy handles it).
const apiBase = process.env.VITE_API_BASE || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        customer: resolve(__dirname, 'customer.html')
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: apiBase,
        changeOrigin: true
      },
      '/uploads': {
        target: apiBase,
        changeOrigin: true
      }
    }
  }
});
