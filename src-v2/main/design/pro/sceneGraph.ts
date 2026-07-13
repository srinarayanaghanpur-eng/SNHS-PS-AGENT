// Professional Poster Scene Graph
// Flexible node-based composition model replacing the fixed 11-group scaffold.
// Both the preview renderer and JSX emitter consume this same structure.

export type NodeKind =
  | 'group'
  | 'text'
  | 'image'
  | 'shape'
  | 'gradient'
  | 'line'
  | 'mask'
  | 'photoFrame'
  | 'overlay'
  | 'decorative';

export type SemanticRole =
  | 'background'
  | 'structuralGraphic'
  | 'header'
  | 'title'
  | 'subtitle'
  | 'dateLabel'
  | 'managementPhoto'
  | 'managementName'
  | 'managementDesignation'
  | 'studentPhoto'
  | 'studentName'
  | 'programmeHeading'
  | 'programmeItem'
  | 'programmeNumber'
  | 'message'
  | 'quote'
  | 'footer'
  | 'footerPhone'
  | 'footerAddress'
  | 'footerBranding'
  | 'decorative'
  | 'photoOverlay'
  | 'photoCaption';

export type FontWeight = 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';
export type TextCase = 'none' | 'uppercase' | 'lowercase' | 'capitalize' | 'small-caps';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type CropMode = 'cover' | 'contain' | 'fill' | 'none';
export type MaskShape = 'rect' | 'rounded' | 'circle' | 'ellipse' | 'custom' | 'none';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light' | 'color' | 'luminosity';

export interface Point { x: number; y: number; }
export interface Size { w: number; h: number; }
export interface Rect { x: number; y: number; w: number; h: number; }
export interface Constraints {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  aspectRatio?: number;
  alignX?: 'left' | 'center' | 'right' | 'stretch';
  alignY?: 'top' | 'center' | 'bottom' | 'stretch';
  margin?: { top: number; right: number; bottom: number; left: number };
  padding?: { top: number; right: number; bottom: number; left: number };
}

export interface Effects {
  shadow?: { color: string; opacity: number; distance: number; blur: number; angle: number };
  innerShadow?: { color: string; opacity: number; distance: number; blur: number; angle: number };
  glow?: { color: string; opacity: number; blur: number; spread?: number };
  stroke?: { color: string; width: number; opacity: number; align?: 'inside' | 'center' | 'outside' };
  blendMode?: BlendMode;
  opacity?: number;
  filter?: string; // CSS filter string for preview
}

export interface TextStyle {
  fontFamily: string;
  fontPostScriptName: string;
  fontWeight: FontWeight;
  fontSize: number;
  minFontSize: number;
  maxFontSize?: number;
  lineHeight: number; // multiplier
  tracking: number; // em units
  textCase: TextCase;
  align: TextAlign;
  verticalAlign: VerticalAlign;
  color: string;
  maxLines?: number;
  wrap: boolean;
  hyphenate?: boolean;
  letterSpacing?: number; // absolute px override
}

export interface ImageStyle {
  assetPath: string;
  aspectRatio: number;
  focalPoint: Point; // 0-1 normalized
  cropMode: CropMode;
  maskShape: MaskShape;
  maskRadius?: number;
  border?: { color: string; width: number; opacity: number };
  shadow?: Effects['shadow'];
  blendMode?: BlendMode;
  opacity?: number;
  overlay?: { color: string; opacity: number; blendMode?: BlendMode };
  grayscale?: number; // 0-1
  duotone?: { shadows: string; highlights: string; opacity?: number };
  blurBackground?: { radius: number; opacity: number };
}

export interface ShapeStyle {
  fill?: string | GradientDef;
  stroke?: { color: string; width: number; align?: 'inside' | 'center' | 'outside'; dash?: number[] };
  radius?: number | { tl: number; tr: number; br: number; bl: number };
}

