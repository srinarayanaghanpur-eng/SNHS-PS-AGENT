import type { ReferenceExt, ReferenceProject, SchoolProfile } from '../types';
import { PluginError } from '../utils/errors';
import { fnv1aBytes, id, sha256Hex } from '../utils/hash';
import { log } from '../utils/logger';
import { saveProject, getReferenceEntryPath } from '../project/projectStore';
import { dataDir, exists, writeText } from '../bridge/apiClient';

const SUPPORTED: ReferenceExt[] = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
const MAX_BYTES = 80 * 1024 * 1024;

function extOf(name: string): ReferenceExt {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (!(SUPPORTED as string[]).includes(ext))
    throw new PluginError('UNSUPPORTED_FORMAT', `Unsupported file type ".${ext}".`, 'Upload a JPG, JPEG, PNG, WEBP, or PDF poster.');
  return ext as ReferenceExt;
}

async function openInPhotoshop(filePath: string, ext: ReferenceExt): Promise<{ width: number; height: number; resolution: number }> {
  const res = await fetch('/api/ps/open-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
  const data = await res.json();
  if (!data.success) throw new PluginError('OPEN_FAILED', 'Photoshop did not open the uploaded file.', 'Confirm the file is not corrupt and try again.');
  const docId = extractValue(data.stdout, 'DOC_ID');
  const width = Number(extractValue(data.stdout, 'DOC_WIDTH'));
  const height = Number(extractValue(data.stdout, 'DOC_HEIGHT'));
  const resolution = Number(extractValue(data.stdout, 'DOC_RES'));
  return { width, height, resolution };
}

function extractValue(stdout: string, key: string): string {
  for (const line of stdout.split('\n')) {
    if (line.startsWith(key + ':')) return line.slice(key.length + 1).trim();
  }
  return '';
}

export async function uploadReferencePoster(
  profile: SchoolProfile,
  onProgress?: (message: string, percent: number) => void
): Promise<ReferenceProject | undefined> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.jpg,.jpeg,.png,.webp,.pdf';
  const file: File = await new Promise((resolve) => {
    input.onchange = () => resolve(input.files?.[0] as File);
    input.click();
  });
  if (!file) return undefined;

  const ext = extOf(file.name);
  onProgress?.('Reading file…', 10);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!bytes.length) throw new PluginError('EMPTY_FILE', 'The selected file is empty.', 'Choose a valid poster file.');
  if (bytes.length > MAX_BYTES) throw new PluginError('FILE_TOO_LARGE', 'File exceeds 80 MB.', 'Export a smaller copy of the poster and retry.');

  const projectId = id('proj');
  onProgress?.('Storing project copy…', 30);
  const base = await dataDir();
  const storedFileName = `reference.${ext}`;
  const projectDir = `${base}/projects/${projectId}`;
  if (!(await exists(projectDir))) await writeText(`${projectDir}/.keep`, '');
  const storedPath = `${projectDir}/${storedFileName}`;
  const b64 = btoa(String.fromCharCode(...bytes));
  await (await fetch('/api/fs/write-binary', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: storedPath, data: b64 }),
  }));

  onProgress?.('Hashing…', 45);
  const digest = await sha256Hex(bytes);

  onProgress?.('Opening in Photoshop…', 60);
  const docInfo = await openInPhotoshop(storedPath, ext);

  onProgress?.('Saving project…', 85);
  const project: ReferenceProject = {
    schemaVersion: 1,
    projectId,
    name: file.name.replace(/\.[^.]+$/, ''),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'uploaded',
    mode: 'pending',
    overallConfidence: 0,
    reference: {
      originalFileName: file.name,
      storedFileName,
      ext,
      bytes: bytes.length,
      contentHash: fnv1aBytes(bytes),
      sha256: digest,
      width: docInfo.width,
      height: docInfo.height,
      resolution: docInfo.resolution,
      pdfPage: ext === 'pdf' ? 1 : undefined,
      psDocumentId: 0
    },
    profileSnapshot: profile,
    regions: [],
    replacementDecisions: {},
    exports: [],
    failedElements: []
  };
  const saved = await saveProject(project);
  onProgress?.('Reference poster ready', 100);
  log('info', 'uploadReferencePoster', `${file.name} → ${projectId} (${docInfo.width}×${docInfo.height})`);
  return saved;
}

export async function reopenReference(project: ReferenceProject): Promise<ReferenceProject> {
  const entryPath = await getReferenceEntryPath(project);
  if (!entryPath) throw new PluginError('REFERENCE_MISSING', 'Stored reference file not found.', 'Re-upload the original poster for this project.');
  const docInfo = await openInPhotoshop(entryPath, project.reference.ext);
  const updated = { ...project, reference: { ...project.reference, psDocumentId: 0 } };
  return saveProject(updated);
}
