import type { DetectedRegion, ReferenceProject } from '../types';
import { DEFAULT_PROFILE } from '../profile/schoolProfile';
import { log } from '../utils/logger';
import { dataDir, readText, writeText, listDir, deleteEntry, exists } from '../bridge/apiClient';
import { join } from '../utils/path';

const PROJECTS_DIR = 'projects';

const MODES = new Set(['pending', 'full', 'hybrid', 'safe']);
const STATUSES = new Set(['uploaded', 'analyzing', 'analyzed', 'generating', 'generated', 'failed']);

function validRegion(r: any): r is DetectedRegion {
  return r && typeof r === 'object' && typeof r.id === 'string'
    && r.bounds && typeof r.bounds.left === 'number' && typeof r.bounds.top === 'number'
    && typeof r.bounds.width === 'number' && typeof r.bounds.height === 'number'
    && typeof r.confidence === 'number';
}

export function validateProject(raw: any): ReferenceProject | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if (typeof raw.projectId !== 'string' || !raw.reference || typeof raw.reference !== 'object') return undefined;
  const ref = raw.reference;
  if (typeof ref.storedFileName !== 'string' || typeof ref.width !== 'number' || typeof ref.height !== 'number')
    return undefined;

  const p: ReferenceProject = {
    schemaVersion: 1,
    projectId: raw.projectId,
    name: typeof raw.name === 'string' && raw.name ? raw.name : raw.projectId,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    status: STATUSES.has(raw.status) ? raw.status : 'uploaded',
    mode: MODES.has(raw.mode) ? raw.mode : 'pending',
    overallConfidence: typeof raw.overallConfidence === 'number' ? Math.max(0, Math.min(100, raw.overallConfidence)) : 0,
    reference: ref,
    profileSnapshot: raw.profileSnapshot && typeof raw.profileSnapshot === 'object' ? raw.profileSnapshot : { ...DEFAULT_PROFILE },
    regions: [],
    replacementDecisions: raw.replacementDecisions && typeof raw.replacementDecisions === 'object' ? raw.replacementDecisions : {},
    exports: Array.isArray(raw.exports) ? raw.exports.filter((x: any) => typeof x === 'string') : [],
    failedElements: Array.isArray(raw.failedElements) ? raw.failedElements : []
  };
  const regions = Array.isArray(raw.regions) ? raw.regions : [];
  for (const r of regions) {
    if (validRegion(r)) p.regions.push(r);
    else {
      log('warn', 'validateProject', `Dropped invalid region in ${p.projectId}: ${JSON.stringify(r).slice(0, 120)}`);
      p.failedElements.push({ stage: 'validation', elementId: r?.id, message: 'Invalid region skipped', recovered: true });
    }
  }
  return p;
}

async function projectsRoot(): Promise<string> {
  const base = await dataDir();
  const dir = `${base}/${PROJECTS_DIR}`;
  if (!(await exists(dir))) await writeText(`${dir}/.keep`, '');
  return dir;
}

async function projectFolder(projectId: string): Promise<string> {
  const root = await projectsRoot();
  const dir = `${root}/${projectId}`;
  if (!(await exists(dir))) await writeText(`${dir}/.keep`, '');
  return dir;
}

export async function saveProject(project: ReferenceProject): Promise<ReferenceProject> {
  const p = validateProject(project);
  if (!p) throw new Error('Project failed validation and cannot be saved');
  p.updatedAt = new Date().toISOString();
  const folder = await projectFolder(p.projectId);
  await writeText(`${folder}/project.json`, JSON.stringify(p, null, 2));
  return p;
}

export async function loadProject(projectId: string): Promise<ReferenceProject | undefined> {
  try {
    const folder = await projectFolder(projectId);
    let text: string;
    try { text = await readText(`${folder}/project.json`); }
    catch { text = ''; }
    if (!text) return undefined;
    return validateProject(JSON.parse(text));
  } catch (err) {
    log('error', 'loadProject', `${projectId}: ${String(err)}`);
    return undefined;
  }
}

export async function listProjects(): Promise<ReferenceProject[]> {
  const root = await projectsRoot();
  const entries = await listDir(root);
  const out: ReferenceProject[] = [];
  for (const e of entries) {
    if (!e.isFolder) continue;
    const p = await loadProject(e.name);
    if (p) out.push(p);
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(projectId: string): Promise<void> {
  const root = await projectsRoot();
  await deleteEntry(`${root}/${projectId}`);
}

export async function getReferenceEntryPath(project: ReferenceProject): Promise<string | undefined> {
  try {
    const folder = await projectFolder(project.projectId);
    const p = `${folder}/${project.reference.storedFileName}`;
    if (await exists(p)) return p;
    return undefined;
  } catch { return undefined; }
}
