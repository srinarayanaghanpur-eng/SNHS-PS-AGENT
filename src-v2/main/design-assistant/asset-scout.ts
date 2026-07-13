// Asset scout.
//
// Searches for visual assets in a fixed, licence-respecting order (§ Background
// and asset scout):
//   1. Existing application asset library
//   2. Previously approved school assets
//   3. Openverse (API)
//   4. Pexels (when an API key is configured)
//   5. Visible browser fallback (Openverse results page)
// It never auto-downloads arbitrary copyrighted Google Images.

import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { log } from '../logger';
import type { Candidate } from './browser-controller';

export type ProviderName = 'library' | 'approved' | 'openverse' | 'pexels' | 'browser';

export interface ScoutConfig {
  libraryDirs?: string[];       // existing asset library folders
  approvedDirs?: string[];      // previously approved school assets
  pexelsApiKey?: string;        // optional
  allowBrowserFallback?: boolean;
  max?: number;                 // 6..12
}

export interface ScoutResult {
  provider: ProviderName;
  query: string;
  candidates: Candidate[];
  note?: string;
}

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function listLocal(dirs: string[], query: string, source: ProviderName): Promise<Candidate[]> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: Candidate[] = [];
  for (const dir of dirs) {
    let names: string[] = [];
    try { names = await readdir(dir); } catch { continue; }
    for (const name of names) {
      if (!IMG_EXT.has(extname(name).toLowerCase())) continue;
      const hay = name.toLowerCase();
      const score = terms.filter((t) => hay.includes(t)).length;
      if (terms.length === 0 || score > 0) {
        const full = join(dir, name);
        out.push({ thumbnailUrl: `file://${full}`, fullUrl: `file://${full}`, source, license: 'local' });
      }
    }
  }
  return out;
}

// Openverse: CC-licensed image search API. Returns metadata incl. licence.
async function searchOpenverse(query: string, max: number): Promise<Candidate[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${max}&license_type=commercial,modification`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SNHS-Poster-Agent/1.0' } });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.results ?? []).slice(0, max).map((r: any): Candidate => ({
      thumbnailUrl: r.thumbnail ?? r.url, fullUrl: r.url, width: r.width, height: r.height,
      source: r.source ?? 'openverse', license: r.license ? `${r.license} ${r.license_version ?? ''}`.trim() : undefined,
      pageUrl: r.foreign_landing_url,
    }));
  } catch (e) { log('WARN', 'scout.openverse.failed', { message: (e as Error).message }); return []; }
}

async function searchPexels(query: string, apiKey: string, max: number): Promise<Candidate[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${max}`;
  try {
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.photos ?? []).slice(0, max).map((p: any): Candidate => ({
      thumbnailUrl: p.src?.medium ?? p.src?.original, fullUrl: p.src?.original, width: p.width, height: p.height,
      source: 'pexels', license: 'Pexels License', pageUrl: p.url,
    }));
  } catch (e) { log('WARN', 'scout.pexels.failed', { message: (e as Error).message }); return []; }
}

export function openverseResultsUrl(query: string): string {
  return `https://openverse.org/search/image?q=${encodeURIComponent(query)}`;
}

// Run the provider chain, returning the first provider that yields candidates.
export async function scout(query: string, cfg: ScoutConfig): Promise<ScoutResult> {
  const max = Math.min(12, Math.max(6, cfg.max ?? 12));

  const library = await listLocal(cfg.libraryDirs ?? [], query, 'library');
  if (library.length) return { provider: 'library', query, candidates: library.slice(0, max) };

  const approved = await listLocal(cfg.approvedDirs ?? [], query, 'approved');
  if (approved.length) return { provider: 'approved', query, candidates: approved.slice(0, max) };

  const openverse = await searchOpenverse(query, max);
  if (openverse.length) return { provider: 'openverse', query, candidates: openverse };

  if (cfg.pexelsApiKey) {
    const pexels = await searchPexels(query, cfg.pexelsApiKey, max);
    if (pexels.length) return { provider: 'pexels', query, candidates: pexels };
  }

  // Browser fallback is handled by the caller (needs a live context); we only
  // signal it here so the UI can open the visible window.
  return { provider: 'browser', query, candidates: [], note: cfg.allowBrowserFallback ? 'Use visible browser fallback' : 'No API results and browser fallback disabled' };
}
