import type {
  ReferenceAnalysis, ReferenceSceneGraph, AccuracyReport, RegionAccuracyScore,
  NormalizedRect, DetectedRegion,
} from './referenceTypes';

function rectCenter(r: NormalizedRect): { cx: number; cy: number } {
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
}

function rectDistance(a: NormalizedRect, b: NormalizedRect): number {
  const ac = rectCenter(a);
  const bc = rectCenter(b);
  return Math.sqrt((ac.cx - bc.cx) ** 2 + (ac.cy - bc.cy) ** 2);
}

function intersectionOverUnion(a: NormalizedRect, b: NormalizedRect): number {
  const xLeft = Math.max(a.x, b.x);
  const yTop = Math.max(a.y, b.y);
  const xRight = Math.min(a.x + a.width, b.x + b.width);
  const yBottom = Math.min(a.y + a.height, b.y + b.height);

  if (xRight <= xLeft || yBottom <= yTop) return 0;

  const intersection = (xRight - xLeft) * (yBottom - yTop);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

function geometrySimilarity(a: NormalizedRect, b: NormalizedRect): number {
  const iou = intersectionOverUnion(a, b);
  const posDist = rectDistance(a, b);
  const maxDist = Math.sqrt(2);
  const posSim = 1 - Math.min(posDist / maxDist, 1);
  const sizeSimA = Math.min(a.width / b.width, b.width / a.width);
  const sizeSimB = Math.min(a.height / b.height, b.height / a.height);
  const sizeSim = Math.min(sizeSimA, sizeSimB);

  return iou * 0.5 + posSim * 0.3 + sizeSim * 0.2;
}

function findMatchingRegion(
  referenceRegion: DetectedRegion,
  generatedRegions: DetectedRegion[],
): DetectedRegion | undefined {
  let best: DetectedRegion | undefined;
  let bestScore = 0;

  for (const gen of generatedRegions) {
    if (gen.role !== referenceRegion.role) continue;
    const score = intersectionOverUnion(referenceRegion.bounds, gen.bounds);
    if (score > bestScore) {
      bestScore = score;
      best = gen;
    }
  }

  return best;
}

function scoreRegion(
  reference: DetectedRegion,
  generated: DetectedRegion | undefined,
): RegionAccuracyScore {
  if (!generated) {
    return {
      regionId: reference.id,
      regionRole: reference.role,
      geometryAccuracy: 0,
      sizeAccuracy: 0,
      positionAccuracy: 0,
      overall: 0,
    };
  }

  const ref = reference.bounds;
  const gen = generated.bounds;

  const sizeWSim = Math.min(ref.width / gen.width, gen.width / ref.width);
  const sizeHSim = Math.min(ref.height / gen.height, gen.height / ref.height);
  const sizeAccuracy = (sizeWSim + sizeHSim) / 2 * 100;

  const refCenter = rectCenter(ref);
  const genCenter = rectCenter(gen);
  const posDiff = Math.sqrt((refCenter.cx - genCenter.cx) ** 2 + (refCenter.cy - genCenter.cy) ** 2);
  const maxPosDiff = Math.sqrt(2);
  const positionAccuracy = (1 - Math.min(posDiff / maxPosDiff, 1)) * 100;

  const geoSim = geometrySimilarity(ref, gen) * 100;

  return {
    regionId: reference.id,
    regionRole: reference.role,
    geometryAccuracy: Math.round(geoSim * 100) / 100,
    sizeAccuracy: Math.round(sizeAccuracy * 100) / 100,
    positionAccuracy: Math.round(positionAccuracy * 100) / 100,
    overall: Math.round((geoSim * 0.4 + sizeAccuracy * 0.3 + positionAccuracy * 0.3) * 100) / 100,
  };
}

export interface MetricInput {
  analysis: ReferenceAnalysis;
  generatedRegions: DetectedRegion[];
  strength: 'exact' | 'adaptive';
}

export function computeAccuracyReport(input: MetricInput): AccuracyReport {
  const { analysis, generatedRegions, strength } = input;
  const regionScores: RegionAccuracyScore[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];

  const majorRegions = analysis.allRegions.filter((r) =>
    r.role !== 'unknown' && r.role !== 'decorativeShape' && r.role !== 'divider' && r.role !== 'border'
  );

  for (const refRegion of majorRegions) {
    const genRegion = findMatchingRegion(refRegion, generatedRegions);
    const score = scoreRegion(refRegion, genRegion);
    regionScores.push(score);
  }

  const headerRegions = regionScores.filter((s) =>
    s.regionRole === 'schoolName' || s.regionRole === 'schoolLogo' || s.regionRole === 'schoolAddress'
  );
  const footerRegions = regionScores.filter((s) =>
    s.regionRole === 'contactInfoRegion' || s.regionRole === 'footerPhone' ||
    s.regionRole === 'footerAddress' || s.regionRole === 'footerYear'
  );
  const photoRegions = regionScores.filter((s) =>
    s.regionRole === 'heroPhoto' || s.regionRole === 'supportingPhoto' || s.regionRole === 'programmePhoto'
  );
  const textRegions = regionScores.filter((s) =>
    s.regionRole === 'eventTitle' || s.regionRole === 'posterDate' || s.regionRole === 'quote'
  );
  const decorRegions = regionScores.filter((s) =>
    s.regionRole === 'decorativeShape' || s.regionRole === 'divider' || s.regionRole === 'border' || s.regionRole === 'topAccentEdge'
  );

  const avg = (scores: RegionAccuracyScore[], key: keyof RegionAccuracyScore): number => {
    if (scores.length === 0) return 100;
    const vals = scores.map((s) => s[key] as number).filter((v) => Number.isFinite(v));
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 100;
  };

  const geometryAccuracy = Math.round(avg(regionScores, 'geometryAccuracy') * 100) / 100;
  const headerAccuracy = Math.round(avg(headerRegions, 'overall') * 100) / 100;
  const footerAccuracy = Math.round(avg(footerRegions, 'overall') * 100) / 100;
  const photoSlotAccuracy = Math.round(avg(photoRegions, 'overall') * 100) / 100;
  const typographyAccuracy = Math.round(avg(textRegions, 'overall') * 100) / 100;
  const decorativeShapeAccuracy = Math.round(avg(decorRegions, 'overall') * 100) / 100;

  const allScores = [
    geometryAccuracy, headerAccuracy, footerAccuracy,
    photoSlotAccuracy, typographyAccuracy, 100, decorativeShapeAccuracy,
  ];
  const overallStructuralAccuracy = Math.round(
    allScores.reduce((a, b) => a + b, 0) / allScores.length * 100
  ) / 100;

  const minOverall = strength === 'exact' ? 90 : 80;
  const accepted = overallStructuralAccuracy >= minOverall;

  if (geometryAccuracy < 70) {
    failures.push(`Geometry accuracy too low: ${geometryAccuracy.toFixed(1)}%`);
  }
  if (headerAccuracy < 70) {
    failures.push(`Header accuracy too low: ${headerAccuracy.toFixed(1)}%`);
  }
  if (footerAccuracy < 70) {
    failures.push(`Footer accuracy too low: ${footerAccuracy.toFixed(1)}%`);
  }
  if (photoSlotAccuracy < 60) {
    failures.push(`Photo slot accuracy too low: ${photoSlotAccuracy.toFixed(1)}%`);
  }
  if (typographyAccuracy < 60) {
    failures.push(`Typography accuracy too low: ${typographyAccuracy.toFixed(1)}%`);
  }

  const photoCount = analysis.heroPhotoRegion ? 1 : 0 + analysis.supportingPhotoRegions.length + analysis.programmePhotoRegions.length;
  const genPhotoCount = generatedRegions.filter(
    (r) => r.role === 'heroPhoto' || r.role === 'supportingPhoto' || r.role === 'programmePhoto'
  ).length;
  if (photoCount !== genPhotoCount && strength === 'exact') {
    failures.push(`Photo slot count mismatch: reference has ${photoCount}, generated has ${genPhotoCount}`);
  }

  if (regionScores.some((s) => s.overall < 30)) {
    warnings.push('Some regions have very low accuracy scores');
  }

  return {
    geometryAccuracy,
    headerAccuracy,
    footerAccuracy,
    photoSlotAccuracy,
    typographyAccuracy,
    colourAccuracy: 100,
    decorativeShapeAccuracy,
    overallStructuralAccuracy,
    regionScores,
    warnings,
    failures,
    accepted,
  };
}

export function accuracyLabel(score: number): string {
  if (score >= 90) return 'Accurate reconstruction';
  if (score >= 85) return 'Close but requires correction';
  if (score >= 70) return 'Loose similarity only';
  return 'Reconstruction failed';
}
