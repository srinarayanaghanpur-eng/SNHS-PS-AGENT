// Automatic Refinement Loop
// Generates poster plan, critiques, applies corrections, re-renders
// until quality gate is passed or max rounds reached.

import { log } from '../../logger';
import type { SceneGraph, VariantCandidate, QualityScore, QualityDetail, Criticism, Correction, RefinementStep } from './sceneGraph';
import { critiqueDesign, type CritiqueResult } from './critic';

const MAX_REFINEMENT_ROUNDS = 3;
const QUALITY_GATE_SCORE = 65;

export interface RefinementConfig {
  minScore: number;
  maxRounds: number;
  applyCorrections: boolean;
}

const DEFAULT_CONFIG: RefinementConfig = {
  minScore: QUALITY_GATE_SCORE,
  maxRounds: MAX_REFINEMENT_ROUNDS,
  applyCorrections: true,
};

export async function refineCandidate(
  candidate: VariantCandidate,
  config: Partial<RefinementConfig> = {}
): Promise<VariantCandidate> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const history: RefinementStep[] = [];

  let currentSG = candidate.sceneGraph;
  let currentScore = candidate.qualityScore;
  let round = 0;

  log('INFO', 'refinement.start', { id: candidate.id, score: currentScore.overall });

  while (round < cfg.maxRounds) {
    const critique: CritiqueResult = critiqueDesign(currentSG);

    const beforeScore = currentScore;
    currentScore = critique.score;

    // Collect criticisms and corrections
    const criticisms = critique.criticisms.filter(c => c.severity === 'critical' || c.severity === 'major');
    const corrections = critique.corrections;

    history.push({
      round: round + 1,
      beforeScore: beforeScore.overall,
      afterScore: currentScore.overall,
      criticisms,
      correctionsApplied: corrections,
    });

    log('INFO', 'refinement.round', { round: round + 1, score: currentScore.overall, corrections: corrections.length });

    // Check if quality gate is passed
    if (currentScore.overall >= cfg.minScore) {
      log('INFO', 'refinement.passed', { round: round + 1, score: currentScore.overall });
      break;
    }

    // Check if there are no more actionable corrections
    if (corrections.length === 0) {
      log('WARN', 'refinement.no-corrections', { round, score: currentScore.overall });
      break;
    }

    // Apply corrections if configured
    if (cfg.applyCorrections) {
      currentSG = applyCorrectionsToSceneGraph(currentSG, corrections);
    }

    round++;
  }

  // Update candidate
  candidate.sceneGraph = currentSG;
  candidate.qualityScore = currentScore;
  candidate.refinementHistory = history;

  log('INFO', 'refinement.complete', { id: candidate.id, finalScore: currentScore.overall, rounds: history.length });
  return candidate;
}

function applyCorrectionsToSceneGraph(sg: SceneGraph, corrections: Correction[]): SceneGraph {
  // Deep clone the scene graph
  const updated = JSON.parse(JSON.stringify(sg)) as SceneGraph;

  for (const correction of corrections) {
    if (!correction.nodeId) continue;

    // Find the node in the scene graph
    const node = findNodeById(updated.root, correction.nodeId);
    if (!node) continue;

    switch (correction.type) {
      case 'resize':
        if (correction.property === 'rect') {
          node.rect = correction.afterValue as any;
        } else if (correction.property === 'fontSize' && node.kind === 'text') {
          node.style.fontSize = correction.afterValue as number;
        }
        break;
      case 'reposition':
        if (correction.property === 'rect' && node.rect) {
          const after = correction.afterValue as any;
          if (after.x !== undefined) node.rect.x = after.x;
          if (after.y !== undefined) node.rect.y = after.y;
        }
        break;
      case 'recolor':
        if (correction.property === 'color' && node.kind === 'text') {
          node.style.color = correction.afterValue as string;
        }
        break;
      case 'retype':
        if (correction.property === 'align' && node.kind === 'text') {
          node.style.align = correction.afterValue as 'left' | 'center' | 'right';
        }
        break;
      case 'remove':
        if (correction.property === 'visible') {
          node.visible = false;
        }
        break;
      case 'adjustTypography':
        if (correction.property === 'fontSize' && node.kind === 'text') {
          node.style.fontSize = correction.afterValue as number;
        }
        break;
      case 'adjustSpacing':
        if (node.rect) {
          const after = correction.afterValue as any;
          if (after.x !== undefined) node.rect.x = after.x;
          if (after.y !== undefined) node.rect.y = after.y;
          if (after.w !== undefined) node.rect.w = after.w;
          if (after.h !== undefined) node.rect.h = after.h;
        }
        break;
    }
  }

  return updated;
}

function findNodeById(group: { id: string; kind: string; children?: any[] }, targetId: string): any {
  if (group.id === targetId) return group;
  if (group.children) {
    for (const child of group.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

export function getRefinementReport(candidate: VariantCandidate): string {
  const lines: string[] = [
    `Refinement Report for ${candidate.id}`,
    `======================================`,
    `Final Score: ${candidate.qualityScore.overall}/100`,
    `Refinement Rounds: ${candidate.refinementHistory.length}`,
    ``,
    `Score History:`,
  ];

  for (const step of candidate.refinementHistory) {
    lines.push(`  Round ${step.round}: ${step.beforeScore} → ${step.afterScore} (${step.correctionsApplied.length} corrections)`);
    for (const crit of step.criticisms.slice(0, 3)) {
      lines.push(`    [${crit.severity}] ${crit.message}`);
    }
  }

  return lines.join('\n');
}