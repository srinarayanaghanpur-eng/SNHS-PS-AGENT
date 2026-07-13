import type { TemplateManifest } from '../types';
import { dataDir, readText, writeText, listDir, deleteEntry, exists } from '../bridge/apiClient';
import { join } from '../utils/path';

const TEMPLATES_DIR = 'templates';

async function templatesFolder(): Promise<string> {
  const base = await dataDir();
  const dir = `${base}/${TEMPLATES_DIR}`;
  if (!(await exists(dir))) await writeText(`${dir}/.keep`, '');
  return dir;
}

export async function saveManifest(m: TemplateManifest): Promise<void> {
  const f = await templatesFolder();
  await writeText(`${f}/${m.templateId}.json`, JSON.stringify(m, null, 2));
}

export async function listManifests(): Promise<TemplateManifest[]> {
  const f = await templatesFolder();
  const entries = await listDir(f);
  const out: TemplateManifest[] = [];
  for (const e of entries) {
    if (e.isFile && e.name.endsWith('.json') && e.name !== '.keep') {
      try {
        const content = await readText(`${f}/${e.name}`);
        out.push(JSON.parse(content));
      } catch { }
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function findByFingerprint(fp: string): Promise<TemplateManifest | undefined> {
  return (await listManifests()).find(m => m.fingerprint === fp);
}

export async function deleteManifest(id: string): Promise<void> {
  const f = await templatesFolder();
  await deleteEntry(`${f}/${id}.json`);
}

export async function updateManifest(m: TemplateManifest): Promise<TemplateManifest> {
  m.updatedAt = new Date().toISOString();
  await saveManifest(m);
  return m;
}
