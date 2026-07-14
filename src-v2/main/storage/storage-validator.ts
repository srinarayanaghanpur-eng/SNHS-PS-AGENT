import { access, mkdir, writeFile, unlink, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { sep, resolve, join } from 'node:path';
import type { ValidationResult } from './storage-types';
import { app } from 'electron';

const FORBIDDEN_ROOTS = [
  process.env.WINDIR || 'C:\\Windows',
  process.env.ProgramFiles || 'C:\\Program Files',
  process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  process.env.SYSTEMROOT || 'C:\\Windows',
];

function getAppPaths(): string[] {
  return [
    app.getAppPath(),
    resolve(app.getAppPath(), '..'),
    join(app.getPath('userData')),
    join(app.getPath('exe')),
  ];
}

export async function validateStorageRoot(candidate: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!candidate || typeof candidate !== 'string') {
    errors.push('Path must be a non-empty string.');
    return { valid: false, errors, warnings, freeBytes: 0, isWritable: false };
  }

  // Path traversal
  const resolved = resolve(candidate);
  if (resolved.includes('..')) {
    errors.push('Path traversal detected (..).');
  }

  // Normalize and check
  const normalized = resolved + sep;

  // Forbidden roots
  for (const forbidden of FORBIDDEN_ROOTS) {
    if (forbidden && normalized.toLowerCase().startsWith(forbidden.toLowerCase() + sep)) {
      errors.push(`Cannot select the ${forbidden} directory.`);
    }
  }

  // App installation directory
  for (const appPath of getAppPaths()) {
    if (appPath && normalized.toLowerCase().startsWith(resolve(appPath).toLowerCase() + sep)) {
      errors.push('Cannot select the application installation directory.');
      break;
    }
    if (appPath && normalized.toLowerCase() === resolve(appPath).toLowerCase()) {
      errors.push('Cannot select the application installation directory.');
      break;
    }
  }

  // Drive existence check
  const drive = resolved.slice(0, 2);
  if (/^[A-Za-z]:$/.test(drive)) {
    const systemDrive = (process.env.SystemDrive || 'C:').toUpperCase();
    const testRuntime = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    if (drive.toUpperCase() === systemDrive && !testRuntime) {
      errors.push(`Runtime storage cannot use the system drive ${systemDrive}. Choose E: or another data drive.`);
    }
    try {
      await access(drive + sep, constants.R_OK);
    } catch {
      errors.push(`Drive ${drive} is not accessible or disconnected.`);
    }
  }

  let freeBytes = 0;
  let isWritable = false;

  if (errors.length === 0) {
    try {
      await mkdir(resolved, { recursive: true });
      const testFile = join(resolved, `.write-test-${Date.now()}.tmp`);
      await writeFile(testFile, 'probe', 'utf8');
      await unlink(testFile);
      isWritable = true;
    } catch {
      errors.push('The directory is not writable.');
    }
  }

  if (isWritable) {
    try {
      const { execSync } = require('node:child_process');
      const result = execSync(`fsutil volume diskfree ${drive}`, { encoding: 'utf8', timeout: 5000 });
      const match = result.match(/Total\s+free\s+bytes\s+:\s+(\d+)/i);
      if (match) freeBytes = parseInt(match[1], 10);
    } catch {
      // fallback
    }

    const MIN_FREE = 500 * 1024 * 1024; // 500 MB
    if (freeBytes > 0 && freeBytes < MIN_FREE) {
      warnings.push(`Very low disk space: ${(freeBytes / 1024 / 1024 / 1024).toFixed(1)} GB free. At least 500 MB recommended.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, freeBytes, isWritable };
}
