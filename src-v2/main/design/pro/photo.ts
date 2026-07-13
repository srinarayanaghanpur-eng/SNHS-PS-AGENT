// Photo Engine
// Analyzes photographs for composition, crops, focal points, and treatment recommendations.

import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { log } from '../../logger';

// Try to load sharp; fallback gracefully if unavailable
let sharp: any = null;
try {
  sharp = require('sharp');
} catch {
  log('INFO', 'photo.sharp-not-available', { msg: 'Using basic file-based image analysis' });
}

export interface PhotoAnalysis {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
  hasAlpha: boolean;
  fileSize: number;
  format: string;
  // Content analysis
  focalRegion?: { x: number; y: number; w: number; h: number }; // 0-1 normalized
  dominantColors: string[];
  averageLuminance: number; // 0-1
  isDark: boolean;
  contrastLevel: 'low' | 'medium' | 'high';
  // Classification
  isLogo: boolean;
  isPortrait: boolean;
  hasFaces: boolean;
  faceRegions?: { x: number; y: number; w: number; h: number }[];
  // Quality
  sharpnessScore: number; // 0-100
  qualityScore: number; // 0-100
  // Recommendations
  suggestedRole: 'hero' | 'secondary' | 'thumbnail' | 'logo' | 'background';
  suggestedCrop: 'cover' | 'contain' | 'fill' | 'none';
  suggestedMask: 'rect' | 'rounded' | 'circle' | 'ellipse' | 'custom' | 'none';
  suggestedTreatment: 'natural' | 'monochrome' | 'duotone' | 'overlay-dark' | 'overlay-light' | 'blur-background';
  suggestedPlacement: 'full-bleed' | 'edge-bleed' | 'card' | 'circle' | 'polaroid' | 'overlap';
}

export interface CropRecommendation {
  x: number;
  y: number;
  w: number;
  h: number;
  focalPoint: { x: number; y: number };
  reason: string;
}

export interface PhotoPlacement {
  nodeId: string;
  rect: { x: number; y: number; w: number; h: number };
  crop: CropRecommendation;
  mask: 'rect' | 'rounded' | 'circle' | 'ellipse' | 'custom' | 'none';
  maskRadius?: number;
  treatment: 'natural' | 'monochrome' | 'duotone' | 'overlay-dark' | 'overlay-light' | 'blur-background';
  overlayColor?: string;
  overlayOpacity?: number;
  blendMode?: string;
  zIndex: number;
  caption?: string;
}

export interface BatchPhotoAnalysis {
  photos: PhotoAnalysis[];
  heroCandidate: PhotoAnalysis | null;
  secondaryCandidates: PhotoAnalysis[];
  logoCandidates: PhotoAnalysis[];
  backgroundCandidates: PhotoAnalysis[];
  layoutStrategy: 'single-hero' | 'hero-supporting' | 'grid' | 'masonry' | 'overlap' | 'story-flow';
  totalPhotos: number;
}

async function analyzeWithSharp(imagePath: string): Promise<{
  width: number;
  height: number;
  channels: number;
  format: string;
  hasAlpha: boolean;
  dominantColors: string[];
  averageLuminance: number;
  sharpnessScore: number;
}> {
  try {
    if (sharp) {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const stats = await image.stats();
      
      // Get dominant colors using resize to small size
      const smallBuffer = await image.resize(50, 50).raw().toBuffer();
      const colors = extractDominantColors(smallBuffer, metadata.channels || 3);
      
      // Calculate luminance
      const luminance = calculateLuminance(stats);
      
      // Estimate sharpness using Laplacian variance approximation
      const sharpness = await estimateSharpness(imagePath);
      
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        channels: metadata.channels || 3,
        format: metadata.format || 'unknown',
        hasAlpha: (metadata.channels || 3) === 4,
        dominantColors: colors,
        averageLuminance: luminance,
        sharpnessScore: sharpness,
      };
    }
    
    // Fallback: basic file stats + sensible defaults
    const fileStat = await stat(imagePath);
    const ext = extname(imagePath).toLowerCase();
    const formatMap: Record<string, string> = {
      '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.gif': 'gif',
      '.webp': 'webp', '.bmp': 'bmp', '.tiff': 'tiff', '.tif': 'tiff',
    };
    return {
      width: 1920,
      height: 1080,
      channels: 3,
      format: formatMap[ext] || 'unknown',
      hasAlpha: ext === '.png' || ext === '.webp',
      dominantColors: ['#CCCCCC', '#999999'],
      averageLuminance: 0.5,
      sharpnessScore: 0.5,
    };
  } catch (error) {
    log('ERROR', 'photo.sharp-analysis-failed', { path: imagePath, error: String(error) });
    throw error;
  }
}

