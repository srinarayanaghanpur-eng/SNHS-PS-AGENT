import { z } from 'zod';

export const channels = {
  bootstrap: 'v2:bootstrap',
  smoke: 'v2:photoshop-smoke',
  importReference: 'v2:import-reference',
  openPath: 'v2:open-path',
  generatePoster: 'v2:generate-poster',
  analyzeActivePsd: 'v2:analyze-active-psd',
  pickImages: 'v2:pick-images',
  // Brand kit / school profiles
  profilesList: 'v2:profiles-list',
  profileGet: 'v2:profile-get',
  profileCreate: 'v2:profile-create',
  profileUpdate: 'v2:profile-update',
  profileDelete: 'v2:profile-delete',
  assetImport: 'v2:asset-import',
  assetRemove: 'v2:asset-remove',
  assetSetCrop: 'v2:asset-set-crop',
  assetCheckMissing: 'v2:asset-check-missing',
  profileDuplicate: 'v2:profile-duplicate',
  profileSetDefault: 'v2:profile-set-default',
  profileGetDefault: 'v2:profile-get-default',
  validatePosterRequest: 'v2:validate-poster-request',
  // ── Live Design Assistant (additive; does not touch the above) ──
  assistantOpen: 'v2:assistant-open',
  assistantClose: 'v2:assistant-close',
  assistantReadState: 'v2:assistant-read-state',
  assistantReadActiveLayer: 'v2:assistant-read-active-layer',
  assistantCommand: 'v2:assistant-command',
  assistantApplyPlan: 'v2:assistant-apply-plan',
  assistantUndo: 'v2:assistant-undo',
  assistantRedo: 'v2:assistant-redo',
  assistantRestoreOriginal: 'v2:assistant-restore-original',
  assistantSaveVersion: 'v2:assistant-save-version',
  assistantSearchAssets: 'v2:assistant-search-assets',
  assistantDownloadAsset: 'v2:assistant-download-asset',
  assistantReplaceBackground: 'v2:assistant-replace-background',
  // ── History ──
  historyList: 'v2:history-list',
  historyDelete: 'v2:history-delete',
  historyDuplicate: 'v2:history-duplicate',
  historyRegenerate: 'v2:history-regenerate',
  // ── Google Photos connector (additive) ──
  gpStatus: 'v2:gp-status',
  gpConnect: 'v2:gp-connect',
  gpDisconnect: 'v2:gp-disconnect',
  gpRoleCatalog: 'v2:gp-role-catalog',
  gpPick: 'v2:gp-pick',
  gpCommit: 'v2:gp-commit',
  gpAddToday: 'v2:gp-add-today',
  gpReplace: 'v2:gp-replace',
  gpListApproved: 'v2:gp-list-approved',
  gpPlaceSmartObjects: 'v2:gp-place-smart-objects',
} as const;

// Google Photos connector IPC payload schemas.
export const gpRoleSchema = z.enum([
  'school-logo', 'lead-logo', 'chairman', 'correspondent', 'principal',
  'student', 'birthday-student', 'activity-photo', 'campus', 'background',
]);
export const gpCommitSchema = z.object({
  profileId: z.string().min(1),
  jobId: z.string().min(1),
  assignments: z.array(z.object({
    path: z.string().min(1),
    role: gpRoleSchema,
    name: z.string().max(80).optional(),
    className: z.string().max(40).optional(),
  }).strict()).max(64),
}).strict();
export const gpReplaceSchema = z.object({ profileId: z.string().min(1), assetKey: z.string().min(1) }).strict();
export const gpAddTodaySchema = z.object({ role: gpRoleSchema.optional() }).strict();
export const gpListApprovedSchema = z.object({ profileId: z.string().min(1) }).strict();
export const gpPlaceSchema = z.object({
  placements: z.array(z.object({ path: z.string().min(1), layerName: z.string().min(1).max(120) }).strict()).min(1).max(64),
}).strict();

// Design Assistant IPC payload schemas (all inputs validated in main).
export const assistantCommandSchema = z.object({ command: z.string().trim().min(1).max(2000), liveApply: z.boolean().optional() }).strict();
export const assistantSelectLayerSchema = z.object({ layerId: z.number().int() }).strict();
export const assistantSearchSchema = z.object({ query: z.string().trim().min(1).max(200) }).strict();
export const assistantDownloadSchema = z.object({ url: z.string().url(), source: z.string().max(200), license: z.string().max(200).optional() }).strict();
export const assistantReplaceBackgroundSchema = z.object({ assetPath: z.string().min(1), fit: z.enum(['cover', 'contain']).optional() }).strict();

export const smokeRequestSchema = z.object({ requestId: z.string().uuid() }).strict();
export const openPathSchema = z.object({ path: z.string().min(1).max(32_767) }).strict();

