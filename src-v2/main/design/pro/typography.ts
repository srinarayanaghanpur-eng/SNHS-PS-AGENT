// Typography Engine
// Handles font detection, validation, pairing, sizing, and optical adjustments.

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { log } from '../../logger';
import { createStoragePaths } from '../../storage/storagePaths.mjs';

// Defer Electron import — may not be available in test environment

export interface FontInfo {
  family: string;
  postScriptName: string;
  fullName: string;
  weight: FontWeight;
  style: 'normal' | 'italic' | 'oblique';
  path: string;
  isVariable: boolean;
  axes?: { tag: string; min: number; max: number; default: number }[];
}

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface FontPairing {
  name: string;
  display: FontInfo;
  body: FontInfo;
  fallbackDisplay: FontInfo;
  fallbackBody: FontInfo;
  roles: TypographyRoles;
}

export interface TypographyRoles {
  schoolIdentity: FontRole;
  displayTitle: FontRole;
  subtitle: FontRole;
  dateLabel: FontRole;
  programmeHeading: FontRole;
  programmeItem: FontRole;
  quoteMessage: FontRole;
  managementName: FontRole;
  footer: FontRole;
}

export interface FontRole {
  font: FontInfo;
  weight: FontWeight;
  size: number; // base size at 1080px width
  minSize: number;
  maxSize?: number;
  lineHeight: number;
  tracking: number; // em
  textCase: 'none' | 'uppercase' | 'lowercase' | 'capitalize' | 'small-caps';
  colorRole: 'primary' | 'secondary' | 'accent' | 'muted' | 'on-dark' | 'on-light';
}

export interface FontDetectionResult {
  fonts: FontInfo[];
  pairings: FontPairing[];
  missing: string[];
  warnings: string[];
}

const FONT_EXTENSIONS = ['.ttf', '.otf', '.ttc', '.woff', '.woff2'];

const SYSTEM_FONT_DIRS = [
  join(process.env.WINDIR || 'C:\\Windows', 'Fonts'),
  join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts'),
];

function getAppFontDir(): string {
  return createStoragePaths().cacheFonts;
}

const PREFERRED_PAIRINGS: Omit<FontPairing, 'display' | 'body' | 'fallbackDisplay' | 'fallbackBody' | 'roles'>[] = [
  {
    name: 'Poppins + Inter',
    display: { family: 'Poppins', weight: 700 } as any,
    body: { family: 'Inter', weight: 400 } as any,
    fallbackDisplay: { family: 'Arial', weight: 700 } as any,
    fallbackBody: { family: 'Arial', weight: 400 } as any,
    roles: {} as TypographyRoles,
  },
  {
    name: 'Playfair Display + DM Sans',
    display: { family: 'Playfair Display', weight: 700 } as any,
    body: { family: 'DM Sans', weight: 400 } as any,
    fallbackDisplay: { family: 'Georgia', weight: 700 } as any,
    fallbackBody: { family: 'Arial', weight: 400 } as any,
    roles: {} as TypographyRoles,
  },
  {
    name: 'Montserrat + Source Sans 3',
    display: { family: 'Montserrat', weight: 700 } as any,
    body: { family: 'Source Sans 3', weight: 400 } as any,
    fallbackDisplay: { family: 'Arial', weight: 700 } as any,
    fallbackBody: { family: 'Arial', weight: 400 } as any,
    roles: {} as TypographyRoles,
  },
  {
    name: 'Manrope + Inter',
    display: { family: 'Manrope', weight: 700 } as any,
    body: { family: 'Inter', weight: 400 } as any,
    fallbackDisplay: { family: 'Arial', weight: 700 } as any,
    fallbackBody: { family: 'Arial', weight: 400 } as any,
    roles: {} as TypographyRoles,
  },
];

const WEIGHT_MAP: Record<string, FontWeight> = {
  thin: 100, hairline: 100,
  extralight: 200, ultralight: 200, light: 300,
  regular: 400, normal: 400, book: 400, roman: 400,
  medium: 500,
  semibold: 600, demibold: 600,
  bold: 700,
  extrabold: 800, ultrabold: 800,
  black: 900, heavy: 900, ultra: 900,
};

