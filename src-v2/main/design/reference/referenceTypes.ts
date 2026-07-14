export type GenerationMode = 'create-new-design' | 'accurately-recreate-reference';
export type RecreationStrength = 'exact' | 'adaptive';
export type SlotRole =
  | 'schoolLogo' | 'schoolName' | 'schoolAddress'
  | 'chairmanPortrait' | 'principalPortrait' | 'managementPortrait'
  | 'eventTitle' | 'posterDate' | 'posterDay'
  | 'heroPhoto' | 'supportingPhoto' | 'programmePhoto'
  | 'quote' | 'message'
  | 'footerPhone' | 'footerAddress' | 'footerYear' | 'footerLeadBranding'
  | 'leadLogo' | 'groupBranding'
  | 'decorativeShape' | 'background' | 'backgroundImage'
  | 'programmeList' | 'prayerContent'
  | 'divider' | 'border' | 'topAccentEdge'
  | 'unknown';

export interface NormalizedRect {
  x: number; y: number; width: number; height: number;
}

export interface DetectedRegion {
  id: string;
  role: SlotRole;
  type: 'image' | 'text' | 'shape' | 'gradient' | 'group';
  bounds: NormalizedRect;
  confidence: number;
  shape?: 'rect' | 'rounded' | 'circle' | 'ellipse' | 'polygon' | 'custom';
  rotation?: number;
}

export interface TextDetection {
  content: string;
  bounds: NormalizedRect;
  fontCategory?: 'serif' | 'sans-serif' | 'display' | 'script';
  fontWeight?: 'light' | 'regular' | 'bold' | 'black';
  fontSizeRelative: number;
  colour: string;
  alignment: 'left' | 'center' | 'right';
  lineCount: number;
  letterSpacing?: number;
  lineSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  hasOutline?: boolean;
  hasShadow?: boolean;
  surfaceHex?: string;
}

export interface ImageFrameDetection {
  bounds: NormalizedRect;
  aspectRatio: number;
  borderThickness: number;
  borderColour: string;
  cornerRadius: number;
  rotation: number;
  maskShape: 'rect' | 'rounded' | 'circle' | 'ellipse' | 'custom';
  hasShadow: boolean;
  hasStroke: boolean;
  strokeColour?: string;
  strokeSize?: number;
  captionPosition?: 'below' | 'above' | 'overlay' | 'none';
  captionBackground?: string;
  captionAlignment?: 'left' | 'center' | 'right';
}

export interface DecorativeElement {
  type: 'line' | 'rect' | 'ellipse' | 'polygon' | 'gradient' | 'dot' | 'pattern' | 'flourish';
  bounds: NormalizedRect;
  colour: string;
  opacity: number;
  rotation?: number;
  points?: { x: number; y: number }[];
  gradientStops?: { hex: string; position: number }[];
  gradientAngle?: number;
}

export interface ReferenceCanvas {
  width: number;
  height: number;
  backgroundColour?: string;
  backgroundImage?: string;
}

export interface ReferenceAnalysis {
  referenceId: string;
  referencePath: string;
  canvas: ReferenceCanvas;
  headerRegion: DetectedRegion;
  mainTitleRegion: DetectedRegion;
  schoolLogoRegion?: DetectedRegion;
  managementPhotoRegions: DetectedRegion[];
  eventTitleRegion: DetectedRegion;
  dateRegion: DetectedRegion;
  heroPhotoRegion?: DetectedRegion;
  supportingPhotoRegions: DetectedRegion[];
  programmePhotoRegions: DetectedRegion[];
  quoteRegion?: DetectedRegion;
  messageRegions: DetectedRegion[];
  footerRegion: DetectedRegion;
  contactInfoRegion: DetectedRegion;
  leadLogoRegion?: DetectedRegion;
  decorativeShapes: DecorativeElement[];
  borders: DecorativeElement[];
  dividers: DecorativeElement[];
  shadows: { bounds: NormalizedRect; colour: string; opacity: number; size: number; angle: number }[];
  textDetections: TextDetection[];
  imageFrameDetections: ImageFrameDetection[];
  allRegions: DetectedRegion[];
}

export interface ReferenceSceneGraphLayer {
  name: string;
  type: 'background' | 'photo-slot' | 'text' | 'shape' | 'gradient' | 'group';
  bounds: NormalizedRect;
  mask?: 'rect' | 'rounded' | 'circle' | 'ellipse' | 'none';
  fill?: string;
  opacity?: number;
  radius?: number;
  effects?: {
    shadow?: { hex: string; opacity: number; distance: number; size: number; angle: number };
    stroke?: { hex: string; size: number; opacity?: number };
    glow?: { hex: string; opacity: number; size: number };
  };
  style?: {
    font?: string;
    size?: number;
    colour?: string;
    align?: 'left' | 'center' | 'right';
    lineHeight?: number;
    tracking?: number;
    allCaps?: boolean;
    surfaceHex?: string;
  };
  content?: string;
  imagePath?: string;
  fit?: 'cover' | 'contain';
  focusY?: number;
  children?: ReferenceSceneGraphLayer[];
}

export interface ReferenceSceneGraph {
  referenceId: string;
  mode: 'exact-reconstruction';
  canvas: { width: number; height: number };
  layers: ReferenceSceneGraphLayer[];
  layerOrder: string[];
}

