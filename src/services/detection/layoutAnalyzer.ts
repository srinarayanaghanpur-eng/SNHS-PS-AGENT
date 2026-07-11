import type { DetectedFace, DetectedLogo, DetectedRegion, LayoutAnalysis, Rect, ReconstructionMode } from '../../types';
import type { GrayImage } from '../../ocr/imaging';

/**
 * Comprehensive layout analysis engine.
 * Takes all detected elements (text regions, faces, logos, objects)
 * and produces a structural understanding of the poster.
 */
export function analyzeLayout(
  gray: GrayImage,
  textRegions: DetectedRegion[],
  faces: DetectedFace[],
  logos: DetectedLogo[],
  _objects: Array<{ label: string; confidence: number; bounds: Rect }>
): LayoutAnalysis {
  const w = gray.width;
  const h = gray.height;

  const orientation = w > h * 1.1 ? 'landscape' : h > w * 1.1 ? 'portrait' : 'square';

  const margins = detectMargins(textRegions, w, h);

  const sections = detectSections(textRegions, faces, w, h);

  const faceSafeRegions = computeFaceSafeRegions(faces, w, h);

  const visualHierarchy = buildVisualHierarchy(textRegions, w, h);

  const symmetryScore = computeSymmetry(textRegions, w, h);

  const recommededMode = selectMode(textRegions, faces, logos, symmetryScore);

  return {
    canvas: { width: w, height: h, orientation },
    sections,
    margins,
    faceSafeRegions,
    visualHierarchy,
    symmetryScore,
    reconstructionConfidence: recommededMode === 'full' ? 80 : recommededMode === 'hybrid' ? 55 : 35,
    recommendedMode: recommededMode
  };
}

function detectMargins(regions: DetectedRegion[], w: number, h: number) {
  let left = w, top = h, right = 0, bottom = 0;
  if (regions.length === 0) {
    left = Math.round(w * 0.05);
    top = Math.round(h * 0.05);
    right = Math.round(w * 0.05);
    bottom = Math.round(h * 0.05);
  } else {
    for (const r of regions) {
      if (r.bounds.left < left) left = r.bounds.left;
      if (r.bounds.top < top) top = r.bounds.top;
      if (r.bounds.left + r.bounds.width > right) right = w - (r.bounds.left + r.bounds.width);
      if (r.bounds.top + r.bounds.height > bottom) bottom = h - (r.bounds.top + r.bounds.height);
    }
  }
  return { left, top, right, bottom };
}

function detectSections(
  regions: DetectedRegion[],
  faces: DetectedFace[],
  w: number, h: number
): Array<{ section: 'header' | 'content' | 'footer'; region: Rect; confidence: number }> {
  const sections: Array<{ section: 'header' | 'content' | 'footer'; region: Rect; confidence: number }> = [];

  const regionCenters = regions.map(r => ({ y: r.bounds.top + r.bounds.height / 2, role: r.semanticRole }));

  const headerCandidates = regionCenters.filter(r => r.y < h * 0.3);
  const footerCandidates = regionCenters.filter(r => r.y > h * 0.7);
  const contentCandidates = regionCenters.filter(r => r.y >= h * 0.3 && r.y <= h * 0.7);

  if (headerCandidates.length > 0 || faces.some(f => f.bounds.top < h * 0.3)) {
    const yEnd = headerCandidates.length > 0
      ? Math.max(...headerCandidates.map(r => r.y)) + h * 0.05
      : h * 0.22;
    sections.push({
      section: 'header',
      region: { left: 0, top: 0, right: w, bottom: Math.round(yEnd), width: w, height: Math.round(yEnd) },
      confidence: Math.min(90, 50 + headerCandidates.length * 10)
    });
  }

  const contentTop = sections.find(s => s.section === 'header')
    ? sections.find(s => s.section === 'header')!.region.bottom
    : Math.round(h * 0.22);
  const contentBottom = Math.round(h * 0.78);
  sections.push({
    section: 'content',
    region: { left: 0, top: contentTop, right: w, bottom: contentBottom, width: w, height: contentBottom - contentTop },
    confidence: 75
  });

  sections.push({
    section: 'footer',
    region: { left: 0, top: contentBottom, right: w, bottom: h, width: w, height: h - contentBottom },
    confidence: 80
  });

  return sections;
}

