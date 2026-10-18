import { defineConfig } from 'vite';

// GitHub Pages serves from /<repo>/ — CI sets VITE_BASE; local dev stays at /.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
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
