export const DEFAULT_DATA_ROOT: string;
export const REQUIRED_DIRECTORIES: readonly string[];
export interface RuntimeStoragePaths {
  root: string; jobs: string; outputs: string; psd: string; png: string; jpg: string; pdf: string;
  cache: string; cacheThumbnails: string; cachePreviews: string; cacheFonts: string; cacheImageAnalysis: string; cacheTemporary: string;
  assets: string; assetsSchoolLogos: string; assetsLeadLogos: string; assetsChairman: string; assetsPrincipal: string;
  assetsCampuses: string; assetsEventPhotos: string; assetsBackgrounds: string; schoolProfiles: string;
  assistantDownloads: string; approvedLibrary: string; templates: string; posterBrain: string; posterBrainDatasets: string;
  posterBrainModels: string; posterBrainEmbeddings: string; posterBrainCheckpoints: string; posterBrainTrainingRuns: string;
  history: string; historyFile: string; logs: string; backups: string; settings: string; acceptance: string; testRuns: string;
}
export function createStoragePaths(root?: string): RuntimeStoragePaths;
export const storagePaths: RuntimeStoragePaths;
export function ensureStorageDirectoriesSync(root?: string): RuntimeStoragePaths;
export function sanitizeFilename(value: unknown, fallback?: string): string;
export function toPhotoshopPath(filePath: string): string;
export function assertContained(root: string, candidate: string): string;
