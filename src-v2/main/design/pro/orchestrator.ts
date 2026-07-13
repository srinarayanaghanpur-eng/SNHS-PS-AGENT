// Pro Design Engine Orchestrator
// Main entry point for the professional adaptive design engine.
// Coordinates: content analysis → variant generation → layout solving →
// typography/colour/photo engines → criticism → refinement → final plan.

import { log } from '../../logger';
import type { SceneGraph, VariantCandidate, ColorDirection, QualityScore, RefinementStep, GenerationResult, DesignFamily } from './sceneGraph';
import type { DerivedPalette } from './colour';
import type { FontDetectionResult } from './typography';
import type { BatchPhotoAnalysis } from './photo';
import type { ContentInput } from './nodeFactory';
import { resetNodeIdCounter } from './nodeFactory';
import { detectInstalledFonts, getBestPairingForFamily, validateFontAvailability } from './typography';
import { derivePaletteFromPrimary } from './colour';
import { analyzePhotoBatch } from './photo';
import { createLayoutContext, buildConstraintsForFamily, solveLayout, applySolvedLayout } from './layoutSolver';
import { generateVariants, selectBestVariant, getVariantSummary } from './variantGenerator';
import { refineCandidate } from './refinementLoop';
import { critiqueDesign } from './critic';

export interface ProDesignInput {
  width: number;
  height: number;
  content: ContentInput;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  photoPaths: string[];
  outputDir: string;
  preferredFontPairing?: string;
  familyPreference?: DesignFamily;
  colorDirectionPreference?: ColorDirection;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

export interface ProDesignOutput {
  candidates: VariantCandidate[];
  selectedCandidate: VariantCandidate;
  finalSceneGraph: SceneGraph;
  fontReport: string;
  summary: string;
  refinementReport: string;
}

export async function runProDesignPipeline(input: ProDesignInput): Promise<ProDesignOutput> {
  log('INFO', 'pro-design.pipeline.start', { input });

  // Step 1: Detect fonts
  log('INFO', 'pro-design.font-detection');
  const fontResult = await detectInstalledFonts();

  if (fontResult.missing.length > 0) {
    log('WARN', 'pro-design.fonts-missing', { missing: fontResult.missing });
  }

  const fontReport = buildFontReport(fontResult);

  // Step 2: Analyze photos
  log('INFO', 'pro-design.photo-analysis', { count: input.photoPaths.length });
  const photoAnalysis = await analyzePhotoBatch(input.photoPaths, 'editorial-minimal');

  // Step 3: Generate 6 variant candidates
  log('INFO', 'pro-design.generating-variants');
  resetNodeIdCounter();

  const candidates = await generateVariants({
    width: input.width,
    height: input.height,
    content: input.content,
    primaryColor: input.primaryColor,
    fontDetection: fontResult,
    photoPaths: input.photoPaths,
    outputDir: input.outputDir,
  });

  // Step 4: Select best variant
  log('INFO', 'pro-design.selecting-variant');
  const selected = selectBestVariant(candidates);

  // Step 5: Refine the selected variant
  log('INFO', 'pro-design.refining');
  const refinedCandidate = await refineCandidate(selected, {
    minScore: 65,
    maxRounds: 3,
    applyCorrections: true,
  });

  const summary = getVariantSummary(candidates);
  const refinementReport = `<refinement details>`;

  log('INFO', 'pro-design.pipeline.complete', {
    candidates: candidates.length,
    selectedId: selected.id,
    finalScore: refinedCandidate.qualityScore.overall,
  });

  return {
    candidates,
    selectedCandidate: refinedCandidate,
    finalSceneGraph: refinedCandidate.sceneGraph,
    fontReport,
    summary,
    refinementReport,
  };
}

function buildFontReport(fontResult: FontDetectionResult): string {
  const lines: string[] = [
    `Font Detection Report`,
    `=====================`,
    `Fonts found: ${fontResult.fonts.length}`,
    `Pairings generated: ${fontResult.pairings.length}`,
    ``,
    `Missing fonts: ${fontResult.missing.length > 0 ? fontResult.missing.join(', ') : 'None'}`,
  ];
  if (fontResult.warnings.length) {
    lines.push(`Warnings:`);
    fontResult.warnings.forEach(w => lines.push(`  - ${w}`));
  }
  lines.push(``, `Available pairings:`);
  fontResult.pairings.forEach(p => lines.push(`  - ${p.name} (display: ${p.display.family}, body: ${p.body.family})`));

  return lines.join('\n');
}

// Legacy compatibility: convert old ComposeInput to new ContentInput
import type { ComposeInput } from '../types';

export function legacyToContentInput(legacy: ComposeInput): ContentInput {
  return {
    school: {
      name: legacy.school.name,
      address: legacy.school.address,
      phone: legacy.school.phone,
      academicYear: legacy.school.academicYear,
      logoPath: legacy.assets?.mainLogo?.path || legacy.school.logoPath,
      leadLogoPath: legacy.assets?.leadLogo?.path,
    },
    headline: legacy.headline,
    subheadline: legacy.subheadline,
    message: legacy.message,
    details: legacy.details,
    venue: legacy.venue,
    programme: legacy.prayer?.programme,
    management: legacy.management ? {
      chairman: legacy.management.chairman?.show ? {
        show: true,
        asset: legacy.management.chairman.asset,
        name: legacy.management.chairman.name,
        designation: legacy.management.chairman.designation,
      } : undefined,
      principal: legacy.management.principal?.show ? {
        show: true,
        asset: legacy.management.principal.asset,
        name: legacy.management.principal.name,
        designation: legacy.management.principal.designation,
      } : undefined,
    } : undefined,
    leadBranding: 'Powered by LEAD Curriculum',
  };
}