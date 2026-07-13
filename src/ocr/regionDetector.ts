/**
 * Text-region proposal: binarise → connected components → merge horizontally
 * adjacent components into line boxes → merge vertically stacked lines into
 * region blocks. Pure functions, unit-testable.
 */
import type { GrayImage } from './imaging';
import { adaptiveThreshold } from './imaging';

export interface Box { left: number; top: number; width: number; height: number }

function overlaps(a: Box, b: Box, padX: number, padY: number): boolean {
  return a.left - padX < b.left + b.width && b.left - padX < a.left + a.width
    && a.top - padY < b.top + b.height && b.top - padY < a.top + a.height;
}

function union(a: Box, b: Box): Box {
  const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
  return { left, top, width: Math.max(a.left + a.width, b.left + b.width) - left, height: Math.max(a.top + a.height, b.top + b.height) - top };
}

/** Connected components (4-neighbour) over dark pixels using an iterative flood fill. */
export function connectedComponents(bin: GrayImage, maxComponents = 20000): Box[] {
  const { data, width, height } = bin;
  const seen = new Uint8Array(data.length);
  const boxes: Box[] = [];
  const stack = new Int32Array(Math.min(data.length, 1 << 20));
  for (let start = 0; start < data.length; start++) {
    if (data[start] !== 0 || seen[start]) continue;
    let sp = 0; stack[sp++] = start; seen[start] = 1;
    let minX = width, minY = height, maxX = 0, maxY = 0, count = 0;
    while (sp > 0) {
      const i = stack[--sp];
      const x = i % width, y = (i / width) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      count++;
      const tryPush = (j: number) => { if (j >= 0 && j < data.length && !seen[j] && data[j] === 0 && sp < stack.length) { seen[j] = 1; stack[sp++] = j; } };
      if (x > 0) tryPush(i - 1);
      if (x < width - 1) tryPush(i + 1);
      tryPush(i - width); tryPush(i + width);
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    // discard specks and huge blobs (photo/background regions, borders)
    if (count < 8 || h < 4 || h > height * 0.5 || w > width * 0.9) continue;
    boxes.push({ left: minX, top: minY, width: w, height: h });
    if (boxes.length >= maxComponents) break;
  }
  return boxes;
}

/** Iteratively merge boxes that are close on the given axis until stable. */
export function mergeBoxes(boxes: Box[], padX: number, padY: number): Box[] {
  let merged = boxes.slice();
  let changed = true;
  while (changed) {
    changed = false;
    const next: Box[] = [];
    const used = new Array(merged.length).fill(false);
    for (let i = 0; i < merged.length; i++) {
      if (used[i]) continue;
      let acc = merged[i];
      for (let j = i + 1; j < merged.length; j++) {
        if (used[j]) continue;
        // only merge glyphs of similar height (avoids swallowing photos into text lines)
        const hRatio = Math.min(acc.height, merged[j].height) / Math.max(acc.height, merged[j].height);
        if (hRatio > 0.35 && overlaps(acc, merged[j], padX, padY)) { acc = union(acc, merged[j]); used[j] = true; changed = true; }
      }
      next.push(acc);
    }
    merged = next;
  }
  return merged;
}

/**
 * Full proposal pass. Returns region boxes in the coordinate space of `gray`,
 * sorted in reading order (top→bottom, then left→right).
 */
export function detectTextRegions(gray: GrayImage): Box[] {
  const bin = adaptiveThreshold(gray);
  const comps = connectedComponents(bin);
  if (!comps.length) return [];
  const medianH = comps.map(c => c.height).sort((a, b) => a - b)[comps.length >> 1] || 12;
  const lines = mergeBoxes(comps, medianH * 1.2, medianH * 0.3);   // words → lines
  const blocks = mergeBoxes(lines, medianH * 0.8, medianH * 0.9);  // lines → blocks
  return blocks
    .filter(b => b.width >= medianH && b.height >= 5)
    .map(b => ({ // pad slightly so OCR sees full glyphs
      left: Math.max(0, b.left - 4), top: Math.max(0, b.top - 4),
      width: Math.min(gray.width - Math.max(0, b.left - 4), b.width + 8),
      height: Math.min(gray.height - Math.max(0, b.top - 4), b.height + 8)
    }))
    .sort((a, b) => (Math.abs(a.top - b.top) > medianH ? a.top - b.top : a.left - b.left));
}
