import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: './', // Use relative paths for assets
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
        main: resolve(__dirname, 'index.html'), // Ensure this points to your main HTML file
      },
      output: {
        assetFileNames: 'assets/[name].[ext]', // Ensure assets are placed in the correct folder
      },
    },
  },
  publicDir: false, // Disable default public folder behavior
});