function parseWeightFromName(name: string): FontWeight {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(WEIGHT_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 400;
}

function parseStyleFromName(name: string): 'normal' | 'italic' | 'oblique' {
  const lower = name.toLowerCase();
  if (lower.includes('italic')) return 'italic';
  if (lower.includes('oblique')) return 'oblique';
  return 'normal';
}

function normalizeFamilyName(name: string): string {
  return name
    .replace(/[-\s](thin|extralight|ultralight|light|regular|normal|book|roman|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|ultra|italic|oblique)$/i, '')
    .replace(/[-\s](w\d+)$/i, '')
    .trim();
}

async function scanFontDirectory(dir: string): Promise<FontInfo[]> {
  const fonts: FontInfo[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        fonts.push(...await scanFontDirectory(fullPath));
      } else if (FONT_EXTENSIONS.includes(extname(entry.name).toLowerCase())) {
        const font = await parseFontFile(fullPath);
        if (font) fonts.push(font);
      }
    }
  } catch {
    // directory doesn't exist or not readable
  }
  return fonts;
}

async function parseFontFile(path: string): Promise<FontInfo | null> {
  // Parse font metadata from file
  // In production, use a proper font parser like fontkit or opentype.js
  // For now, extract from filename as fallback
  try {
    const stats = await stat(path);
    if (stats.size === 0) return null;
    
    const ext = extname(path).toLowerCase();
    const baseName = path.split(/[\\/]/).pop()!.replace(ext, '');
    
    // Basic parsing from filename - in production use fontkit
    const family = normalizeFamilyName(baseName);
    const weight = parseWeightFromName(baseName);
    const style = parseStyleFromName(baseName);
    const postScriptName = baseName.replace(/\s+/g, '');
    
    return {
      family,
      postScriptName,
      fullName: baseName,
      weight,
      style,
      path,
      isVariable: false, // TODO: detect variable fonts
    };
  } catch {
    return null;
  }
}

let fontCache: FontDetectionResult | null = null;

export async function detectInstalledFonts(forceRefresh = false): Promise<FontDetectionResult> {
  if (fontCache && !forceRefresh) return fontCache;
  
  log('INFO', 'typography.font-scan.start');
  
  const allFonts: FontInfo[] = [];
  
  // Scan system fonts
  for (const dir of SYSTEM_FONT_DIRS) {
    allFonts.push(...await scanFontDirectory(dir));
  }
  
  // Scan app fonts
  allFonts.push(...await scanFontDirectory(getAppFontDir()));
  
  // Build pairings from available fonts
  const pairings = buildPairings(allFonts);
  
  // Check preferred pairings availability
  const missing: string[] = [];
  const warnings: string[] = [];
  
  for (const pref of PREFERRED_PAIRINGS) {
    const displayFound = allFonts.some(f => f.family.toLowerCase() === (pref.display as any).family.toLowerCase());
    const bodyFound = allFonts.some(f => f.family.toLowerCase() === (pref.body as any).family.toLowerCase());
    if (!displayFound) missing.push(`Display: ${(pref.display as any).family}`);
    if (!bodyFound) missing.push(`Body: ${(pref.body as any).family}`);
  }
  
  if (missing.length) {
    warnings.push(`Preferred fonts not installed: ${missing.join(', ')}. Using fallbacks.`);
  }
  
  fontCache = { fonts: allFonts, pairings, missing, warnings };
  log('INFO', 'typography.font-scan.complete', { count: allFonts.length, pairings: pairings.length });
  return fontCache;
}

