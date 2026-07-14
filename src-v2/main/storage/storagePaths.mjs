import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_DATA_ROOT = process.env.SNHS_AGENT_DATA_ROOT || 'E:\\AI AGENTS\\SmartPosterAgent';

export const REQUIRED_DIRECTORIES = Object.freeze([
  'jobs',
  'psd', 'exports', 'exports/png', 'exports/jpg', 'exports/pdf',
  'previews', 'previews/thumbnails',
  'temp', 'temp/cache', 'temp/fonts', 'temp/image-analysis',
  'assets', 'assets/school-logos', 'assets/lead-logos', 'assets/chairman', 'assets/principal',
  'assets/campuses', 'assets/event-photos', 'assets/backgrounds', 'assets/school-profiles',
  'assets/assistant-downloads', 'assets/approved-library',
  'assets/templates',
  'poster-brain', 'poster-brain/datasets', 'poster-brain/models', 'poster-brain/embeddings',
  'poster-brain/checkpoints', 'poster-brain/training-runs',
  'history', 'logs', 'backups', 'settings', 'acceptance', 'test-runs',
]);

export function createStoragePaths(root = DEFAULT_DATA_ROOT) {
  const dataRoot = path.resolve(root);
  const at = (...parts) => path.join(dataRoot, ...parts);
  return Object.freeze({
    root: dataRoot,
    jobs: at('jobs'),
    outputs: at('exports'),
    psd: at('psd'),
    png: at('exports', 'png'),
    jpg: at('exports', 'jpg'),
    pdf: at('exports', 'pdf'),
    cache: at('temp', 'cache'),
    cacheThumbnails: at('previews', 'thumbnails'),
    cachePreviews: at('previews'),
    cacheFonts: at('temp', 'fonts'),
    cacheImageAnalysis: at('temp', 'image-analysis'),
    cacheTemporary: at('temp'),
    assets: at('assets'),
    assetsSchoolLogos: at('assets', 'school-logos'),
    assetsLeadLogos: at('assets', 'lead-logos'),
    assetsChairman: at('assets', 'chairman'),
    assetsPrincipal: at('assets', 'principal'),
    assetsCampuses: at('assets', 'campuses'),
    assetsEventPhotos: at('assets', 'event-photos'),
    assetsBackgrounds: at('assets', 'backgrounds'),
    schoolProfiles: at('assets', 'school-profiles'),
    assistantDownloads: at('assets', 'assistant-downloads'),
    approvedLibrary: at('assets', 'approved-library'),
    templates: at('assets', 'templates'),
    posterBrain: at('poster-brain'),
    posterBrainDatasets: at('poster-brain', 'datasets'),
    posterBrainModels: at('poster-brain', 'models'),
    posterBrainEmbeddings: at('poster-brain', 'embeddings'),
    posterBrainCheckpoints: at('poster-brain', 'checkpoints'),
    posterBrainTrainingRuns: at('poster-brain', 'training-runs'),
    history: at('history'),
    historyFile: at('history', 'poster-history.json'),
    logs: at('logs'),
    backups: at('backups'),
    settings: at('settings'),
    acceptance: at('acceptance'),
    testRuns: at('test-runs'),
  });
}

export const storagePaths = createStoragePaths();

export function ensureStorageDirectoriesSync(root = DEFAULT_DATA_ROOT) {
  for (const relative of REQUIRED_DIRECTORIES) fs.mkdirSync(path.join(root, relative), { recursive: true });
  return createStoragePaths(root);
}

export function sanitizeFilename(value, fallback = 'untitled') {
  const cleaned = String(value || '')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/[. ]+$/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
  return cleaned || fallback;
}

export function toPhotoshopPath(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/').replace(/'/g, "\\'");
}

export function assertContained(root, candidate) {
  const normalizedRoot = path.resolve(root).toLowerCase();
  const normalizedCandidate = path.resolve(candidate).toLowerCase();
  if (normalizedCandidate !== normalizedRoot && !normalizedCandidate.startsWith(normalizedRoot + path.sep)) {
    throw new Error(`PATH_OUTSIDE_APP_STORAGE: ${candidate}`);
  }
  if (normalizedCandidate.length > 240) throw new Error(`WINDOWS_PATH_TOO_LONG: ${candidate}`);
  return path.resolve(candidate);
}
