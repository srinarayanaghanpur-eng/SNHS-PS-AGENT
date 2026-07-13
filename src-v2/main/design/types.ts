// Declarative layer-plan model. The composer produces a Plan; the JSX emitter
// renders it in Photoshop as editable groups, shapes, text and smart objects.

export interface Rect { x: number; y: number; w: number; h: number }

export interface ShadowEffect { hex: string; opacity: number; distance: number; size: number; angle: number }
export interface GlowEffect { hex: string; opacity: number; size: number }
export interface StrokeEffect { hex: string; size: number; opacity?: number }
export interface Effects { shadow?: ShadowEffect; glow?: GlowEffect; stroke?: StrokeEffect }

export interface GradientStop { hex: string; position: number } // position 0..100

export type PlanNode =
  | { kind: 'rect'; name: string; rect: Rect; hex: string; opacity?: number; radius?: number; effects?: Effects }
  | { kind: 'gradient'; name: string; rect: Rect; stops: GradientStop[]; angle: number; opacity?: number }
  | { kind: 'ellipse'; name: string; rect: Rect; hex: string; opacity?: number; effects?: Effects }
  | {
      kind: 'text'; name: string; content: string; rect: Rect;
      font: string; size: number; minSize: number; maxLines: number;
      hex: string; align: 'left' | 'center' | 'right';
      lineHeight?: number; tracking?: number; allCaps?: boolean; effects?: Effects;
      // hex of the surface this text sits on, for contrast validation
      surfaceHex?: string;
    }
  | {
      kind: 'photo'; name: string; rect: Rect; path: string;
      mask: 'rect' | 'rounded' | 'circle' | 'none'; radius?: number;
      // vertical focus for cover-crop, 0=top 1=bottom; portraits keep headroom
      focusY?: number; effects?: Effects;
      // 'cover' fills and crops (photos); 'contain' fits whole image inside the
      // box preserving aspect ratio and never cropping (logos, §6).
      fit?: 'cover' | 'contain';
      // user crop from the brand kit, applied on top of cover-fit
      zoom?: number; offsetX?: number; offsetY?: number;
    };

export interface PlanGroup { name: string; nodes: PlanNode[]; opacity?: number; visible?: boolean }

export interface Plan {
  width: number; height: number; baseHex: string;
  groups: PlanGroup[]; // ordered bottom → top
}

export interface QualityWarning { code: string; message: string; nodeName?: string; severity: 'info' | 'warning' | 'error' }
export interface QualityReport { score: number; warnings: QualityWarning[]; fixesApplied: string[] }

export interface StudentPhoto {
  path: string; name?: string; className?: string;
  zoom?: number; offsetX?: number; offsetY?: number;
}

export interface PrayerContent {
  day?: string; prayerTitle?: string; thought?: string; news?: string; pledge?: string;
  speech?: string; dance?: string; karate?: string; examInfo?: string; festivalInfo?: string;
  programme?: string[]; birthdays?: { name: string; className?: string; photo?: string }[];
}

export interface SchoolProfile {
  name: string; address: string; phone: string; academicYear: string; logoPath?: string;
}

export const DEFAULT_SCHOOL: SchoolProfile = {
  name: 'SRI NARAYANA HIGH SCHOOL',
  address: 'Ghanpur (M), Jayashankar Bhupalpally District · PIN 506135',
  phone: '6300038389',
  academicYear: 'Academic Year 2026–27',
};

// A brand-kit image resolved to an on-disk path plus its optional user crop.
export interface ResolvedAsset { path: string; hasAlpha?: boolean; crop?: { zoom: number; offsetX: number; offsetY: number } }

export interface BrandColors { primary: string; secondary: string; accent: string; background: string }

export interface BrandOptions {
  colors?: BrandColors;
  headingFont?: string; bodyFont?: string;
  footerStyle?: 'solid-bar' | 'gradient-bar' | 'minimal-line';
  logoPlacement?: 'left' | 'center' | 'right';
  leadPlacement?: 'top-right' | 'footer-right' | 'beside-powered-by';
  showLead?: boolean;
}

export interface ManagementPerson {
  show: boolean; asset?: ResolvedAsset; name?: string; designation?: string;
  frame?: 'circle' | 'rounded' | 'rectangle'; message?: string;
}

export interface BrandAssetsInput {
  mainLogo?: ResolvedAsset; leadLogo?: ResolvedAsset; background?: ResolvedAsset;
}

export interface ComposeInput {
  category: string;
  presetId?: string;
  headline: string; subheadline?: string; message?: string; details?: string; venue?: string;
  photos: StudentPhoto[];
  school: SchoolProfile;
  prayer?: PrayerContent;
  width: number; height: number;
  variationSeed: number; // 0,1,2 → genuinely different compositions
  // Brand-kit extensions. When present these override preset defaults so each
  // school uses its own colours, fonts and real logos instead of one template.
  brand?: BrandOptions;
  assets?: BrandAssetsInput;
  management?: { chairman?: ManagementPerson; principal?: ManagementPerson };
}
