import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;

// GitHub Pages serves from /<repo>/ — CI sets VITE_BASE; local dev stays at /.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: { playcanvas: ['playcanvas'] },
      },
    },
  },
});
