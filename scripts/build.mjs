import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const electronOut = path.join(root, 'electron');
const cleanOnly = process.argv.includes('--clean');
const watch = process.argv.includes('--watch');
const buildElectron = process.argv.includes('--electron');
const buildV2 = process.argv.includes('--v2');

// ─── Frontend ─────────────────────────────────────────────────
async function buildFrontend() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, 'src', 'ui', 'styles.css'), path.join(dist, 'styles.css'));
  await cp(path.join(root, 'index.html'), path.join(dist, 'index.html'));
  await cp(path.join(root, 'build', 'icon.png'), path.join(dist, 'app-icon.png'));
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

async function buildV2Files() {
  const v2Dist = path.join(root, 'dist-v2');
  const v2Main = path.join(root, 'electron-v2');
  await rm(v2Dist, { recursive: true, force: true });
  await rm(v2Main, { recursive: true, force: true });
  await mkdir(v2Dist, { recursive: true });
  await mkdir(v2Main, { recursive: true });
  await cp(path.join(root, 'src-v2', 'renderer', 'index.html'), path.join(v2Dist, 'index.html'));
  await cp(path.join(root, 'src-v2', 'renderer', 'assistant.html'), path.join(v2Dist, 'assistant.html'));
  await cp(path.join(root, 'src-v2', 'renderer', 'styles.css'), path.join(v2Dist, 'styles.css'));
  await cp(path.join(root, 'build', 'icon.png'), path.join(v2Dist, 'app-icon.png'));
  await build({ entryPoints:[path.join(root,'src-v2','renderer','index.tsx')], outfile:path.join(v2Dist,'index.js'), bundle:true, format:'iife', platform:'browser', target:'es2020', logLevel:'info' });
  // Live Design Assistant window bundle (separate entry, same secure preload).
  await build({ entryPoints:[path.join(root,'src-v2','renderer','design-assistant','assistant.tsx')], outfile:path.join(v2Dist,'assistant.js'), bundle:true, format:'iife', platform:'browser', target:'es2020', logLevel:'info' });
  // 'playwright' is an OPTIONAL dependency (only needed for the visible-browser
  // asset fallback). Mark it external so the bundle builds whether or not it is
  // installed; browser-controller loads it lazily and degrades gracefully.
  for (const file of ['main.ts','preload.ts']) await build({ entryPoints:[path.join(root,'src-v2','main',file)], outfile:path.join(v2Main,file.replace(/\.ts$/,'.js')), bundle:true, platform:'node', target:'node20', format:'cjs', external:['electron','playwright','sharp','@img/sharp-win32-x64'], logLevel:'info' });
}

// ─── Main ─────────────────────────────────────────────────────
if (cleanOnly) {
  await rm(dist, { recursive: true, force: true });
  process.exit(0);
}

if (buildV2) {
  console.log('Building isolated V2 desktop…');
  await buildV2Files();
  console.log('V2 desktop build complete.');
} else if (buildElectron) {
  console.log('Building Electron + backend bundle…');
  await buildElectronFiles();
  console.log('Electron build complete.');
} else {
  console.log('Building frontend…');
  await buildFrontend();
  console.log('Frontend build complete.');
}