function extractDominantColors(buffer: Buffer, channels: number): string[] {
  const colorCounts = new Map<string, number>();
  const step = channels;
  
  for (let i = 0; i < buffer.length; i += step) {
    const r = buffer[i];
    const g = buffer[i + 1];
    const b = buffer[i + 2];
    // Quantize to reduce color count
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;
    const key = `${qr.toString(16).padStart(2, '0')}${qg.toString(16).padStart(2, '0')}${qb.toString(16).padStart(2, '0')}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
  }
  
  return Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex]) => `#${hex.toUpperCase()}`);
}

function calculateLuminance(stats: any): number {
  if (!stats.channels || stats.channels.length < 3) return 0.5;
  const [r, g, b] = stats.channels.slice(0, 3).map(c => c.mean / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function estimateSharpness(imagePath: string): Promise<number> {
  if (!sharp) return 0.5;
  try {
    // Use a simple gradient-based sharpness estimation
    const image = sharp(imagePath).greyscale().raw();
    const { data, info } = await image.toBuffer({ resolveWithObject: true });
    let sum = 0;
    let count = 0;
    const width = info.width;
    const height = info.height;
    
    // Sample every 4th pixel for performance
    for (let y = 1; y < height - 1; y += 4) {
      for (let x = 1; x < width - 1; x += 4) {
        const idx = y * width + x;
        const center = data[idx];
        const dx = data[idx + 1] - data[idx - 1];
        const dy = data[idx + width] - data[idx - width];
        sum += Math.sqrt(dx * dx + dy * dy);
        count++;
      }
    }
    return Math.min(100, (sum / count) * 2); // Normalize to 0-100
  } catch {
    return 50; // Default
  }
}

async function detectFaces(imagePath: string): Promise<{ x: number; y: number; w: number; h: number }[]> {
  // Placeholder - in production integrate with face-api.js or similar
  // For now, use simple center-weighted assumption for portraits
  return [];
}

function classifyPhotoType(analysis: {
  width: number;
  height: number;
  aspectRatio: number;
  dominantColors: string[];
  hasAlpha: boolean;
  hasFaces: boolean;
}): { isLogo: boolean; isPortrait: boolean } {
  const { aspectRatio, hasAlpha, hasFaces, dominantColors } = analysis;
  
  // Logo detection: has alpha, simple colors, often square-ish
  const isLogo = hasAlpha && dominantColors.length <= 4 && aspectRatio > 0.5 && aspectRatio < 2;
  
  // Portrait detection: faces present, or tall aspect ratio with skin-tone colors
  const skinTones = dominantColors.filter(c => isSkinTone(c));
  const isPortrait = hasFaces || (aspectRatio < 0.9 && skinTones.length > 0);
  
  return { isLogo, isPortrait };
}

function isSkinTone(hex: string): boolean {
  // Simple skin tone detection
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r > 60 && r < 255 && g > 40 && g < 200 && b > 20 && b < 180 && r > g && r > b;
}

function recommendRole(analysis: PhotoAnalysis, batch: PhotoAnalysis[], index: number): PhotoAnalysis['suggestedRole'] {
  const { isLogo, isPortrait, qualityScore, width, height, aspectRatio } = analysis;
  
  if (isLogo) return 'logo';
  if (qualityScore < 40) return 'thumbnail';
  if (index === 0 && qualityScore > 70 && (aspectRatio > 1.2 || aspectRatio < 0.8)) return 'hero';
  if (isPortrait && qualityScore > 60) return 'secondary';
  if (aspectRatio > 1.5 && width > 2000) return 'background';
  return 'secondary';
}

function recommendCrop(role: PhotoAnalysis['suggestedRole'], aspectRatio: number): PhotoAnalysis['suggestedCrop'] {
  switch (role) {
    case 'hero': return aspectRatio > 1 ? 'cover' : 'cover';
    case 'background': return 'cover';
    case 'logo': return 'contain';
    case 'thumbnail': return 'cover';
    default: return 'cover';
  }
}

function recommendMask(role: PhotoAnalysis['suggestedRole'], isPortrait: boolean, designFamily: string): PhotoAnalysis['suggestedMask'] {
  if (designFamily === 'editorial-minimal') {
    if (role === 'hero') return 'none';
    if (role === 'secondary') return 'rounded';
    return 'rounded';
  }
  if (designFamily === 'bold-graphic') {
    if (role === 'hero') return 'rect';
    if (isPortrait) return 'circle';
    return 'rect';
  }
  if (designFamily === 'photo-story') {
    if (role === 'hero') return 'none';
    if (isPortrait) return 'circle';
    return 'rounded';
  }
  return 'rounded';
}

function recommendTreatment(analysis: PhotoAnalysis, palette?: { accent: string }): PhotoAnalysis['suggestedTreatment'] {
  if (analysis.isLogo) return 'natural';
  if (analysis.isDark && analysis.contrastLevel === 'low') return 'overlay-light';
  if (!analysis.isDark && analysis.contrastLevel === 'low') return 'overlay-dark';
  if (analysis.dominantColors.length <= 2) return 'monochrome';
  if (palette && analysis.averageLuminance > 0.6) return 'overlay-dark';
  return 'natural';
}

function recommendPlacement(role: PhotoAnalysis['suggestedRole'], count: number, designFamily: string): PhotoAnalysis['suggestedPlacement'] {
  if (designFamily === 'photo-story' && role === 'hero') return 'full-bleed';
  if (designFamily === 'editorial-minimal' && role === 'hero') return 'edge-bleed';
  if (designFamily === 'bold-graphic' && role === 'hero') return 'overlap';
  if (role === 'logo') return 'card';
  if (count <= 1) return 'full-bleed';
  if (count <= 3) return 'card';
  return 'circle';
}

export async function analyzePhoto(imagePath: string, designFamily: string = 'editorial-minimal', palette?: { accent: string }): Promise<PhotoAnalysis> {
  log('INFO', 'photo.analyze.start', { path: imagePath });
  
  const sharpData = await analyzeWithSharp(imagePath);
  const faces = await detectFaces(imagePath);
  const { isLogo, isPortrait } = classifyPhotoType({ ...sharpData, hasFaces: faces.length > 0 });
  
  const analysis: PhotoAnalysis = {
    width: sharpData.width,
    height: sharpData.height,
    aspectRatio: sharpData.width / sharpData.height,
    orientation: sharpData.width > sharpData.height ? 'landscape' : sharpData.width < sharpData.height ? 'portrait' : 'square',
    hasAlpha: sharpData.hasAlpha,
    fileSize: 0, // TODO: get from fs.stat
    format: sharpData.format,
    dominantColors: sharpData.dominantColors,
    averageLuminance: sharpData.averageLuminance,
    isDark: sharpData.averageLuminance < 0.4,
    contrastLevel: sharpData.averageLuminance < 0.3 ? 'high' : sharpData.averageLuminance > 0.7 ? 'low' : 'medium',
    isLogo,
    isPortrait,
    hasFaces: faces.length > 0,
    faceRegions: faces,
    sharpnessScore: sharpData.sharpnessScore,
    qualityScore: calculateQualityScore(sharpData, faces.length > 0),
    suggestedRole: 'secondary', // Will be set after batch analysis
    suggestedCrop: 'cover',
    suggestedMask: 'rounded',
    suggestedTreatment: 'natural',
    suggestedPlacement: 'card',
  };
  
  // Set recommendations that don't depend on batch
  analysis.suggestedCrop = recommendCrop('secondary', analysis.aspectRatio);
  analysis.suggestedMask = recommendMask('secondary', analysis.isPortrait, designFamily);
  analysis.suggestedTreatment = recommendTreatment(analysis, palette);
  analysis.suggestedPlacement = recommendPlacement('secondary', 1, designFamily);
  
  log('INFO', 'photo.analyze.complete', { path: imagePath, role: analysis.suggestedRole, quality: analysis.qualityScore });
  return analysis;
}

function calculateQualityScore(sharpData: { sharpnessScore: number; width: number; height: number; averageLuminance: number }, hasFaces: boolean): number {
  let score = 50;
  score += Math.min(30, sharpData.sharpnessScore * 0.3);
  score += Math.min(20, (sharpData.width * sharpData.height) / 1000000 * 10); // Megapixels bonus
  if (hasFaces) score += 10;
  if (sharpData.averageLuminance > 0.2 && sharpData.averageLuminance < 0.8) score += 10;
  return Math.min(100, Math.round(score));
}

export async function analyzePhotoBatch(imagePaths: string[], designFamily: string = 'editorial-minimal', palette?: { accent: string }): Promise<BatchPhotoAnalysis> {
  const analyses = await Promise.all(imagePaths.map(p => analyzePhoto(p, designFamily, palette)));
  
  // Sort by quality and role suitability
  analyses.sort((a, b) => b.qualityScore - a.qualityScore);
  
  // Assign roles based on sorted order and characteristics
  let heroAssigned = false;
  for (let i = 0; i < analyses.length; i++) {
    const role = recommendRole(analyses[i], analyses, i);
    analyses[i].suggestedRole = role;
    analyses[i].suggestedCrop = recommendCrop(role, analyses[i].aspectRatio);
    analyses[i].suggestedMask = recommendMask(role, analyses[i].isPortrait, designFamily);
    analyses[i].suggestedTreatment = recommendTreatment(analyses[i], palette);
    analyses[i].suggestedPlacement = recommendPlacement(role, analyses.length, designFamily);
    
    if (role === 'hero') heroAssigned = true;
  }
  
  // Ensure at least one hero if we have good photos
  if (!heroAssigned && analyses.length > 0 && analyses[0].qualityScore > 50) {
    analyses[0].suggestedRole = 'hero';
    analyses[0].suggestedCrop = recommendCrop('hero', analyses[0].aspectRatio);
    analyses[0].suggestedMask = recommendMask('hero', analyses[0].isPortrait, designFamily);
    analyses[0].suggestedPlacement = recommendPlacement('hero', analyses.length, designFamily);
  }
  
  const heroCandidate = analyses.find(a => a.suggestedRole === 'hero') || null;
  const secondaryCandidates = analyses.filter(a => a.suggestedRole === 'secondary');
  const logoCandidates = analyses.filter(a => a.suggestedRole === 'logo');
  const backgroundCandidates = analyses.filter(a => a.suggestedRole === 'background');
  
  // Determine layout strategy
  let layoutStrategy: BatchPhotoAnalysis['layoutStrategy'] = 'grid';
  const heroCount = analyses.filter(a => a.suggestedRole === 'hero').length;
  const secondaryCount = secondaryCandidates.length;
  
  if (analyses.length === 1) layoutStrategy = 'single-hero';
  else if (heroCount >= 1 && secondaryCount > 0) layoutStrategy = 'hero-supporting';
  else if (designFamily === 'photo-story' && heroCount >= 1) layoutStrategy = 'story-flow';
  else if (designFamily === 'bold-graphic' && secondaryCount >= 2) layoutStrategy = 'overlap';
  else if (analyses.length >= 6) layoutStrategy = 'masonry';
  else layoutStrategy = 'grid';
  
  return {
    photos: analyses,
    heroCandidate,
    secondaryCandidates,
    logoCandidates,
    backgroundCandidates,
    layoutStrategy,
    totalPhotos: analyses.length,
  };
}

export function generatePhotoPlacements(
  batch: BatchPhotoAnalysis,
  canvasSize: { width: number; height: number },
  designFamily: string,
  seed: number
): PhotoPlacement[] {
  const placements: PhotoPlacement[] = [];
  const { width, height } = canvasSize;
  const safeMargin = Math.min(width, height) * 0.05;
  const contentWidth = width - safeMargin * 2;
  const contentHeight = height - safeMargin * 2;
  
  let zIndex = 10;
  
  switch (batch.layoutStrategy) {
    case 'single-hero': {
      const hero = batch.heroCandidate!;
      const aspect = hero.aspectRatio;
      let w, h, x, y;
      
      if (designFamily === 'photo-story') {
        // Full bleed
        w = width;
        h = width / aspect;
        if (h < height) { h = height; w = height * aspect; }
        x = (width - w) / 2;
        y = (height - h) / 2;
      } else if (designFamily === 'editorial-minimal') {
        // Edge bleed - extend to one edge
        const bleedEdge = seed % 4; // 0=top, 1=right, 2=bottom, 3=left
        if (bleedEdge === 0) { // top
          w = contentWidth;
          h = w / aspect;
          x = safeMargin;
          y = safeMargin;
        } else if (bleedEdge === 1) { // right
          h = contentHeight * 0.7;
          w = h * aspect;
          x = width - safeMargin - w;
          y = safeMargin + (contentHeight - h) / 2;
        } else if (bleedEdge === 2) { // bottom
          w = contentWidth;
          h = w / aspect;
          x = safeMargin;
          y = height - safeMargin - h;
        } else { // left
          h = contentHeight * 0.7;
          w = h * aspect;
          x = safeMargin;
          y = safeMargin + (contentHeight - h) / 2;
        }
      } else { // bold-graphic
        // Large centered with crop
        w = contentWidth * 0.85;
        h = w / aspect;
        x = safeMargin + (contentWidth - w) / 2;
        y = safeMargin + contentHeight * 0.1;
      }
      
      placements.push(createPlacement(hero, { x, y, w, h }, zIndex++));
      break;
    }
    
    case 'hero-supporting': {
      const hero = batch.heroCandidate!;
      const secondary = batch.secondaryCandidates;
      
      // Hero placement
      const heroRect = calculateHeroRect(hero, canvasSize, designFamily, seed);
      placements.push(createPlacement(hero, heroRect, zIndex++));
      
      // Secondary photos in grid/cards below or beside hero
      const secondaryRects = calculateSecondaryRects(secondary, heroRect, canvasSize, designFamily);
      for (const rect of secondaryRects) {
        placements.push(createPlacement(secondary.shift()!, rect, zIndex++));
      }
      break;
    }
    
    case 'grid':
    case 'masonry': {
      const allPhotos = [...batch.photos].filter(p => p.suggestedRole !== 'logo' && p.suggestedRole !== 'background');
      const cols = batch.layoutStrategy === 'masonry' ? (allPhotos.length > 8 ? 4 : 3) : Math.ceil(Math.sqrt(allPhotos.length));
      const gap = Math.min(width, height) * 0.02;
      const colWidth = (contentWidth - (cols - 1) * gap) / cols;
      
      let row = 0;
      let col = 0;
      let rowHeights: number[] = [];
      
      for (const photo of allPhotos) {
        const aspect = photo.aspectRatio;
        const w = colWidth;
        const h = w / aspect;
        
        const x = safeMargin + col * (colWidth + gap);
        const y = safeMargin + (rowHeights.slice(0, row).reduce((a, b) => a + b, 0)) + row * gap;
        
        placements.push(createPlacement(photo, { x, y, w, h }, zIndex++));
        
        // Track row height for masonry
        if (batch.layoutStrategy === 'masonry') {
          while (rowHeights.length <= row) rowHeights.push(0);
          rowHeights[row] = Math.max(rowHeights[row], h);
        }
        
        col++;
        if (col >= cols) { col = 0; row++; }
      }
      break;
    }
    
    case 'overlap': {
      // Bold graphic style - overlapping photos with rotation
      const photos = [...batch.photos].filter(p => p.suggestedRole !== 'logo').slice(0, 5);
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) * 0.35;
      
      photos.forEach((photo, i) => {
        const angle = (i / photos.length) * Math.PI * 2 + (seed * 0.3);
        const radius = maxRadius * (0.3 + 0.7 * (i / Math.max(1, photos.length - 1)));
        const w = contentWidth * 0.28;
        const h = w / photo.aspectRatio;
        const x = centerX + Math.cos(angle) * radius - w / 2;
        const y = centerY + Math.sin(angle) * radius - h / 2;
        const rotation = (seed + i * 15) % 30 - 15; // -15 to 15 degrees
        
        placements.push(createPlacement(photo, { x, y, w, h }, zIndex++, rotation));
      });
      break;
    }
    
    case 'story-flow': {
      // Photo story - sequential narrative layout
      const photos = [...batch.photos].filter(p => p.suggestedRole !== 'logo').slice(0, 8);
      const hero = batch.heroCandidate;
      
      if (hero) {
        const heroRect = calculateHeroRect(hero, canvasSize, 'photo-story', seed);
        placements.push(createPlacement(hero, heroRect, zIndex++));
      }
      
      // Remaining photos in a flowing column or row
      const remaining = photos.filter(p => p !== hero);
      const flowDirection = seed % 2 === 0 ? 'vertical' : 'horizontal';
      const gap = Math.min(width, height) * 0.025;
      
      if (flowDirection === 'vertical') {
        let currentY = safeMargin + (hero ? placements[0].rect.h + gap : 0);
        for (const photo of remaining) {
          const w = contentWidth * 0.6;
          const h = w / photo.aspectRatio;
          const x = width / 2 - w / 2;
          placements.push(createPlacement(photo, { x, y: currentY, w, h }, zIndex++));
          currentY += h + gap;
        }
      } else {
        let currentX = safeMargin;
        for (const photo of remaining) {
          const h = contentHeight * 0.3;
          const w = h * photo.aspectRatio;
          const y = height / 2 - h / 2;
          placements.push(createPlacement(photo, { x: currentX, y, w, h }, zIndex++));
          currentX += w + gap;
        }
      }
      break;
    }
  }
  
  // Add logos at the end (lower z-index)
  for (const logo of batch.logoCandidates) {
    const w = width * 0.08;
    const h = w / logo.aspectRatio;
    placements.push(createPlacement(logo, { x: safeMargin, y: safeMargin, w, h }, 5));
  }
  
  return placements;
}

function createPlacement(photo: PhotoAnalysis, rect: { x: number; y: number; w: number; h: number }, zIndex: number, rotation = 0): PhotoPlacement {
  // Calculate crop to fill the rect
  const targetAspect = rect.w / rect.h;
  const sourceAspect = photo.aspectRatio;
  
  let cropX = 0, cropY = 0, cropW = 1, cropH = 1;
  
  if (photo.suggestedCrop === 'cover') {
    if (sourceAspect > targetAspect) {
      // Source wider - crop sides
      cropW = targetAspect / sourceAspect;
      cropX = (1 - cropW) / 2;
    } else {
      // Source taller - crop top/bottom
      cropH = sourceAspect / targetAspect;
      cropY = photo.focalRegion ? photo.focalRegion.y : (1 - cropH) * 0.3; // Bias toward top for faces
    }
  }
  
  return {
    nodeId: `photo-${photo.path.split(/[\\/]/).pop()}`,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) },
    crop: {
      x: cropX, y: cropY, w: cropW, h: cropH,
      focalPoint: { x: photo.focalRegion?.x || 0.5, y: photo.focalRegion?.y || 0.38 },
      reason: `Cover crop for ${rect.w}x${rect.h} frame`
    },
    mask: photo.suggestedMask,
    maskRadius: photo.suggestedMask === 'rounded' ? Math.min(rect.w, rect.h) * 0.06 : undefined,
    treatment: photo.suggestedTreatment,
    overlayColor: photo.suggestedTreatment.includes('overlay') ? (photo.isDark ? '#FFFFFF' : '#000000') : undefined,
    overlayOpacity: photo.suggestedTreatment.includes('overlay') ? 0.4 : undefined,
    blendMode: photo.suggestedTreatment === 'overlay-dark' ? 'multiply' : photo.suggestedTreatment === 'overlay-light' ? 'screen' : 'normal',
    zIndex,
    caption: photo.name,
  };
}

