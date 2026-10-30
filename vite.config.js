import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // O frontend chama /api; em desenvolvimento o Vite repassa para o backend.
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { chunkSizeWarningLimit: 800 },
});