export interface RoleMapping {
  referenceSlot: string;
  referenceRole: SlotRole;
  replacementAsset?: string;
  replacementContent?: string;
  cropAdjustment?: { zoom: number; offsetX: number; offsetY: number };
  preserved: boolean;
  confidence: number;
}

export interface ContentMap {
  referenceId: string;
  mappings: RoleMapping[];
  missingAssets: { role: SlotRole; description: string }[];
  availableAssets: string[];
}

export interface RequiredAssetsChecklist {
  referenceId: string;
  required: { role: SlotRole; description: string; provided: boolean; path?: string }[];
  missingCount: number;
  totalCount: number;
}

export interface RegionAccuracyScore {
  regionId: string;
  regionRole: SlotRole;
  geometryAccuracy: number;
  sizeAccuracy: number;
  positionAccuracy: number;
  colourAccuracy?: number;
  contentAccuracy?: number;
  overall: number;
}

export interface AccuracyReport {
  geometryAccuracy: number;
  headerAccuracy: number;
  footerAccuracy: number;
  photoSlotAccuracy: number;
  typographyAccuracy: number;
  colourAccuracy: number;
  decorativeShapeAccuracy: number;
  overallStructuralAccuracy: number;
  regionScores: RegionAccuracyScore[];
  warnings: string[];
  failures: string[];
  accepted: boolean;
}

export interface DebugOverlayConfig {
  referenceOpacity: number;
  showDetectedRegions: boolean;
  showAlignmentGuides: boolean;
  showPixelDifference: boolean;
  showTextDifferences: boolean;
  showImageSlotDifferences: boolean;
}

export interface TextFittingReport {
  originalSize: number;
  adjustedSize: number;
  originalTracking: number;
  adjustedTracking: number;
  lineBreaksChanged: boolean;
  boxHeightIncreased: boolean;
  fitAchieved: boolean;
  warning?: string;
}

export interface CropAdjustment {
  assetPath: string;
  slotId: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  faceSafeAnchor: boolean;
}

export interface UserCorrection {
  regionId: string;
  type: 'bounds' | 'role' | 'content' | 'crop' | 'lock' | 'mark-decoration' | 'mark-ignored' | 'assign-photo';
  before: unknown;
  after: unknown;
}

export interface ReconstructionJob {
  jobId: string;
  referenceId: string;
  mode: GenerationMode;
  strength: RecreationStrength;
  referencePath: string;
  analysis: ReferenceAnalysis;
  sceneGraph: ReferenceSceneGraph;
  contentMap: ContentMap;
  checklist: RequiredAssetsChecklist;
  firstRenderPath?: string;
  finalRenderPath?: string;
  accuracyReport?: AccuracyReport;
  corrections: UserCorrection[];
  psdPath?: string;
  pngPath?: string;
  jpgPath?: string;
  differenceHeatmapPath?: string;
  status: 'analysis-pending' | 'analysis-complete' | 'awaiting-assets' | 'rendering' | 'comparing' | 'approved' | 'failed';
}

export type AnalysisPass = 'global-structure' | 'object-detection' | 'ocr-typography' | 'image-frame' | 'decorative';

export const REFERENCE_LAYER_GROUPS = [
  '00_REFERENCE_GUIDES',
  '01_BACKGROUND',
  '02_HEADER',
  '03_SCHOOL_LOGO',
  '04_SCHOOL_NAME',
  '05_CHAIRMAN',
  '06_EVENT_TITLE',
  '07_HERO_PHOTO',
  '08_SUPPORTING_PHOTOS',
  '09_QUOTE',
  '10_PROGRAMME_GALLERY',
  '11_FOOTER',
  '12_GROUP_BRANDING',
  '13_LEAD_LOGO',
  '14_CONTACT_DETAILS',
  '15_DECORATIONS',
] as const;

export const ACCEPTANCE_THRESHOLDS = {
  exact: {
    sectionBoundaryTolerance: 0.02,
    photoSlotCount: true,
    photoFrameTolerance: 0.02,
    headerFooterHeightTolerance: 0.02,
    logoPortraitTolerance: 0.02,
    textAlignmentMatch: true,
    noMissingMajorRegion: true,
    noUnrelatedLayoutFamily: true,
    noSilentReplacement: true,
    minimumOverallAccuracy: 0.90,
  },
  adaptive: {
    sectionBoundaryTolerance: 0.05,
    photoSlotCount: false,
    photoFrameTolerance: 0.05,
    headerFooterHeightTolerance: 0.05,
    logoPortraitTolerance: 0.05,
    textAlignmentMatch: false,
    noMissingMajorRegion: true,
    noUnrelatedLayoutFamily: true,
    noSilentReplacement: true,
    minimumOverallAccuracy: 0.80,
  },
} as const;

export const ACCEPTANCE_LABELS = {
  below70: 'Reconstruction failed',
  '70to84': 'Loose similarity only',
  '85to89': 'Close but requires correction',
  '90andAbove': 'Accurate reconstruction',
} as const;

export function acceptanceLabel(score: number): string {
  if (score >= 90) return ACCEPTANCE_LABELS['90andAbove'];
  if (score >= 85) return ACCEPTANCE_LABELS['85to89'];
  if (score >= 70) return ACCEPTANCE_LABELS['70to84'];
  return ACCEPTANCE_LABELS.below70;
}
