// Pipeline connecting the three intelligence layers:
//   1. VisualAssetAnalyzer → 2. DesignPlanGenerator → 3. QualityCritic

import type { ComposeInput, Plan } from '../types';
import type {
  TrainingRecord, DesignPlan, CriticReport, RejectionReason,
  QualityScores, CropAnchors,
} from './brainTypes';
import { BRAIN_VERSION } from './brainTypes';
import { analyzeAssets, type AssetAnalysis } from './visualAssetAnalyzer';
import { generateDesignPlan, designPlanToLegacyPlan } from './designPlanGenerator';
import { critiquePosterQuality, critiqueDesignPlan } from './qualityCritic';
import { retrieveSimilar, extractKeywords } from './brainRetrieval';
import { saveRecord, loadRecord } from './brainStorage';
import { randomUUID } from 'node:crypto';

export interface PipelineInput {
  composeInput: ComposeInput;
  posterWidth: number;
  posterHeight: number;
  variationSeed: number;
  compositionFamily?: string;
  existingPlanId?: string;
}

export interface PipelineOutput {
  designPlan: DesignPlan;
  legacyPlan: Plan;
  criticReport: CriticReport;
  trainingRecord: TrainingRecord | null;
  approvalState: 'pending' | 'approved' | 'auto-approved';
}

export async function runBrainPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { composeInput, posterWidth, posterHeight, variationSeed, compositionFamily } = input;

  const analysis = analyzeAssets(composeInput);

  const designPlan = await generateDesignPlan({
    input: composeInput, analysis,
    posterWidth, posterHeight, variationSeed, compositionFamily,
  });

  const dpCritic = critiqueDesignPlan(designPlan);
  if (!dpCritic.passed) {
    applyCriticFeedback(designPlan, dpCritic, analysis);
  }

  const legacyPlan = designPlanToLegacyPlan(designPlan, composeInput);

  const posterId = designPlan.planId;
  const now = new Date().toISOString();
  const existing = await loadRecord(posterId);

  const qs: QualityScores = {
    visualCritique: dpCritic.overallScore,
    qualityGate: 0,
    humanRating: existing?.qualityScores.humanRating ?? null,
    criticScores: Object.fromEntries(dpCritic.scores.map(s => [s.category, s.score])),
  };

  const record: TrainingRecord = {
    posterId,
    schoolId: composeInput.school?.name || 'unknown',
    eventCategory: composeInput.category || 'prayer',
    eventText: [composeInput.headline, composeInput.subheadline, composeInput.message].filter(Boolean).join(' '),
    inputAssetManifest: analysis.manifest,
    referencePosterPath: null,
    finalPosterPath: '',
    designPlan,
    selectedHeroPhoto: designPlan.heroPhoto.assetPath,
    supportingPhotoOrder: designPlan.supportingPhotos.map(p => p.assetPath),
    cropAnchors: buildCropMap(designPlan),
    approvalState: 'pending',
    rejectionReasons: [],
    rejectionNote: '',
    qualityScores: qs,
    humanCorrections: existing?.humanCorrections ?? null,
    modelVersion: BRAIN_VERSION,
    rendererVersion: BRAIN_VERSION,
    brainVersion: BRAIN_VERSION,
    preferencePairs: existing?.preferencePairs ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    approvedAt: existing?.approvedAt ?? null,
  };

  let approvalState: PipelineOutput['approvalState'] = 'pending';
  if (dpCritic.overallScore >= 80 && dpCritic.failures.length === 0) {
    record.approvalState = 'approved';
    record.approvedAt = now;
    approvalState = 'auto-approved';
  }

  await saveRecord(record);

  return { designPlan, legacyPlan, criticReport: dpCritic, trainingRecord: record, approvalState };
}

function applyCriticFeedback(dp: DesignPlan, critic: CriticReport, analysis: AssetAnalysis): void {
  for (const s of critic.scores) {
    if (s.score >= 60) continue;
    switch (s.category) {
      case 'hero-dominance':
        if (dp.heroPhoto.frameRect.w > 0) {
          dp.heroPhoto.frameRect = { ...dp.heroPhoto.frameRect, w: Math.round(dp.heroPhoto.frameRect.w * 1.3), h: Math.round(dp.heroPhoto.frameRect.h * 1.3) };
          dp.decisionLog.push({ category: 'critique-fix', choice: 'enlarge-hero', rationale: `Critic: weak hero dominance (${s.score}/100)`, source: 'critique' });
        }
        break;
      case 'template-repetition':
      case 'dashboard-resemblance':
        dp.supportingPhotos.forEach((sp, i) => { sp.frameShape = (i % 2 === 0) ? 'rounded' : 'circle'; });
        dp.decisionLog.push({ category: 'critique-fix', choice: 'vary-frame-shapes', rationale: `Critic: ${s.category} (${s.score}/100)`, source: 'critique' });
        break;
      case 'branding-completeness':
        if (s.score < 50) {
          dp.brandingPlacement.schoolNameRect = dp.sections.headerZone;
          dp.decisionLog.push({ category: 'critique-fix', choice: 'reinforce-branding', rationale: `Critic: branding incomplete (${s.score}/100)`, source: 'critique' });
        }
        break;
      case 'canvas-utilisation':
        if (s.score < 40) {
          const sz = dp.sections.safeArea;
          dp.decorations.push({ type: 'halo', rect: { x: sz.x + Math.round(sz.w * 0.3), y: sz.y + Math.round(sz.h * 0.15), w: Math.round(sz.w * 0.4), h: Math.round(sz.h * 0.3) }, color: dp.palette.accent, opacity: 0.15, zIndex: 1 });
          dp.decisionLog.push({ category: 'critique-fix', choice: 'add-backdrop-element', rationale: `Critic: canvas underused (${s.score}/100)`, source: 'critique' });
        }
        break;
    }
  }
}

function buildCropMap(dp: DesignPlan): Record<string, CropAnchors> {
  const m: Record<string, CropAnchors> = {};
  m[dp.heroPhoto.assetPath] = dp.heroPhoto.cropAnchors;
  for (const sp of dp.supportingPhotos) m[sp.assetPath] = sp.cropAnchors;
  return m;
}

export async function recordRenderedOutput(posterId: string, finalPath: string, planCriticScore?: number, qualityGateScore?: number): Promise<void> {
  const r = await loadRecord(posterId);
  if (!r) return;
  r.finalPosterPath = finalPath;
  if (planCriticScore !== undefined) r.qualityScores.visualCritique = planCriticScore;
  if (qualityGateScore !== undefined) r.qualityScores.qualityGate = qualityGateScore;
  r.updatedAt = new Date().toISOString();
  await saveRecord(r);
}
