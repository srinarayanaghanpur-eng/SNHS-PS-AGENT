// Layer 3: Rendered-Poster Quality Critic
//
// Scores a rendered (or planned) poster against 14 human-design criteria.
// Rejects outputs that look like spreadsheets, tables, dashboards, or
// mechanically repeated templates.

import type { Plan, PlanNode, PlanGroup } from '../types';
import type { CriticReport, CriticScore, CritiqueThresholds } from './brainTypes';
import type { DesignPlan } from './brainTypes';
import { DEFAULT_CRITIQUE_THRESHOLDS } from './brainTypes';
import { safeArea, overlap } from '../layout';

function nodeRect(n: PlanNode): { x: number; y: number; w: number; h: number } | null {
  if (n.kind === 'polygon') {
    const xs = n.points.map(p => p.x);
    const ys = n.points.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return 'rect' in n ? (n as any).rect : null;
}

function collect(plan: Plan) {
  const all: PlanNode[] = [];
  const texts: Extract<PlanNode, { kind: 'text' }>[] = [];
  const photos: Extract<PlanNode, { kind: 'photo' }>[] = [];
  const rects: Extract<PlanNode, { kind: 'rect' }>[] = [];
  for (const g of plan.groups) {
    for (const n of g.nodes) {
      all.push(n);
      if (n.kind === 'text') texts.push(n);
      if (n.kind === 'photo') photos.push(n);
      if (n.kind === 'rect') rects.push(n);
    }
  }
  return { all, texts, photos, rects };
}

function s(category: string, score: number, weight: number, details: string, pass: boolean): CriticScore {
  return { category, score, weight, details, pass };
}

function scoreHumanMade(plan: Plan, photos: Extract<PlanNode, { kind: 'photo' }>[], texts: Extract<PlanNode, { kind: 'text' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  if (photos.length >= 2) {
    const sizes = photos.map(p => `${Math.round(p.rect.w)}x${Math.round(p.rect.h)}`);
    const u = new Set(sizes).size;
    if (u === 1) { score -= 40; d.push('All photos identical size (template grid)'); }
    else if (u <= 2) { score -= 15; d.push('Low photo size variety'); }
    else d.push('Good photo size variety');
  }
  if (texts.length >= 3) {
    if (new Set(texts.map(t => t.size)).size < 3) { score -= 10; d.push('Only 1-2 text sizes used'); }
  }
  return s('human-made', Math.max(0, score), 15, d.join('; ') || 'Pass', score >= 60);
}

function scoreEventStorytelling(plan: Plan, texts: Extract<PlanNode, { kind: 'text' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  const hasTitle = texts.some(t => (t.name.includes('TITLE') || t.name.includes('HEADLINE')) && t.content.trim().length > 0);
  const hasDate = texts.some(t => t.name.includes('DATE') && t.content.trim().length > 0);
  const hasCat = texts.some(t => { const c = t.content.toLowerCase(); return c.includes('prayer') || c.includes('birthday') || c.includes('celebration') || c.includes('programme'); });
  if (!hasTitle) { score -= 30; d.push('No title/headline'); }
  if (!hasDate) { score -= 20; d.push('No date'); }
  if (!hasCat) { score -= 15; d.push('Event category unclear'); }
  if (hasTitle && hasDate) d.push('Event story clear');
  return s('event-storytelling', Math.max(0, score), 10, d.join('; ') || 'Pass', score >= 60);
}

function scoreHeroDominance(plan: Plan, photos: Extract<PlanNode, { kind: 'photo' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  if (photos.length >= 2) {
    const areas = photos.map(p => p.rect.w * p.rect.h).sort((a, b) => b - a);
    const ratio = areas[1] > 0 ? areas[0] / areas[1] : 2;
    if (ratio < 1.3) { score -= 40; d.push(`Hero not dominant (ratio ${ratio.toFixed(1)}:1)`); }
    else if (ratio < 1.6) { score -= 15; d.push(`Weak dominance (${ratio.toFixed(1)}:1)`); }
    else d.push(`Good hero dominance (${ratio.toFixed(1)}:1)`);
  } else if (photos.length === 1) d.push('Single photo — automatically dominant');
  else { score -= 50; d.push('No photos at all'); }
  return s('hero-dominance', Math.max(0, score), 12, d.join('; ') || 'Pass', score >= 60);
}

function scorePhotoRelevance(plan: Plan, metadata: Record<string, any>): CriticScore {
  let score = 100; const d: string[] = [];
  const count = metadata?.photoCount || 0;
  if (count === 0) { score -= 30; d.push('No photos used'); }
  else if (count > 15) { score -= 10; d.push(`${count} photos may be too many`); }
  else d.push(`${count} photos — appropriate count`);
  return s('photo-relevance', Math.max(0, score), 8, d.join('; ') || 'Pass', score >= 50);
}

function scoreFaceSafeCropping(plan: Plan, photos: Extract<PlanNode, { kind: 'photo' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  for (const p of photos) {
    const fy = p.focusY ?? 0.5;
    if (fy < 0.1 || fy > 0.9) { score -= 15; d.push(`Photo ${p.name || ''} has extreme focusY (${fy})`); }
  }
  if (d.length === 0 && photos.length > 0) d.push('FocusY values reasonable');
  return s('face-safe-cropping', Math.max(0, score), 8, d.join('; ') || 'Pass', score >= 60);
}

function scoreDuplicateDetection(plan: Plan, photos: Extract<PlanNode, { kind: 'photo' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  const paths = photos.map(p => p.path).filter(Boolean);
  if (paths.length !== new Set(paths).size) { score -= 30; d.push('Duplicate photo(s) detected'); }
  else if (paths.length > 0) d.push('No duplicate photos');
  return s('duplicate-detection', Math.max(0, score), 5, d.join('; ') || 'Pass', score >= 60);
}

function scoreBrandingCompleteness(plan: Plan, texts: Extract<PlanNode, { kind: 'text' }>[], photos: Extract<PlanNode, { kind: 'photo' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  const hasName = texts.some(t => t.name.includes('SCHOOL_NAME') && t.content.trim().length > 0);
  const hasLogo = photos.some(p => p.name.includes('LOGO'));
  const hasFooter = texts.some(t => t.name.includes('FOOTER'));
  if (!hasName) { score -= 30; d.push('Missing school name'); }
  if (!hasLogo) { score -= 20; d.push('Missing school logo'); }
  if (!hasFooter) { score -= 10; d.push('Missing footer'); }
  if (hasName && hasLogo) d.push('Branding complete');
  return s('branding-completeness', Math.max(0, score), 10, d.join('; ') || 'Pass', score >= 60);
}

function scoreTypographyReadability(plan: Plan, texts: Extract<PlanNode, { kind: 'text' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  const minR = Math.round(plan.width * 0.011);
  for (const t of texts) {
    if (t.name.includes('TITLE') && t.size < minR * 1.5) { score -= 15; d.push(`Title (${t.size}px) too small`); break; }
  }
  for (const t of texts) {
    if ((t.name.includes('BODY') || t.name.includes('PROGRAMME')) && t.size < minR) { score -= 10; d.push(`Body text at ${t.size}px may be unreadable`); break; }
  }
  if (d.length === 0 && texts.length > 0) d.push('Text sizes are readable');
  return s('typography-readability', Math.max(0, score), 8, d.join('; ') || 'Pass', score >= 60);
}

function scoreVisualBalance(plan: Plan, all: PlanNode[]): CriticScore {
  let score = 100; const d: string[] = [];
  const safe = safeArea(plan.width, plan.height);
  const quads = [
    { x: safe.left, y: safe.top, w: safe.width / 2, h: (safe.bottom - safe.top) / 2 },
    { x: safe.left + safe.width / 2, y: safe.top, w: safe.width / 2, h: (safe.bottom - safe.top) / 2 },
    { x: safe.left, y: safe.top + (safe.bottom - safe.top) / 2, w: safe.width / 2, h: (safe.bottom - safe.top) / 2 },
    { x: safe.left + safe.width / 2, y: safe.top + (safe.bottom - safe.top) / 2, w: safe.width / 2, h: (safe.bottom - safe.top) / 2 },
  ];
  const empty = quads.filter(q => !all.some(n => {
    if (n.kind === 'rect' && (n as any).name?.startsWith('BG_')) return false;
    const nr = nodeRect(n);
    return nr !== null && overlap(nr, q as any, 10);
  })).length;
  if (empty >= 3) { score -= 30; d.push(`${empty}/4 quadrants empty`); }
  else if (empty >= 1) { score -= 10; d.push(`${empty} quadrant(s) light`); }
  else d.push('Balanced across all quadrants');
  return s('visual-balance', Math.max(0, score), 8, d.join('; ') || 'Pass', score >= 50);
}

function scoreCanvasUtilisation(plan: Plan, all: PlanNode[]): CriticScore {
  let score = 100; const d: string[] = [];
  const nonBg = all.filter(n => { const nm = (n as any).name || ''; return !nm.startsWith('BG_') && !nm.startsWith('DECO_'); });
  let area = 0;
  for (const n of nonBg) { const nr = nodeRect(n); if (nr) area += nr.w * nr.h; }
  const density = area / (plan.width * plan.height);
  if (density < 0.10) { score -= 30; d.push(`Density ${Math.round(density * 100)}% — too sparse`); }
  else if (density < 0.18) { score -= 10; d.push(`Density ${Math.round(density * 100)}% — could be fuller`); }
  else d.push(`Good density ${Math.round(density * 100)}%`);
  return s('canvas-utilisation', Math.max(0, score), 6, d.join('; ') || 'Pass', score >= 50);
}

function scoreEmotionalAuthenticity(plan: Plan, texts: Extract<PlanNode, { kind: 'text' }>[], photos: Extract<PlanNode, { kind: 'photo' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  const hasStudents = photos.length >= 2;
  const hasWarm = texts.some(t => { const c = t.content.toLowerCase(); return c.includes('prayer') || c.includes('thought') || c.includes('inspire') || c.includes('bless') || c.includes('celebrate'); });
  if (!hasStudents) { score -= 15; d.push('Few student photos (less personal)'); }
  if (!hasWarm) { score -= 10; d.push('No warm/emotional messaging'); }
  if (hasStudents && hasWarm) d.push('Has emotional authenticity');
  return s('emotional-authenticity', Math.max(0, score), 5, d.join('; ') || 'Pass', score >= 50);
}

function scoreTemplateRepetition(plan: Plan, rects: Extract<PlanNode, { kind: 'rect' }>[], photos: Extract<PlanNode, { kind: 'photo' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  if (photos.length >= 3) {
    const ws = photos.map(p => Math.round(p.rect.w / 10) * 10);
    if (new Set(ws).size === 1) { score -= 35; d.push('All photos identical width (template pattern)'); }
    const ys = photos.map(p => Math.round(p.rect.y / 20) * 20);
    if (new Set(ys).size <= 2 && photos.length >= 4) { score -= 20; d.push('Photos in perfect rows (mechanical)'); }
  }
  if (d.length === 0) d.push('No template repetition detected');
  return s('template-repetition', Math.max(0, score), 10, d.join('; ') || 'Pass', score >= 60);
}

function scoreDashboardResemblance(plan: Plan, rects: Extract<PlanNode, { kind: 'rect' }>[], texts: Extract<PlanNode, { kind: 'text' }>[]): CriticScore {
  let score = 100; const d: string[] = [];
  const nonBgRects = rects.filter(r => { const nm = (r as any).name || ''; return !nm.startsWith('BG_') && !nm.startsWith('DECO_') && !nm.startsWith('TOP_ACCENT'); });
  const sameW = nonBgRects.length >= 3 && new Set(nonBgRects.map(r => Math.round(r.rect.w / 20) * 20)).size <= 1;
  const sameH = nonBgRects.length >= 3 && new Set(nonBgRects.map(r => Math.round(r.rect.h / 20) * 20)).size <= 1;
  const hasTable = texts.some(t => (t.name.includes('PROGRAMME') || t.name.includes('ORDER')) && t.content.split('\n').length > 5);
  if (sameW && sameH && nonBgRects.length >= 4) { score -= 40; d.push('Multiple identical rectangles (dashboard grid)'); }
  if (hasTable) { score -= 25; d.push('Programme/list pattern resembles a table'); }
  if (!sameW && !sameH) d.push('No dashboard/table resemblance');
  return s('dashboard-resemblance', Math.max(0, score), 10, d.join('; ') || 'Pass', score >= 60);
}

// ── Main critic ──────────────────────────────────────────────────────────────

export function critiquePosterQuality(plan: Plan, thresholds: CritiqueThresholds = DEFAULT_CRITIQUE_THRESHOLDS): CriticReport {
  const { all, texts, photos, rects } = collect(plan);
  const metadata = plan.metadata || {};

  const criteria = [
    scoreHumanMade(plan, photos, texts),
    scoreEventStorytelling(plan, texts),
    scoreHeroDominance(plan, photos),
    scorePhotoRelevance(plan, metadata),
    scoreFaceSafeCropping(plan, photos),
    scoreDuplicateDetection(plan, photos),
    scoreBrandingCompleteness(plan, texts, photos),
    scoreTypographyReadability(plan, texts),
    scoreVisualBalance(plan, all),
    scoreCanvasUtilisation(plan, all),
    scoreEmotionalAuthenticity(plan, texts, photos),
    scoreTemplateRepetition(plan, rects, photos),
    scoreDashboardResemblance(plan, rects, texts),
  ];

  const totalW = criteria.reduce((s, c) => s + c.weight, 0);
  const overallScore = Math.round(criteria.reduce((s, c) => s + (c.score * c.weight / totalW), 0));

  const failures = criteria.filter(c => !c.pass && c.score < 40).map(c => c.category);
  const warnings = criteria.filter(c => !c.pass && c.score >= 40 && c.score < 60).map(c => c.category);
  const suggestions = criteria.filter(c => c.score < 60).map(c => c.details);

  const hardFailures = failures.filter(f => ['template-repetition', 'dashboard-resemblance', 'hero-dominance'].includes(f));
  const passed = hardFailures.length === 0 && overallScore >= thresholds.minScore;

  return { overallScore, scores: criteria, failures, warnings, suggestions, thresholds, passed };
}

// ── DesignPlan critic ────────────────────────────────────────────────────────

export function critiqueDesignPlan(dp: DesignPlan): CriticReport {
  return critiquePosterQuality(planFromDesignPlan(dp));
}

function planFromDesignPlan(dp: DesignPlan): Plan {
  return {
    width: dp.sections.safeArea.w + dp.sections.safeArea.x * 2,
    height: dp.sections.safeArea.h + dp.sections.safeArea.y * 2,
    baseHex: dp.palette.background,
    groups: [
      { name: '00_BACKGROUND', opacity: 1, visible: true, nodes: [{ kind: 'rect', name: 'BG_MAIN', rect: { x: 0, y: 0, w: 1920, h: 1080 }, hex: dp.palette.background }] },
      { name: '03_TITLE', opacity: 1, visible: true, nodes: [{ kind: 'text', name: 'TITLE', content: 'Critique Dummy', rect: dp.sections.titleZone, font: dp.typography.headingFont, size: dp.typography.titleSize, minSize: 12, maxLines: 2, hex: dp.palette.textPrimary, align: 'center' }] },
      { name: '05_STUDENT_PHOTOS', opacity: 1, visible: true, nodes: [
        ...(dp.heroPhoto.assetPath ? [{ kind: 'photo' as const, name: 'HERO_PHOTO', path: dp.heroPhoto.assetPath, rect: dp.heroPhoto.frameRect, mask: (dp.heroPhoto.frameShape === 'circle' ? 'circle' : dp.heroPhoto.frameShape === 'rounded' ? 'rounded' : 'rect') as 'rect' | 'rounded' | 'circle', focusY: dp.heroPhoto.focusY, fit: 'cover' as const }] : []),
        ...dp.supportingPhotos.map(sp => ({ kind: 'photo' as const, name: `PHOTO_${sp.role}`, path: sp.assetPath, rect: sp.frameRect, mask: (sp.frameShape === 'circle' ? 'circle' : sp.frameShape === 'rounded' ? 'rounded' : 'rect') as 'rect' | 'rounded' | 'circle', focusY: sp.focusY, fit: 'cover' as const })),
      ]},
      { name: '09_FOOTER', opacity: 1, visible: true, nodes: [{ kind: 'rect', name: 'FOOTER_BG', rect: dp.sections.footerZone, hex: dp.palette.footerBg }] },
    ],
    metadata: { compositionFamily: dp.compositionFamily, photoCount: dp.metadata.photoCount, heroFirst: true, assetUsage: { used: [], missing: [], invalid: [] } },
  };
}
