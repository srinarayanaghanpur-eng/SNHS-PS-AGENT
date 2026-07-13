import { readdir, stat, copyFile, mkdir, rename } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { createWriteStream } from 'node:fs';
import type { MigrationPlan, MigrationResult } from './storage-types';
import { StoragePaths } from './storage-paths';

async function countFiles(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await countFiles(full);
        files += sub.files;
        bytes += sub.bytes;
      } else if (entry.isFile()) {
        files++;
        try { bytes += (await stat(full)).size; } catch { }
      }
    }
  } catch { }
  return { files, bytes };
}

export async function estimateMigration(sourceRoot: string, targetRoot: string): Promise<MigrationPlan> {
  const { files, bytes } = await countFiles(sourceRoot);
  let freeBytes = 0;
  const drive = targetRoot.slice(0, 2);
  if (/^[A-Za-z]:$/.test(drive)) {
    try {
      const { execSync } = require('node:child_process');
      const result = execSync(`fsutil volume diskfree ${drive}`, { encoding: 'utf8', timeout: 5000 });
      const match = result.match(/Total\s+free\s+bytes\s+:\s+(\d+)/i);
      if (match) freeBytes = parseInt(match[1], 10);
    } catch { }
  }
  return {
    sourceRoot,
    targetRoot,
    totalFiles: files,
    totalBytes: bytes,
    freeBytesOnTarget: freeBytes,
    sufficientSpace: freeBytes === 0 || bytes === 0 || freeBytes > bytes,
  };
}

type MigrationMode = 'move' | 'copy';

interface CopyJob {
  source: string;
  target: string;
  isDir: boolean;
}

export async function executeMigration(
  sourceRoot: string,
  targetRoot: string,
  mode: MigrationMode,
  onProgress?: (current: number, total: number, file: string) => void,
): Promise<MigrationResult> {
  const logPath = join(targetRoot, 'Logs', `migration-${Date.now()}.log`);
  await mkdir(join(targetRoot, 'Logs'), { recursive: true });
  const logStream = createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });
  const log = (msg: string) => { logStream.write(`[${new Date().toISOString()}] ${msg}\n`); };

  const failed: string[] = [];
  let migrated = 0;
  let bytesMigrated = 0;

  try {
    log(`Migration started: ${sourceRoot} → ${targetRoot}`);
    log(`Mode: ${mode}`);

    const jobs: CopyJob[] = [];
    const queue = [sourceRoot];
    while (queue.length > 0) {
      const dir = queue.pop()!;
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          queue.push(full);
          jobs.push({ source: full, target: join(targetRoot, relative(sourceRoot, full)), isDir: true });
        } else if (entry.isFile()) {
          jobs.push({ source: full, target: join(targetRoot, relative(sourceRoot, full)), isDir: false });
        }
      }
    }

    // Create all directories first
    for (const job of jobs) {
      if (job.isDir) {
        await mkdir(job.target, { recursive: true }).catch(() => { });
      }
    }

    const fileJobs = jobs.filter((j) => !j.isDir);
    for (let i = 0; i < fileJobs.length; i++) {
      const job = fileJobs[i];
      try {
        const s = await stat(job.source);
        if (mode === 'move') {
          await rename(job.source, job.target).catch(async () => {
            await copyFile(job.source, job.target);
            const { unlink } = await import('node:fs/promises');
            await unlink(job.source).catch(() => { });
          });
        } else {
          await copyFile(job.source, job.target);
        }
        migrated++;
        bytesMigrated += s.size;
        onProgress?.(i + 1, fileJobs.length, job.source);
      } catch (err) {
        failed.push(job.source);
        log(`FAILED: ${job.source} → ${job.target} (${err})`);
      }
    }

    log(`Migration completed. ${migrated} files, ${bytesMigrated} bytes, ${failed.length} failed.`);
    logStream.end();

    return {
      success: failed.length === 0,
      sourceRoot,
      targetRoot,
      filesMigrated: migrated,
      bytesMigrated,
      failedFiles: failed.length,
      logPath,
    };
  } catch (err) {
    log(`Migration error: ${err}`);
    logStream.end();
    return {
      success: false,
      sourceRoot,
      targetRoot,
      filesMigrated: migrated,
      bytesMigrated,
      failedFiles: failed.length,
      logPath,
      error: String(err),
    };
  }
}
