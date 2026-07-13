// Colour Engine
// Derives harmonious palettes from school brand primary colour.
// Supports multiple colour directions with WCAG contrast guarantees.

import { log } from '../../logger';

export interface ColourStop { hex: string; position: number } // 0-100

export interface DerivedPalette {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  textOnAccent: string;
  textOnDark: string;
  textOnLight: string;
  divider: string;
  overlayDark: string;
  overlayLight: string;
  success: string;
  warning: string;
  error: string;
  direction: ColourDirection;
  roleColours: RoleColourMap;
}

export type ColourDirection = 'monochromatic' | 'complementary' | 'analogous' | 'high-contrast-academic';

export interface RoleColourMap {
  schoolIdentity: string;
  displayTitle: string;
  subtitle: string;
  dateLabel: string;
  programmeHeading: string;
  programmeItem: string;
  quoteMessage: string;
  managementName: string;
  footer: string;
  background: string;
  surface: string;
  accent: string;
  divider: string;
  overlay: string;
}

export interface ColourAnalysis {
  dominantColors: string[];
  averageLuminance: number;
  isDark: boolean;
  suggestedTextColor: string;
  contrastRatio: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function shiftHue(hex: string, degrees: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const { r: r2, g: g2, b: b2 } = hslToRgb((h + degrees) % 360, s, l);
  return rgbToHex(r2, g2, b2);
}

function adjustLightness(hex: string, delta: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const { r: r2, g: g2, b: b2 } = hslToRgb(h, s, clamp(l + delta, 0, 100));
  return rgbToHex(r2, g2, b2);
}

function adjustSaturation(hex: string, delta: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const { r: r2, g: g2, b: b2 } = hslToRgb(h, clamp(s + delta, 0, 100), l);
  return rgbToHex(r2, g2, b2);
}

function mixColors(hexA: string, hexB: string, ratio: number): string {
  const { r: r1, g: g1, b: b1 } = hexToRgb(hexA);
  const { r: r2, g: g2, b: b2 } = hexToRgb(hexB);
  return rgbToHex(
    Math.round(r1 + (r2 - r1) * ratio),
    Math.round(g1 + (g2 - g1) * ratio),
    Math.round(b1 + (b2 - b1) * ratio)
  );
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(textColor: string, bgColor: string, minRatio = 4.5): string {
  const ratio = contrastRatio(textColor, bgColor);
  if (ratio >= minRatio) return textColor;
  
  // Adjust text color lightness until contrast is met
  const { r, g, b } = hexToRgb(textColor);
  const { h, s, l } = rgbToHsl(r, g, b);
  const bgL = luminance(bgColor);
  const targetL = bgL > 0.5 ? 0 : 1; // dark text on light bg, light text on dark bg
  
  let newL = l;
  const step = targetL > l ? 2 : -2;
  for (let i = 0; i < 50; i++) {
    newL = clamp(newL + step, 0, 100);
    const { r: r2, g: g2, b: b2 } = hslToRgb(h, s, newL);
    const testColor = rgbToHex(r2, g2, b2);
    if (contrastRatio(testColor, bgColor) >= minRatio) return testColor;
  }
  return targetL > 0.5 ? '#FFFFFF' : '#000000';
}

function generateGradientStops(hex: string, count: number, lightnessRange: [number, number]): ColourStop[] {
  const stops: ColourStop[] = [];
  const { h, s, l } = rgbToHsl(...Object.values(hexToRgb(hex)));
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const newL = lightnessRange[0] + (lightnessRange[1] - lightnessRange[0]) * t;
    const { r, g, b } = hslToRgb(h, s, newL);
    stops.push({ hex: rgbToHex(r, g, b), position: Math.round(t * 100) });
  }
  return stops;
}

export function derivePaletteFromPrimary(
  primaryHex: string,
  direction: ColourDirection = 'monochromatic',
  secondaryHex?: string,
  accentHex?: string
): DerivedPalette {
  const primary = primaryHex.toUpperCase().replace('#', '');
  const primaryClean = `#${primary}`;
  
  const { h, s, l } = rgbToHsl(...Object.values(hexToRgb(primaryClean)));
  const isDark = l < 50;
  
  let secondary: string;
  let accent: string;
  let background: string;
  let backgroundAlt: string;
  
  switch (direction) {
    case 'monochromatic': {
      secondary = adjustLightness(primaryClean, isDark ? -15 : 15);
      accent = adjustSaturation(adjustLightness(primaryClean, isDark ? 25 : -25), 15);
      background = isDark ? adjustLightness(primaryClean, -40) : adjustLightness(primaryClean, 85);
      backgroundAlt = isDark ? adjustLightness(primaryClean, -35) : adjustLightness(primaryClean, 80);
      break;
    }
    case 'complementary': {
      secondary = shiftHue(primaryClean, 180);
      accent = shiftHue(primaryClean, 150); // split complementary
      background = isDark ? '#0D1B2A' : '#F8FAFC';
      backgroundAlt = isDark ? '#142D4A' : '#F1F5F9';
      break;
    }
    case 'analogous': {
      secondary = shiftHue(primaryClean, 30);
      accent = shiftHue(primaryClean, -30);
      background = isDark ? adjustLightness(primaryClean, -45) : adjustLightness(primaryClean, 90);
      backgroundAlt = isDark ? adjustLightness(primaryClean, -40) : adjustLightness(primaryClean, 85);
      break;
    }
    case 'high-contrast-academic': {
      // Navy/Gold academic style
      secondary = isDark ? '#1E3A5F' : '#1E3A5F';
      accent = '#D4A72C'; // Gold
      background = isDark ? '#0B1D3A' : '#F7FAFF';
      backgroundAlt = isDark ? '#123E78' : '#FFFFFF';
      break;
    }
    default: {
      secondary = adjustLightness(primaryClean, -10);
      accent = shiftHue(primaryClean, 120);
      background = isDark ? '#111827' : '#F9FAFB';
      backgroundAlt = isDark ? '#1F2937' : '#FFFFFF';
    }
  }
  
  // Override with provided values if available
  if (secondaryHex) secondary = secondaryHex.toUpperCase().replace('#', '');
  if (accentHex) accent = accentHex.toUpperCase().replace('#', '');
  
  // Ensure proper contrast for text colors
  const surface = isDark ? adjustLightness(background, 8) : '#FFFFFF';
  const surfaceElevated = isDark ? adjustLightness(background, 12) : '#FFFFFF';
  
  const textPrimary = ensureContrast(isDark ? '#FFFFFF' : '#111827', background);
  const textOnPrimary = ensureContrast(isDark ? '#FFFFFF' : '#000000', primaryClean, 4.5);
  const textOnAccent = ensureContrast(isDark ? '#FFFFFF' : '#000000', accent, 4.5);
  const textOnDark = ensureContrast('#FFFFFF', background);
  const textOnLight = ensureContrast('#111827', backgroundAlt);
  const textSecondary = ensureContrast(isDark ? '#D1D5DB' : '#4B5563', background);
  const textMuted = ensureContrast(isDark ? '#9CA3AF' : '#9CA3AF', background);
  
  const divider = isDark ? adjustLightness(background, 20) : adjustLightness(backgroundAlt, -15);
  const overlayDark = 'rgba(0,0,0,0.6)';
  const overlayLight = 'rgba(255,255,255,0.1)';
  
  const roleColours: RoleColourMap = {
    schoolIdentity: textOnPrimary,
    displayTitle: textPrimary,
    subtitle: textSecondary,
    dateLabel: accent,
    programmeHeading: textPrimary,
    programmeItem: textPrimary,
    quoteMessage: textPrimary,
    managementName: textPrimary,
    footer: textOnDark,
    background,
    surface,
    accent,
    divider,
    overlay: overlayDark,
  };
  
  const palette: DerivedPalette = {
    primary: primaryClean,
    primaryDark: adjustLightness(primaryClean, -20),
    primaryLight: adjustLightness(primaryClean, 20),
    secondary: secondary.startsWith('#') ? secondary : `#${secondary}`,
    accent: accent.startsWith('#') ? accent : `#${accent}`,
    accentDark: adjustLightness(accent.startsWith('#') ? accent : `#${accent}`, -20),
    accentLight: adjustLightness(accent.startsWith('#') ? accent : `#${accent}`, 20),
    background: background.startsWith('#') ? background : `#${background}`,
    backgroundAlt: backgroundAlt.startsWith('#') ? backgroundAlt : `#${backgroundAlt}`,
    surface,
    surfaceElevated,
    textPrimary,
    textSecondary,
    textMuted,
    textOnPrimary,
    textOnAccent,
    textOnDark,
    textOnLight,
    divider: divider.startsWith('#') ? divider : `#${divider}`,
    overlayDark,
    overlayLight,
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    direction,
    roleColours,
  };
  
  log('INFO', 'colour.palette-derived', { primary: primaryClean, direction, isDark });
  return palette;
}

export function getGradientStopsForBackground(palette: DerivedPalette, style: 'vertical' | 'diagonal' | 'radial' | 'split' | 'vignette'): ColourStop[][] {
  switch (style) {
    case 'vertical':
      return [generateGradientStops(palette.primary, 3, [palette.primaryDark, palette.primaryLight] as any)];
    case 'diagonal':
      return [generateGradientStops(palette.primary, 3, [palette.primaryDark, palette.primaryLight] as any)];
    case 'radial':
      return [generateGradientStops(palette.primary, 4, [palette.background, palette.primary] as any)];
    case 'split':
      return [generateGradientStops(palette.backgroundAlt, 2, [palette.background, palette.backgroundAlt] as any)];
    case 'vignette':
      return [generateGradientStops(palette.primary, 3, [palette.primaryLight, palette.primaryDark] as any)];
    default:
      return [generateGradientStops(palette.primary, 2, [palette.primary, palette.primaryLight] as any)];
  }
}

export function analyzePhotoColors(imagePath: string): Promise<ColourAnalysis> {
  // Placeholder - in production use a proper image analysis library
  // like sharp + color-thief or custom implementation
  return Promise.resolve({
    dominantColors: ['#1E3A5F', '#D4A72C', '#FFFFFF'],
    averageLuminance: 0.45,
    isDark: true,
    suggestedTextColor: '#FFFFFF',
    contrastRatio: 8.5,
  });
}

export function getOverlayColorForPhoto(palette: DerivedPalette, photoAnalysis: ColourAnalysis): string {
  if (photoAnalysis.isDark) {
    return palette.overlayLight;
  }
  return palette.overlayDark;
}

export function getTextColorForSurface(palette: DerivedPalette, surfaceRole: keyof RoleColourMap): string {
  return palette.roleColours[surfaceRole] || palette.textPrimary;
}

export function createDirectionVariants(basePalette: DerivedPalette): DerivedPalette[] {
  const directions: ColourDirection[] = ['monochromatic', 'complementary', 'analogous', 'high-contrast-academic'];
  return directions.map(d => derivePaletteFromPrimary(basePalette.primary, d, basePalette.secondary, basePalette.accent));
}

export function limitPalette(palette: DerivedPalette, maxColors = 8): string[] {
  // Return the most important colors for the design
  return [
    palette.primary,
    palette.accent,
    palette.background,
    palette.surface,
    palette.textPrimary,
    palette.textSecondary,
    palette.textMuted,
    palette.divider,
  ].slice(0, maxColors);
}
