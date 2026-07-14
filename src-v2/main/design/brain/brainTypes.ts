// Core types for the trainable human-design learning system.
//
// Three intelligence layers:
//   1. VisualAssetAnalyzer — understands inputs
//   2. DesignPlanGenerator — produces versioned DesignPlan JSON
//   3. QualityCritic — scores rendered output
//
// The DesignPlan is the immutable contract: same JSON drives
// preview SVG, PNG, JPG, and layered PSD generation.

import type { Rect } from '../types';

// ── Brain version ────────────────────────────────────────────────────────────
export const BRAIN_VERSION = '1.0.0';

// ── DesignPlan — the immutable design specification ──────────────────────────

export interface DesignPlan {
  planVersion: string;
  planId: string;
  createdAt: string;

  compositionFamily: string;
  variationSeed: number;

  heroPhoto: PhotoPlacement;
  supportingPhotos: PhotoPlacement[];
  galleryOrder: string[];

  sections: {
    photoZone: Rect;
    headerZone: Rect;
    titleZone: Rect;
    contentZone: Rect;
    footerZone: Rect;
    safeArea: Rect;
  };
  sectionBoxes: Record<string, Rect>;

  palette: DesignPalette;
  typography: DesignTypography;

  brandingPlacement: {
    logoRect: Rect;
    schoolNameRect: Rect;
    addressRect: Rect | null;
    leadLogoRect: Rect | null;
    footerRect: Rect;
    headerRuleRect: Rect | null;
  };

  decorations: DecorationSpec[];
  quoteTreatment: QuoteSpec | null;
  managementSection: ManagementSpec | null;

  footer: FooterSpec;
  photoshopLayerStructure: PhotoshopLayerGroup[];

  decisionLog: DesignDecision[];
  metadata: DesignPlanMetadata;
}

export interface PhotoPlacement {
  assetPath: string;
  role: 'hero' | 'supporting' | 'gallery' | 'management' | 'birthday' | 'decorative';
  importanceScore: number;
  frameShape: 'rect' | 'rounded' | 'circle' | 'polaroid';
  frameRect: Rect;
  focusY: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  cropAnchors: CropAnchors;
  labelText?: string;
  labelBelow?: boolean;
}

export interface CropAnchors {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DesignPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  headerBg: string;
  footerBg: string;
  cardBg: string;
  divider: string;
}

export interface DesignTypography {
  headingFont: string;
  bodyFont: string;
  titleSize: number;
  subtitleSize: number;
  headingSize: number;
  bodySize: number;
  captionSize: number;
  lineHeight: number;
  tracking: number;
}

export interface DecorationSpec {
  type: 'circle' | 'ribbon' | 'rule' | 'dotGrid' | 'rays' | 'arch' | 'halo' | 'cornerFrame' | 'sideBand' | 'wave' | 'confetti' | 'accentEdge' | 'glow';
  rect: Rect;
  color: string;
  opacity: number;
  zIndex: number;
}

export interface QuoteSpec {
  quoteRect: Rect;
  authorRect: Rect | null;
  hasQuotationMarks: boolean;
  style: 'elegant' | 'bold' | 'minimal';
}

export interface ManagementSpec {
  chairman: ManagementPersonPlacement | null;
  principal: ManagementPersonPlacement | null;
}

export interface ManagementPersonPlacement {
  photoRect: Rect;
  frame: 'circle' | 'rect' | 'rounded';
  nameRect: Rect | null;
  designationRect: Rect | null;
  ringColor: string;
}

export interface FooterSpec {
  barStyle: 'solid' | 'gradient' | 'minimal' | 'none';
  showAddress: boolean;
  showPhone: boolean;
  showYear: boolean;
  showLeadLogo: boolean;
  elements: FooterElement[];
}

export interface FooterElement {
  type: 'text' | 'logo';
  content: string;
  rect: Rect;
}

export interface PhotoshopLayerGroup {
  groupName: string;
  zIndex: number;
  layers: PhotoshopLayer[];
}

export interface PhotoshopLayer {
  name: string;
  type: 'text' | 'image' | 'shape' | 'group';
  visible: boolean;
  locked?: boolean;
}

