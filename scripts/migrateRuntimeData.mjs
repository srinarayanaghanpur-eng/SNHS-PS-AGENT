#!/usr/bin/env node
import { copyFile, mkdir, readFile, readdir, rename, rmdir, stat, unlink, utimes, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { ensureStorageDirectoriesSync, sanitizeFilename } from '../src-v2/main/storage/storagePaths.mjs';

const execute = process.argv.includes('--execute');
const repository = resolve(import.meta.dirname, '..');
const paths = ensureStorageDirectoriesSync(process.env.SNHS_AGENT_DATA_ROOT);
const runId = new Date().toISOString().replace(/[:.]/g, '-');

const runtimeDirectories = [
  ['studio-output', join(paths.acceptance, runId, 'studio-output')],
  ['studio-output-real', join(paths.acceptance, runId, 'studio-output-real')],
  ['studio-output-collage', join(paths.acceptance, runId, 'studio-output-collage')],
  ['studio-output-collage2', join(paths.acceptance, runId, 'studio-output-collage2')],
  ['smoke-output', join(paths.testRuns, runId, 'smoke-output')],
  ['test-output', join(paths.testRuns, runId, 'test-output')],
  ['test-output-diff', join(paths.testRuns, runId, 'test-output-diff')],
  ['test-pro-output', join(paths.testRuns, runId, 'test-pro-output')],
  ['acceptance-results', join(paths.acceptance, runId, 'acceptance-results')],
  ['__SNHS_OUTPUT__', join(paths.jobs, `legacy-analysis-${runId}`)],
];

const runtimeFiles = [
  ['electron-debug.log', join(paths.logs, `electron-debug-${runId}.log`)],
  ['electron-stdout.log', join(paths.logs, `electron-stdout-${runId}.log`)],
  ['storage-audit.txt', join(paths.logs, `repository-storage-search-${runId}.txt`)],
  ['_probe.txt', join(paths.logs, `legacy-probe-${runId}.txt`)],
];
const legacyRuntimeDirectories = [
  [join(paths.root, 'BrandKits'), paths.schoolProfiles],
];

const documentsRoot = join(process.env.USERPROFILE || '', 'Documents', 'SNHS Smart Poster Agent');
const roamingRoot = join(process.env.APPDATA || '', 'snhs-smart-poster-agent');
const legacyCentralRoot = 'E:\\AI AGENTS\\SNHS SMART POSTER AGENT';
const externalRuntimeDirectories = [
  [join(legacyCentralRoot, 'jobs'), paths.jobs],
  [join(legacyCentralRoot, 'outputs', 'psd'), paths.psd],
  [join(legacyCentralRoot, 'outputs', 'png'), paths.png],
  [join(legacyCentralRoot, 'outputs', 'jpg'), paths.jpg],
  [join(legacyCentralRoot, 'outputs', 'pdf'), paths.pdf],
  [join(legacyCentralRoot, 'outputs', 'legacy-outputs'), join(paths.outputs, 'legacy-outputs')],
  [join(legacyCentralRoot, 'cache'), paths.cache],
  [join(legacyCentralRoot, 'temp'), paths.cacheTemporary],
  [join(legacyCentralRoot, 'assets'), paths.assets],
  [join(legacyCentralRoot, 'poster-brain'), paths.posterBrain],
  [join(legacyCentralRoot, 'history'), paths.history],
  [join(legacyCentralRoot, 'logs'), paths.logs],
  [join(legacyCentralRoot, 'backups'), paths.backups],
  [join(legacyCentralRoot, 'settings'), paths.settings],
  [join(legacyCentralRoot, 'acceptance'), paths.acceptance],
  [join(legacyCentralRoot, 'test-runs'), paths.testRuns],
  [join(documentsRoot, 'Assets'), join(paths.assets, 'legacy-assets')],
  [join(documentsRoot, 'Brand'), join(paths.assets, 'legacy-brand')],
  [join(documentsRoot, 'BrandKits'), paths.schoolProfiles],
  [join(documentsRoot, 'Cache'), join(paths.cache, 'legacy-cache')],
  [join(documentsRoot, 'Jobs'), join(paths.jobs, 'legacy-jobs')],
  [join(documentsRoot, 'Logs'), join(paths.logs, 'legacy-logs')],
  [join(documentsRoot, 'Outputs'), join(paths.outputs, 'legacy-outputs')],
  [join(documentsRoot, 'Projects'), join(paths.jobs, 'legacy-projects')],
  [join(documentsRoot, 'Reference Posters'), join(paths.posterBrain, 'reference-posters')],
  [join(documentsRoot, 'Templates'), paths.templates],
  [join(roamingRoot, 'blob_storage'), join(paths.cache, 'electron-session', 'blob_storage')],
  [join(roamingRoot, 'Cache'), join(paths.cache, 'electron-cache', 'Cache')],
  [join(roamingRoot, 'Code Cache'), join(paths.cache, 'electron-cache', 'Code Cache')],
  [join(roamingRoot, 'DawnGraphiteCache'), join(paths.cache, 'electron-cache', 'DawnGraphiteCache')],
  [join(roamingRoot, 'DawnWebGPUCache'), join(paths.cache, 'electron-cache', 'DawnWebGPUCache')],
  [join(roamingRoot, 'GPUCache'), join(paths.cache, 'electron-cache', 'GPUCache')],
  [join(roamingRoot, 'Local Storage'), join(paths.cache, 'electron-session', 'Local Storage')],
  [join(roamingRoot, 'Network'), join(paths.cache, 'electron-session', 'Network')],
  [join(roamingRoot, 'Session Storage'), join(paths.cache, 'electron-session', 'Session Storage')],
  [join(roamingRoot, 'Shared Dictionary'), join(paths.cache, 'electron-session', 'Shared Dictionary')],
];
const externalRuntimeFiles = [
  [join(roamingRoot, 'settings.json'), join(paths.settings, 'legacy-app-settings.json')],
  [join(roamingRoot, 'Preferences'), join(paths.settings, 'electron-user-data', 'Preferences')],
  [join(roamingRoot, 'Local State'), join(paths.settings, 'electron-user-data', 'Local State')],
  [join(roamingRoot, 'DIPS'), join(paths.settings, 'electron-user-data', 'DIPS')],
  [join(roamingRoot, 'DIPS-wal'), join(paths.settings, 'electron-user-data', 'DIPS-wal')],
  [join(roamingRoot, 'SharedStorage'), join(paths.settings, 'electron-user-data', 'SharedStorage')],
  [join(roamingRoot, 'SharedStorage-wal'), join(paths.settings, 'electron-user-data', 'SharedStorage-wal')],
  [join(roamingRoot, 'DevToolsActivePort'), join(paths.cache, 'electron-session', 'DevToolsActivePort')],
  [join(roamingRoot, 'lockfile'), join(paths.cache, 'electron-session', 'lockfile')],
];

async function enumerate(source, destination) {
  const entries = await readdir(source, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const src = join(source, entry.name);
    const dest = join(destination, entry.name);
    if (entry.isDirectory()) files.push(...await enumerate(src, dest));
    else if (entry.isFile()) {
      const info = await stat(src);
      files.push({ source: src, requestedDestination: dest, bytes: info.size, mtime: info.mtime.toISOString() });
    }
  }
  return files;
}

async function collisionSafe(target) {
  if (!existsSync(target)) return target;
  const extension = extname(target);
  const stem = basename(target, extension);
  for (let index = 1; index < 10_000; index++) {
    const candidate = join(dirname(target), `${stem}__migrated_${String(index).padStart(3, '0')}${extension}`);
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`Unable to allocate collision-safe destination for ${target}`);
}

const manifest = {
  schemaVersion: 1,
  runId,
  mode: execute ? 'move' : 'plan',
  repository,
  dataRoot: paths.root,
  createdAt: new Date().toISOString(),
  protectedRepositoryFixtures: ['acceptance-assets', 'acceptance-tests', 'studio-assets'],
  files: [],
  summary: { planned: 0, moved: 0, skipped: 0, failed: 0, totalBytes: 0 },
};

for (const [name, target] of runtimeDirectories) {
  const source = join(repository, name);
  if (!existsSync(source)) continue;
  manifest.files.push(...await enumerate(source, target));
}
for (const [source, target] of legacyRuntimeDirectories) {
  if (resolve(source).toLowerCase() === resolve(target).toLowerCase() || !existsSync(source)) continue;
  manifest.files.push(...await enumerate(source, target));
}
for (const [source, target] of externalRuntimeDirectories) {
  if (!source || resolve(source).toLowerCase() === resolve(target).toLowerCase() || !existsSync(source)) continue;
  manifest.files.push(...await enumerate(source, target));
}
for (const [name, target] of runtimeFiles) {
  const source = join(repository, name);
  if (!existsSync(source)) continue;
  const info = await stat(source);
  manifest.files.push({ source, requestedDestination: target, bytes: info.size, mtime: info.mtime.toISOString() });
}
for (const [source, target] of externalRuntimeFiles) {
  if (!existsSync(source)) continue;
  const info = await stat(source);
  manifest.files.push({ source, requestedDestination: target, bytes: info.size, mtime: info.mtime.toISOString() });
}

// Generated media loose in the repository root is runtime data. Packaged and
// fixture assets inside source/build/tests are deliberately not searched.
for (const entry of await readdir(repository, { withFileTypes: true })) {
  if (!entry.isFile() || !/\.(?:psd|png|jpe?g|pdf)$/i.test(entry.name)) continue;
  const source = join(repository, entry.name);
  const extension = extname(entry.name).toLowerCase();
  const targetDir = extension === '.psd' ? paths.psd : extension === '.png' ? paths.png : extension === '.pdf' ? paths.pdf : paths.jpg;
  const info = await stat(source);
  manifest.files.push({ source, requestedDestination: join(targetDir, sanitizeFilename(entry.name)), bytes: info.size, mtime: info.mtime.toISOString() });
}

manifest.summary.planned = manifest.files.length;
manifest.summary.totalBytes = manifest.files.reduce((sum, item) => sum + item.bytes, 0);

if (execute) {
  for (const item of manifest.files) {
    try {
      const destination = await collisionSafe(item.requestedDestination);
      await mkdir(dirname(destination), { recursive: true });
      try { await rename(item.source, destination); }
      catch {
        await copyFile(item.source, destination);
        await utimes(destination, new Date(item.mtime), new Date(item.mtime));
        await unlink(item.source);
      }
      item.destination = destination;
      item.status = destination === item.requestedDestination ? 'moved' : 'moved-renamed-to-avoid-overwrite';
      manifest.summary.moved++;
    } catch (error) {
      item.status = 'failed';
      item.error = error instanceof Error ? error.message : String(error);
      manifest.summary.failed++;
    }
  }

  // Only remove directories proven empty after file-by-file migration.
  for (const [name] of runtimeDirectories) {
    const root = join(repository, name);
    const dirs = [];
    const collect = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) if (entry.isDirectory()) await collect(join(dir, entry.name));
      dirs.push(dir);
    };
    if (existsSync(root)) await collect(root);
    for (const dir of dirs) await rmdir(dir).catch(() => undefined);
  }
  for (const [root] of legacyRuntimeDirectories) {
    const dirs = [];
    const collect = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) if (entry.isDirectory()) await collect(join(dir, entry.name));
      dirs.push(dir);
    };
    if (existsSync(root)) await collect(root);
    for (const dir of dirs) await rmdir(dir).catch(() => undefined);
  }
  for (const [root] of externalRuntimeDirectories) {
    const dirs = [];
    const collect = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) if (entry.isDirectory()) await collect(join(dir, entry.name));
      dirs.push(dir);
    };
    if (existsSync(root)) await collect(root);
    for (const dir of dirs) await rmdir(dir).catch(() => undefined);
  }

  // Runtime JSON stores absolute asset/output paths. Rewrite those references
  // after the legacy central root has moved so profiles, job metadata, and
  // Recent Edits do not point back to an empty directory.
  const jsonFiles = [];
  const collectJson = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) await collectJson(absolute);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) jsonFiles.push(absolute);
    }
  };
  const rewriteValue = (value) => {
    if (typeof value === 'string' && value.toLowerCase().startsWith(legacyCentralRoot.toLowerCase())) {
      return paths.root + value.slice(legacyCentralRoot.length);
    }
    if (Array.isArray(value)) return value.map(rewriteValue);
    if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) value[key] = rewriteValue(value[key]);
    }
    return value;
  };
  await collectJson(paths.root);
  let rewrittenJson = 0;
  for (const file of jsonFiles) {
    try {
      const original = JSON.parse(await readFile(file, 'utf8'));
      const before = JSON.stringify(original);
      const rewritten = rewriteValue(original);
      if (JSON.stringify(rewritten) === before) continue;
      const temporaryJson = `${file}.${process.pid}.rewrite.tmp`;
      await writeFile(temporaryJson, JSON.stringify(rewritten, null, 2), 'utf8');
      await rename(temporaryJson, file);
      rewrittenJson++;
    } catch { /* non-JSON or partial runtime records are left untouched */ }
  }
  manifest.summary.rewrittenJson = rewrittenJson;
}

manifest.completedAt = new Date().toISOString();
const manifestPath = join(paths.logs, 'storage-migration.json');
if (existsSync(manifestPath)) {
  try {
    const previous = JSON.parse(await readFile(manifestPath, 'utf8'));
    const archivePath = join(paths.logs, `storage-migration-${sanitizeFilename(previous.runId || 'previous')}.json`);
    if (!existsSync(archivePath)) await copyFile(manifestPath, archivePath);
    manifest.previousManifest = archivePath;
  } catch { /* a corrupt old manifest never blocks data migration */ }
}
const temporary = `${manifestPath}.${process.pid}.tmp`;
await writeFile(temporary, JSON.stringify(manifest, null, 2), 'utf8');
await rename(temporary, manifestPath);
process.stdout.write(JSON.stringify({ execute, manifestPath, summary: manifest.summary, dataRoot: paths.root }, null, 2) + '\n');
