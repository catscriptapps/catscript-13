// /vite.config.js

// Vite configuration for Laravel with auto-collection of page scripts and manifest generation
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// === Auto-collect all page JS files in resources/js/pages ===
const pageScriptsDir = path.resolve(__dirname, 'resources/js/pages');
const pageScripts = fs.existsSync(pageScriptsDir)
  ? fs.readdirSync(pageScriptsDir)
      .filter(file => file.endsWith('.js'))
      .map(file => path.join('resources/js/pages', file))
  : [];

// === Helper: Generate page manifest after build ===
function generatePageManifest() {
  return {
    name: 'generate-page-manifest',
    closeBundle() {
      try {
        const outputDir = path.resolve(__dirname, 'public/assets/js');
        if (!fs.existsSync(outputDir)) return;

        const files = fs.readdirSync(outputDir)
          .filter(f => f.endsWith('-page.min.js'))
          .map(f => f.replace('.min.js', ''));

        const manifestPath = path.join(outputDir, 'page-manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(files, null, 2));

        // build.json: a hash of every built script — the ?v= app.js puts on
        // the page scripts it loads (assetBuildId() in server/helpers.php)
        const hash = crypto.createHash('sha1');
        fs.readdirSync(outputDir).filter(f => f.endsWith('.js')).sort()
          .forEach(f => { hash.update(f); hash.update(fs.readFileSync(path.join(outputDir, f))); });
        fs.writeFileSync(path.join(outputDir, 'build.json'), JSON.stringify({ id: hash.digest('hex').slice(0, 12) }) + '\n');

        console.log(`✅ page-manifest.json generated with ${files.length} entries.`);
      } catch (err) {
        console.error('⚠️ Failed to generate page-manifest.json:', err);
      }
    },
  };
}

// === Main Vite Config ===
export default defineConfig({
  plugins: [
    laravel({
      // Force Vite to treat all page scripts as entry points
      input: [
        'resources/css/app.css',
        'resources/js/app.js',
        ...pageScripts, // ✅ every page JS included
      ],
      refresh: [
        './resources/views/**/*.php',
        './resources/js/**/*.js',
      ],
    }),
    generatePageManifest(), // Generate manifest for SPA dynamic loading
  ],
  build: {
    outDir: 'public/assets',
    emptyOutDir: true, // old hashed chunks would otherwise pile up
    rollupOptions: {
      output: {
        // Name entries by their SOURCE file, not chunk.name: both
        // resources/js/app.js and resources/css/app.css are entries called
        // "app", and mapping every "app" chunk to js/app.min.js made Rollup
        // rename whichever lost the race to app.min2.js — so some builds
        // shipped no app.min.js at all (404, no JS, no SPA navigation).
        entryFileNames: chunk => {
          const src = (chunk.facadeModuleId || '').replace(/\\/g, '/');
          if (src.endsWith('/resources/js/app.js')) return 'js/app.min.js';
          if (src.endsWith('.css')) return 'js/[name]-css-entry.min.js'; // CSS entry's empty JS facade
          return `js/${chunk.name}.min.js`;
        },
        // Shared chunks carry a content hash: page scripts import them by
        // file name, so a fixed name let browsers keep running a stale copy
        // (and two same-named chunks collided into guest-store.min2.js)
        chunkFileNames: 'js/[name]-[hash].min.js',
        // Only the main stylesheet is css/app.min.css (what the layouts link);
        // CSS pulled in by other modules (e.g. AOS via utils/animations.js)
        // keeps its own name instead of colliding into app.min2.css.
        assetFileNames: assetInfo => {
          const name = assetInfo.names?.[0] ?? assetInfo.name ?? '';
          if (name === 'app.css') return 'css/app.min.css';
          if (name.endsWith('.css')) return 'css/[name].min.css';
          return 'assets/[name]-[hash][extname]';
        },
      },
      preserveEntrySignatures: 'strict', // ✅ prevents empty chunks from being removed
    },
  },
});
