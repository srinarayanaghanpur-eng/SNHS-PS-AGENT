import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import {
  REQUIRED_DIRECTORIES,
  assertContained,
  createStoragePaths,
  sanitizeFilename,
  toPhotoshopPath,
} from '../src-v2/main/storage/storagePaths.mjs';

describe('central runtime storage paths', () => {
  const root = resolve('E:\\AI AGENTS\\SmartPosterAgent');

  it('routes every required runtime directory beneath one data root', () => {
    const paths = createStoragePaths(root);
    expect(paths.root).toBe(root);
    expect(REQUIRED_DIRECTORIES).toContain('jobs');
    expect(REQUIRED_DIRECTORIES).toContain('psd');
    expect(REQUIRED_DIRECTORIES).toContain('temp');
    expect(REQUIRED_DIRECTORIES).toContain('poster-brain/training-runs');
    expect(REQUIRED_DIRECTORIES).toContain('history');
    for (const path of Object.values(paths)) {
      expect(typeof path).toBe('string');
      expect(assertContained(root, path)).toBe(path);
    }
  });

  it('sanitizes filenames and emits Photoshop-safe absolute paths', () => {
    const safe = sanitizeFilename('  Prayer: 14/07/2026?.psd  ');
    expect(safe).not.toMatch(/[<>:"/\\|?*]/);
    expect(safe.length).toBeLessThanOrEqual(120);
    expect(toPhotoshopPath(join(root, 'psd', 'poster.psd'))).toMatch(/^E:\//);
    expect(() => assertContained(root, 'C:\\Users\\ADMIN\\poster.psd')).toThrow(/PATH_OUTSIDE_APP_STORAGE/);
  });
});
