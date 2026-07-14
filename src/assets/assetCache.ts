import type { AssetCacheCategory, AssetCacheEntry } from '../types';
import { dataDir, readText, writeText, listDir, deleteEntry, exists } from '../bridge/apiClient';
import { join, extname, basename } from '../utils/path';
import { fnv1a } from '../utils/hash';
import { log } from '../utils/logger';

declare global {
  interface Window {
    electronAPI?: import('../../electron/preload').ElectronAPI;
  }
}

function api(): import('../../electron/preload').ElectronAPI {
  if (!window.electronAPI) throw new Error('Electron API not available');
  return window.electronAPI;
}

const CACHE_ROOT = 'asset-cache';
const META_FILE = 'cache-index.json';

function categoryFolder(category: AssetCacheCategory): string {
  return `${CACHE_ROOT}/${category}`;
}

export async function getCacheRoot(): Promise<string> {
  const base = await dataDir();
  const docsPath = base.replace(/[\\/]AppData[\\/]Roaming[\\/].+$/, '');
  return `${docsPath}\\Documents\\SNHS Smart Poster Agent\\asset-cache`;
}

async function ensureCacheDirs(): Promise<void> {
  const root = await getCacheRoot();
  const categories: AssetCacheCategory[] = [
    'backgrounds', 'academic', 'prayer', 'birthdays', 'festivals',
    'examinations', 'admissions', 'textures', 'icons', 'overlays', 'general'
  ];
  for (const cat of categories) {
    const dir = join(root, cat);
    if (!(await exists(dir))) {
      await writeText(join(dir, '.keep'), '');
    }
  }
}

async function cacheIndexPath(): Promise<string> {
  const root = await getCacheRoot();
  await ensureCacheDirs();
  return join(root, META_FILE);
}

async function loadIndex(): Promise<Record<string, AssetCacheEntry>> {
  try {
    const p = await cacheIndexPath();
    if (await exists(p)) {
      return JSON.parse(await readText(p));
    }
  } catch { }
  return {};
}

async function saveIndex(index: Record<string, AssetCacheEntry>): Promise<void> {
  const p = await cacheIndexPath();
  await writeText(p, JSON.stringify(index, null, 2));
}

function classifyCategory(url: string, tags: string[], role: string): AssetCacheCategory {
  const u = url.toLowerCase();
  const t = tags.map(t => t.toLowerCase()).join(' ');
  const combined = u + ' ' + t + ' ' + role.toLowerCase();
  if (/prayer|church|worship|spiritual|meditation|faith/.test(combined)) return 'prayer';
  if (/birthday|confetti|celebration|cake|balloon/.test(combined)) return 'birthdays';
  if (/festival|diwali|christmas|eid|holi|pongal|celebration/.test(combined)) return 'festivals';
  if (/exam|test|study|book|pencil|stationery|academic|education|school/.test(combined)) return 'academic';
  if (/admission|enrol|registration|open house/.test(combined)) return 'admissions';
  if (/texture|paper|grain|fabric|noise/.test(combined)) return 'textures';
  if (/icon|svg|symbol/.test(combined)) return 'icons';
  if (/overlay|light.?ray|flare|glow|sparkle/.test(combined)) return 'overlays';
  if (/background|bg|wallpaper/.test(combined)) return 'backgrounds';
  return 'general';
}

export async function cacheAsset(
  url: string,
  sourcePage: string,
  websiteName: string,
  licence: string,
  imageData: ArrayBuffer,
  width: number,
  height: number,
  fileType: string,
  tags: string[],
  role: string
): Promise<AssetCacheEntry> {
  await ensureCacheDirs();
  const id = fnv1a(url + Date.now());
  const ext = fileType.startsWith('svg') ? '.svg' : '.png';
  const category = classifyCategory(url, tags, role);
  const fileName = `${id}${ext}`;
  const categoryDir = join(await getCacheRoot(), category);
  const localPath = join(categoryDir, fileName);

  const bytes = new Uint8Array(imageData);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  await api().fs.writeBinary(localPath, b64);

  const entry: AssetCacheEntry = {
    id,
    originalUrl: url,
    sourcePage,
    websiteName,
    downloadDate: new Date().toISOString(),
    licence,
    localCachedPath: localPath,
    width,
    height,
    fileSize: bytes.length,
    fileType: ext.replace('.', ''),
    category,
    tags,
    approved: false,
    favourite: false,
    hidden: false,
    rejectionReasons: []
  };

  const index = await loadIndex();
  index[id] = entry;
  await saveIndex(index);

  log('info', 'assetCache', `Cached ${fileName} in ${category}`);
  return entry;
}

export async function getCachedAsset(id: string): Promise<AssetCacheEntry | undefined> {
  const index = await loadIndex();
  return index[id];
}

export async function listCachedAssets(category?: AssetCacheCategory): Promise<AssetCacheEntry[]> {
  const index = await loadIndex();
  const entries = Object.values(index);
  if (category) return entries.filter(e => e.category === category && !e.hidden);
  return entries.filter(e => !e.hidden);
}

export async function deleteCachedAsset(id: string): Promise<void> {
  const index = await loadIndex();
  const entry = index[id];
  if (!entry) return;
  try {
    if (await exists(entry.localCachedPath)) {
      await deleteEntry(entry.localCachedPath);
    }
  } catch (err) {
    log('warn', 'assetCache', `Failed to delete file for ${id}: ${err}`);
  }
  delete index[id];
  await saveIndex(index);
}

export async function updateCachedAssetMeta(id: string, updates: Partial<AssetCacheEntry>): Promise<AssetCacheEntry | undefined> {
  const index = await loadIndex();
  const entry = index[id];
  if (!entry) return undefined;
  Object.assign(entry, updates);
  await saveIndex(index);
  return entry;
}

export async function favouriteAsset(id: string): Promise<AssetCacheEntry | undefined> {
  return updateCachedAssetMeta(id, { favourite: true });
}

export async function approveAsset(id: string): Promise<AssetCacheEntry | undefined> {
  return updateCachedAssetMeta(id, { approved: true });
}

export async function hideAsset(id: string): Promise<AssetCacheEntry | undefined> {
  return updateCachedAssetMeta(id, { hidden: true });
}

export async function markAssetUnsuitable(id: string, reasons: string[]): Promise<AssetCacheEntry | undefined> {
  return updateCachedAssetMeta(id, { rejectionReasons: reasons, approved: false });
}

export async function getAssetByUrl(url: string): Promise<AssetCacheEntry | undefined> {
  const index = await loadIndex();
  return Object.values(index).find(e => e.originalUrl === url);
}

export async function isAssetCached(url: string): Promise<boolean> {
  return !!(await getAssetByUrl(url));
}

export async function clearCache(): Promise<void> {
  const root = await getCacheRoot();
  const index = await loadIndex();
  for (const entry of Object.values(index)) {
    try {
      if (await exists(entry.localCachedPath)) {
        await deleteEntry(entry.localCachedPath);
      }
    } catch { }
  }
  await writeText(await cacheIndexPath(), '{}');
  log('info', 'assetCache', 'Cache cleared');
}

export async function getCacheStats(): Promise<{ totalCount: number; totalSize: number; categories: Record<string, number> }> {
  const index = await loadIndex();
  let totalSize = 0;
  const categories: Record<string, number> = {};
  for (const entry of Object.values(index)) {
    if (entry.hidden) continue;
    totalSize += entry.fileSize || 0;
    categories[entry.category] = (categories[entry.category] || 0) + 1;
  }
  return { totalCount: Object.values(index).filter(e => !e.hidden).length, totalSize, categories };
}
