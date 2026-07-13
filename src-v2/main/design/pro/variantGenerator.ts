// Variant Generator
// Generates 6 distinct candidate variants from the same content input
// (2 per design family) with genuinely different compositions.

import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { log } from '../../logger';
import type { SceneGraph, VariantCandidate, QualityScore, DesignFamily, ColorDirection } from './sceneGraph';
import type { DerivedPalette } from './colour';
import type { FontPairing, FontDetectionResult } from './typography';
import type { BatchPhotoAnalysis } from './photo';
import type { ContentInput } from './nodeFactory';
import { resetNodeIdCounter } from './nodeFactory';
import { derivePaletteFromPrimary, createDirectionVariants } from './colour';
import { getBestPairingForFamily } from './typography';
import { analyzePhotoBatch } from './photo';
import { FAMILY_COMPOSERS, FAMILY_VARIANTS } from './families/index';
import { critiqueDesign } from './critic';

export interface VariantConfig {
  width: number;
  height: number;
  content: ContentInput;
  primaryColor: string;
  fontDetection: FontDetectionResult;
  photoPaths: string[];
  outputDir: string;
}

export async function generateVariants(config: VariantConfig): Promise<VariantCandidate[]> {
  const { width, height, content, primaryColor, fontDetection, photoPaths, outputDir } = config;

  log('INFO', 'variants.generating', { config });

  // 1. Analyze photos
  const photoAnalysis = await analyzePhotoBatch(photoPaths, 'editorial-minimal');

  // 2. Generate output dir
  const variantsDir = join(outputDir, 'candidates');
  await mkdir(variantsDir, { recursive: true });

  const candidates: VariantCandidate[] = [];
  const families: DesignFamily[] = ['editorial-minimal', 'bold-graphic', 'photo-story'];

  for (const family of families) {
    // Get the font pairing for this family
    const typography = getBestPairingForFamily(fontDetection.pairings, family);

    // Get the composer
    const compose = FAMILY_COMPOSERS[family];
    if (!compose) {
      log('WARN', 'variants.no-composer', { family });
      continue;
    }

    // Generate 2 variants per family
    const variantCount = FAMILY_VARIANTS[family] || 2;
    for (let v = 0; v < variantCount; v++) {
      resetNodeIdCounter();
      const variationSeed = families.indexOf(family) * 100 + v;

      // Derive color palette for this variant
      // Use different color directions per variant within each family
      const colorDirections: ColorDirection[] = ['monochromatic', 'complementary'];
      const colorDir = colorDirections[v % colorDirections.length];
      const palette = derivePaletteFromPrimary(primaryColor, colorDir);

      // Generate the scene graph
      const sceneGraph = compose(width, height, palette, typography, photoAnalysis, content, variationSeed);

      // Run the design critic
      const critique = critiqueDesign(sceneGraph);

      // Render a thumbnail placeholder path
      const thumbnailPath = join(variantsDir, `${family}-v${v + 1}.png`);

      const candidate: VariantCandidate = {
        id: `candidate-${family}-v${v + 1}-${randomUUID().slice(0, 8)}`,
        designFamily: family,
        colorDirection: colorDir,
        seed: variationSeed,
        sceneGraph,
        thumbnailPath,
        qualityScore: critique.score,
        refinementHistory: [],
        isSelected: false,
      };

      candidates.push(candidate);
      log('INFO', 'variants.generated', { family, variant: v + 1, score: critique.score.overall });
    }
  }

  // Sort by quality score (best first)
  candidates.sort((a, b) => b.qualityScore.overall - a.qualityScore.overall);

  return candidates;
}

export function selectBestVariant(candidates: VariantCandidate[]): VariantCandidate {
  // Pick the highest-scoring variant
  const best = candidates.reduce((best, curr) =>
    curr.qualityScore.overall > best.qualityScore.overall ? curr : best
  );
  best.isSelected = true;
  return best;
}

export function getVariantsByFamily(candidates: VariantCandidate[], family: DesignFamily): VariantCandidate[] {
  return candidates.filter(c => c.designFamily === family);
}

export function getVariantSummary(candidates: VariantCandidate[]): string {
  const lines: string[] = [
    `Variant Generation Summary`,
    `=========================`,
    `Total candidates: ${candidates.length}`,
    ``,
    `By family:`,
  ];

  const families = ['editorial-minimal', 'bold-graphic', 'photo-story'] as DesignFamily[];
  for (const family of families) {
    const familyCandidates = getVariantsByFamily(candidates, family);
    if (familyCandidates.length) {
      lines.push(`  ${family}:`);
      familyCandidates.forEach(c => {
        lines.push(`    score=${c.qualityScore.overall} seed=${c.seed} color=${c.colorDirection}`);
      });
    }
  }

  lines.push(``, `Best candidate: ${candidates[0]?.designFamily} (score=${candidates[0]?.qualityScore.overall})`);
  return lines.join('\n');
}