function buildPairings(fonts: FontInfo[]): FontPairing[] {
  const pairings: FontPairing[] = [];
  
  // Try preferred pairings first
  for (const pref of PREFERRED_PAIRINGS) {
    const displayFonts = fonts.filter(f => f.family.toLowerCase() === (pref.display as any).family.toLowerCase());
    const bodyFonts = fonts.filter(f => f.family.toLowerCase() === (pref.body as any).family.toLowerCase());
    const fallbackDisplay = fonts.find(f => f.family.toLowerCase() === (pref.fallbackDisplay as any).family.toLowerCase());
    const fallbackBody = fonts.find(f => f.family.toLowerCase() === (pref.fallbackBody as any).family.toLowerCase());
    
    if (displayFonts.length && bodyFonts.length && fallbackDisplay && fallbackBody) {
      pairings.push({
        name: pref.name,
        display: pickBestWeight(displayFonts, 700),
        body: pickBestWeight(bodyFonts, 400),
        fallbackDisplay,
        fallbackBody,
        roles: createTypographyRoles(
          pickBestWeight(displayFonts, 700),
          pickBestWeight(bodyFonts, 400),
          fallbackDisplay,
          fallbackBody
        ),
      });
    }
  }
  
  // Generate additional pairings from available fonts
  const serifFonts = fonts.filter(f => isSerif(f.family));
  const sansFonts = fonts.filter(f => !isSerif(f.family));
  
  for (const serif of serifFonts.slice(0, 3)) {
    for (const sans of sansFonts.slice(0, 3)) {
      if (pairings.length >= 8) break;
      const fallbackSans = sansFonts.find(f => f.family.toLowerCase() === 'arial') || sansFonts[0];
      const fallbackSerif = serifFonts.find(f => f.family.toLowerCase() === 'georgia') || serifFonts[0];
      pairings.push({
        name: `${serif.family} + ${sans.family}`,
        display: serif,
        body: sans,
        fallbackDisplay: fallbackSerif,
        fallbackBody: fallbackSans,
        roles: createTypographyRoles(serif, sans, fallbackSerif, fallbackSans),
      });
    }
  }
  
  return pairings;
}

function pickBestWeight(fonts: FontInfo[], targetWeight: FontWeight): FontInfo {
  return fonts.reduce((best, f) => 
    Math.abs(f.weight - targetWeight) < Math.abs(best.weight - targetWeight) ? f : best
  );
}

function isSerif(family: string): boolean {
  const serifKeywords = ['serif', 'georgia', 'times', 'palatino', 'garamond', 'baskerville', 'caslon', 'playfair', 'merriweather', 'cormorant', 'libre', 'pt serif'];
  return serifKeywords.some(k => family.toLowerCase().includes(k));
}

function createTypographyRoles(
  displayFont: FontInfo,
  bodyFont: FontInfo,
  fallbackDisplay: FontInfo,
  fallbackBody: FontInfo
): TypographyRoles {
  const baseSize = 1080; // reference width
  
  return {
    schoolIdentity: { font: displayFont, weight: 700, size: Math.round(baseSize * 0.035), minSize: 20, lineHeight: 1.1, tracking: 50, textCase: 'uppercase', colorRole: 'primary' },
    displayTitle: { font: displayFont, weight: 700, size: Math.round(baseSize * 0.062), minSize: 32, maxSize: 120, lineHeight: 1.02, tracking: 10, textCase: 'uppercase', colorRole: 'primary' },
    subtitle: { font: displayFont, weight: 400, size: Math.round(baseSize * 0.026), minSize: 16, lineHeight: 1.25, tracking: 0, textCase: 'none', colorRole: 'secondary' },
    dateLabel: { font: displayFont, weight: 600, size: Math.round(baseSize * 0.019), minSize: 12, lineHeight: 1.1, tracking: 20, textCase: 'uppercase', colorRole: 'accent' },
    programmeHeading: { font: displayFont, weight: 600, size: Math.round(baseSize * 0.022), minSize: 14, lineHeight: 1.15, tracking: 35, textCase: 'uppercase', colorRole: 'primary' },
    programmeItem: { font: bodyFont, weight: 400, size: Math.round(baseSize * 0.019), minSize: 13, lineHeight: 1.4, tracking: 0, textCase: 'none', colorRole: 'primary' },
    quoteMessage: { font: bodyFont, weight: 400, size: Math.round(baseSize * 0.022), minSize: 14, maxSize: 28, lineHeight: 1.5, tracking: 0, textCase: 'none', colorRole: 'primary' },
    managementName: { font: displayFont, weight: 600, size: Math.round(baseSize * 0.021), minSize: 13, lineHeight: 1.15, tracking: 0, textCase: 'none', colorRole: 'primary' },
    footer: { font: bodyFont, weight: 400, size: Math.round(baseSize * 0.017), minSize: 11, lineHeight: 1.2, tracking: 0, textCase: 'none', colorRole: 'muted' },
  };
}

