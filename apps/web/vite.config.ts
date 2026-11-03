import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Valeurs dupliquées de @sq/shared (LOCAL_HOST, ports) : la config Vite est chargée avant
// la résolution des paquets du workspace. Toute écoute se fait sur 127.0.0.1 (§2).
const HOST = '127.0.0.1';
const SERVER = 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: HOST,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': SERVER,
      '/ws': { target: SERVER, ws: true },
    },
  },
  preview: {
    host: HOST,
    port: 4173,
    strictPort: true,
  },
  build: {
    // Pas de source maps en production : le bundle ne doit rien contenir d'inutile.
    sourcemap: false,
  },
});
