import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, rmSync, copyFileSync, renameSync } from 'node:fs';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const DATA_DIR = join(homedir(), 'AppData', 'Roaming', 'snhs-poster-agent');

export function dataDir(): string {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  return DATA_DIR;
}

export function ensureDir(p: string): string {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
  return p;
}

export function readText(p: string): string {
  return readFileSync(p, 'utf-8');
}

export function writeText(p: string, content: string): void {
  const d = dirname(p);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  writeFileSync(p, content, 'utf-8');
}

export function readBinary(p: string): Uint8Array {
  return new Uint8Array(readFileSync(p));
}

export function writeBinary(p: string, data: Uint8Array): void {
  const d = dirname(p);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  writeFileSync(p, data);
}

export function listDir(p: string): { name: string; isFile: boolean; isFolder: boolean; size: number; mtime: Date }[] {
  if (!existsSync(p)) return [];
  return readdirSync(p, { withFileTypes: true }).map(e => {
    const full = join(p, e.name);
    const s = statSync(full);
    return { name: e.name, isFile: e.isFile(), isFolder: e.isDirectory(), size: s.size, mtime: s.mtime };
  });
}

export function deleteEntry(p: string): void {
  if (!existsSync(p)) return;
  const s = statSync(p);
  if (s.isDirectory()) rmSync(p, { recursive: true, force: true });
  else unlinkSync(p);
}

export function copyEntry(src: string, dst: string): void {
  const d = dirname(dst);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  const s = statSync(src);
  if (s.isDirectory()) {
    if (!existsSync(dst)) mkdirSync(dst, { recursive: true });
    for (const e of readdirSync(src)) copyEntry(join(src, e), join(dst, e));
  } else {
    copyFileSync(src, dst);
  }
}

export function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function projectDir(projectId: string): string {
  return ensureDir(join(DATA_DIR, 'projects', projectId));
}

export function templatesDir(): string {
  return ensureDir(join(DATA_DIR, 'templates'));
}

export function modelsDir(): string {
  return ensureDir(join(DATA_DIR, 'models'));
}

export function profileFile(): string {
  return join(DATA_DIR, 'school-profile.json');
}

export function profileMediaDir(role: string): string {
  return ensureDir(join(DATA_DIR, 'profile-media', role));
}

export function assetsDir(): string {
  return ensureDir(join(DATA_DIR, 'assets'));
}

export function assetFolderTokenFile(): string {
  return join(DATA_DIR, 'asset-folder.txt');
}

export function logDir(): string {
  return ensureDir(join(DATA_DIR, 'logs'));
}
