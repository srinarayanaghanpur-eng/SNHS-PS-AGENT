/** Pure OCR-result merging: overlapping candidates from different variants/passes
 *  are deduplicated by IoU with highest confidence winning, then sorted into
 *  reading order. Kept free of UXP/Photoshop imports for unit testing. */
export interface MergeCandidate {
  text: string; confidence: number;
  left: number; top: number; width: number; height: number;
  source: string;
}

export function iou(a: MergeCandidate, b: MergeCandidate): number {
  const x0 = Math.max(a.left, b.left), y0 = Math.max(a.top, b.top);
  const x1 = Math.min(a.left + a.width, b.left + b.width), y1 = Math.min(a.top + a.height, b.top + b.height);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const uni = a.width * a.height + b.width * b.height - inter;
  return uni > 0 ? inter / uni : 0;
}

export function mergeCandidates(candidates: MergeCandidate[]): MergeCandidate[] {
  const sorted = candidates.filter(c => c.text.trim()).sort((a, b) => b.confidence - a.confidence);
  const kept: MergeCandidate[] = [];
  for (const c of sorted) if (!kept.some(k => iou(k, c) > 0.4)) kept.push(c);
  const medianH = kept.map(k => k.height).sort((a, b) => a - b)[kept.length >> 1] || 16;
  return kept.sort((a, b) => (Math.abs(a.top - b.top) > medianH * 0.7 ? a.top - b.top : a.left - b.left));
}
