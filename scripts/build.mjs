import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const electronOut = path.join(root, 'electron');
const cleanOnly = process.argv.includes('--clean');
const watch = process.argv.includes('--watch');
const buildElectron = process.argv.includes('--electron');

// ─── Frontend ─────────────────────────────────────────────────
async function buildFrontend() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, 'src', 'ui', 'styles.css'), path.join(dist, 'styles.css'));
  await cp(path.join(root, 'index.html'), path.join(dist, 'index.html'));
  const options = {
    entryPoints: [path.join(root, 'src', 'index.tsx')],
    outfile: path.join(dist, 'index.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
    logLevel: 'info'
  };
  if (watch) { const ctx = await context(options); await ctx.watch(); console.log('Watching frontend sources…'); }
  else await build(options);
}

// ─── Electron main & preload (includes bundled backend) ────────
async function buildElectronFiles() {
  // Build IPC handlers + backend modules bundled into main.js
  for (const file of ['main.ts', 'preload.ts']) {
    const entry = path.join(electronOut, file);
    const outfile = path.join(electronOut, file.replace(/\.ts$/, '.js'));
    const opts = {
      entryPoints: [entry],
      outfile,
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      sourcemap: false,
      external: ['electron'],
      logLevel: 'info',
    };
    await build(opts);
  }
}

// ─── Main ─────────────────────────────────────────────────────
if (cleanOnly) {
  await rm(dist, { recursive: true, force: true });
  process.exit(0);
}

if (buildElectron) {
  console.log('Building Electron + backend bundle…');
  await buildElectronFiles();
  console.log('Electron build complete.');
} else {
  console.log('Building frontend…');
  await buildFrontend();
  console.log('Frontend build complete.');
}
