export type SemanticRole =
  | 'school_logo' | 'school_name' | 'school_address' | 'school_phone' | 'poster_title'
  | 'poster_subtitle' | 'event_name' | 'event_date' | 'event_description' | 'academic_year'
  | 'student_name' | 'student_class' | 'student_photo' | 'birthday_photo' | 'birthday_name'
  | 'achievement_photo' | 'achievement_name' | 'teacher_photo' | 'chairman_photo'
  | 'principal_photo' | 'background' | 'decorative_element' | 'icon' | 'footer'
  | 'powered_by_lead'   | 'contact_information' | 'social_media' | 'event_image' | 'email' | 'website'
  | 'optional_section' | 'repeated_student_card' | 'unknown';
export type LayerType = 'group'|'text'|'pixel'|'smartObject'|'shape'|'adjustment'|'background'|'other';
export interface Rect { left:number; top:number; right:number; bottom:number; width:number; height:number }
export interface TextMetadata { contents:string; font?:string; size?:number; alignment?:string; color?:string; leading?:number; pointText?:boolean }
export interface LayerSnapshot {
  layerId:number; name:string; path:string; parentPath:string|null; parentGroup:string|null; depth:number;
  type:LayerType; bounds:Rect; boundsNoEffects:Rect; visible:boolean; opacity:number; blendMode:string;
  locked:boolean; locks:{all:boolean;pixels:boolean;position:boolean;transparent:boolean}; clipping:boolean;
  masks:{pixel:boolean;vector:boolean;filter:boolean}; smartObject:boolean; text?:TextMetadata;
  children:LayerSnapshot[]; childIds:number[]; siblingIds:number[]; zIndex:number;
}
export interface ClassifiedLayer extends LayerSnapshot { semanticRole:SemanticRole; confidence:number; reasons:string[]; optional:boolean; repeatable:boolean; conflict?:boolean }
export interface TemplateManifest {
  schemaVersion:1; templateId:string; templateName:string; sourceFilename:string; documentWidth:number;
  documentHeight:number; resolution:number; createdAt:string; updatedAt:string; fingerprint:string;
  layers:ClassifiedLayer[]; hierarchy:ClassifiedLayer[]; reviewLayerIds:number[]; tagged:boolean;
}
export interface AnalysisResult { manifest:TemplateManifest; reused:boolean; warnings:string[] }
export interface StudentRecord { name:string; className:string; photo?:FileRef }
export interface FileRef { name:string; path?:string; entry?:any }
export type EventMode='prayer'|'birthday'|'achievement'|'dance'|'karate'|'sports'|'examination'|'holiday'|'festival'|'admissions'|'notice'|'teacher'|'special'|'custom';
export interface PosterData { mode:EventMode; values:Record<string,string>; students:StudentRecord[]; files:Record<string,FileRef|undefined>; exportFormats:ExportFormat[]; exportFolder?:string }
export type ExportFormat='png'|'jpeg'|'psd'|'pdf'|'square'|'portrait'|'display'|'a4';
export interface OperationWarning { operation:string; message:string; solution:string; layerId?:number }
export interface QualityIssue { code:string; severity:'error'|'warning'|'critical'; message:string; layerId?:number }
export interface QualityReport { score:number; label:'Excellent'|'Good'|'Needs Review'|'Invalid'; issues:QualityIssue[] }

// --- Layout types ---
export type LayoutSection = 'header' | 'content' | 'footer';
export interface LayoutRegion {
  x: number; y: number; width: number; height: number;
}
export interface SectionInfo {
  region: LayoutRegion;
  section: LayoutSection;
}
export interface SafeArea {
  left: number; top: number; right: number; bottom: number;
  width: number; height: number;
}

// --- Text fitting ---
export interface TextRegion {
  x: number; y: number; width: number; height: number;
  maxLines: number;
  minFontSize: number;
  maxFontSize: number;
  alignment: 'left' | 'center' | 'right';
}
export interface FitResult {
  success: boolean;
  finalSize: number;
  lineCount: number;
  overflow: boolean;
  wasTrimmed: boolean;
}

// --- Image fitting ---
export interface ImageFitOptions {
  maxWidthPercent?: number;
  maxHeightPercent?: number;
  coverFit?: boolean;
  preserveMask?: boolean;
}

// --- Validation & repair ---
export interface LayoutIssue {
  code: string;
  severity: 'error' | 'warning' | 'critical';
  message: string;
  layerId?: number;
  section?: LayoutSection;
}
export interface AutoFix {
  description: string;
  target: string;
  success: boolean;
}
export interface LayoutValidationResult {
  valid: boolean;
  score: number;
  issues: LayoutIssue[];
  fixesApplied: AutoFix[];
  criticalIssueCount: number;
}

export interface GenerationResult {
  documentName: string;
  exports: string[];
  quality: QualityReport;
  warnings: OperationWarning[];
  layoutValidation?: LayoutValidationResult;
}
export interface AssetRecord { id:string; name:string; category:string; path:string; extension:string; license?:string; source?:string; entry?:any; size?:number; tags?:string[] }

