import { readFile } from 'node:fs/promises';
import { getStorageManager } from './storage/storage-manager';
import { atomicJson } from './storage';
import type { HistoryRecord, HistoryStore } from '../shared/historyTypes';
import { HISTORY_SCHEMA_VERSION } from '../shared/historyTypes';

async function historyFilePath(): Promise<string> {
  const mgr = await getStorageManager();
  return mgr.getPaths().getHistoryPath();
}

let cache: HistoryStore | null = null;

async function ensureStore(): Promise<HistoryStore> {
  if (cache) return cache;
  try {
    const fp = await historyFilePath();
    const raw = await readFile(fp, 'utf8');
    const parsed = JSON.parse(raw) as HistoryStore;
    if (parsed.schemaVersion === HISTORY_SCHEMA_VERSION) {
      cache = parsed;
      return parsed;
    }
  } catch {
    // File doesn't exist yet
  }
  const store: HistoryStore = { schemaVersion: HISTORY_SCHEMA_VERSION, records: [] };
  cache = store;
  return store;
}

async function persist(store: HistoryStore): Promise<void> {
  const fp = await historyFilePath();
  await atomicJson(fp, store);
}

export async function listHistory(): Promise<HistoryRecord[]> {
  const store = await ensureStore();
  return [...store.records].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export async function addHistory(record: HistoryRecord): Promise<void> {
  const store = await ensureStore();
  store.records.push(record);
  await persist(store);
}

export async function deleteHistory(id: string, removeFiles: boolean): Promise<void> {
  const store = await ensureStore();
  const idx = store.records.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`History record not found: ${id}`);
  const record = store.records[idx];
  if (removeFiles) {
    const { rm } = await import('node:fs/promises');
    try { await rm(record.folderPath, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  store.records.splice(idx, 1);
  cache = store;
  await persist(store);
}

export async function getHistoryById(id: string): Promise<HistoryRecord | undefined> {
  const store = await ensureStore();
  return store.records.find((r) => r.id === id);
}

export function clearHistoryCache(): void {
  cache = null;
}
