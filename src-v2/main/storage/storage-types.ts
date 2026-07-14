export const REQUIRED_DIRECTORIES = [
  'jobs',
  'psd',
  'exports',
  'exports/png',
  'exports/jpg',
  'exports/pdf',
  'previews',
  'previews/thumbnails',
  'assets',
  'temp',
  'temp/cache',
  'temp/fonts',
  'temp/image-analysis',
  'history',
  'logs',
  'backups',
  'poster-brain',
  'poster-brain/datasets',
  'poster-brain/models',
  'poster-brain/embeddings',
  'poster-brain/checkpoints',
  'poster-brain/training-runs',
  'assets/school-logos',
  'assets/lead-logos',
  'assets/chairman',
  'assets/principal',
  'assets/campuses',
  'assets/event-photos',
  'assets/backgrounds',
  'assets/school-profiles',
  'acceptance',
  'test-runs',
  'settings',
] as const;

export interface StorageSettings {
  dataRoot: string;
  rootPath?: string;
  schemaVersion: number;
  updatedAt: string;
}

export interface StorageUsage {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
}

export interface StorageUsageSummary {
  rootPath: string;
  disk: StorageUsage;
  directories: { path: string; sizeBytes: number; fileCount: number }[];
  cacheSizeBytes: number;
  tempSizeBytes: number;
  directoryCount: number;
}

export interface MigrationPlan {
  sourceRoot: string;
  targetRoot: string;
  totalFiles: number;
  totalBytes: number;
  freeBytesOnTarget: number;
  sufficientSpace: boolean;
}

export interface MigrationResult {
  success: boolean;
  sourceRoot: string;
  targetRoot: string;
  filesMigrated: number;
  bytesMigrated: number;
  failedFiles: number;
  logPath: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  freeBytes: number;
  isWritable: boolean;
}
