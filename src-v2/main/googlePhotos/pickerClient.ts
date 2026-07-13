// Thin client for the official Google Photos Picker API (§2–§4). Flow:
//   1. sessions.create           -> { id, pickerUri, pollingConfig, mediaItemsSet }
//   2. open pickerUri in browser  (done by the service)
//   3. poll sessions.get          until mediaItemsSet === true
//   4. mediaItems.list            -> only the items the user explicitly picked
//   5. sessions.delete            to stay within resource limits
//
// Only the readonly Picker scope is used; the deprecated Library API is not
// touched (§19). Raw bytes are fetched from mediaFile.baseUrl with "=d" (§5).

import { getAccessToken } from './oauth';
import { log } from '../logger';

const BASE = 'https://photospicker.googleapis.com/v1';

export interface PickingSession {
  id: string;
  pickerUri: string;
  mediaItemsSet: boolean;
  pollingConfig?: { pollInterval?: string; timeoutIn?: string };
  expireTime?: string;
}

export interface PickedMediaItem {
  id: string;
  createTime?: string;
  type?: string; // 'PHOTO' | 'VIDEO'
  mediaFile?: {
    baseUrl?: string;
    mimeType?: string;
    filename?: string;
    mediaFileMetadata?: { width?: number; height?: number };
  };
}

async function authHeaders(): Promise<Record<string, string>> {
  return { authorization: `Bearer ${await getAccessToken()}` };
}

async function asError(res: Response, context: string): Promise<Error> {
  let detail = '';
  try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
  return new Error(`GOOGLE_PICKER_${context}_${res.status} ${detail}`.trim());
}

export async function createSession(maxItemCount?: number): Promise<PickingSession> {
  const res = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'content-type': 'application/json' },
    body: JSON.stringify(maxItemCount ? { pickingConfig: { maxItemCount: String(maxItemCount) } } : {}),
  });
  if (!res.ok) throw await asError(res, 'CREATE');
  const session = (await res.json()) as PickingSession;
  log('INFO', 'google-photos.session.created', { id: session.id });
  return session;
}

export async function getSession(id: string): Promise<PickingSession> {
  const res = await fetch(`${BASE}/sessions/${encodeURIComponent(id)}`, { headers: await authHeaders() });
  if (!res.ok) throw await asError(res, 'GET');
  return (await res.json()) as PickingSession;
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await fetch(`${BASE}/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', headers: await authHeaders() });
  } catch (e) { log('WARN', 'google-photos.session.delete-failed', { id, error: String(e) }); }
}

function parseSeconds(duration: string | undefined, fallback: number): number {
  if (!duration) return fallback;
  const n = Number(duration.replace(/s$/, ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Polls until the user finishes picking (mediaItemsSet) or the session times
// out. isCancelled lets the caller abort (e.g. a Cancel button). Honors the
// server-recommended pollInterval/timeoutIn.
export async function waitForSelection(
  session: PickingSession,
  isCancelled: () => boolean = () => false,
): Promise<boolean> {
  let current = session;
  const started = Date.now();
  while (!current.mediaItemsSet) {
    if (isCancelled()) return false;
    const intervalMs = parseSeconds(current.pollingConfig?.pollInterval, 3) * 1000;
    const timeoutMs = parseSeconds(current.pollingConfig?.timeoutIn, 300) * 1000;
    if (Date.now() - started > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, Math.max(1000, intervalMs)));
    current = await getSession(session.id);
  }
  return true;
}

export async function listSelectedItems(sessionId: string): Promise<PickedMediaItem[]> {
  const items: PickedMediaItem[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${BASE}/mediaItems`);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: await authHeaders() });
    if (!res.ok) throw await asError(res, 'LIST');
    const json = (await res.json()) as { mediaItems?: PickedMediaItem[]; nextPageToken?: string };
    for (const it of json.mediaItems ?? []) items.push(it);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return items;
}

// Downloads the FULL-resolution original bytes for a picked item (§5, §14 — not
// a thumbnail). "=d" requests the raw download; the bearer token is required.
export async function downloadOriginalBytes(baseUrl: string): Promise<Buffer> {
  const url = baseUrl.includes('=') ? `${baseUrl}=d` : `${baseUrl}=d`;
  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) throw await asError(res, 'DOWNLOAD');
  return Buffer.from(await res.arrayBuffer());
}
