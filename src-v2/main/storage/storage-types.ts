export const REQUIRED_DIRECTORIES = [
  'Projects',
  'Assets/School Logos',
  'Assets/LEAD Logos',
  'Assets/Leadership Photos',
  'Assets/Campus Photos',
  'Assets/Student Photos',
  'Assets/Event Photos',
  'Assets/Decorative Assets',
  'Photoshop/PSD',
  'Photoshop/PNG',
  'Photoshop/JPG',
  'Photoshop/Templates',
  'Premiere/Projects',
  'Premiere/Exports',
  'Premiere/Media',
  'Word/DOCX',
  'Word/PDF',
  'Word/Templates',
  'AI Models',
  'Database',
  'Cache',
  'Temp',
  'Logs',
  'Backups',
  'Jobs',
  'BrandKits',
  'Config',
  'Projects/assistant-sessions',
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
