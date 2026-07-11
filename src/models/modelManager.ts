import type { ModelDescriptor, ModelRecord, ModelStatus } from '../types';
import { sha256Hex, fnv1aBytes } from '../utils/hash';
import { log } from '../utils/logger';
import { dataDir, readText, writeText, listDir, deleteEntry, exists, selectFolder, uploadFileToDir } from '../bridge/apiClient';
import { join } from '../utils/path';

const MODELS_DIR = 'models';
const META_FILE = 'models-meta.json';

export const MODEL_REGISTRY: ModelDescriptor[] = [
  { id: 'tess-worker', label: 'Tesseract worker', fileName: 'worker.min.js', url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js', minBytes: 30_000, purpose: 'ocr-core', required: true },
  { id: 'tess-core', label: 'Tesseract core (WASM, SIMD)', fileName: 'tesseract-core-simd.wasm.js', url: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js', minBytes: 2_000_000, purpose: 'ocr-core', required: true },
  { id: 'tess-eng', label: 'English OCR data', fileName: 'eng.traineddata.gz', url: 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz', minBytes: 1_000_000, purpose: 'ocr-lang', required: true },
  { id: 'tess-tel', label: 'Telugu OCR data', fileName: 'tel.traineddata.gz', url: 'https://tessdata.projectnaptha.com/4.0.0/tel.traineddata.gz', minBytes: 1_000_000, purpose: 'ocr-lang', required: true },
  { id: 'detection-model', label: 'Object detection (YOLOv8n ONNX)', fileName: 'yolov8n.onnx', url: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2/xenova/yolov8n.onnx', minBytes: 5_000_000, purpose: 'detection', required: false },
  { id: 'face-model', label: 'Face detection (BlazeFace ONNX)', fileName: 'blazeface.onnx', url: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2/xenova/blazeface.onnx', minBytes: 400_000, purpose: 'face', required: false }
];

interface MetaEntry { sha256: string; bytes: number; installedAt: string }
type Meta = Record<string, MetaEntry>;

async function modelsDir(): Promise<string> {
  const base = await dataDir();
  const dir = `${base}/${MODELS_DIR}`;
  if (!(await exists(dir))) await writeText(`${dir}/.keep`, '');
  return dir;
}

async function readMeta(): Promise<Meta> {
  try {
    const d = await modelsDir();
    return JSON.parse(await readText(`${d}/${META_FILE}`));
  } catch { return {}; }
}

async function writeMeta(meta: Meta): Promise<void> {
  const d = await modelsDir();
  await writeText(`${d}/${META_FILE}`, JSON.stringify(meta, null, 2));
}

async function inspect(desc: ModelDescriptor, meta: Meta): Promise<ModelRecord> {
  const d = await modelsDir();
  const path = `${d}/${desc.fileName}`;
  if (!(await exists(path))) return { descriptor: desc, status: 'missing' };
  try {
    const res = await fetch(`/api/fs/read-binary`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) return { descriptor: desc, status: 'corrupt', error: 'Read failed' };
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length < desc.minBytes)
      return { descriptor: desc, status: 'corrupt', bytes: bytes.length, error: 'File smaller than expected — likely a truncated download.' };
    const digest = await sha256Hex(bytes);
    const known = meta[desc.id];
    if (known && known.sha256 !== digest)
      return { descriptor: desc, status: 'corrupt', bytes: bytes.length, sha256: digest, error: 'SHA-256 mismatch with recorded install.' };
    if (!known) { meta[desc.id] = { sha256: digest, bytes: bytes.length, installedAt: new Date().toISOString() }; await writeMeta(meta); }
    return { descriptor: desc, status: 'ready', bytes: bytes.length, sha256: digest, installedAt: meta[desc.id].installedAt };
  } catch (err) {
    return { descriptor: desc, status: 'corrupt', error: String(err) };
  }
}

export async function scanModels(): Promise<ModelRecord[]> {
  const meta = await readMeta();
  const out: ModelRecord[] = [];
  for (const desc of MODEL_REGISTRY) out.push(await inspect(desc, meta));
  return out;
}

export function allRequiredReady(records: ModelRecord[]): boolean {
  return MODEL_REGISTRY.filter(d => d.required)
    .every(d => records.find(r => r.descriptor.id === d.id)?.status === 'ready');
}

async function saveModelBytes(desc: ModelDescriptor, bytes: Uint8Array): Promise<ModelRecord> {
  if (bytes.length < desc.minBytes)
    return { descriptor: desc, status: 'corrupt', bytes: bytes.length, error: 'Downloaded file is smaller than the sane minimum size.' };
  const d = await modelsDir();
  const path = `${d}/${desc.fileName}`;
  const b64 = btoa(String.fromCharCode(...bytes));
  const res = await fetch(`/api/fs/write-binary`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, data: b64 }),
  });
  if (!res.ok) return { descriptor: desc, status: 'corrupt', error: 'Write failed' };
  const digest = await sha256Hex(bytes);
  const meta = await readMeta();
  meta[desc.id] = { sha256: digest, bytes: bytes.length, installedAt: new Date().toISOString() };
  await writeMeta(meta);
  log('info', 'modelManager', `${desc.id} installed (${bytes.length} bytes, sha256 ${digest.slice(0, 12)}…)`);
  return { descriptor: desc, status: 'ready', bytes: bytes.length, sha256: digest, installedAt: meta[desc.id].installedAt };
}

export async function downloadModel(
  desc: ModelDescriptor,
  onProgress?: (status: ModelStatus, percent: number) => void
): Promise<ModelRecord> {
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      onProgress?.('downloading', 0);
      const res = await fetch(desc.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length') ?? 0);
      let bytes: Uint8Array;
      if (res.body && typeof (res.body as any).getReader === 'function') {
        const reader = (res.body as any).getReader();
        const chunks: Uint8Array[] = []; let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); received += value.length;
          if (total) onProgress?.('downloading', Math.min(99, Math.round((received / total) * 100)));
        }
        bytes = new Uint8Array(received); let off = 0;
        for (const c of chunks) { bytes.set(c, off); off += c.length; }
      } else {
        bytes = new Uint8Array(await res.arrayBuffer());
      }
      onProgress?.('verifying', 100);
      const rec = await saveModelBytes(desc, bytes);
      if (rec.status === 'ready') return rec;
      lastError = rec.error ?? 'verification failed';
    } catch (err) {
      lastError = String(err);
      log('warn', 'downloadModel', `${desc.id} attempt ${attempt}/3 failed: ${lastError}`);
    }
  }
  return { descriptor: desc, status: 'corrupt', error: `Download failed after 3 attempts: ${lastError}. Use "Import Offline Model Pack" instead.` };
}

