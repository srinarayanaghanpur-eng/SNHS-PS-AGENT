import { app } from 'electron';
import { mkdir, readFile, writeFile, stat, rm, readdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { StoragePaths } from './storage-paths';
import { validateStorageRoot } from './storage-validator';
import { estimateMigration, executeMigration } from './storage-migration';
import type { StorageSettings, StorageUsageSummary, MigrationPlan, MigrationResult, ValidationResult } from './storage-types';

const SETTINGS_FILE = 'storage-config.json';
const SETTINGS_SCHEMA_VERSION = 2;

const DEFAULT_ROOT = 'E:\\AI AGENTS\\SNHS SMART POSTER AGENT';

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
    if (saved && saved.rootPath && existsSync(saved.rootPath.split('\\').slice(0, 2).join('\\') + '\\')) {
      this._rootPath = saved.rootPath;
    } else if (saved && saved.rootPath) {
      const drive = saved.rootPath.slice(0, 2);
      if (/^[A-Za-z]:$/.test(drive) && !existsSync(drive + '\\')) {
        this._rootPath = DEFAULT_ROOT;
      } else {
        this._rootPath = DEFAULT_ROOT;
      }
    } else {
      this._rootPath = DEFAULT_ROOT;
    }
    this.paths = new StoragePaths(this._rootPath);
    await this.saveSettings({ rootPath: this._rootPath });
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

  async setStorageRoot(newRoot: string, migrateExisting = false): Promise<void> {
    const resolved = resolve(newRoot);
    const paths = new StoragePaths(resolved);

    if (migrateExisting && this._rootPath && this._rootPath !== resolved) {
      const result = await executeMigration(this._rootPath, resolved, 'move');
      if (!result.success) {
        const dirs = paths.getAllDirectories();
        await Promise.all(dirs.map((d) => mkdir(d, { recursive: true })));
        this._rootPath = resolved;
        this.paths = paths;
        await this.saveSettings({ rootPath: resolved });
        throw new Error(`Partial migration: ${result.filesMigrated} moved, ${result.failedFiles} failed. Check ${result.logPath}`);
      }
    } else {
      const dirs = paths.getAllDirectories();
      await Promise.all(dirs.map((d) => mkdir(d, { recursive: true })));
    }

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
        const entries = await readdir(d, { withFileTypes: true });
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
    const cacheDirs = [this.paths.getCacheDirectory(), this.paths.getCachePreviewsDirectory(), this.paths.getCacheThumbnailsDirectory(), this.paths.getCacheTemporaryDirectory()];
    const tempDir = this.paths.getCacheTemporaryDirectory();
    for (const ds of dirStats) {
      if (cacheDirs.some((cd) => ds.path === cd)) cacheSizeBytes += ds.sizeBytes;
      if (ds.path === tempDir) tempSizeBytes += ds.sizeBytes;
    }

    const drive = this._rootPath.slice(0, 2);
    let totalBytes = 0, freeBytes = 0, usedBytes = 0;
    try {
      const { execSync } = require('node:child_process');
      const result = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get Size,FreeSpace /format:csv`, { encoding: 'utf8', timeout: 5000 });
      const lines = result.trim().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        if (line.includes('Node')) continue;
        const parts = line.split(',').map((s: string) => s.trim());
        if (parts.length >= 3 && /^[A-Za-z]:/.test(parts[1])) {
          freeBytes = parseInt(parts[2], 10) || 0;
          totalBytes = parseInt(parts[3], 10) || 0;
          break;
        }
      }
      if (totalBytes > 0) usedBytes = totalBytes - freeBytes;
    } catch {
      try {
        const { execSync } = require('node:child_process');
        const result = execSync(`fsutil volume diskfree ${drive}`, { encoding: 'utf8', timeout: 5000 });
        const totalMatch = result.match(/Total\s+bytes\s+:\s+(\d+)/i);
        const freeMatch = result.match(/Total\s+free\s+bytes\s+:\s+(\d+)/i);
        if (totalMatch) totalBytes = parseInt(totalMatch[1], 10);
        if (freeMatch) freeBytes = parseInt(freeMatch[1], 10);
        usedBytes = totalBytes - freeBytes;
      } catch { }
    }

    return {
      rootPath: this._rootPath,
      disk: { totalBytes, usedBytes, freeBytes, usagePercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0 },
      directories: dirStats,
      cacheSizeBytes,
      tempSizeBytes,
      directoryCount: dirStats.filter((d) => d.fileCount > 0 || d.sizeBytes > 0).length,
    };
  }

  // ── Cache / Temp cleanup ──

  async clearCache(): Promise<{ filesDeleted: number; bytesRecovered: number }> {
    const dirs = [this.paths.getCacheDirectory(), this.paths.getCachePreviewsDirectory(), this.paths.getCacheThumbnailsDirectory()];
    let filesDeleted = 0, bytesRecovered = 0;
    for (const dir of dirs) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isFile()) continue;
          const ext = e.name.split('.').pop()?.toLowerCase();
          const preserveExts = ['psd', 'png', 'jpg', 'jpeg'];
          if (preserveExts.includes(ext || '')) continue;
          const full = join(dir, e.name);
          try {
            const s = await stat(full);
            bytesRecovered += s.size;
            await rm(full, { force: true });
            filesDeleted++;
          } catch { }
        }
      } catch { }
    }
    return { filesDeleted, bytesRecovered };
  }

  async clearTemp(): Promise<{ filesDeleted: number; bytesRecovered: number }> {
    const dir = this.paths.getCacheTemporaryDirectory();
    let filesDeleted = 0, bytesRecovered = 0;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const now = Date.now();
      for (const e of entries) {
        if (!e.isFile()) continue;
        const ext = e.name.split('.').pop()?.toLowerCase();
        const preserveExts = ['psd', 'png', 'jpg', 'jpeg'];
        if (preserveExts.includes(ext || '')) continue;
        const full = join(dir, e.name);
        try {
          const s = await stat(full);
          const ageMs = now - s.mtimeMs;
          if (ageMs < 60 * 60 * 1000) continue;
          bytesRecovered += s.size;
          await rm(full, { force: true });
          filesDeleted++;
        } catch { }
      }
    } catch { }
    return { filesDeleted, bytesRecovered };
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