export function validateFontAvailability(fonts: FontInfo[], requiredNames: string[]): { available: FontInfo[]; missing: string[]; substitutions: Map<string, FontInfo> } {
  const available: FontInfo[] = [];
  const missing: string[] = [];
  const substitutions = new Map<string, FontInfo>();
  
  for (const name of requiredNames) {
    const found = fonts.find(f => 
      f.family.toLowerCase() === name.toLowerCase() ||
      f.postScriptName.toLowerCase() === name.toLowerCase()
    );
    if (found) {
      available.push(found);
    } else {
      missing.push(name);
      // Find best substitute
      const sub = fonts.find(f => f.weight >= 600) || fonts[0];
      if (sub) substitutions.set(name, sub);
    }
  }
  
  return { available, missing, substitutions };
}

export function getFontPairingByName(pairings: FontPairing[], name: string): FontPairing | undefined {
  return pairings.find(p => p.name.toLowerCase() === name.toLowerCase());
}

export function getBestPairingForFamily(pairings: FontPairing[], designFamily: 'editorial-minimal' | 'bold-graphic' | 'photo-story'): FontPairing {
  // Select pairing based on design family
  const preferences: Record<string, string[]> = {
    'editorial-minimal': ['Playfair Display + DM Sans', 'Poppins + Inter', 'Manrope + Inter'],
    'bold-graphic': ['Montserrat + Source Sans 3', 'Poppins + Inter', 'Manrope + Inter'],
    'photo-story': ['Playfair Display + DM Sans', 'Manrope + Inter', 'Poppins + Inter'],
  };
  
  const prefs = preferences[designFamily] || preferences['editorial-minimal'];
  
  for (const pref of prefs) {
    const found = pairings.find(p => p.name.toLowerCase().includes(pref.toLowerCase().split('+')[0].trim().toLowerCase()));
    if (found) return found;
  }
  
  return pairings[0] || createEmergencyPairing();
}

function createEmergencyPairing(): FontPairing {
  const arial = { family: 'Arial', postScriptName: 'ArialMT', fullName: 'Arial', weight: 400, style: 'normal', path: '', isVariable: false } as FontInfo;
  const arialBold = { ...arial, weight: 700, postScriptName: 'Arial-BoldMT' };
  return {
    name: 'Emergency Arial',
    display: arialBold,
    body: arial,
    fallbackDisplay: arialBold,
    fallbackBody: arial,
    roles: createTypographyRoles(arialBold, arial, arialBold, arial),
  };
}

// Optical sizing adjustments
export function calculateOpticalSize(baseSize: number, fontSize: number): number {
  // Adjust for optical perception at different sizes
  if (fontSize <= 12) return 1.02;
  if (fontSize <= 18) return 1.01;
  if (fontSize >= 72) return 0.98;
  if (fontSize >= 48) return 0.99;
  return 1.0;
}

export function calculateResponsiveSize(
  baseSize: number,
  containerWidth: number,
  referenceWidth = 1080,
  minSize: number,
  maxSize?: number
): number {
  const scaled = Math.round(baseSize * (containerWidth / referenceWidth));
  const clamped = Math.max(minSize, Math.min(maxSize || Infinity, scaled));
  return clamped;
}

// Text measurement helpers (for layout solver)
export interface TextMetrics {
  width: number;
  height: number;
  lines: number;
  baseline: number;
  ascent: number;
  descent: number;
}

export function estimateTextMetrics(
  text: string,
  fontSize: number,
  lineHeight: number,
  tracking: number,
  maxWidth: number,
  fontFamily: string
): TextMetrics {
  // Rough estimation - in production use canvas.measureText or Photoshop DOM
  const charWidth = fontSize * 0.55; // average character width ratio
  const trackingPx = fontSize * (tracking / 1000);
  const effectiveCharWidth = charWidth + trackingPx;
  const charsPerLine = Math.max(1, Math.floor(maxWidth / effectiveCharWidth));
  const lines = Math.ceil(text.length / charsPerLine);
  const width = Math.min(maxWidth, text.length * effectiveCharWidth);
  const height = lines * fontSize * lineHeight;
  
  return {
    width,
    height,
    lines,
    baseline: fontSize * 0.8,
    ascent: fontSize * 0.8,
    descent: fontSize * 0.2,
  };
}
