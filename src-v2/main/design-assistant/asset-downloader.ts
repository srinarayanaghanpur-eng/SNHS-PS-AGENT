// Asset downloader.
//
// Downloads a chosen full-resolution candidate into the current job's assets
// directory, then validates it (MIME/HTML/min-dims) before it can be imported
// (§ Visible Chrome workflow steps 8–13). Does not depend on the Windows
// clipboard. Restricts to configured providers and allowed MIME types.

import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { validateDownloadedAsset, mimeToFormat, DEFAULT_ASSET_RULES, type AssetRules } from './asset-validator';
import { log } from '../logger';

export interface DownloadRequest {
  url: string;
  destDir: string;         // job assets directory
  source: string;          // provider / website
  license?: string;
  rules?: AssetRules;
  allowedHosts?: string[]; // restrict network access to configured providers
}

export interface DownloadResult {
  ok: boolean;
  path?: string;
  format?: string;
  width?: number;
  height?: number;
  source: string;
  license?: string;
  reason?: string;
}

// Sanitise a filename and prevent path traversal.
export function safeFileName(url: string, format: string | null): string {
  const base = url.split('/').pop()?.split('?')[0] ?? 'asset';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').slice(0, 80) || 'asset';
  const ext = format ? `.${format === 'jpg' ? 'jpg' : format}` : (extname(cleaned) || '.img');
  const stem = cleaned.replace(/\.[a-zA-Z0-9]+$/, '');
  return `${Date.now()}_${stem}${ext}`;
}

function hostAllowed(url: string, allowed?: string[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  try { const h = new URL(url).hostname; return allowed.some((a) => h === a || h.endsWith(`.${a}`)); }
  catch { return false; }
}

export async function downloadAsset(req: DownloadRequest): Promise<DownloadResult> {
  const rules = req.rules ?? DEFAULT_ASSET_RULES;
  if (!/^https?:\/\//i.test(req.url)) return { ok: false, source: req.source, reason: 'only http(s) URLs allowed' };
  if (!hostAllowed(req.url, req.allowedHosts)) return { ok: false, source: req.source, reason: 'host not in allow-list' };

  await mkdir(req.destDir, { recursive: true });
  let response: Response;
  try {
    response = await fetch(req.url, { redirect: 'follow', headers: { 'User-Agent': 'SNHS-Poster-Agent/1.0' } });
  } catch (e) {
    return { ok: false, source: req.source, reason: `network error: ${(e as Error).message}` };
  }
  if (!response.ok || !response.body) return { ok: false, source: req.source, reason: `HTTP ${response.status}` };

  const mime = response.headers.get('content-type') ?? '';
  const declaredFormat = mimeToFormat(mime);
  if (mime && !declaredFormat) return { ok: false, source: req.source, reason: `content-type ${mime} not an allowed image` };

  const fileName = safeFileName(req.url, declaredFormat);
  const dest = join(req.destDir, fileName);
  try {
    await pipeline(Readable.fromWeb(response.body as any), createWriteStream(dest));
  } catch (e) {
    await rm(dest, { force: true }).catch(() => undefined);
    return { ok: false, source: req.source, reason: `write failed: ${(e as Error).message}` };
  }

  const validation = await validateDownloadedAsset(dest, rules);
  if (!validation.ok) {
    await rm(dest, { force: true }).catch(() => undefined); // reject & clean up
    return { ok: false, source: req.source, reason: validation.reason };
  }
  log('INFO', 'design-assistant.downloadAsset', { source: req.source, path: dest, w: validation.width, h: validation.height });
  return { ok: true, path: dest, format: validation.format, width: validation.width, height: validation.height, source: req.source, license: req.license };
}
