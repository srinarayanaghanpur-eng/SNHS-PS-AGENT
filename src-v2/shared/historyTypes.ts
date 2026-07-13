export interface HistoryRecord {
  id: string;
  schoolProfileId: string;
  schoolShortForm: string;
  schoolName: string;
  posterType: string;
  posterCategory: string;
  templateId: string;
  templateName: string;
  posterDate: string;
  generatedAt: string;
  version: number;
  baseName: string;
  psdPath: string;
  pngPath?: string;
  jpgPath?: string;
  folderPath: string;
  jsonPath: string;
  assetsUsed: string[];
  posterContent: Record<string, unknown>;
  qualityResult: {
    score: number;
    label: string;
    warnings: number;
  };
}

export const HISTORY_SCHEMA_VERSION = 1;

export interface HistoryStore {
  schemaVersion: number;
  records: HistoryRecord[];
}

export const historyChannels = {
  historyList: 'v2:history-list',
  historyDelete: 'v2:history-delete',
  historyDuplicate: 'v2:history-duplicate',
  historyRegenerate: 'v2:history-regenerate',
} as const;
