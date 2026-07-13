/** Pure mask construction: replace-flagged regions → padded, merged repair rects. */
import type { DetectedRegion } from '../types';
import type { RectPx } from './rgba';
import { clampRect } from './rgba';

function intersects(a: RectPx, b: RectPx): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width
    && a.top < b.top + b.height && b.top < a.top + a.height;
}

function union(a: RectPx, b: RectPx): RectPx {
  const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
  return { left, top, width: Math.max(a.left + a.width, b.left + b.width) - left, height: Math.max(a.top + a.height, b.top + b.height) - top };
}

/**
 * Build repair rects for all regions that must be removed. Padding is
 * proportional to text height so anti-aliased edges and shadows are included.
 */
export function buildRepairRects(regions: DetectedRegion[], canvasWidth: number, canvasHeight: number): RectPx[] {
  const rects: RectPx[] = regions
    .filter(r => r.replace)
    .map(r => {
      const pad = Math.max(4, Math.round(r.bounds.height * 0.25));
      return clampRect({
        left: r.bounds.left - pad, top: r.bounds.top - pad,
        width: r.bounds.width + pad * 2, height: r.bounds.height + pad * 2
      }, canvasWidth, canvasHeight);
    })
    .filter(r => r.width > 0 && r.height > 0);
  // merge overlaps so inpainting never processes the same pixels twice
  let merged = rects.slice(), changed = true;
  while (changed) {
    changed = false;
    const next: RectPx[] = [];
    const used = new Array(merged.length).fill(false);
    for (let i = 0; i < merged.length; i++) {
      if (used[i]) continue;
      let acc = merged[i];
      for (let j = i + 1; j < merged.length; j++) {
        if (!used[j] && intersects(acc, merged[j])) { acc = union(acc, merged[j]); used[j] = true; changed = true; }
      }
      next.push(acc);
    }
    merged = next;
  }
  return merged;
}