export interface DesignDecision {
  category: string;
  choice: string;
  rationale: string;
  alternativesConsidered?: string[];
  source: 'rule' | 'retrieval' | 'heuristic' | 'critique' | 'human-correction';
}

export interface DesignPlanMetadata {
  modelVersion: string;
  rendererVersion: string;
  brainVersion: string;
  assetCount: number;
  photoCount: number;
  hasBirthdays: boolean;
  hasManagement: boolean;
  emphasis: string;
  derivedFromPlanId: string | null;
  retrievalSource: 'human-approved' | 'generated-approved' | 'reference' | 'none';
  similarExampleIds: string[];
}

// ── Training Record ──────────────────────────────────────────────────────────

export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'corrected';

export type RejectionReason =
  | 'wrong-hero-photo'
  | 'bad-crop'
  | 'missing-branding'
  | 'too-empty'
  | 'too-crowded'
  | 'looks-mechanical'
  | 'typography-problem'
  | 'looks-like-table'
  | 'ignores-photos'
  | 'face-badly-cropped'
  | 'empty-cards'
  | 'repeated-rectangles'
  | 'less-expressive-than-reference'
  | 'dashboard-resemblance'
  | 'other';

export interface AssetManifest {
  photos: Array<{ path: string; name: string; className?: string }>;
  logos: Array<{ path: string; type: 'school' | 'lead' }>;
  managementPhotos: Array<{ path: string; role: 'chairman' | 'principal' }>;
  background?: string;
  referencePoster: string | null;
}

export interface QualityScores {
  visualCritique: number;
  qualityGate: number;
  humanRating: number | null;
  criticScores: Record<string, number>;
}

export interface PreferencePair {
  posterAId: string;
  posterBId: string;
  winner: 'A' | 'B' | 'none';
  reason: string;
  createdAt: string;
  userId?: string;
}

export interface TrainingRecord {
  posterId: string;
  schoolId: string;
  eventCategory: string;
  eventText: string;
  inputAssetManifest: AssetManifest;
  referencePosterPath: string | null;
  finalPosterPath: string;
  designPlan: DesignPlan;

  selectedHeroPhoto: string;
  supportingPhotoOrder: string[];
  cropAnchors: Record<string, CropAnchors>;

  approvalState: ApprovalState;
  rejectionReasons: RejectionReason[];
  rejectionNote: string;
  qualityScores: QualityScores;
  humanCorrections: Partial<DesignPlan> | null;

  modelVersion: string;
  rendererVersion: string;
  brainVersion: string;
  preferencePairs: PreferencePair[];

  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

// ── Feedback types ───────────────────────────────────────────────────────────

export interface FeedbackAction {
  posterId: string;
  action: 'approve' | 'reject' | 'correct' | 'compare';
  reasons?: RejectionReason[];
  note?: string;
  corrections?: Partial<DesignPlan>;
  comparison?: { posterBId: string; winner: PreferencePair['winner']; reason: string };
  timestamp: string;
}

export interface CritiqueThresholds {
  minScore: number;
  heroDominanceMin: number;
  brandingCompletenessMin: number;
  maxMechanicalPenalty: number;
  maxEmptyQuadrants: number;
}

export const DEFAULT_CRITIQUE_THRESHOLDS: CritiqueThresholds = {
  minScore: 65,
  heroDominanceMin: 1.6,
  brandingCompletenessMin: 0.7,
  maxMechanicalPenalty: 15,
  maxEmptyQuadrants: 1,
};

// ── Retrieval types ──────────────────────────────────────────────────────────

export interface RetrievalQuery {
  eventCategory: string;
  emphasis: string;
  photoCount: number;
  hasBirthdays: boolean;
  hasManagement: boolean;
  assetCount: number;
  schoolId?: string;
  keywords: string[];
}

export interface RetrievalResult {
  record: TrainingRecord;
  similarityScore: number;
  matchedOn: string[];
}

// ── Critic types ─────────────────────────────────────────────────────────────

export interface CriticScore {
  category: string;
  score: number;
  weight: number;
  details: string;
  pass: boolean;
}

export interface CriticReport {
  overallScore: number;
  scores: CriticScore[];
  failures: string[];
  warnings: string[];
  suggestions: string[];
  thresholds: CritiqueThresholds;
  passed: boolean;
}
