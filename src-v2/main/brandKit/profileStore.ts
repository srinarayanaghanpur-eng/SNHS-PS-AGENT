// Persistent school-profile / brand-kit store under the central data root at
// assets/school-profiles. Each profile owns asset subfolders. Metadata and paths are
// stored in JSON — never image bytes (§3).

import { mkdir, readFile, readdir, cp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicJson, getStoragePaths } from '../storage';
import { log } from '../logger';
import {
  ASSET_SUBFOLDER, SNHS_DEFAULT, schoolProfileSchema,
  type BrandAssetKey, type Crop, type SchoolProfile,
} from '../../shared/brandKit';
import { importAssetFile, type ImportRequest } from './assetImport';

export function brandKitsRoot(): string { return getStoragePaths().getSchoolProfilesDirectory(); }
export function profileDir(id: string): string { return join(brandKitsRoot(), id); }
function indexPath(): string { return join(brandKitsRoot(), 'profiles.json'); }
function defaultPath(): string { return join(brandKitsRoot(), '_default.json'); }

const SUBFOLDERS = ['logos', 'management', 'students', 'campus', 'signatures', 'stamps', 'partners', 'backgrounds'];

async function ensureProfileFolders(id: string): Promise<void> {
  await Promise.all(SUBFOLDERS.map((f) => mkdir(join(profileDir(id), f), { recursive: true })));
}

interface Index { schemaVersion: number; profileIds: string[] }

async function readIndex(): Promise<Index> {
  try {
    const raw = JSON.parse(await readFile(indexPath(), 'utf8'));
    if (Array.isArray(raw.profileIds)) return { schemaVersion: 2, profileIds: raw.profileIds };
  } catch { /* first run */ }
  return { schemaVersion: 2, profileIds: [] };
}

async function writeIndex(index: Index): Promise<void> { await atomicJson(indexPath(), index); }

