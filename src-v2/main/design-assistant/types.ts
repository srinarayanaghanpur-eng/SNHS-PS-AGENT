// Live Design Assistant Agent — shared types.
//
// This module is the interactive assistant that operates *after or during*
// poster generation. It is additive: it never replaces the design-composer
// (src-v2/main/design/*) or its IPC channels. It reuses the existing
// Photoshop transport pattern (write JSX → cscript smoke-test-dojavascript.vbs
// → JSX writes result.json → Node polls & zod-validates).

import { z } from 'zod';

// ── Scene graph ────────────────────────────────────────────────────────────
// A non-destructive, structured read of the active Photoshop document. The
// analyzer JSX never modifies the document; it only reports.

export interface LayerBounds { left: number; top: number; right: number; bottom: number }

export type LayerType = 'group' | 'text' | 'smartObject' | 'shape' | 'pixel' | 'adjustment' | 'other';

export interface SceneLayer {
  id: number;
  name: string;
  parentPath: string;
  parentId: number | null;
  type: LayerType;
  depth: number;
  zOrder: number;
  bounds: LayerBounds | null;
  width: number;
  height: number;
  x: number;
  y: number;
  visible: boolean;
  opacity: number;
  blendMode: string;
  locked: boolean;
  smartObject: boolean;
  linkedSmartObject: boolean;
  clippingMask: boolean;
  hasMask: boolean;
  adjustmentType: string | null;
  // text-only fields (null on non-text layers)
  text: string | null;
  fontName: string | null;
  fontSize: number | null;
  textColorHex: string | null;
  // selection state
  active: boolean;
  children: SceneLayer[];
}

export interface SceneDocument {
  name: string;
  width: number;
  height: number;
  resolution: number;
}

export interface SceneGraph {
  document: SceneDocument;
  layers: SceneLayer[];
  activeLayerId: number | null;
}

// ── Semantic roles ─────────────────────────────────────────────────────────
export const SEMANTIC_ROLES = [
  'background', 'background_overlay', 'school_logo', 'lead_logo',
  'chairman_photo', 'correspondent_photo', 'principal_photo', 'student_photo',
  'school_name', 'school_address', 'phone_number', 'headline', 'subheadline',
  'date', 'programme_text', 'birthday_section', 'footer', 'decorative_element',
  'icon', 'frame', 'unknown_element',
] as const;
export type SemanticRole = (typeof SEMANTIC_ROLES)[number];

export interface SemanticMatch {
  layerId: number;
  role: SemanticRole;
  confidence: number; // 0..1
  reasons: string[];
}

// Roles that are protected by default (§ School branding protection).
export const PROTECTED_ROLES: ReadonlySet<SemanticRole> = new Set<SemanticRole>([
  'school_logo', 'lead_logo', 'school_name', 'school_address', 'phone_number',
  'chairman_photo', 'correspondent_photo', 'footer',
]);

// ── Operations (allow-list) ────────────────────────────────────────────────
// Every operation the executor is permitted to run. AI/renderer input is
// validated against this schema; anything else is rejected. Raw JSX is never
// accepted from AI or renderer.

export const hexSchema = z.string().regex(/^[0-9a-fA-F]{6}$/, 'expected 6-digit hex');

