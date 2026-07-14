import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { getStorageManager, StorageManager } from './storage/storage-manager';
import type { StoragePaths } from './storage/storage-paths';
import { REQUIRED_DIRECTORIES } from './storage/storagePaths.mjs';
import { assertContained, sanitizeFilename } from './storage/storagePaths.mjs';
import { validateStorageRoot } from './storage/storage-validator';

export const folders = REQUIRED_DIRECTORIES;

let _mgr: StorageManager | null = null;

export async function ensureStorage(): Promise<StorageManager> {
  if (!_mgr) { _mgr = await getStorageManager(); }
  return _mgr;
}

export function baseFolder(): string {
  if (!_mgr) throw new Error('StorageManager not initialized. Call ensureStorage() during app startup.');
  return _mgr.getStorageRoot();
}

export function containedPath(candidate: string): boolean {
  if (!_mgr) throw new Error('StorageManager not initialized.');
  return _mgr.containedPath(candidate);
}

export async function initializeStorage(): Promise<void> {
  _mgr = await getStorageManager();
  await _mgr.reinit();
}

export async function atomicJson(path: string, value: unknown): Promise<void> {
  if (!containedPath(path)) throw new Error('PATH_OUTSIDE_APP_STORAGE');
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
  await rename(temporary, path);
}

export function getStorageManagerInstance(): StorageManager {
  if (!_mgr) throw new Error('StorageManager not initialized.');
  return _mgr;
}

export function getStoragePaths(): StoragePaths { return getStorageManagerInstance().getPaths(); }

export interface JobWorkspace { root: string; input: string; assets: string; output: string }

export async function createJobWorkspace(jobId: string): Promise<JobWorkspace> {
  const safeId = sanitizeFilename(jobId, 'job');
  const root = assertContained(baseFolder(), join(getStoragePaths().getJobsDirectory(), safeId));
  const workspace = { root, input: join(root, 'input'), assets: join(root, 'assets'), output: join(root, 'output') };
  await Promise.all(Object.values(workspace).map((directory) => mkdir(directory, { recursive: true })));
  return workspace;
}

export async function assertStorageReady(minimumFreeBytes = 1024 * 1024 * 1024): Promise<void> {
  const validation = await validateStorageRoot(baseFolder());
  if (!validation.valid) throw new Error(`STORAGE_ROOT_UNAVAILABLE: ${validation.errors.join(' ')}`);
  if (validation.freeBytes > 0 && validation.freeBytes < minimumFreeBytes) {
    throw new Error(`INSUFFICIENT_STORAGE_SPACE: ${validation.freeBytes} bytes free; ${minimumFreeBytes} required before Photoshop export.`);
  }
}
