import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // Build from the root
  build: {
    outDir: 'dist', // Output to a dedicated dist directory
    emptyOutDir: true, // Clean the output directory before building
    assetsDir: 'assets', // Keep bundled assets in assets/ folder
    assetsInclude: ['views/*.html'], // Include views folder HTML files in build
  },
});