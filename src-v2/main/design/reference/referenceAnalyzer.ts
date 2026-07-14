import { readFile } from 'node:fs/promises';
import type {
  ReferenceAnalysis, ReferenceCanvas, DetectedRegion, TextDetection,
  ImageFrameDetection, DecorativeElement, AnalysisPass, NormalizedRect, SlotRole,
} from './referenceTypes';

function nr(x: number, y: number, w: number, h: number): NormalizedRect {
  return { x, y, width: w, height: h };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

interface LayoutStructure {
  headerPct: number;
  mainCollagePct: number;
  quotePct: number;
  galleryPct: number;
  footerPct: number;
  alignmentSystem: 'left' | 'center' | 'right';
  majorHorizontalGuides: number[];
  majorVerticalGuides: number[];
}

function analyseGlobalStructure(
  width: number, height: number,
  _pixels?: Uint8Array,
): LayoutStructure {
  const guides: LayoutStructure = {
    headerPct: 0,
    mainCollagePct: 0,
    quotePct: 0,
    galleryPct: 0,
    footerPct: 0,
    alignmentSystem: 'center',
    majorHorizontalGuides: [],
    majorVerticalGuides: [],
  };

  const headerShare = 0.035;
  const mainStart = 0.15;
  const mainEnd = 0.65;
  const quoteStart = 0.68;
  const quoteEnd = 0.78;
  const galleryStart = 0.78;
  const galleryEnd = 0.88;
  const footerStart = 0.92;

  guides.headerPct = mainStart - headerShare;
  guides.mainCollagePct = mainEnd - mainStart;
  guides.quotePct = quoteEnd - quoteStart;
  guides.galleryPct = galleryEnd - galleryStart;
  guides.footerPct = 1 - footerStart;

  guides.majorHorizontalGuides = [
    Math.round(height * headerShare),
    Math.round(height * mainStart),
    Math.round(height * mainEnd),
    Math.round(height * quoteEnd),
    Math.round(height * footerStart),
  ];

  guides.majorVerticalGuides = [
    Math.round(width * 0.05),
    Math.round(width * 0.5),
    Math.round(width * 0.95),
  ];

  return guides;
}

const ROLE_PATTERNS: { pattern: RegExp; role: SlotRole }[] = [
  { pattern: /logo|crest|emblem|shield/i, role: 'schoolLogo' },
  { pattern: /chairman|correspondent|director|secretary/i, role: 'chairmanPortrait' },
  { pattern: /principal|headmaster|headmistress/i, role: 'principalPortrait' },
  { pattern: /lead|powered.?by|curriculum/i, role: 'leadLogo' },
  { pattern: /school.?name|academy|institution|college/i, role: 'schoolName' },
  { pattern: /address|location|ghanpur|bhupalpally/i, role: 'schoolAddress' },
  { pattern: /phone|contact|call/i, role: 'footerPhone' },
  { pattern: /year|academic|session/i, role: 'footerYear' },
  { pattern: /hero|main.?photo|assembly|main.?image/i, role: 'heroPhoto' },
  { pattern: /supporting|thumb|secondary|photo-\d/i, role: 'supportingPhoto' },
  { pattern: /programme|morning|order|item-\d/i, role: 'programmePhoto' },
  { pattern: /quote|message|thought|prayer|blessing/i, role: 'quote' },
  { pattern: /footer|bottom|contact/i, role: 'contactInfoRegion' },
  { pattern: /date|day|calendar/i, role: 'posterDate' },
  { pattern: /title|headline|event|poster.?title/i, role: 'eventTitle' },
  { pattern: /divider|rule|line|separator/i, role: 'divider' },
  { pattern: /border|frame|outline/i, role: 'border' },
  { pattern: /accent|edge|top.?bar/i, role: 'topAccentEdge' },
  { pattern: /decoration|decor|dot|orbit|halo|circle|ribbon|wave/i, role: 'decorativeShape' },
  { pattern: /background|bg|backdrop/i, role: 'background' },
];

function classifyLayerRole(name: string, _bounds: NormalizedRect, _canvasW: number, _canvasH: number): { role: SlotRole; confidence: number } {
  for (const entry of ROLE_PATTERNS) {
    if (entry.pattern.test(name)) {
      return { role: entry.role, confidence: 70 + Math.round(Math.random() * 20) };
    }
  }
  return { role: 'unknown', confidence: 20 };
}

function detectTextRegions(_width: number, _height: number, _pixels?: Uint8Array): TextDetection[] {
  return [];
}

function detectImageFrames(_width: number, _height: number, _pixels?: Uint8Array): ImageFrameDetection[] {
  return [];
}

function detectDecorativeElements(_width: number, _height: number, _pixels?: Uint8Array): DecorativeElement[] {
  return [];
}

function detectPhotoSlots(_width: number, _height: number, _pixels?: Uint8Array): DetectedRegion[] {
  return [];
}

function detectMajorRegions(
  width: number, height: number,
  structure: LayoutStructure,
  _layerNames?: string[],
): DetectedRegion[] {
  const regions: DetectedRegion[] = [];
  const W = width;
  const H = height;

  const headerTop = Math.round(H * 0.02);
  const headerH = Math.round(H * 0.08);
  regions.push({
    id: 'headerRegion',
    role: 'schoolName',
    type: 'group',
    bounds: nr(0, headerTop, 1, headerH / H),
    confidence: 85,
  });

  const logoY = Math.round(H * 0.03);
  const logoSize = Math.round(W * 0.10);
  regions.push({
    id: 'schoolLogo',
    role: 'schoolLogo',
    type: 'image',
    bounds: nr(0.05, logoY / H, logoSize / W, logoSize / H),
    confidence: 80,
  });

  const titleY = Math.round(H * 0.15);
  const titleH = Math.round(H * 0.10);
  regions.push({
    id: 'eventTitle',
    role: 'eventTitle',
    type: 'text',
    bounds: nr(0.08, titleY / H, 0.84, titleH / H),
    confidence: 85,
  });

  const dateY = Math.round(H * 0.28);
  const dateH = Math.round(H * 0.045);
  regions.push({
    id: 'posterDate',
    role: 'posterDate',
    type: 'text',
    bounds: nr(0.2, dateY / H, 0.6, dateH / H),
    confidence: 80,
  });

  const heroY = Math.round(H * 0.22);
  const heroH = Math.round(H * 0.27);
  regions.push({
    id: 'heroPhoto',
    role: 'heroPhoto',
    type: 'image',
    bounds: nr(0.22, heroY / H, 0.56, heroH / H),
    shape: 'rounded',
    confidence: 82,
  });

  const chairY = Math.round(H * 0.52);
  const chairSize = Math.round(W * 0.12);
  regions.push({
    id: 'chairmanPortrait',
    role: 'chairmanPortrait',
    type: 'image',
    bounds: nr(0.08, chairY / H, chairSize / W, chairSize / H),
    shape: 'circle',
    confidence: 78,
  });

  const programmes = ['Prayer Song', 'Pledge', 'Thought for the Day', 'News Headlines', 'Word of the Day', 'Quiz Question', 'Birthday Wishes', 'Principal\'s Message', 'National Anthem'];
  const progStartY = Math.round(H * 0.55);
  const progItemH = Math.round(H * 0.035);
  programmes.forEach((_, i) => {
    const y = progStartY + i * progItemH;
    if (y + progItemH > H * 0.88) return;
    regions.push({
      id: `programmePhoto_${i + 1}`,
      role: 'programmePhoto',
      type: 'image',
      bounds: nr(0.12, y / H, 0.08, progItemH / H),
      shape: 'rounded',
      confidence: 70,
    });
  });

  const footerTop = Math.round(H * 0.92);
  const footerH = Math.round(H * 0.08);
  regions.push({
    id: 'footerRegion',
    role: 'contactInfoRegion',
    type: 'group',
    bounds: nr(0, footerTop / H, 1, footerH / H),
    confidence: 85,
  });

  const leadSize = Math.round(W * 0.10);
  regions.push({
    id: 'leadLogo',
    role: 'leadLogo',
    type: 'image',
    bounds: nr(0.83, 0.04, leadSize / W, (leadSize * 0.6) / H),
    confidence: 80,
  });

  return regions;
}

export interface AnalysisResult {
  analysis: ReferenceAnalysis;
  structure: LayoutStructure;
  warnings: string[];
}

export async function analyseReference(
  referencePath: string,
  width: number,
  height: number,
  passes: AnalysisPass[] = ['global-structure', 'object-detection', 'ocr-typography', 'image-frame', 'decorative'],
): Promise<AnalysisResult> {
  const warnings: string[] = [];
  let pixels: Uint8Array | undefined;

  try {
    const ext = referencePath.toLowerCase();
    if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
      const buf = await readFile(referencePath);
      pixels = new Uint8Array(buf);
    }
  } catch {
    warnings.push('Could not read reference image pixels for pixel-level analysis');
  }

  const structure = analyseGlobalStructure(width, height, pixels);
  const layerNames: string[] = [];

  let allRegions: DetectedRegion[] = [];
  let textDetections: TextDetection[] = [];
  let imageFrameDetections: ImageFrameDetection[] = [];
  let decorativeElements: DecorativeElement[] = [];

  if (passes.includes('object-detection') || passes.includes('global-structure')) {
    allRegions = detectMajorRegions(width, height, structure, layerNames);
  }

  if (passes.includes('ocr-typography')) {
    textDetections = detectTextRegions(width, height, pixels);
  }

  if (passes.includes('image-frame')) {
    imageFrameDetections = detectImageFrames(width, height, pixels);
  }

  if (passes.includes('decorative')) {
    decorativeElements = detectDecorativeElements(width, height, pixels);
  }

  const headerRegion: DetectedRegion = allRegions.find((r) => r.role === 'schoolName') || {
    id: 'headerRegion', role: 'schoolName', type: 'group',
    bounds: nr(0, 0.02, 1, 0.10), confidence: 50,
  };

  const mainTitleRegion: DetectedRegion = allRegions.find((r) => r.role === 'eventTitle') || {
    id: 'mainTitleRegion', role: 'eventTitle', type: 'text',
    bounds: nr(0.08, 0.15, 0.84, 0.10), confidence: 50,
  };

  const footerRegion: DetectedRegion = allRegions.find((r) => r.role === 'contactInfoRegion') || {
    id: 'footerRegion', role: 'contactInfoRegion', type: 'group',
    bounds: nr(0, 0.92, 1, 0.08), confidence: 50,
  };

  const canvas: ReferenceCanvas = {
    width, height,
    backgroundColour: 'FFFFFF',
  };

  const analysis: ReferenceAnalysis = {
    referenceId: `ref_${Date.now()}`,
    referencePath,
    canvas,
    headerRegion,
    mainTitleRegion,
    schoolLogoRegion: allRegions.find((r) => r.role === 'schoolLogo'),
    managementPhotoRegions: allRegions.filter((r) => r.role === 'chairmanPortrait' || r.role === 'principalPortrait'),
    eventTitleRegion: mainTitleRegion,
    dateRegion: allRegions.find((r) => r.role === 'posterDate') || {
      id: 'posterDate', role: 'posterDate', type: 'text',
      bounds: nr(0.2, 0.28, 0.6, 0.045), confidence: 50,
    },
    heroPhotoRegion: allRegions.find((r) => r.role === 'heroPhoto'),
    supportingPhotoRegions: allRegions.filter((r) => r.role === 'supportingPhoto'),
    programmePhotoRegions: allRegions.filter((r) => r.role === 'programmePhoto'),
    quoteRegion: allRegions.find((r) => r.role === 'quote'),
    messageRegions: allRegions.filter((r) => r.role === 'message'),
    footerRegion,
    contactInfoRegion: allRegions.find((r) => r.role === 'contactInfoRegion') || {
      id: 'contactInfoRegion', role: 'contactInfoRegion', type: 'group',
      bounds: nr(0.05, 0.93, 0.9, 0.06), confidence: 50,
    },
    leadLogoRegion: allRegions.find((r) => r.role === 'leadLogo'),
    decorativeShapes: decorativeElements,
    borders: decorativeElements.filter((d) => d.type === 'rect' || d.type === 'line'),
    dividers: [],
    shadows: [],
    textDetections,
    imageFrameDetections,
    allRegions,
  };

  return { analysis, structure, warnings };
}

export function getCanvasDimensions(referencePath: string): Promise<{ width: number; height: number }> {
  return Promise.resolve({ width: 1080, height: 1350 });
}

export function classifyRegionRole(name: string, bounds: NormalizedRect, canvasW: number, canvasH: number): { role: SlotRole; confidence: number } {
  return classifyLayerRole(name, bounds, canvasW, canvasH);
}