// --- Phase 1: School profile ---
export interface SchoolProfile {
  schemaVersion: 1;
  schoolName: string;
  shortName: string;
  location: string;
  phone: string;
  altPhones: string[];
  email: string;
  website: string;
  academicYear: string;
  groupName: string;
  branchName: string;
  curriculum: string;
  brandColors: string[];          // hex strings, primary first
  preferredFonts: string[];       // ordered by preference
  footerStyle: string;            // free-text description used by layout engine
  preferredLanguages: string[];
  socialMedia: Record<string, string>;
  // stored file names inside the profile media folder (data/profile-media/<role>/)
  media: Partial<Record<ProfileMediaRole, string[]>>;
  updatedAt: string;
}
export type ProfileMediaRole =
  | 'logo' | 'campus' | 'students' | 'staff' | 'uniform' | 'chairman' | 'principal';

// --- Phase 1: Reference-poster projects ---
export type ReconstructionMode = 'pending' | 'full' | 'hybrid' | 'safe';
export type ReferenceProjectStatus =
  | 'uploaded' | 'analyzing' | 'analyzed' | 'generating' | 'generated' | 'failed';
export type ReferenceExt = 'jpg' | 'jpeg' | 'png' | 'webp' | 'pdf';
export interface ReferenceInfo {
  originalFileName: string;
  storedFileName: string;         // file inside data/projects/<id>/
  ext: ReferenceExt;
  bytes: number;
  contentHash: string;            // fnv1a of bytes (fast) — sha256 kept in sha256 field
  sha256: string;
  width: number; height: number; resolution: number; // from opened PS document
  pdfPage?: number;               // page rasterised when ext === 'pdf'
  psDocumentId?: number;          // last known open document id (session-scoped)
}
export interface DetectedRegion {
  id: string;
  kind: 'text' | 'face' | 'person' | 'logo' | 'photo' | 'shape' | 'decoration' | 'background' | 'unknown';
  bounds: Rect;
  rotation?: number;
  text?: string;
  language?: string;
  confidence: number;             // 0-100
  semanticRole?: SemanticRole;
  replace?: boolean;              // institution-specific → must be replaced/covered
  notes?: string;
}
export interface FailedElement { stage: string; elementId?: string; message: string; recovered: boolean }
export interface ReferenceProject {
  schemaVersion: 1;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: ReferenceProjectStatus;
  mode: ReconstructionMode;
  overallConfidence: number;      // 0-100, 0 until analysis runs
  reference: ReferenceInfo;
  profileSnapshot: SchoolProfile;
  regions: DetectedRegion[];
  replacementDecisions: Record<string, string>; // regionId -> action
  exports: string[];
  failedElements: FailedElement[];
}

// --- Phase 1: Model manager ---
export type ModelStatus = 'missing' | 'downloading' | 'verifying' | 'ready' | 'corrupt';
export interface ModelDescriptor {
  id: string;
  label: string;
  fileName: string;               // name inside data/models/
  url: string;                    // download source (Lite mode)
  minBytes: number;               // sanity floor; real size varies by version
  purpose: 'ocr-core' | 'ocr-lang' | 'detection' | 'face';
  required: boolean;
}
export interface ModelRecord {
  descriptor: ModelDescriptor;
  status: ModelStatus;
  bytes?: number;
  sha256?: string;                // recorded on first successful install, verified after
  installedAt?: string;
  error?: string;
}

// --- Phase 3: Detection ---
export interface DetectedObject {
  label: string;
  confidence: number;
  bounds: Rect;
}
export interface DetectedFace {
  bounds: Rect;
  landmarks?: Array<{x:number;y:number}>;
  confidence: number;
}
export interface DetectedLogo {
  bounds: Rect;
  confidence: number;
  method: 'ocr_position'|'shape'|'position_heuristic';
}
export interface LayoutAnalysis {
  canvas: {width:number;height:number;orientation:'portrait'|'landscape'|'square'};
  grid?: {columns:number;rows:number;columnWidth:number;rowHeight:number};
  sections: Array<{section:LayoutSection;region:Rect;confidence:number}>;
  visualHierarchy: Array<{elementId:string;importance:number}>;
  margins: {left:number;top:number;right:number;bottom:number};
  faceSafeRegions: Rect[];
  symmetryScore: number;
  reconstructionConfidence: number;
  recommendedMode: ReconstructionMode;
}

// --- Phase 6: Bridge / layer creation / export variants ---
export interface LayerEffects {
  shadow?: {distance:number;angle:number;size:number;color:string;opacity:number};
  stroke?: {size:number;color:string;position:'inside'|'outside'|'center'};
  gradient?: {colors:string[];angle:number;style:'linear'|'radial'};
  glow?: {color:string;size:number;opacity:number};
}
export interface DocumentSpec {
  name:string; width:number; height:number; resolution?:number;
}
export interface TextLayerSpec {
  text:string; font?:string; size:number; color:string;
  bounds:Rect; alignment?:'left'|'center'|'right';
  leading?:number; tracking?:number;
}
export interface ShapeSpec {
  kind:'rectangle'|'rounded-rectangle'|'ellipse'|'polygon';
  bounds:Rect; fill?:string; stroke?:{color:string;width:number};
  radius?:number;
}
export type BlendMode = 'normal'|'multiply'|'screen'|'overlay'|'darken'|'lighten'|'color'|'luminosity'|'softLight'|'hardLight';
export interface ExportImageOptions {
  quality?:number; compression?:number; embedICC?:boolean; trimTransparent?:boolean;
}