export async function importOfflineModelPack(
  onProgress?: (message: string, percent: number) => void
): Promise<ModelRecord[]> {
  const sourceResult = await selectFolder();
  if (!sourceResult) return scanModels();
  const d = await modelsDir();
  const entries = await listDir(sourceResult);
  const byName = new Map(entries.filter(e => e.isFile).map(e => [e.name.toLowerCase(), e.name]));
  const results: ModelRecord[] = [];
  let i = 0;
  for (const desc of MODEL_REGISTRY) {
    i++;
    onProgress?.(`Importing ${desc.label}…`, Math.round((i / MODEL_REGISTRY.length) * 100));
    const matchName = byName.get(desc.fileName.toLowerCase());
    if (!matchName) {
      results.push({ descriptor: desc, status: 'missing', error: `${desc.fileName} not found in the selected folder.` });
      continue;
    }
    try {
      const srcPath = `${sourceResult}/${matchName}`;
      const res = await fetch(`/api/fs/read-binary`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: srcPath }),
      });
      if (!res.ok) { results.push({ descriptor: desc, status: 'corrupt', error: 'Read failed' }); continue; }
      const buf = await res.arrayBuffer();
      results.push(await saveModelBytes(desc, new Uint8Array(buf)));
    } catch (err) {
      results.push({ descriptor: desc, status: 'corrupt', error: String(err) });
    }
  }
  return results;
}

export async function deleteModel(desc: ModelDescriptor): Promise<void> {
  const d = await modelsDir();
  const path = `${d}/${desc.fileName}`;
  try { await deleteEntry(path); } catch { }
  const meta = await readMeta();
  delete meta[desc.id];
  await writeMeta(meta);
}
