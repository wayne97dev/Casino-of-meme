import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      buffer: true, // Abilita il polyfill per Buffer
      global: true, // Abilita il polyfill per global (opzionale, ma utile per alcune librerie)
    }),
  ],
  define: {
    'process.env': process.env, // Necessario per leggere .env in alcuni casi
  },
  optimizeDeps: {
    include: ['three'], // Ottimizza three per @react-three/postprocessing
  },
  resolve: {
    alias: {
      three: 'three', // Assicura che three venga risolto correttamente
    },
  },
});