export interface GradientDef {
  type: 'linear' | 'radial' | 'angular';
  stops: { color: string; position: number; opacity?: number }[];
  angle?: number;
  center?: Point;
  radius?: number;
}

export interface LineStyle {
  color: string;
  width: number;
  cap?: 'butt' | 'round' | 'square';
  dash?: number[];
}

export interface BaseNode {
  id: string;
  kind: NodeKind;
  semanticRole?: SemanticRole;
  name: string; // Photoshop layer name
  parentId?: string;
  zIndex: number;
  visible: boolean;
  opacity: number; // 0-100
  rotation: number; // degrees
  transformOrigin: Point; // 0-1 normalized
  rect: Rect; // final resolved position/size
  constraints?: Constraints;
  effects?: Effects;
  deliberateOverlap?: boolean; // marked overlaps that critic should ignore
  metadata?: Record<string, unknown>;
}

export interface GroupNode extends BaseNode {
  kind: 'group';
  children: SceneNode[];
  layout?: 'none' | 'flex' | 'grid' | 'absolute';
  flexDirection?: 'row' | 'column';
  flexWrap?: boolean;
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  gap?: number;
}

export interface TextNode extends BaseNode {
  kind: 'text';
  content: string;
  style: TextStyle;
  resolvedBounds?: Rect; // actual text bounds after layout
  textMetrics?: { width: number; height: number; lines: number; baseline: number };
}

export interface ImageNode extends BaseNode {
  kind: 'image';
  style: ImageStyle;
  naturalSize?: Size; // original image dimensions
}

export interface ShapeNode extends BaseNode {
  kind: 'shape';
  shapeType: 'rect' | 'ellipse' | 'polygon' | 'path';
  points?: Point[]; // for polygon/path
  style: ShapeStyle;
}

export interface GradientNode extends BaseNode {
  kind: 'gradient';
  gradient: GradientDef;
}

export interface LineNode extends BaseNode {
  kind: 'line';
  start: Point;
  end: Point;
  style: LineStyle;
}

export interface MaskNode extends BaseNode {
  kind: 'mask';
  maskShape: MaskShape;
  radius?: number;
  targetId: string; // node being masked
}

export interface PhotoFrameNode extends BaseNode {
  kind: 'photoFrame';
  style: ImageStyle;
  caption?: string;
  captionStyle?: Partial<TextStyle>;
  showCaption: boolean;
}

export interface OverlayNode extends BaseNode {
  kind: 'overlay';
  overlayType: 'color' | 'gradient' | 'blur' | 'noise' | 'pattern';
  color?: string;
  gradient?: GradientDef;
  opacity: number;
  blendMode?: BlendMode;
}

export interface DecorativeNode extends BaseNode {
  kind: 'decorative';
  decorationType: 'circle' | 'arc' | 'corner' | 'rule' | 'dotGrid' | 'confetti' | 'wave' | 'ray' | 'halo' | 'custom';
  style: ShapeStyle;
  animation?: { type: 'pulse' | 'rotate' | 'float'; duration: number; delay: number };
}

export type SceneNode =
  | GroupNode
  | TextNode
  | ImageNode
  | ShapeNode
  | GradientNode
  | LineNode
  | MaskNode
  | PhotoFrameNode
  | OverlayNode
  | DecorativeNode;

export interface SceneGraph {
  width: number;
  height: number;
  dpi: number;
  colorMode: 'RGB' | 'CMYK';
  backgroundColor: string;
  root: GroupNode;
  version: number;
  seed: number;
  designFamily: DesignFamily;
  colorDirection: ColorDirection;
  thumbnail?: string; // base64 or path
  qualityScore?: QualityScore;
  refinementHistory?: RefinementStep[];
}

export type DesignFamily = 'editorial-minimal' | 'bold-graphic' | 'photo-story';
export type ColorDirection = 'monochromatic' | 'complementary' | 'analogous' | 'high-contrast-academic';

