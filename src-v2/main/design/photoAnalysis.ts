// Photo analysis for human-like poster composition.
//
// Determines which photo should be the hero, computes orientations,
// and assigns importance scores so the collage layout can give each
// photo the right visual weight.
//
// When sharp is available, actual image dimensions are read.
// Otherwise, orientation is inferred from the photo path / name
// conventions, and hero selection falls back to position-based rules.

import { stat } from 'node:fs/promises';
import { extname } from 'node:path';

let sharp: any = null;
try {
  sharp = require('sharp');
} catch {
  // sharp is optional; fall back to heuristic analysis
}

export interface PhotoAnalysis {
  path: string;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape' | 'square';
  aspectRatio: number;
  fileSize: number;
  // Heuristic scores:
  //   heroScore  - how suitable this photo is as the dominant image (0-100)
  //                Large + portrait = high (good for hero). Small + landscape = lower.
  heroScore: number;
  // Importance rank within the batch (0 = most important)
  importanceRank: number;
}

export interface BatchAnalysis {
  photos: PhotoAnalysis[];
  heroIndex: number;    // index into photos[] for the hero
  orientations: ('portrait' | 'landscape' | 'square')[];
}

/**
 * Score a photo's hero potential based on available metadata.
 *
 * Heuristics used:
 *   - Larger photos (by file size) → more likely to be the main event image
 *   - Portrait orientation → good for hero in school posters
 *   - First-position photos in the batch → likely the assembly/hero shot
 *
 * When actual dimensions are available (via sharp), orientation and
 * resolution are also used.
 */
function computeHeroScore(
  photo: { path: string; width: number; height: number; fileSize: number },
  index: number,
  batchSize: number,
): number {
  let score = 30; // baseline

  // Position bonus: the first photo is most likely the hero
  if (index === 0) score += 25;
  else if (index === 1) score += 10;

  // File size bonus: larger files tend to be more important photos
  const mb = photo.fileSize / (1024 * 1024);
  if (mb > 3) score += 20;
  else if (mb > 1) score += 10;
  else if (mb > 0.3) score += 5;

  // Orientation bonus (when we have actual dimensions)
  if (photo.width > 0 && photo.height > 0) {
    const ratio = photo.width / photo.height;
    if (ratio < 0.9) {
      // Portrait — great for hero in portrait-oriented poster
      score += 20;
    } else if (ratio > 1.4) {
      // Wide landscape — less ideal as hero in a 4:5 poster
      score -= 5;
    } else {
      // Near square — good
      score += 10;
    }

    // Resolution bonus
    const mp = (photo.width * photo.height) / 1_000_000;
    if (mp > 8) score += 15;
    else if (mp > 4) score += 10;
    else if (mp > 2) score += 5;
  } else {
    // No dimensions — infer orientation from filename/position heuristics
    const name = photo.path.toLowerCase();
    if (name.includes('hero') || name.includes('main') || name.includes('assembly') || name.includes('stage')) {
      score += 20;
    }
    // First photo in typical school uploads is the main event photo
    if (index === 0) score += 10;
  }

  // Penalty for very small files (likely thumbnails or logos)
  if (photo.fileSize < 50_000) score -= 20;

  return Math.max(0, Math.min(100, score));
}

export async function analyzePhoto(imagePath: string, index: number, batchSize: number): Promise<PhotoAnalysis> {
  let width = 0;
  let height = 0;
  let fileSize = 0;

  try {
    const st = await stat(imagePath);
    fileSize = st.size;
  } catch {
    // file may not be accessible; use defaults
  }

  if (sharp) {
    try {
      const metadata = await sharp(imagePath).metadata();
      width = metadata.width || 0;
      height = metadata.height || 0;
    } catch {
      // sharp read failed; fall through to defaults
    }
  } else {
    // Heuristic: infer likely dimensions from filename patterns
    const name = imagePath.toLowerCase();
    if (name.includes('portrait') || name.includes('vertical')) {
      width = 1200;
      height = 1600;
    } else if (name.includes('landscape') || name.includes('horizontal') || name.includes('wide')) {
      width = 1600;
      height = 1200;
    }
  }

  let orientation: 'portrait' | 'landscape' | 'square';
  if (width > 0 && height > 0) {
    const ratio = width / height;
    orientation = ratio < 0.9 ? 'portrait' : ratio > 1.1 ? 'landscape' : 'square';
  } else {
    // Guess orientation from aspect ratio of typical phone photos
    // Most school event photos from phones are portrait (9:16)
    orientation = 'portrait';
  }

  const aspectRatio = width > 0 && height > 0 ? width / height : 0.75;
  const heroScore = computeHeroScore({ path: imagePath, width, height, fileSize }, index, batchSize);

  return {
    path: imagePath,
    width,
    height,
    orientation,
    aspectRatio,
    fileSize,
    heroScore,
    importanceRank: 0, // set by analyzeBatch
  };
}

export async function analyzeBatch(imagePaths: string[]): Promise<BatchAnalysis> {
  const analyses = await Promise.all(
    imagePaths.map((path, i) => analyzePhoto(path, i, imagePaths.length)),
  );

  // Sort by heroScore descending to assign importance ranks
  const sorted = [...analyses].sort((a, b) => b.heroScore - a.heroScore);
  const rankMap = new Map<string, number>();
  sorted.forEach((a, i) => rankMap.set(a.path, i));

  for (const a of analyses) {
    a.importanceRank = rankMap.get(a.path) ?? 99;
  }

  // Hero = highest-scoring photo that isn't tiny
  let heroIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < analyses.length; i++) {
    if (analyses[i].heroScore > bestScore && analyses[i].fileSize > 20000) {
      bestScore = analyses[i].heroScore;
      heroIndex = i;
    }
  }

  return {
    photos: analyses,
    heroIndex,
    orientations: analyses.map(a => a.orientation),
  };
}
