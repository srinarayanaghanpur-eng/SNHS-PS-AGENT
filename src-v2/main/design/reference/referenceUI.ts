import type {
  GenerationMode, RecreationStrength, ReferenceAnalysis, ContentMap,
  RequiredAssetsChecklist, ReferenceSceneGraph, UserCorrection,
} from './referenceTypes';

export const UI_STEPS = [
  'UPLOAD_REFERENCE',
  'ANALYSE_STRUCTURE',
  'REVIEW_REGIONS',
  'UPLOAD_ASSETS',
  'CHOOSE_STRENGTH',
  'GENERATE',
  'COMPARE',
  'OPEN_PSD',
] as const;

export type UIStep = typeof UI_STEPS[number];

export interface ReferenceRecreationUIState {
  currentStep: UIStep;
  mode: GenerationMode;
  strength: RecreationStrength;

  referencePath?: string;
  referencePreviewUrl?: string;
  referenceWidth?: number;
  referenceHeight?: number;

  analysis?: ReferenceAnalysis;
  analysisWarnings: string[];

  sceneGraph?: ReferenceSceneGraph;
  contentMap?: ContentMap;
  checklist?: RequiredAssetsChecklist;

  detectedTextBlocks: { content: string; bounds: { x: number; y: number; w: number; h: number }; confidence: number }[];
  detectedPhotoSlots: { index: number; bounds: { x: number; y: number; w: number; h: number }; role: string }[];
  detectedLogos: { bounds: { x: number; y: number; w: number; h: number }; label: string }[];
  headerFooterRegions: { type: 'header' | 'footer'; bounds: { x: number; y: number; w: number; h: number } }[];

  corrections: UserCorrection[];

  renderPath?: string;
  comparePath?: string;
  accuracyReportJson?: string;
  differenceHeatmapPath?: string;

  psdPath?: string;
  pngPath?: string;
  jpgPath?: string;

  isProcessing: boolean;
  error?: string;
}

export function createInitialUIState(): ReferenceRecreationUIState {
  return {
    currentStep: 'UPLOAD_REFERENCE',
    mode: 'accurately-recreate-reference',
    strength: 'exact',
    analysisWarnings: [],
    detectedTextBlocks: [],
    detectedPhotoSlots: [],
    detectedLogos: [],
    headerFooterRegions: [],
    corrections: [],
    isProcessing: false,
  };
}

export function nextStep(current: UIStep): UIStep | null {
  const idx = UI_STEPS.indexOf(current);
  if (idx < 0 || idx >= UI_STEPS.length - 1) return null;
  return UI_STEPS[idx + 1];
}

export function previousStep(current: UIStep): UIStep | null {
  const idx = UI_STEPS.indexOf(current);
  if (idx <= 0) return null;
  return UI_STEPS[idx - 1];
}
