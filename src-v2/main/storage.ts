import { app } from 'electron';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export const folders = ['Brand', 'Templates', 'Assets', 'Reference Posters', 'Projects', 'Outputs', 'Jobs', 'Logs', 'Cache'] as const;

export function baseFolder(): string { return join(app.getPath('documents'), 'SNHS Smart Poster Agent'); }
export function containedPath(candidate: string): boolean {
  const root = resolve(baseFolder()) + sep;
  return resolve(candidate).startsWith(root);
}
export async function initializeStorage(): Promise<void> {
  await Promise.all(folders.map((folder) => mkdir(join(baseFolder(), folder), { recursive: true })));
}
export async function atomicJson(path: string, value: unknown): Promise<void> {
  if (!containedPath(path)) throw new Error('PATH_OUTSIDE_APP_STORAGE');
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporary, path);
}
