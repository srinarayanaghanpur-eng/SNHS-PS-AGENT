#!/usr/bin/env node
import { readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { createStoragePaths, REQUIRED_DIRECTORIES } from '../src-v2/main/storage/storagePaths.mjs';

const repository = resolve(import.meta.dirname, '..');
const paths = createStoragePaths(process.env.SNHS_AGENT_DATA_ROOT);
const pointerRoot = join(process.env.APPDATA || '', 'snhs-smart-poster-agent');
const reportPath = join(paths.logs, 'storage-audit-final.json');
const ignoredDirectories = new Set(['.git', 'node_modules', 'release', 'dist-v2', 'electron-v2']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json', '.md', '.vbs', '.html', '.css']);
const obsoleteRepositoryDirectories = [
  '__SNHS_OUTPUT__', 'acceptance-results', 'smoke-output', 'studio-output', 'studio-output-real',
  'studio-output-collage', 'studio-output-collage2', 'test-output', 'test-output-diff', 'test-pro-output',
];

async function walk(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile() && textExtensions.has(extname(entry.name).toLowerCase())) files.push(absolute);
  }
  return files;
}

function classification(file, kind) {
  const normalized = file.replace(/\\/g, '/');
  if (normalized.endsWith('/scripts/migrateRuntimeData.mjs')) return 'allowed:migration-compatibility';
  if (normalized.endsWith('/scripts/auditRuntimeStorage.mjs')) return 'allowed:audit-rule';
  if (normalized.includes('/tests/') && kind === 'os-temp') return 'allowed:test-temporary';
  if (normalized.endsWith('/storage/storage-manager.ts') && kind === 'user-data') return 'allowed:tiny-pointer';
  if (normalized.endsWith('/main/main.ts') && kind === 'user-data') return 'allowed:tiny-pointer-bootstrap';
  if (normalized.endsWith('/storage/storage-validator.ts') && kind === 'user-data') return 'allowed:read-only-validation';
  if ((normalized.includes('/photoshop/') || normalized.endsWith('/psdAnalysis.ts') || normalized.endsWith('/photoshop-state-reader.ts')) && kind === 'jsx-placeholder') return 'allowed:replaced-before-photoshop';
  if (normalized.endsWith('/storage/storagePaths.mjs') && kind === 'central-root') return 'allowed:central-default';
  return 'violation';
}

const rules = [
  { kind: 'hardcoded-system-path', regex: /["'`](?:C:)[\\/](?:Users|Windows|Program Files)[\\/][^"'`\r\n]*/gi },
  { kind: 'legacy-electron-path', regex: /app\.getPath\(["'](?:documents|downloads|temp)["']\)/gi },
  { kind: 'legacy-home-path', regex: /homedir\(\)[^\r\n]*(?:Documents|AppData|Outputs|Cache|Jobs|Logs)/gi },
  { kind: 'os-temp', regex: /\btmpdir\(\)/gi },
  { kind: 'user-data', regex: /app\.getPath\(["']userData["']\)/gi },
  { kind: 'jsx-placeholder', regex: /__SNHS_OUTPUT__/g },
  { kind: 'central-root', regex: /E:\\AI AGENTS\\SmartPosterAgent/g },
  { kind: 'legacy-runtime-name', regex: /(?:studio-output(?:-real|-collage2?|-collage)?|test-pro-output|acceptance-results|BrandKits)/g },
];

const findings = [];
for (const file of await walk(repository)) {
  const content = await readFile(file, 'utf8').catch(() => '');
  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    for (const match of content.matchAll(rule.regex)) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push({ file: relative(repository, file), line, kind: rule.kind, match: match[0].slice(0, 180), classification: classification(file, rule.kind) });
    }
  }
}

const checks = [];
for (const directory of REQUIRED_DIRECTORIES) {
  const absolute = join(paths.root, directory);
  checks.push({ name: `required:${directory}`, pass: existsSync(absolute), path: absolute });
}
for (const directory of obsoleteRepositoryDirectories) {
  const absolute = join(repository, directory);
  checks.push({ name: `repository-runtime-absent:${directory}`, pass: !existsSync(absolute), path: absolute });
}

const pointerItems = existsSync(pointerRoot) ? await readdir(pointerRoot, { withFileTypes: true }) : [];
checks.push({
  name: 'c-pointer-only',
  pass: pointerItems.every((entry) => entry.isFile() && entry.name === 'storage-config.json'),
  path: pointerRoot,
  entries: pointerItems.map((entry) => entry.name),
});
checks.push({ name: 'migration-manifest-present', pass: existsSync(join(paths.logs, 'storage-migration.json')), path: join(paths.logs, 'storage-migration.json') });

const outputCounts = {};
for (const [kind, directory] of Object.entries({ psd: paths.psd, png: paths.png, jpg: paths.jpg, pdf: paths.pdf })) {
  let count = 0;
  const countFiles = async (root) => {
    for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
      const absolute = join(root, entry.name);
      if (entry.isDirectory()) await countFiles(absolute);
      else if (entry.isFile()) count++;
    }
  };
  await countFiles(directory);
  outputCounts[kind] = count;
}

const violations = findings.filter((finding) => finding.classification === 'violation');
const failedChecks = checks.filter((check) => !check.pass);
const report = {
  schemaVersion: 1,
  auditedAt: new Date().toISOString(),
  repository,
  dataRoot: paths.root,
  status: violations.length === 0 && failedChecks.length === 0 ? 'pass' : 'fail',
  summary: { sourceFilesScanned: (await walk(repository)).length, findings: findings.length, allowedFindings: findings.length - violations.length, violations: violations.length, failedChecks: failedChecks.length, outputCounts },
  checks,
  findings,
  violations,
};

const temporary = `${reportPath}.${process.pid}.tmp`;
await writeFile(temporary, JSON.stringify(report, null, 2), 'utf8');
await rename(temporary, reportPath);
process.stdout.write(JSON.stringify({ reportPath, status: report.status, summary: report.summary }, null, 2) + '\n');
process.exitCode = report.status === 'pass' ? 0 : 1;