export interface QualityScore {
  overall: number; // 0-100
  hierarchy: number;
  balance: number;
  alignment: number;
  whitespace: number;
  rhythm: number;
  contrast: number;
  readability: number;
  visualWeight: number;
  photoQuality: number;
  brandConsistency: number;
  decorationRestraint: number;
  contentCompleteness: number;
  details: QualityDetail[];
}

export interface QualityDetail {
  category: keyof Omit<QualityScore, 'overall' | 'details'>;
  score: number;
  issues: string[];
  suggestions: string[];
}

export interface RefinementStep {
  round: number;
  beforeScore: number;
  afterScore: number;
  criticisms: Criticism[];
  correctionsApplied: Correction[];
}

export interface Criticism {
  category: keyof Omit<QualityScore, 'overall' | 'details'>;
  severity: 'critical' | 'major' | 'minor' | 'info';
  message: string;
  nodeIds: string[];
  suggestedAction: string;
}

export interface Correction {
  type: 'resize' | 'reposition' | 'recolor' | 'retype' | 'replace' | 'remove' | 'add' | 'adjustSpacing' | 'adjustTypography';
  nodeId: string;
  property: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string;
}

export interface DesignIntent {
  category: string;
  headline: string;
  subheadline?: string;
  message?: string;
  details?: string;
  venue?: string;
  photos: AnalyzedPhoto[];
  programme?: string[];
  prayer?: PrayerContent;
  management?: { chairman?: ManagementPerson; principal?: ManagementPerson };
  school: SchoolInfo;
  brand: BrandInfo;
  width: number;
  height: number;
  seed: number;
  designFamily?: DesignFamily;
  colorDirection?: ColorDirection;
}

export interface SchoolInfo {
  name: string;
  shortName?: string;
  address: string;
  phone: string;
  academicYear: string;
  logoPath?: string;
  leadLogoPath?: string;
}

export interface BrandInfo {
  colors: { primary: string; secondary: string; accent: string; background: string };
  headingFont?: string;
  bodyFont?: string;
  footerStyle?: 'solid-bar' | 'gradient-bar' | 'minimal-line';
  logoPlacement?: 'left' | 'center' | 'right';
  leadPlacement?: 'top-right' | 'footer-right' | 'beside-powered-by';
  showLead?: boolean;
}

export interface ManagementPerson {
  show: boolean;
  asset?: { path: string; hasAlpha?: boolean; crop?: { zoom: number; offsetX: number; offsetY: number } };
  name?: string;
  designation?: string;
  frame?: 'circle' | 'rounded' | 'rectangle';
  message?: string;
}

export interface PrayerContent {
  day?: string;
  prayerTitle?: string;
  thought?: string;
  news?: string;
  pledge?: string;
  speech?: string;
  dance?: string;
  karate?: string;
  examInfo?: string;
  festivalInfo?: string;
  programme?: string[];
  birthdays?: { name: string; className?: string; photo?: string }[];
}

export interface AnalyzedPhoto {
  path: string;
  name?: string;
  className?: string;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  // Analysis results
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
  hasAlpha: boolean;
  focalRegion?: { x: number; y: number; w: number; h: number }; // 0-1 normalized
  dominantColors: string[];
  isLogo: boolean;
  isPortrait: boolean;
  qualityScore: number; // 0-100
  suggestedRole: 'hero' | 'secondary' | 'thumbnail' | 'logo' | 'background';
  suggestedCrop: CropMode;
  suggestedMask: MaskShape;
}

export interface VariantCandidate {
  id: string;
  designFamily: DesignFamily;
  colorDirection: ColorDirection;
  seed: number;
  sceneGraph: SceneGraph;
  thumbnailPath: string;
  qualityScore: QualityScore;
  refinementHistory: RefinementStep[];
  isSelected: boolean;
}

export interface GenerationResult {
  candidates: VariantCandidate[];
  selectedCandidate?: VariantCandidate;
  finalSceneGraph?: SceneGraph;
  psdPath?: string;
  pngPath?: string;
  jpgPath?: string;
}