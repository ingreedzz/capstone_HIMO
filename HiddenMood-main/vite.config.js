import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // Build from the root
  build: {
    outDir: '.', // Output to root directory
    emptyOutDir: false, // Prevent deleting root files
    assetsDir: 'assets', // Keep bundled assets in assets/ folder
    assetsInclude: ['views/*.html'], // Include views folder HTML files in build
  },
});