export const jobFailureSchema = z.object({
  code: z.string(), stage: z.string(), message: z.string(), details: z.string(), retryable: z.boolean(),
}).strict();

export const smokeResultSchema = z.object({
  success: z.boolean(), jobId: z.string(), stage: z.string(),
  psdPath: z.string().optional(), jpgPath: z.string().optional(),
  error: jobFailureSchema.optional(),
}).strict();

export type SmokeResult = z.infer<typeof smokeResultSchema>;

export const studentPhotoSchema = z.object({
  path: z.string().min(1), name: z.string().max(60).optional(), className: z.string().max(30).optional(),
  zoom: z.number().min(1).max(4).optional(),
  offsetX: z.number().min(-1).max(1).optional(),
  offsetY: z.number().min(-1).max(1).optional(),
}).strict();

export const prayerContentSchema = z.object({
  day: z.string().max(40).optional(), prayerTitle: z.string().max(160).optional(),
  thought: z.string().max(400).optional(), news: z.string().max(400).optional(),
  pledge: z.string().max(400).optional(), speech: z.string().max(300).optional(),
  dance: z.string().max(300).optional(), karate: z.string().max(300).optional(),
  examInfo: z.string().max(400).optional(), festivalInfo: z.string().max(400).optional(),
  programme: z.array(z.string().max(160)).max(14).optional(),
  birthdays: z.array(z.object({ name: z.string().max(60), className: z.string().max(30).optional(), photo: z.string().optional() }).strict()).max(12).optional(),
}).strict();

export const managementPersonSchema = z.object({
  show: z.boolean().default(false),
  assetKey: z.enum(['chairmanPhoto', 'correspondentPhoto', 'directorPhoto', 'principalPhoto', 'headmasterPhoto']).optional(),
  name: z.string().max(80).optional(),
  designation: z.string().max(80).optional(),
  frame: z.enum(['circle', 'rounded', 'rectangle']).optional(),
  message: z.string().max(400).optional(),
}).strict();

// Per-poster overrides that do not mutate the saved school profile.
export const schoolOverrideSchema = z.object({
  name: z.string().max(120).optional(),
  address: z.string().max(240).optional(),
  phone: z.string().max(40).optional(),
  academicYear: z.string().max(40).optional(),
  showLead: z.boolean().optional(),
}).strict();

export const posterRequestSchema = z.object({
  category: z.enum(['prayer','birthday','dance','karate','sports','examination','achievement','festival','holiday','admissions','hiring','custom']),
  headline: z.string().trim().min(1).max(100),
  subheadline: z.string().trim().max(160),
  message: z.string().trim().max(600),
  details: z.string().trim().max(180),
  // ── design-engine extensions (all optional; old callers keep working) ──
  presetId: z.string().max(60).optional(),
  venue: z.string().trim().max(120).optional(),
  photos: z.array(studentPhotoSchema).max(16).optional(),
  logoPath: z.string().optional(),
  prayer: prayerContentSchema.optional(),
  width: z.number().int().min(600).max(4000).optional(),
  height: z.number().int().min(600).max(4000).optional(),
  variations: z.number().int().min(1).max(3).optional(),
  exportPng: z.boolean().optional(),
  exportPdf: z.boolean().optional(),
  outputFolder: z.string().optional(),
  fileName: z.string().max(120).optional(),
  // ── brand kit ──
  schoolProfileId: z.string().max(80).optional(),
  schoolOverride: schoolOverrideSchema.optional(),
  management: z.object({ chairman: managementPersonSchema.optional(), principal: managementPersonSchema.optional() }).optional(),
}).strict();
export type PosterRequest = z.infer<typeof posterRequestSchema>;
export type ManagementPersonRequest = z.infer<typeof managementPersonSchema>;

// Structured pre-generation validation result (§9).
export interface ValidationIssue { field: string; message: string }
export interface ValidationResult { ok: boolean; issues: ValidationIssue[] }

export const pickImagesSchema = z.object({ kind: z.enum(['photos','logo']) }).strict();

export interface PosterVariationResult {
  variation: number; presetId: string; psdPath: string; jpgPath?: string; pngPath?: string;
  quality: { score: number; warnings: { code: string; message: string; severity: string }[]; fixesApplied: string[] };
  photoshopWarnings: string[];
}
export interface PosterGenerationResult {
  success: true; jobId: string; stage: 'completed'; variations: PosterVariationResult[];
  // kept for backward compatibility with the old single-output shape
  psdPath: string; jpgPath?: string; pngPath?: string;
}
export interface PosterProgressEvent { jobId: string; stage: number; label: string; variation?: number }

export const progressChannel = 'v2:poster-progress';