function calculateHeroRect(photo: PhotoAnalysis, canvas: { width: number; height: number }, family: string, seed: number): { x: number; y: number; w: number; h: number } {
  const { width, height } = canvas;
  const safeMargin = Math.min(width, height) * 0.05;
  const contentWidth = width - safeMargin * 2;
  const contentHeight = height - safeMargin * 2;
  const aspect = photo.aspectRatio;
  
  if (family === 'photo-story') {
    // Full bleed
    let w = width;
    let h = width / aspect;
    if (h < height) { h = height; w = height * aspect; }
    return { x: (width - w) / 2, y: (height - h) / 2, w, h };
  }
  
  if (family === 'editorial-minimal') {
    // Large but not full bleed, aligned to grid
    const w = contentWidth * 0.9;
    const h = w / aspect;
    return { x: safeMargin + contentWidth * 0.05, y: safeMargin + contentHeight * 0.08, w, h };
  }
  
  // bold-graphic
  const w = contentWidth * 0.75;
  const h = w / aspect;
  return { x: safeMargin + contentWidth * 0.15, y: safeMargin + contentHeight * 0.12, w, h };
}

function calculateSecondaryRects(
  photos: PhotoAnalysis[],
  heroRect: { x: number; y: number; w: number; h: number },
  canvas: { width: number; height: number },
  family: string
): { x: number; y: number; w: number; h: number }[] {
  const { width, height } = canvas;
  const safeMargin = Math.min(width, height) * 0.05;
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  
  const startY = heroRect.y + heroRect.h + safeMargin * 0.5;
  const availableHeight = height - safeMargin - startY;
  const cols = Math.min(photos.length, family === 'bold-graphic' ? 2 : 3);
  const gap = Math.min(width, height) * 0.015;
  const colWidth = (width - safeMargin * 2 - (cols - 1) * gap) / cols;
  
  photos.forEach((photo, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const w = colWidth;
    const h = w / photo.aspectRatio;
    const x = safeMargin + col * (colWidth + gap);
    const y = startY + row * (availableHeight / Math.ceil(photos.length / cols));
    rects.push({ x, y, w: Math.min(w, h * 1.5), h: Math.min(h, w * 1.5) });
  });
  
  return rects;
}

export function createPhotoNodeFromPlacement(placement: PhotoPlacement, palette: any): any {
  // Convert to scene graph image node
  return {
    id: placement.nodeId,
    kind: 'image',
    semanticRole: placement.caption ? 'studentPhoto' : 'background',
    name: placement.nodeId,
    parentId: undefined,
    zIndex: placement.zIndex,
    visible: true,
    opacity: 100,
    rotation: 0,
    transformOrigin: { x: 0.5, y: 0.5 },
    rect: placement.rect,
    style: {
      assetPath: placement.nodeId, // Will be resolved
      aspectRatio: placement.rect.w / placement.rect.h,
      focalPoint: placement.crop.focalPoint,
      cropMode: 'cover',
      maskShape: placement.mask,
      maskRadius: placement.maskRadius,
      border: undefined,
      shadow: { color: '#000000', opacity: 30, distance: 8, blur: 16, angle: 120 },
      blendMode: placement.blendMode as any,
      opacity: 100,
      overlay: placement.overlayColor ? { color: placement.overlayColor, opacity: placement.overlayOpacity || 0.4, blendMode: placement.blendMode as any } : undefined,
    },
    metadata: { caption: placement.caption },
  };
}