export const operationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('translate'), x: z.number(), y: z.number() }).strict(),
  z.object({ type: z.literal('align'), edge: z.enum(['top', 'bottom', 'left', 'right', 'centerH', 'centerV']) }).strict(),
  z.object({ type: z.literal('scale'), percentage: z.number().min(1).max(1000), maintainAspectRatio: z.boolean().default(true) }).strict(),
  z.object({ type: z.literal('setSize'), width: z.number().positive().optional(), height: z.number().positive().optional(), maintainAspectRatio: z.boolean().default(true) }).strict(),
  z.object({ type: z.literal('reorder'), direction: z.enum(['forward', 'backward', 'front', 'back']) }).strict(),
  z.object({ type: z.literal('setTextColor'), hex: hexSchema }).strict(),
  z.object({ type: z.literal('setFillColor'), hex: hexSchema }).strict(),
  z.object({ type: z.literal('setStrokeColor'), hex: hexSchema, size: z.number().positive().max(200).default(4) }).strict(),
  z.object({ type: z.literal('removeStroke') }).strict(),
  z.object({ type: z.literal('setOpacity'), opacity: z.number().min(0).max(100) }).strict(),
  z.object({ type: z.literal('adjustOpacity'), delta: z.number().min(-100).max(100) }).strict(),
  z.object({ type: z.literal('setBlendMode'), mode: z.string().max(40) }).strict(),
  z.object({ type: z.literal('addShadow') }).strict(),
  z.object({ type: z.literal('removeShadow') }).strict(),
  z.object({ type: z.literal('addOverlay'), tone: z.enum(['dark', 'light', 'gradient']), opacity: z.number().min(0).max(100).default(40) }).strict(),
  z.object({ type: z.literal('adjustBrightness'), delta: z.number().min(-150).max(150) }).strict(),
  z.object({ type: z.literal('adjustSaturation'), delta: z.number().min(-100).max(100) }).strict(),
  z.object({ type: z.literal('replaceText'), text: z.string().max(2000) }).strict(),
  z.object({ type: z.literal('setFont'), fontName: z.string().max(120) }).strict(),
  z.object({ type: z.literal('setFontSize'), size: z.number().positive().max(2000) }).strict(),
  z.object({ type: z.literal('setTextCase'), mode: z.enum(['upper', 'title', 'sentence']) }).strict(),
  z.object({ type: z.literal('setBold'), bold: z.boolean() }).strict(),
  z.object({ type: z.literal('setAlignment'), align: z.enum(['left', 'center', 'right']) }).strict(),
  z.object({ type: z.literal('setVisibility'), visible: z.boolean() }).strict(),
  z.object({ type: z.literal('delete') }).strict(),
  z.object({ type: z.literal('duplicate') }).strict(),
  z.object({ type: z.literal('setLock'), locked: z.boolean() }).strict(),
  z.object({ type: z.literal('rename'), name: z.string().min(1).max(120) }).strict(),
  z.object({ type: z.literal('roundedCorners'), radius: z.number().positive().max(400) }).strict(),
  z.object({ type: z.literal('replaceSmartObject'), assetPath: z.string().min(1) }).strict(),
  z.object({ type: z.literal('replaceBackground'), assetPath: z.string().min(1), fit: z.enum(['cover', 'contain']).default('cover') }).strict(),
]);
export type Operation = z.infer<typeof operationSchema>;

export const SUPPORTED_OPERATION_TYPES = [
  'translate', 'align', 'scale', 'setSize', 'reorder', 'setTextColor', 'setFillColor',
  'setStrokeColor', 'removeStroke', 'setOpacity', 'adjustOpacity', 'setBlendMode', 'addShadow',
  'removeShadow', 'addOverlay', 'adjustBrightness', 'adjustSaturation', 'replaceText', 'setFont',
  'setFontSize', 'setTextCase', 'setBold', 'setAlignment', 'setVisibility', 'delete', 'duplicate',
  'setLock', 'rename', 'roundedCorners', 'replaceSmartObject', 'replaceBackground',
] as const;

// Operations that must always show a preview / confirmation before applying.
export const CONFIRM_OPERATION_TYPES: ReadonlySet<Operation['type']> = new Set([
  'replaceBackground', 'replaceSmartObject', 'delete', 'replaceText', 'setSize',
]);

// ── Action plan ────────────────────────────────────────────────────────────
export const targetSchema = z.object({
  semanticRole: z.enum(SEMANTIC_ROLES).optional(),
  layerId: z.number().int(),
  confidence: z.number().min(0).max(1),
}).strict();
export type ActionTarget = z.infer<typeof targetSchema>;

export const actionPlanSchema = z.object({
  command: z.string().max(2000),
  targets: z.array(targetSchema).min(1).max(24),
  operations: z.array(operationSchema).min(1).max(24),
  requiresPreview: z.boolean(),
  source: z.enum(['deterministic', 'gemini']).default('deterministic'),
  warnings: z.array(z.string()).default([]),
}).strict();
export type ActionPlan = z.infer<typeof actionPlanSchema>;

// ── Execution result ───────────────────────────────────────────────────────
export interface ExecutionResult {
  success: boolean;
  modifiedLayerIds: number[];
  warnings: string[];
  previewPath?: string;
  checkpointId?: string;
  error?: string;
}

// ── Verification ───────────────────────────────────────────────────────────
export type VerificationCode =
  | 'OUT_OF_CANVAS' | 'LOGO_CUT_OFF' | 'LOGO_DISTORTED' | 'TEXT_OVERLAP'
  | 'TEXT_CLIPPED' | 'TEXT_TOO_CLOSE_TO_EDGE' | 'LOW_TEXT_CONTRAST'
  | 'BACKGROUND_COVERS_CONTENT' | 'MISSING_SCHOOL_BRANDING' | 'MISSING_LEAD_BRANDING'
  | 'EMPTY_PHOTO_FRAME' | 'UNEXPECTED_HIDDEN_LAYER';

export interface VerificationIssue {
  code: VerificationCode;
  message: string;
  layerId?: number;
  severity: 'warning' | 'error';
}
