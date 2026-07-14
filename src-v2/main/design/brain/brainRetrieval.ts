// Similar-poster retrieval engine.
//
// Before generating a new DesignPlan, search the approved-poster library
// for visually and semantically similar examples. Retrieve the top 3
// and adapt their composition knowledge.

import type { TrainingRecord, DesignPlan, RetrievalQuery, RetrievalResult } from './brainTypes';
import { loadRecord, listRecordsWithMeta, recordsByCategory, recordsBySchool } from './brainStorage';

// ── Main retrieval ───────────────────────────────────────────────────────────

export async function retrieveSimilar(query: RetrievalQuery, maxResults: number = 3): Promise<DesignPlan[]> {
  const candidates = await gatherCandidates(query);
  const scored = candidates.map(c => ({
    record: c,
    similarityScore: computeSimilarity(c, query),
    matchedOn: matchDimensions(c, query),
  }));
  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.slice(0, maxResults).map(r => r.record.designPlan);
}

async function gatherCandidates(query: RetrievalQuery): Promise<TrainingRecord[]> {
  const ids: string[] = [];

  // 1. Same school first
  if (query.schoolId) {
    ids.push(...await recordsBySchool(query.schoolId));
  }

  // 2. Same category
  ids.push(...await recordsByCategory(query.eventCategory));

  // 3. All approved
  const approved = await listRecordsWithMeta('human-approved');
  ids.push(...approved.filter(r => ['approved', 'generated-approved'].includes(r.approvalState)).map(r => r.posterId));

  const uniqueIds = [...new Set(ids)];
  const records: TrainingRecord[] = [];
  for (const id of uniqueIds) {
    const r = await loadRecord(id);
    if (r && (r.approvalState === 'approved' || r.approvalState === 'corrected')) {
      records.push(r);
    }
  }
  return records;
}

function computeSimilarity(record: TrainingRecord, query: RetrievalQuery): number {
  let score = 0;

  // Exact category match
  if (record.eventCategory === query.eventCategory) score += 25;
  else if (similarCategory(record.eventCategory, query.eventCategory)) score += 10;

  // Photo count similarity
  const photoDiff = Math.abs(record.inputAssetManifest.photos.length - query.photoCount);
  if (photoDiff === 0) score += 15;
  else if (photoDiff <= 2) score += 8;

  // Emphasis match
  const recEmphasis = record.designPlan?.metadata?.emphasis || '';
  if (recEmphasis === query.emphasis) score += 15;

  // Birthday match
  if (record.designPlan?.metadata?.hasBirthdays === query.hasBirthdays) score += 10;

  // Management match
  if (record.designPlan?.metadata?.hasManagement === query.hasManagement) score += 10;

  // Keyword overlap
  const recordText = record.eventText.toLowerCase();
  const keywordMatches = query.keywords.filter(k => recordText.includes(k.toLowerCase())).length;
  score += keywordMatches * 5;

  // Recency bonus (prefer newer examples)
  const ageDays = daysSince(record.createdAt);
  score += Math.max(0, 5 - ageDays * 0.1);

  return Math.min(100, score);
}

function matchDimensions(record: TrainingRecord, query: RetrievalQuery): string[] {
  const matched: string[] = [];
  if (record.eventCategory === query.eventCategory) matched.push('category');
  if (Math.abs(record.inputAssetManifest.photos.length - query.photoCount) <= 1) matched.push('photo-count');
  if (record.designPlan?.metadata?.emphasis === query.emphasis) matched.push('emphasis');
  return matched;
}

function similarCategory(a: string, b: string): boolean {
  const prayerLike = ['prayer', 'daily-prayer', 'morning-assembly'];
  const celebration = ['birthday', 'celebration', 'festival'];
  const exam = ['exam', 'preparation', 'study'];
  const all = [prayerLike, celebration, exam];
  return all.some(group => group.includes(a) && group.includes(b));
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

// ── Keyword extraction from ComposeInput ─────────────────────────────────────

export function extractKeywords(input: { headline?: string; subheadline?: string; message?: string; details?: string; prayer?: { prayerTitle?: string; thought?: string } }): string[] {
  const words = new Set<string>();
  const text = [input.headline, input.subheadline, input.message, input.details, input.prayer?.prayerTitle, input.prayer?.thought].filter(Boolean).join(' ').toLowerCase();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'be', 'this', 'that']);
  for (const word of text.split(/\s+/)) {
    const clean = word.replace(/[^a-z0-9]/g, '');
    if (clean.length > 2 && !stopWords.has(clean)) words.add(clean);
  }
  return [...words].slice(0, 20);
}

// ── Export for use in pipeline ───────────────────────────────────────────────

export async function findBestReference(query: RetrievalQuery): Promise<DesignPlan | null> {
  const results = await retrieveSimilar(query, 1);
  return results[0] || null;
}