async function readProfile(id: string): Promise<SchoolProfile | null> {
  try {
    const raw = JSON.parse(await readFile(join(profileDir(id), 'profile.json'), 'utf8'));
    return schoolProfileSchema.parse(raw);
  } catch (error) {
    log('WARN', 'profile.read-failed', { id, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function saveProfileFile(profile: SchoolProfile): Promise<void> {
  await ensureProfileFolders(profile.id);
  await atomicJson(join(profileDir(profile.id), 'profile.json'), profile);
}

// Seeds the built-in SNHS profile the first time the store is opened.
export async function initProfiles(): Promise<void> {
  await mkdir(brandKitsRoot(), { recursive: true });
  const index = await readIndex();
  if (index.profileIds.length === 0) {
    const now = new Date().toISOString();
    const profile = schoolProfileSchema.parse({ ...SNHS_DEFAULT, id: `snhs-${randomUUID().slice(0, 8)}`, createdAt: now, updatedAt: now });
    await saveProfileFile(profile);
    await writeIndex({ schemaVersion: 2, profileIds: [profile.id] });
    await setDefaultProfile(profile.id);
    log('INFO', 'profile.seeded', { id: profile.id });
  }
}

export async function listProfiles(): Promise<SchoolProfile[]> {
  const index = await readIndex();
  const profiles = await Promise.all(index.profileIds.map(readProfile));
  return profiles.filter((p): p is SchoolProfile => p !== null);
}

export async function getProfile(id: string): Promise<SchoolProfile | null> { return readProfile(id); }

export async function createProfile(partial: Partial<SchoolProfile>): Promise<SchoolProfile> {
  const now = new Date().toISOString();
  const id = partial.id ?? `school-${randomUUID().slice(0, 8)}`;
  const profile = schoolProfileSchema.parse({ ...SNHS_DEFAULT, name: 'New School', ...partial, id, assets: {}, createdAt: now, updatedAt: now });
  await saveProfileFile(profile);
  const index = await readIndex();
  if (!index.profileIds.includes(id)) { index.profileIds.push(id); await writeIndex(index); }
  log('INFO', 'profile.created', { id });
  return profile;
}

// Updates the editable fields of a profile (not assets — those go through
// importAsset/removeAsset so files and metadata stay consistent).
export async function updateProfile(id: string, patch: Partial<SchoolProfile>): Promise<SchoolProfile> {
  const existing = await readProfile(id);
  if (!existing) throw new Error(`PROFILE_NOT_FOUND: ${id}`);
  const merged = schoolProfileSchema.parse({
    ...existing, ...patch, id, assets: existing.assets, management: { ...existing.management, ...(patch.management ?? {}) }, branding: { ...existing.branding, ...(patch.branding ?? {}) }, createdAt: existing.createdAt, updatedAt: new Date().toISOString(),
  });
  await saveProfileFile(merged);
  log('INFO', 'profile.updated', { id });
  return merged;
}

export async function duplicateProfile(id: string): Promise<SchoolProfile> {
  const existing = await readProfile(id);
  if (!existing) throw new Error(`PROFILE_NOT_FOUND: ${id}`);
  const now = new Date().toISOString();
  const newId = `school-${randomUUID().slice(0, 8)}`;
  const profile = schoolProfileSchema.parse({
    ...existing, id: newId, name: `${existing.name} (Copy)`, createdAt: now, updatedAt: now, assets: {},
  });
  await saveProfileFile(profile);
  // Copy asset files from the source profile to the new one.
  for (const [key, asset] of Object.entries(existing.assets)) {
    if (!asset) continue;
    try {
      const destDir = join(profileDir(newId), ASSET_SUBFOLDER[key as BrandAssetKey]);
      const ext = asset.path.split('.').pop() ?? 'png';
      const destName = `${key}-${randomUUID().slice(0, 8)}.${ext}`;
      const destPath = join(destDir, destName);
      await mkdir(destDir, { recursive: true });
      await cp(asset.path, destPath);
      profile.assets[key as BrandAssetKey] = { ...asset, path: destPath };
    } catch (e) {
      log('WARN', 'profile.duplicate.asset-copy-failed', { key, error: String(e) });
    }
  }
  await saveProfileFile(profile);
  const index = await readIndex();
  if (!index.profileIds.includes(newId)) { index.profileIds.push(newId); await writeIndex(index); }
  log('INFO', 'profile.duplicated', { from: id, to: newId });
  return profile;
}

export async function deleteProfile(id: string): Promise<void> {
  const index = await readIndex();
  index.profileIds = index.profileIds.filter((p) => p !== id);
  await writeIndex(index);
  await rm(profileDir(id), { recursive: true, force: true });
  // Clear default if it was this profile.
  try { const def = await getDefaultProfile(); if (def?.id === id) await setDefaultProfile(''); } catch { /* ignore */ }
  log('INFO', 'profile.deleted', { id });
}

// Default profile management.
export async function setDefaultProfile(id: string): Promise<void> {
  await atomicJson(defaultPath(), { defaultProfileId: id });
}

export async function getDefaultProfile(): Promise<SchoolProfile | null> {
  try {
    const raw = JSON.parse(await readFile(defaultPath(), 'utf8'));
    if (raw.defaultProfileId) return readProfile(raw.defaultProfileId);
  } catch { /* no default set */ }
  return null;
}

export async function importAsset(id: string, key: BrandAssetKey, request: ImportRequest): Promise<SchoolProfile> {
  const profile = await readProfile(id);
  if (!profile) throw new Error(`PROFILE_NOT_FOUND: ${id}`);
  await ensureProfileFolders(id);
  const destDir = join(profileDir(id), ASSET_SUBFOLDER[key]);
  const asset = await importAssetFile(request, destDir, key);
  const updated = schoolProfileSchema.parse({ ...profile, assets: { ...profile.assets, [key]: asset }, updatedAt: new Date().toISOString() });
  await saveProfileFile(updated);
  log('INFO', 'asset.imported', { id, key, path: asset.path });
  return updated;
}

export async function setAssetCrop(id: string, key: BrandAssetKey, crop: Crop): Promise<SchoolProfile> {
  const profile = await readProfile(id);
  if (!profile) throw new Error(`PROFILE_NOT_FOUND: ${id}`);
  const asset = profile.assets[key];
  if (!asset) throw new Error(`ASSET_NOT_FOUND: ${key}`);
  const updated = schoolProfileSchema.parse({ ...profile, assets: { ...profile.assets, [key]: { ...asset, crop } }, updatedAt: new Date().toISOString() });
  await saveProfileFile(updated);
  return updated;
}

export async function removeAsset(id: string, key: BrandAssetKey): Promise<SchoolProfile> {
  const profile = await readProfile(id);
  if (!profile) throw new Error(`PROFILE_NOT_FOUND: ${id}`);
  const asset = profile.assets[key];
  if (asset) await rm(asset.path, { force: true }).catch(() => undefined);
  const assets = { ...profile.assets }; delete assets[key];
  const updated = schoolProfileSchema.parse({ ...profile, assets, updatedAt: new Date().toISOString() });
  await saveProfileFile(updated);
  log('INFO', 'asset.removed', { id, key });
  return updated;
}

// Reports which stored asset files have been moved/renamed/deleted.
export async function checkMissingAssets(id: string): Promise<{ key: BrandAssetKey; path: string }[]> {
  const profile = await readProfile(id);
  if (!profile) return [];
  const missing: { key: BrandAssetKey; path: string }[] = [];
  for (const [key, asset] of Object.entries(profile.assets)) {
    if (!asset) continue;
    try { const info = await stat(asset.path); if (!info.isFile() || info.size === 0) missing.push({ key: key as BrandAssetKey, path: asset.path }); }
    catch { missing.push({ key: key as BrandAssetKey, path: asset.path }); }
  }
  if (missing.length) log('WARN', 'asset.missing', { id, missing });
  return missing;
}
