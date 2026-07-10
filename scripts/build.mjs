import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const cleanOnly = process.argv.includes('--clean');
const watch = process.argv.includes('--watch');
await rm(dist, { recursive: true, force: true });
if (cleanOnly) process.exit(0);
await mkdir(dist, { recursive: true });
await Promise.all(['manifest.json', 'index.html'].map((f) => cp(path.join(root, f), path.join(dist, f))));
await cp(path.join(root, 'src', 'ui', 'styles.css'), path.join(dist, 'styles.css'));
const options = {
  entryPoints: [path.join(root, 'src', 'index.tsx')],
  outfile: path.join(dist, 'index.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  external: ['photoshop', 'uxp'],
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  logLevel: 'info'
};
if (watch) { const ctx = await context(options); await ctx.watch(); console.log('Watching UXP plugin sources…'); }
else await build(options);
