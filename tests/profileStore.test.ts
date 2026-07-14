import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock Electron so the real storage + store run end-to-end against temp roots.
let tempBase: string;
let tempDataRoot: string;
vi.mock('electron', () => ({ app: {
  getPath: (name: string) => name === 'userData' ? tempBase : name === 'exe' ? 'C:\\SNHS-Test-App\\SNHS.exe' : tempBase,
  isPackaged: false,
  getAppPath: () => 'C:\\SNHS-Test-App\\resources\\app.asar',
} }));
vi.mock('../src-v2/main/logger', () => ({ log: () => {}, installCrashHandlers: () => {} }));

import * as store from '../src-v2/main/brandKit/profileStore';
import { initializeStorage } from '../src-v2/main/storage';
import { resetStorageManager } from '../src-v2/main/storage/storage-manager';

// A minimal valid PNG (signature + IHDR) so asset import passes validation.
function writePng(path: string): void {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = [0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 0x40, 0, 0, 0, 0x40, 8, 6, 0, 0, 0];
  writeFileSync(path, Buffer.from([...sig, ...ihdr, ...Array(200).fill(0)]));
}

beforeEach(async () => {
  tempBase = mkdtempSync(join(tmpdir(), 'snhs-store-'));
  tempDataRoot = mkdtempSync(join(tmpdir(), 'snhs-runtime-'));
  process.env.SNHS_AGENT_DATA_ROOT = tempDataRoot;
  resetStorageManager();
  await initializeStorage();
});
afterEach(() => {
  delete process.env.SNHS_AGENT_DATA_ROOT;
  rmSync(tempBase, { recursive: true, force: true });
  rmSync(tempDataRoot, { recursive: true, force: true });
});

describe('profile store', () => {
  it('seeds the built-in SNHS profile on first init', async () => {
    await store.initProfiles();
    const profiles = await store.listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Sri Narayana High School');
    expect(profiles[0].pin).toBe('506135');
    expect(profiles[0].phone1).toBe('6300038389');
  });

  it('persists a profile across a fresh store read (reopen simulation)', async () => {
    await store.initProfiles();
    const created = await store.createProfile({ name: 'Second School', district: 'Warangal' });
    // A second listProfiles reads only from disk — no in-memory cache.
    const reloaded = (await store.listProfiles()).find((p) => p.id === created.id);
    expect(reloaded?.name).toBe('Second School');
    expect(reloaded?.district).toBe('Warangal');
  });

  it('imports an asset to disk and stores only its path in JSON', async () => {
    await store.initProfiles();
    const [profile] = await store.listProfiles();
    const src = join(tempBase, 'logo.png');
    writePng(src);
    const updated = await store.importAsset(profile.id, 'mainLogo', { sourcePath: src });
    expect(updated.assets.mainLogo?.path).toContain(join('assets', 'school-profiles', profile.id, 'logos'));
    expect(updated.assets.mainLogo?.hasAlpha).toBe(true);
    // reload from disk to confirm persistence
    const reloaded = await store.getProfile(profile.id);
    expect(reloaded?.assets.mainLogo?.originalName).toBe('logo.png');
  });

  it('detects a moved/deleted asset file', async () => {
    await store.initProfiles();
    const [profile] = await store.listProfiles();
    const src = join(tempBase, 'lead.png');
    writePng(src);
    const updated = await store.importAsset(profile.id, 'leadLogo', { sourcePath: src });
    rmSync(updated.assets.leadLogo!.path, { force: true });
    const missing = await store.checkMissingAssets(profile.id);
    expect(missing.map((m) => m.key)).toContain('leadLogo');
  });

  it('rejects a non-image file with a clear error', async () => {
    await store.initProfiles();
    const [profile] = await store.listProfiles();
    const bad = join(tempBase, 'notimage.png');
    writeFileSync(bad, Buffer.from(Array(300).fill(0x41)));
    await expect(store.importAsset(profile.id, 'mainLogo', { sourcePath: bad })).rejects.toThrow(/not a usable image|JPG, PNG or WebP/);
  });

  it('removes an asset and its file', async () => {
    await store.initProfiles();
    const [profile] = await store.listProfiles();
    const src = join(tempBase, 's.png'); writePng(src);
    await store.importAsset(profile.id, 'stamp', { sourcePath: src });
    const after = await store.removeAsset(profile.id, 'stamp');
    expect(after.assets.stamp).toBeUndefined();
  });
});