function computeFaceSafeRegions(faces: DetectedFace[], w: number, h: number): Rect[] {
  return faces.map(f => {
    const pad = Math.round(Math.max(f.bounds.width, f.bounds.height) * 0.5);
    return {
      left: Math.max(0, f.bounds.left - pad),
      top: Math.max(0, f.bounds.top - pad),
      right: Math.min(w, f.bounds.left + f.bounds.width + pad),
      bottom: Math.min(h, f.bounds.top + f.bounds.height + pad),
      width: Math.min(w, f.bounds.width + pad * 2),
      height: Math.min(h, f.bounds.height + pad * 2)
    };
  });
}

function buildVisualHierarchy(
  regions: DetectedRegion[],
  _w: number, _h: number
): Array<{ elementId: string; importance: number }> {
  const hierarchy: Array<{ elementId: string; importance: number }> = [];

  for (const r of regions) {
    let importance = 50;

    if (r.semanticRole === 'school_name' || r.semanticRole === 'poster_title') importance = 90;
    else if (r.semanticRole === 'school_logo') importance = 85;
    else if (r.semanticRole === 'event_date' || r.semanticRole === 'academic_year') importance = 65;
    else if (r.semanticRole === 'school_phone' || r.semanticRole === 'school_address') importance = 55;
    else if (r.semanticRole === 'student_photo' || r.semanticRole === 'event_image') importance = 75;
    else if (r.semanticRole === 'footer') importance = 30;

    const area = r.bounds.width * r.bounds.height;
    const docArea = _w * _h;
    if (area > docArea * 0.1) importance = Math.min(100, Math.round(importance + 15));

    hierarchy.push({ elementId: r.id, importance });
  }

  return hierarchy.sort((a, b) => b.importance - a.importance);
}

function computeSymmetry(regions: DetectedRegion[], w: number, _h: number): number {
  if (regions.length === 0) return 50;
  const midX = w / 2;
  let leftMass = 0, rightMass = 0;
  for (const r of regions) {
    const cx = r.bounds.left + r.bounds.width / 2;
    const mass = r.bounds.width * r.bounds.height;
    if (cx < midX) leftMass += mass; else rightMass += mass;
  }
  if (leftMass === 0 && rightMass === 0) return 50;
  const ratio = Math.min(leftMass, rightMass) / Math.max(leftMass, rightMass);
  return Math.round(ratio * 100);
}

function selectMode(
  textRegions: DetectedRegion[],
  faces: DetectedFace[],
  logos: DetectedLogo[],
  symmetryScore: number
): ReconstructionMode {
  if (textRegions.length === 0) return 'safe';
  const avgConfidence = textRegions.length > 0
    ? textRegions.reduce((s, r) => s + r.confidence, 0) / textRegions.length
    : 0;
  const hasLogo = logos.length > 1 || (logos.length === 1 && logos[0].confidence >= 45);
  const hasFaces = faces.length > 0;
  const replaceCount = textRegions.filter(r => r.replace).length;
  const totalImportant = textRegions.filter(r =>
    ['school_name', 'school_phone', 'school_address', 'academic_year', 'email', 'website'].includes(r.semanticRole ?? '')
  ).length;

  if (avgConfidence >= 65 && hasLogo && symmetryScore >= 60 && replaceCount >= totalImportant * 0.5) {
    return 'full';
  }
  if (avgConfidence >= 40 && (hasLogo || hasFaces) && replaceCount > 0) {
    return 'hybrid';
  }
  return 'safe';
}

export function computeOverallConfidence(layout: LayoutAnalysis, textConfidence: number): number {
  const weights = {
    textWeight: 0.35,
    symmetryWeight: 0.15,
    modeWeight: 0.25,
    hierarchyWeight: 0.15,
    sectionWeight: 0.10
  };
  const modeScore = layout.recommendedMode === 'full' ? 85 : layout.recommendedMode === 'hybrid' ? 55 : 30;
  const hierarchyScore = layout.visualHierarchy.length > 0
    ? Math.min(100, layout.visualHierarchy.length * 12)
    : 0;
  const sectionConf = layout.sections.length > 0
    ? Math.round(layout.sections.reduce((s, sec) => s + sec.confidence, 0) / layout.sections.length)
    : 0;
  const total = Math.round(
    textConfidence * weights.textWeight +
    layout.symmetryScore * weights.symmetryWeight +
    modeScore * weights.modeWeight +
    hierarchyScore * weights.hierarchyWeight +
    sectionConf * weights.sectionWeight
  );
  return Math.min(100, Math.max(0, total));
}
