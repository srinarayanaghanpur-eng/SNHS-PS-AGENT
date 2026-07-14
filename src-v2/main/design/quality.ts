// Automated design-quality validation over the plan, ported from V1's
// layoutValidator/qualityValidator ideas. Fixable problems are corrected in
// place (text nudged into canvas, undersized boxes grown, overlaps resolved by
// shrinking); the rest become scored warnings.

import type { Plan, PlanNode, QualityReport, QualityWarning, Rect } from './types';
import { contrastRatio, inside, overlap, safeArea } from './layout';
import { fitText } from './textFit';

const nodeRect = (n: PlanNode): Rect => {
  if (n.kind !== 'polygon') return n.rect;
  const xs = n.points.map((point) => point.x); const ys = n.points.map((point) => point.y);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

export function validateAndFix(plan: Plan): QualityReport {
  const warnings: QualityWarning[] = [];
  const fixes: string[] = [];
  const canvas: Rect = { x: 0, y: 0, w: plan.width, h: plan.height };
  const safe = safeArea(plan.width, plan.height);
  const safeRect: Rect = { x: safe.left, y: safe.top, w: safe.width, h: safe.height };
  const minReadable = Math.round(plan.width * 0.011);

  const texts: PlanNode[] = [];
  const photos: PlanNode[] = [];
  for (const group of plan.groups) {
    for (const node of group.nodes) {
      if (node.kind === 'text') texts.push(node);
      if (node.kind === 'photo') photos.push(node);
    }
  }

  for (const node of texts) {
    if (node.kind !== 'text') continue;
    const rect = nodeRect(node);

    // Outside canvas → nudge back in (fixable).
    if (!inside(rect, canvas)) {
      rect.x = Math.max(0, Math.min(rect.x, plan.width - rect.w));
      rect.y = Math.max(0, Math.min(rect.y, plan.height - rect.h));
      fixes.push(`Moved "${node.name}" back inside the canvas.`);
    }
    // Outside safe margins → warn only for important text.
    if (!inside(rect, safeRect, 6) && !node.name.startsWith('FOOTER') && !node.name.startsWith('DETAILS')) {
      warnings.push({ code: 'SAFE_MARGIN', message: `"${node.name}" is close to the export edge.`, nodeName: node.name, severity: 'info' });
    }
    // Estimated overflow → shrink to fit (fixable down to minSize).
    const fit = fitText(node.content.replace(/\r/g, ' '), { w: rect.w, h: rect.h }, node.size, node.minSize, node.maxLines, node.font, node.lineHeight ?? 1.25, node.tracking ?? 0);
    if (fit.size < node.size) { node.size = fit.size; fixes.push(`Reduced "${node.name}" to ${fit.size}px to fit its box.`); }
    if (fit.overflow) warnings.push({ code: 'TEXT_OVERFLOW', message: `"${node.name}" may not fit even at minimum size.`, nodeName: node.name, severity: 'warning' });
    // Tiny important text.
    if (node.size < minReadable && /HEADLINE|SCHOOL_NAME|TITLE/.test(node.name)) {
      warnings.push({ code: 'TINY_TEXT', message: `"${node.name}" is very small (${node.size}px).`, nodeName: node.name, severity: 'warning' });
    }
    // Contrast vs its declared surface.
    if (node.surfaceHex) {
      const ratio = contrastRatio(node.hex, node.surfaceHex);
      if (ratio < 3) warnings.push({ code: 'LOW_CONTRAST', message: `"${node.name}" contrast ratio ${ratio.toFixed(1)}:1 is below 3:1.`, nodeName: node.name, severity: 'warning' });
    }
    if (!node.content.trim()) warnings.push({ code: 'EMPTY_TEXT', message: `"${node.name}" is empty.`, nodeName: node.name, severity: 'error' });
  }

  // Text-vs-text and text-vs-photo collisions across groups.
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.kind === 'text' && b.kind === 'text' && overlap(a.rect, b.rect, -4)) {
        warnings.push({ code: 'TEXT_OVERLAP', message: `"${a.name}" overlaps "${b.name}".`, nodeName: a.name, severity: 'warning' });
      }
    }
    const t = texts[i];
    if (t.kind !== 'text') continue;
    for (const photo of photos) {
      if (photo.kind === 'photo' && !photo.name.includes('LOGO') && overlap(t.rect, photo.rect, -6) && !t.name.includes(photo.name)) {
        warnings.push({ code: 'TEXT_ON_PHOTO', message: `"${t.name}" overlaps photo "${photo.name}".`, nodeName: t.name, severity: 'warning' });
      }
    }
  }

  for (const photo of photos) {
    if (photo.kind !== 'photo') continue;
    if (!inside(photo.rect, canvas, 2)) warnings.push({ code: 'PHOTO_OUTSIDE', message: `"${photo.name}" extends outside the canvas.`, nodeName: photo.name, severity: 'warning' });
    if (photo.rect.w < plan.width * 0.05) warnings.push({ code: 'PHOTO_TOO_SMALL', message: `"${photo.name}" frame is very small.`, nodeName: photo.name, severity: 'info' });
  }

  const penalty = warnings.reduce((sum, w) => sum + (w.severity === 'error' ? 18 : w.severity === 'warning' ? 8 : 2), 0);
  return { score: Math.max(0, 100 - penalty), warnings, fixesApplied: fixes };
}
