import { app } from 'electron';
import { mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { StoragePaths } from './storage-paths';
import { validateStorageRoot } from './storage-validator';
import { estimateMigration, executeMigration } from './storage-migration';
import type { StorageSettings, StorageUsageSummary, MigrationPlan, MigrationResult, ValidationResult } from './storage-types';

const SETTINGS_FILE = 'settings.json';
const SETTINGS_SCHEMA_VERSION = 1;

const DEFAULT_ROOT_NAME = 'SNHS Creative Automation Studio';

export class StorageManager {
  private paths!: StoragePaths;
  private _rootPath!: string;

  private constructor() { }

  static async create(): Promise<StorageManager> {
    const mgr = new StorageManager();
    await mgr.init();
    return mgr;
  }

  private async init(): Promise<void> {
    const saved = await this.loadSettings();
    if (saved && saved.rootPath) {
      this._rootPath = saved.rootPath;
    } else {
      this._rootPath = join(app.getPath('documents'), DEFAULT_ROOT_NAME);
      await this.saveSettings({ rootPath: this._rootPath });
    }
    this.paths = new StoragePaths(this._rootPath);
    await this.ensureDirectories();
  }

  // ── Settings persistence ──

  private settingsPath(): string {
    return join(app.getPath('userData'), SETTINGS_FILE);
  }

  private async loadSettings(): Promise<StorageSettings | null> {
    try {
      const raw = await readFile(this.settingsPath(), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private async saveSettings(partial: Partial<StorageSettings>): Promise<StorageSettings> {
    const existing = await this.loadSettings() || { rootPath: '', schemaVersion: SETTINGS_SCHEMA_VERSION, updatedAt: '' };
    const updated: StorageSettings = {
      ...existing,
      ...partial,
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    };
    await mkdir(app.getPath('userData'), { recursive: true });
    await writeFile(this.settingsPath(), JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  }

  // ── Root path ──

  getStorageRoot(): string { return this._rootPath; }

  getPaths(): StoragePaths { return this.paths; }

  // ── Directory creation ──

  private async ensureDirectories(): Promise<void> {
    const dirs = this.paths.getAllDirectories();
    await Promise.all(dirs.map((d) => mkdir(d, { recursive: true }).catch(() => { })));
  }

  // ── Validation ──

  async validateRoot(candidate: string): Promise<ValidationResult> {
    return validateStorageRoot(candidate);
  }

  // ── Change root ──

  async setStorageRoot(newRoot: string): Promise<void> {
    const resolved = resolve(newRoot);
    const paths = new StoragePaths(resolved);
    const dirs = paths.getAllDirectories();
    await Promise.all(dirs.map((d) => mkdir(d, { recursive: true })));
    this._rootPath = resolved;
    this.paths = paths;
    await this.saveSettings({ rootPath: resolved });
  }

  // ── Migration ──

  async estimateMigration(targetRoot: string): Promise<MigrationPlan> {
    return estimateMigration(this._rootPath, targetRoot);
  }

  async migrate(
    targetRoot: string,
    mode: 'move' | 'copy',
    onProgress?: (current: number, total: number, file: string) => void,
  ): Promise<MigrationResult> {
    return executeMigration(this._rootPath, targetRoot, mode, onProgress);
  }

  // ── Storage usage ──

  async getStorageUsage(): Promise<StorageUsageSummary> {
    const dirs = this.paths.getAllDirectories();
    const dirStats = await Promise.all(dirs.map(async (d) => {
      let sizeBytes = 0;
      let fileCount = 0;
      try {
        const entries = await import('node:fs/promises').then((fs) => fs.readdir(d, { withFileTypes: true }));
        for (const e of entries) {
          if (e.isFile()) {
            fileCount++;
            try { sizeBytes += (await stat(join(d, e.name))).size; } catch { }
          }
        }
      } catch { }
      return { path: d, sizeBytes, fileCount };
    }));

    let cacheSizeBytes = 0;
    let tempSizeBytes = 0;
    for (const ds of dirStats) {
      if (ds.path.includes('Cache')) cacheSizeBytes += ds.sizeBytes;
      if (ds.path.endsWith('Temp')) tempSizeBytes += ds.sizeBytes;
    }

    const drive = this._rootPath.slice(0, 2);
    let totalBytes = 0, freeBytes = 0, usedBytes = 0;
    try {
      const { execSync } = require('node:child_process');
      const result = execSync(`fsutil volume diskfree ${drive}`, { encoding: 'utf8', timeout: 5000 });
      const totalMatch = result.match(/Total\s+bytes\s+:\s+(\d+)/i);
      const freeMatch = result.match(/Total\s+free\s+bytes\s+:\s+(\d+)/i);
      if (totalMatch) totalBytes = parseInt(totalMatch[1], 10);
      if (freeMatch) freeBytes = parseInt(freeMatch[1], 10);
      usedBytes = totalBytes - freeBytes;
    } catch { }

    return {
      rootPath: this._rootPath,
      disk: { totalBytes, usedBytes, freeBytes, usagePercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0 },
      directories: dirStats,
      cacheSizeBytes,
      tempSizeBytes,
    };
  }

  // ── Cache / Temp cleanup ──

  async clearCache(): Promise<number> {
    return this.clearDirectory(this.paths.getCacheDirectory(), { preserveExtensions: ['.psd', '.png', '.jpg', '.jpeg'] });
  }

  async clearTemp(): Promise<number> {
    return this.clearDirectory(this.paths.getTempDirectory(), { preserveAgeMinutes: 60 });
  }

  private async clearDirectory(
    dir: string,
    opts?: { preserveExtensions?: string[]; preserveAgeMinutes?: number },
  ): Promise<number> {
    let cleared = 0;
    try {
      const entries = await import('node:fs/promises').then((fs) => fs.readdir(dir, { withFileTypes: true }));
      const now = Date.now();
      for (const e of entries) {
        if (!e.isFile()) continue;
        const ext = e.name.split('.').pop()?.toLowerCase();
        if (opts?.preserveExtensions?.includes(`.${ext}`)) continue;
        const full = join(dir, e.name);
        if (opts?.preserveAgeMinutes) {
          try {
            const s = await stat(full);
            const ageMs = now - s.mtimeMs;
            if (ageMs < opts.preserveAgeMinutes * 60 * 1000) continue;
          } catch { }
        }
        try { await rm(full, { force: true }); cleared++; } catch { }
      }
    } catch { }
    return cleared;
  }

  // ── Security ──

  containedPath(candidate: string): boolean {
    const root = resolve(this._rootPath) + sep;
    return resolve(candidate).toLowerCase().startsWith(root.toLowerCase());
  }

  // ── Re-initialize after migration ──

  async reinit(): Promise<void> {
    await this.ensureDirectories();
  }
}

export type { StorageManager as StorageManagerType };

let instance: StorageManager | null = null;

export async function getStorageManager(): Promise<StorageManager> {
  if (!instance) {
    instance = await StorageManager.create();
  }
  return instance;
}

export function resetStorageManager(): void {
  instance = null;
}
