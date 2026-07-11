/**
 * Quality-control engine for generated posters. Pure: it audits the generation
 * plan/outcome (regions, placed layers, fits) so it can be unit-tested and
 * re-run after each repair pass. Critical failures block export until repaired
 * or safely covered (mandated behaviour).
 */
import type { DetectedRegion, ReferenceProject } from '../types';
import type { TextFit } from '../repair/textFitting';

export interface PlacedElement {
  kind: 'text' | 'image' | 'cover' | 'raster-base';
  name: string;
  left: number; top: number; width: number; height: number;
  ok: boolean;
  fit?: TextFit;
  content?: string;
}

export interface QCIssue { code: string; severity: 'critical' | 'warning'; message: string }
export interface QCReport {
  pass: boolean;
  criticalCount: number;
  issues: QCIssue[];
  scores: Record<string, number>; // 0-100 per dimension
  overall: number;
}

const overlapArea = (a: PlacedElement, r: { left: number; top: number; width: number; height: number }) => {
  const x = Math.max(0, Math.min(a.left + a.width, r.left + r.width) - Math.max(a.left, r.left));
  const y = Math.max(0, Math.min(a.top + a.height, r.top + r.height) - Math.max(a.top, r.top));
  return x * y;
};

export function runQualityControl(
  project: ReferenceProject,
  placed: PlacedElement[],
  canvas: { width: number; height: number },
  covered: DetectedRegion[] // replace-regions that were inpainted/covered
): QCReport {
  const issues: QCIssue[] = [];
  const crit = (code: string, message: string) => issues.push({ code, severity: 'critical', message });
  const warn = (code: string, message: string) => issues.push({ code, severity: 'warning', message });
  const profile = project.profileSnapshot;

  // 1. No original identity may remain: every replace-region must be covered or overlapped by new content.
  const replaceRegions = project.regions.filter(r => r.replace);
  let coveredCount = 0;
  for (const r of replaceRegions) {
    const area = r.bounds.width * r.bounds.height;
    const coveredByRepair = covered.some(c => c.id === r.id);
    const coveredByElement = placed.some(p => p.ok && overlapArea(p, r.bounds) >= area * 0.85);
    if (coveredByRepair || coveredByElement) coveredCount++;
    else crit('OLD_IDENTITY_VISIBLE', `Original "${(r.text ?? r.kind).slice(0, 40)}" region is still visible.`);
  }

  // 2. New identity present and correct.
  const textOf = (frag: string) => placed.find(p => p.kind === 'text' && p.ok && p.content?.toLowerCase().includes(frag.toLowerCase()));
  if (!textOf(profile.schoolName)) crit('SCHOOL_NAME_MISSING', 'New school name text layer missing.');
  if (profile.phone && !textOf(profile.phone)) warn('PHONE_MISSING', 'Configured phone number not placed.');
  if (profile.academicYear && !textOf(profile.academicYear)) warn('YEAR_MISSING', 'Academic year not placed.');
  const logoPlaced = placed.some(p => p.kind === 'image' && p.ok && /logo/i.test(p.name));
  if ((profile.media.logo?.length ?? 0) > 0 && !logoPlaced) warn('LOGO_MISSING', 'Configured logo was not placed.');

  // 3. Readability + canvas bounds.
  for (const p of placed.filter(p => p.kind === 'text' && p.ok)) {
    if (p.fit && !p.fit.fits) crit('TEXT_UNREADABLE', `"${p.name}" could not fit at readable size.`);
    if (p.left < 0 || p.top < 0 || p.left + p.width > canvas.width || p.top + p.height > canvas.height)
      crit('TEXT_OUT_OF_CANVAS', `"${p.name}" extends outside the canvas.`);
  }

  // 4. Face safety: no new element may cover a detected face.
  const faces = project.regions.filter(r => r.kind === 'face' || r.kind === 'person');
  for (const f of faces) for (const p of placed.filter(p => p.ok && p.kind !== 'raster-base')) {
    if (overlapArea(p, f.bounds) > f.bounds.width * f.bounds.height * 0.2)
      crit('FACE_COVERED', `"${p.name}" overlaps a detected face.`);
  }

  // 5. Layer success rate.
  const failed = placed.filter(p => !p.ok);
  if (failed.length) warn('LAYER_FAILURES', `${failed.length} layer(s) fell back or failed: ${failed.map(f => f.name).join(', ')}.`);

  const scores: Record<string, number> = {
    replacementCompleteness: replaceRegions.length ? Math.round((coveredCount / replaceRegions.length) * 100) : 100,
    readability: placed.some(p => p.fit && !p.fit.fits) ? 40 : 100,
    faceSafety: issues.some(i => i.code === 'FACE_COVERED') ? 0 : 100,
    layerSuccess: placed.length ? Math.round((placed.filter(p => p.ok).length / placed.length) * 100) : 100,
    ocrConfidence: project.overallConfidence
  };
  const overall = Math.round(Object.values(scores).reduce((s, v) => s + v, 0) / Object.keys(scores).length);
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  return { pass: criticalCount === 0, criticalCount, issues, scores, overall };
}
