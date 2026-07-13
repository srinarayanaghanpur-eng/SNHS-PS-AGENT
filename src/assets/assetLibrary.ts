import type { AssetRecord } from '../types';
import { dataDir, readText, writeText, listDir, deleteEntry, exists, selectFolder, uploadFile } from '../bridge/apiClient';
import { join, basename, extname } from '../utils/path';
import { sha256Hex } from '../utils/hash';

const META_FILE = 'asset-index.json';

async function settingsFile(): Promise<string> {
  const base = await dataDir();
  return `${base}/asset-folder.txt`;
}

export async function chooseAssetFolder(): Promise<AssetRecord[]> {
  const folder = await selectFolder();
  if (!folder) return [];
  await writeText(await settingsFile(), folder);
  return indexFolder(folder);
}

export async function loadAssets(): Promise<AssetRecord[]> {
  try {
    const token = await readText(await settingsFile());
    if (!token) return [];
    return indexFolder(token);
  } catch { return []; }
}

export async function importAssets(): Promise<AssetRecord[]> {
  return chooseAssetFolder();
}

async function indexFolder(folderPath: string): Promise<AssetRecord[]> {
  const entries = await listDir(folderPath);
  const assets: AssetRecord[] = [];
  const ext = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
  for (const e of entries) {
    if (!e.isFile) continue;
    const extLower = extname(e.name).toLowerCase();
    if (!ext.includes(extLower)) continue;
    const cat = e.name.includes('logo') ? 'logo' :
      e.name.includes('bg') || e.name.includes('back') ? 'background' :
      e.name.includes('icon') || e.name.includes('decor') ? 'decoration' :
      'photo';
    assets.push({
      id: `${cat}_${e.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: e.name.replace(extLower, ''),
      extension: extLower.replace('.', ''),
      category: cat,
      path: `${folderPath}/${e.name}`,
      size: e.size,
      tags: [cat],
      license: undefined
    });
  }
  const metaPath = `${folderPath}/${META_FILE}`;
  if (await exists(metaPath)) {
    try {
      const meta = JSON.parse(await readText(metaPath));
      for (const a of assets) {
        const m = meta[a.id];
        if (m) { a.license = m.license; a.tags = m.tags || a.tags; }
      }
    } catch { }
  }
  return assets;
}
