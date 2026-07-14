import { contextBridge, ipcRenderer } from 'electron';
import { channels, progressChannel, type PosterProgressEvent } from '../shared/ipc';

const posterApi = Object.freeze({
  bootstrap: () => ipcRenderer.invoke(channels.bootstrap),
  runPhotoshopSmoke: () => ipcRenderer.invoke(channels.smoke, { requestId: crypto.randomUUID() }),
  importReference: () => ipcRenderer.invoke(channels.importReference),
  openPath: (path: string) => ipcRenderer.invoke(channels.openPath, { path }),
  generatePoster: (input: unknown) => ipcRenderer.invoke(channels.generatePoster, input),
  analyzeActivePsd: () => ipcRenderer.invoke(channels.analyzeActivePsd),
  pickImages: (kind: 'photos' | 'logo') => ipcRenderer.invoke(channels.pickImages, { kind }),
  // Brand kit / school profiles
  profilesList: () => ipcRenderer.invoke(channels.profilesList),
  profileGet: (id: string) => ipcRenderer.invoke(channels.profileGet, { id }),
  profileCreate: (patch: Record<string, unknown>) => ipcRenderer.invoke(channels.profileCreate, { patch }),
  profileUpdate: (id: string, patch: Record<string, unknown>) => ipcRenderer.invoke(channels.profileUpdate, { id, patch }),
  profileDelete: (id: string) => ipcRenderer.invoke(channels.profileDelete, { id }),
  assetImport: (id: string, key: string, sourcePath?: string) => ipcRenderer.invoke(channels.assetImport, { id, key, sourcePath }),
  assetRemove: (id: string, key: string) => ipcRenderer.invoke(channels.assetRemove, { id, key }),
  assetSetCrop: (id: string, key: string, crop: { zoom: number; offsetX: number; offsetY: number }) => ipcRenderer.invoke(channels.assetSetCrop, { id, key, crop }),
  assetCheckMissing: (id: string) => ipcRenderer.invoke(channels.assetCheckMissing, { id }),
  profileDuplicate: (id: string) => ipcRenderer.invoke(channels.profileDuplicate, { id }),
  profileSetDefault: (id: string) => ipcRenderer.invoke(channels.profileSetDefault, { id }),
  profileGetDefault: () => ipcRenderer.invoke(channels.profileGetDefault),
  validatePosterRequest: (request: unknown) => ipcRenderer.invoke(channels.validatePosterRequest, request),
  // ── Live Design Assistant ──
  assistantOpen: () => ipcRenderer.invoke(channels.assistantOpen),
  assistantClose: () => ipcRenderer.invoke(channels.assistantClose),
  assistantReadState: () => ipcRenderer.invoke(channels.assistantReadState),
  assistantReadActiveLayer: () => ipcRenderer.invoke(channels.assistantReadActiveLayer),
  assistantCommand: (command: string, liveApply?: boolean) => ipcRenderer.invoke(channels.assistantCommand, { command, liveApply }),
  assistantApplyPlan: (plan: unknown) => ipcRenderer.invoke(channels.assistantApplyPlan, plan),
  assistantUndo: () => ipcRenderer.invoke(channels.assistantUndo),
  assistantRedo: () => ipcRenderer.invoke(channels.assistantRedo),
  assistantRestoreOriginal: () => ipcRenderer.invoke(channels.assistantRestoreOriginal),
  assistantSaveVersion: () => ipcRenderer.invoke(channels.assistantSaveVersion),
  assistantSearchAssets: (query: string) => ipcRenderer.invoke(channels.assistantSearchAssets, { query }),
  assistantDownloadAsset: (url: string, source: string, license?: string) => ipcRenderer.invoke(channels.assistantDownloadAsset, { url, source, license }),
  assistantReplaceBackground: (assetPath: string, fit?: 'cover' | 'contain') => ipcRenderer.invoke(channels.assistantReplaceBackground, { assetPath, fit }),
  // ── Google Photos connector ──
  gpStatus: () => ipcRenderer.invoke(channels.gpStatus),
  gpConnect: () => ipcRenderer.invoke(channels.gpConnect),
  gpDisconnect: () => ipcRenderer.invoke(channels.gpDisconnect),
  gpRoleCatalog: () => ipcRenderer.invoke(channels.gpRoleCatalog),
  gpPick: () => ipcRenderer.invoke(channels.gpPick),
  gpCommit: (profileId: string, jobId: string, assignments: unknown[]) => ipcRenderer.invoke(channels.gpCommit, { profileId, jobId, assignments }),
  gpAddToday: (role?: string) => ipcRenderer.invoke(channels.gpAddToday, { role }),
  gpReplace: (profileId: string, assetKey: string) => ipcRenderer.invoke(channels.gpReplace, { profileId, assetKey }),
  gpListApproved: (profileId: string) => ipcRenderer.invoke(channels.gpListApproved, { profileId }),
  gpPlaceSmartObjects: (placements: { path: string; layerName: string }[]) => ipcRenderer.invoke(channels.gpPlaceSmartObjects, { placements }),
  onPosterProgress: (listener: (event: PosterProgressEvent) => void) => {
    const wrapped = (_e: unknown, payload: PosterProgressEvent) => listener(payload);
    ipcRenderer.on(progressChannel, wrapped);
    return () => { ipcRenderer.removeListener(progressChannel, wrapped); };
  },
  // ── Poster Brain (learning system) ──
  brainApprove: (posterId: string) => ipcRenderer.invoke(channels.brainApprove, { posterId }),
  brainReject: (posterId: string, reasons: string[], note: string) => ipcRenderer.invoke(channels.brainReject, { posterId, reasons, note }),
  brainCorrect: (posterId: string, corrections: unknown, note: string) => ipcRenderer.invoke(channels.brainCorrect, { posterId, corrections, note }),
  brainCompare: (posterAId: string, posterBId: string, winner: 'A' | 'B' | 'none', reason: string) => ipcRenderer.invoke(channels.brainCompare, { posterAId, posterBId, winner, reason }),
  brainStats: () => ipcRenderer.invoke(channels.brainStats),
  brainListRecords: (category?: string) => ipcRenderer.invoke(channels.brainListRecords, { category }),
  brainLoadRecord: (posterId: string) => ipcRenderer.invoke(channels.brainLoadRecord, { posterId }),
  brainRecordOutput: (posterId: string, finalPath: string, visualCritique?: number, qualityGate?: number) => ipcRenderer.invoke(channels.brainRecordOutput, { posterId, finalPath, visualCritique, qualityGate }),
  // ── Storage ──
  getStorageSettings: () => ipcRenderer.invoke(channels.getStorageSettings),
  chooseStorageRoot: () => ipcRenderer.invoke(channels.chooseStorageRoot),
  validateStorageRoot: (path: string) => ipcRenderer.invoke(channels.validateStorageRoot, { path }),
  estimateMigration: (path: string) => ipcRenderer.invoke(channels.estimateMigration, { path }),
  migrateStorage: (path: string, migrateExisting?: boolean) => ipcRenderer.invoke(channels.migrateStorage, { path, migrateExisting }),
  openStorageRoot: () => ipcRenderer.invoke(channels.openStorageRoot),
  getStorageUsage: () => ipcRenderer.invoke(channels.getStorageUsage),
  clearCache: () => ipcRenderer.invoke(channels.clearCache),
  clearTemp: () => ipcRenderer.invoke(channels.clearTemp),
  // ── Recent Edits ──
  listRecentEdits: (schoolId?: string, limit?: number) => ipcRenderer.invoke(channels.listRecentEdits, { schoolId, limit }),
  loadJobRecord: (jobId: string) => ipcRenderer.invoke(channels.loadJobRecord, { jobId }),
  openFileLocation: (filePath: string) => ipcRenderer.invoke(channels.openFileLocation, { filePath }),
  // ── History ──
  historyList: () => ipcRenderer.invoke(channels.historyList),
  historyDelete: (id: string, removeFiles: boolean) => ipcRenderer.invoke(channels.historyDelete, { id, removeFiles }),
  historyDuplicate: (id: string) => ipcRenderer.invoke(channels.historyDuplicate, { id }),
  historyRegenerate: (id: string) => ipcRenderer.invoke(channels.historyRegenerate, { id }),
});
contextBridge.exposeInMainWorld('posterApi', posterApi);

export type PosterApi = typeof posterApi;
