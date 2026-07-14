// Poster-brain dataset storage under the configured app storage root.
//
// Each category directory contains JSON records (one per poster).
// The index/ directory maintains a searchable cross-reference.

import { readFile, writeFile, mkdir, readdir, stat, copyFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { existsSync } from 'node:fs';
import type { TrainingRecord, DesignPlan, PreferencePair, ApprovalState, RejectionReason, AssetManifest } from './brainTypes';
import { BRAIN_VERSION } from './brainTypes';

const BRAIN_RELATIVE = 'poster-brain';

async function getBrainRoot(): Promise<string> {
  try {
    const { getStorageManager } = await import('../../storage/storage-manager');
    const mgr = await getStorageManager();
    const paths = mgr.getPaths();
    return paths.getPosterBrainDirectory();
  } catch {
    const { join: pJoin } = await import('node:path');
    const { app } = await import('electron');
    return pJoin(app.getPath('documents'), 'SNHS SMART POSTER AGENT', BRAIN_RELATIVE);
  }
}

async function categoryDir(category: string): Promise<string> {
  const root = await getBrainRoot();
  const valid: Record<string, string> = {
    'human-approved': 'human-approved',
    'generated-approved': 'generated-approved',
    'generated-rejected': 'generated-rejected',
    'human-corrections': 'human-corrections',
    'reference-posters': 'reference-posters',
    'annotations': 'annotations',
    'preference-pairs': 'preference-pairs',
  };
  return join(root, valid[category] || 'annotations');
}

async function recordPath(posterId: string, category: string): Promise<string> {
  return join(await categoryDir(category), `${posterId}.json`);
}

async function indexDir(): Promise<string> {
  const root = await getBrainRoot();
  return join(root, 'index');
}

async function indexPath(key: string): Promise<string> {
  return join(await indexDir(), `${key}.json`);
}

// ── Save / Load ──────────────────────────────────────────────────────────────

export async function saveRecord(record: TrainingRecord): Promise<void> {
  const targetCat = record.approvalState === 'approved' ? 'generated-approved'
    : record.approvalState === 'rejected' ? 'generated-rejected'
    : record.approvalState === 'corrected' ? 'human-corrections'
    : 'annotations';
  const dest = await recordPath(record.posterId, targetCat);
  const catDir = await categoryDir(targetCat);
  await mkdir(catDir, { recursive: true });
  await writeFile(dest, JSON.stringify(record, null, 2), 'utf-8');
  await updateIndex(record);
}

export async function loadRecord(posterId: string): Promise<TrainingRecord | null> {
  for (const cat of ['human-approved', 'generated-approved', 'generated-rejected', 'human-corrections', 'annotations']) {
    const p = await recordPath(posterId, cat);
    try {
      if (existsSync(p)) {
        return JSON.parse(await readFile(p, 'utf-8')) as TrainingRecord;
      }
    } catch { }
  }
  return null;
}

export async function deleteRecord(posterId: string): Promise<void> {
  for (const cat of ['human-approved', 'generated-approved', 'generated-rejected', 'human-corrections', 'annotations']) {
    const p = await recordPath(posterId, cat);
    if (existsSync(p)) {
      await writeFile(p, JSON.stringify({ _deleted: true, posterId, deletedAt: new Date().toISOString() }), 'utf-8');
    }
  }
}

// ── List records ─────────────────────────────────────────────────────────────

export async function listRecords(category?: string): Promise<string[]> {
  if (category) {
    const dir = await categoryDir(category);
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    return files.filter(f => f.endsWith('.json')).map(f => basename(f, '.json'));
  }
  const all: string[] = [];
  for (const cat of ['human-approved', 'generated-approved', 'generated-rejected', 'human-corrections', 'annotations']) {
    all.push(...await listRecords(cat));
  }
  return [...new Set(all)];
}

export async function listRecordsWithMeta(category?: string): Promise<Array<{ posterId: string; approvalState: ApprovalState; eventCategory: string; createdAt: string; score: number }>> {
  const ids = await listRecords(category);
  const results: Array<{ posterId: string; approvalState: ApprovalState; eventCategory: string; createdAt: string; score: number }> = [];
  for (const id of ids) {
    const r = await loadRecord(id);
    if (r) {
      results.push({
        posterId: r.posterId,
        approvalState: r.approvalState,
        eventCategory: r.eventCategory,
        createdAt: r.createdAt,
        score: r.qualityScores.visualCritique,
      });
    }
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Import human-made reference ──────────────────────────────────────────────

export async function importHumanPoster(
  posterId: string,
  schoolId: string,
  eventCategory: string,
  eventText: string,
  manifest: { photos: Array<{ path: string; name: string }>; logos?: Array<{ path: string; type: 'school' | 'lead' }> },
  finalPosterPath: string,
  designPlan: DesignPlan,
  heroPhoto: string,
): Promise<TrainingRecord> {
  const now = new Date().toISOString();
  const record: TrainingRecord = {
    posterId, schoolId, eventCategory, eventText,
    inputAssetManifest: { photos: manifest.photos, logos: (manifest.logos || []) as AssetManifest['logos'], managementPhotos: [], referencePoster: null },
    referencePosterPath: null,
    finalPosterPath,
    designPlan,
    selectedHeroPhoto: heroPhoto,
    supportingPhotoOrder: designPlan.supportingPhotos.map(p => p.assetPath),
    cropAnchors: {},
    approvalState: 'approved',
    rejectionReasons: [],
    rejectionNote: '',
    qualityScores: { visualCritique: 100, qualityGate: 100, humanRating: null, criticScores: {} },
    humanCorrections: null,
    modelVersion: BRAIN_VERSION,
    rendererVersion: BRAIN_VERSION,
    brainVersion: BRAIN_VERSION,
    preferencePairs: [],
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
  };
  for (const p of [...designPlan.supportingPhotos, designPlan.heroPhoto]) {
    record.cropAnchors[p.assetPath] = p.cropAnchors;
  }
  const dest = await recordPath(posterId, 'human-approved');
  const catDir = await categoryDir('human-approved');
  await mkdir(catDir, { recursive: true });
  await writeFile(dest, JSON.stringify(record, null, 2), 'utf-8');
  await updateIndex(record);
  return record;
}

// ── Index ────────────────────────────────────────────────────────────────────

async function updateIndex(record: TrainingRecord): Promise<void> {
  const idxDir = await indexDir();
  await mkdir(idxDir, { recursive: true });
  const bySchool = await indexPath(`school-${record.schoolId}`);
  const byCategory = await indexPath(`category-${record.eventCategory}`);
  const byState = await indexPath(`state-${record.approvalState}`);
  const all = await indexPath('all');

  for (const key of [bySchool, byCategory, byState, all]) {
    let ids: string[] = [];
    if (existsSync(key)) {
      try { ids = JSON.parse(await readFile(key, 'utf-8')); } catch { ids = []; }
    }
    if (!ids.includes(record.posterId)) {
      ids.push(record.posterId);
      await writeFile(key, JSON.stringify(ids), 'utf-8');
    }
  }
}

export async function queryIndex(key: string): Promise<string[]> {
  const p = await indexPath(key);
  if (!existsSync(p)) return [];
  try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return []; }
}

export async function recordsBySchool(schoolId: string): Promise<string[]> {
  return queryIndex(`school-${schoolId}`);
}

export async function recordsByCategory(category: string): Promise<string[]> {
  return queryIndex(`category-${category}`);
}

export async function recordsByState(state: ApprovalState): Promise<string[]> {
  return queryIndex(`state-${state}`);
}

export async function allRecordIds(): Promise<string[]> {
  return queryIndex('all');
}

// ── Approve / Reject / Correct ──────────────────────────────────────────────

export async function approveRecord(posterId: string): Promise<TrainingRecord | null> {
  const r = await loadRecord(posterId);
  if (!r) return null;
  r.approvalState = 'approved';
  r.approvedAt = new Date().toISOString();
  r.updatedAt = new Date().toISOString();
  await saveRecord(r);
  return r;
}

export async function rejectRecord(posterId: string, reasons: RejectionReason[], note: string): Promise<TrainingRecord | null> {
  const r = await loadRecord(posterId);
  if (!r) return null;
  r.approvalState = 'rejected';
  r.rejectionReasons = reasons;
  r.rejectionNote = note;
  r.updatedAt = new Date().toISOString();
  await saveRecord(r);
  return r;
}

export async function correctRecord(posterId: string, corrections: Partial<DesignPlan>, note: string): Promise<TrainingRecord | null> {
  const r = await loadRecord(posterId);
  if (!r) return null;
  r.approvalState = 'corrected';
  r.humanCorrections = corrections;
  r.rejectionNote = note;
  r.updatedAt = new Date().toISOString();
  await saveRecord(r);
  return r;
}

// ── Preference pairs ─────────────────────────────────────────────────────────

export async function savePreferencePair(pair: PreferencePair): Promise<void> {
  const dir = await categoryDir('preference-pairs');
  await mkdir(dir, { recursive: true });
  const p = join(dir, `${pair.posterAId}_vs_${pair.posterBId}_${Date.now()}.json`);
  await writeFile(p, JSON.stringify(pair, null, 2), 'utf-8');
}

export async function loadPreferencePairs(): Promise<PreferencePair[]> {
  const dir = await categoryDir('preference-pairs');
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  const pairs: PreferencePair[] = [];
  for (const f of files.filter(f => f.endsWith('.json'))) {
    try {
      pairs.push(JSON.parse(await readFile(join(dir, f), 'utf-8')));
    } catch { /* skip corrupt */ }
  }
  return pairs;
}

// ── Statistics ───────────────────────────────────────────────────────────────

export async function brainStats(): Promise<Record<string, number>> {
  const stats: Record<string, number> = {
    'human-approved': 0, 'generated-approved': 0, 'generated-rejected': 0,
    'human-corrections': 0, 'reference-posters': 0, 'annotations': 0, 'preference-pairs': 0,
    totalPosters: 0, totalPreferencePairs: 0,
  };
  for (const cat of ['human-approved', 'generated-approved', 'generated-rejected', 'human-corrections', 'reference-posters', 'annotations']) {
    const ids = await listRecords(cat);
    stats[cat] = ids.length;
    stats.totalPosters += ids.length;
  }
  const pairs = await loadPreferencePairs();
  stats.totalPreferencePairs = pairs.length;
  return stats;
}
