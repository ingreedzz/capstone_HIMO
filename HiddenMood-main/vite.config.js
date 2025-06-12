import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: './',
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'views', dest: '' }, // Copy `views/` to `dist/views/`
        { src: 'assets', dest: '' }, // Copy `assets/` to `dist/assets/`
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  publicDir: false, // Disable default public folder behavior
});