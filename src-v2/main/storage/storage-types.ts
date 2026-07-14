export const REQUIRED_DIRECTORIES = [
  'jobs',
  'outputs',
  'outputs/psd',
  'outputs/png',
  'outputs/jpg',
  'outputs/pdf',
  'assets',
  'cache',
  'cache/previews',
  'cache/thumbnails',
  'cache/temporary',
  'history',
  'logs',
  'backups',
  'poster-brain',
  'poster-brain/datasets',
  'poster-brain/models',
  'acceptance',
  'test-runs',
] as const;

export interface StorageSettings {
  rootPath: string;
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
