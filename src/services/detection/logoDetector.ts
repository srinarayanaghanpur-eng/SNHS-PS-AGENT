import type { DetectedLogo } from '../../types';
import type { GrayImage } from '../../ocr/imaging';
import type { DetectedRegion } from '../../types';
import { log } from '../../utils/logger';
import { resize } from '../../ocr/imaging';
import { adaptiveThreshold } from '../../ocr/imaging';
import { connectedComponents } from '../../ocr/regionDetector';

/**
 * Logo detection using multi-strategy heuristics.
 * No model required — uses position, shape, OCR context, and size analysis.
 */
export function detectLogo(
  gray: GrayImage,
  textRegions: DetectedRegion[]
): DetectedLogo[] {
  const logos: DetectedLogo[] = [];
  const w = gray.width;
  const h = gray.height;

  logos.push(...detectByPosition(w, h));
  logos.push(...detectByOcrContext(textRegions, w, h));
  logos.push(...detectByShape(gray, w, h));
  logos.push(...detectByFallbackHeuristic(w, h));

  return deduplicateLogos(logos);
}

function regionArea(r: { left: number; top: number; width: number; height: number }): number {
  return r.width * r.height;
}

function intersects(a: { left: number; top: number; width: number; height: number },
                    b: { left: number; top: number; width: number; height: number }): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width &&
         a.top < b.top + b.height && b.top < a.top + a.height;
}

function overlapRatio(a: { left: number; top: number; width: number; height: number },
                      b: { left: number; top: number; width: number; height: number }): number {
  const x0 = Math.max(a.left, b.left), y0 = Math.max(a.top, b.top);
  const x1 = Math.min(a.left + a.width, b.left + b.width);
  const y1 = Math.min(a.top + a.height, b.top + b.height);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const minArea = Math.min(regionArea(a), regionArea(b));
  return minArea > 0 ? inter / minArea : 0;
}

/**
 * Strategy 1: Position-based. Logos typically sit in the top-left,
 * top-center, or top-right corner of the header area.
 */
function detectByPosition(w: number, h: number): DetectedLogo[] {
  const logos: DetectedLogo[] = [];
  const logoZoneW = Math.round(w * 0.25);
  const logoZoneH = Math.round(h * 0.15);

  if (w >= 200 && h >= 200) {
    const size = Math.min(logoZoneW, logoZoneH);
    const lx = Math.round(w * 0.03), ly = Math.round(h * 0.02);
    logos.push({
      bounds: { left: lx, top: ly, right: lx + size, bottom: ly + size, width: size, height: size },
      confidence: 35,
      method: 'position_heuristic'
    });
  }
  return logos;
}

/**
 * Strategy 2: OCR-context based. If the school name appears as a small
 * bounding box near the top, the region adjacent to it may contain the logo.
 */
function detectByOcrContext(regions: DetectedRegion[], w: number, _h: number): DetectedLogo[] {
  const logos: DetectedLogo[] = [];
  for (const r of regions) {
    if (r.semanticRole === 'school_name' && r.text && r.confidence > 50) {
      const logoSize = Math.min(r.bounds.height * 1.2, w * 0.12, 200);
      let lx = 0, ly = 0;
      if (r.bounds.left < w * 0.4) {
        lx = Math.max(0, r.bounds.left - logoSize - Math.round(w * 0.01));
        ly = r.bounds.top + Math.round((r.bounds.height - logoSize) / 2);
      } else {
        lx = Math.min(w - logoSize, r.bounds.right + Math.round(w * 0.01));
        ly = r.bounds.top + Math.round((r.bounds.height - logoSize) / 2);
      }
      const lt = Math.max(0, ly);
      logos.push({
        bounds: { left: lx, top: lt, right: lx + logoSize, bottom: lt + logoSize, width: logoSize, height: logoSize },
        confidence: Math.min(r.confidence + 10, 85),
        method: 'ocr_position'
      });
    }
  }
  return logos;
}

/**
 * Strategy 3: Shape-based. Look for compact circular or rounded-rect
 * regions with high contrast in the top portion of the poster.
 */
function detectByShape(gray: GrayImage, w: number, h: number): DetectedLogo[] {
  const logos: DetectedLogo[] = [];
  try {
    const scale = Math.min(1, 1000 / Math.max(w, h));
    const small = resize(gray, Math.round(w * scale), Math.round(h * scale));
    const bin = adaptiveThreshold(small);
    const comps = connectedComponents(bin);

    const minSize = Math.round(Math.min(w, h) * 0.03 * scale);
    const maxSize = Math.round(Math.min(w, h) * 0.15 * scale);

    for (const c of comps) {
      if (c.width < minSize || c.height < minSize) continue;
      if (c.width > maxSize || c.height > maxSize) continue;
      if (c.top > small.height * 0.35) continue;

      const aspect = c.width / c.height;
      if (aspect < 0.5 || aspect > 2.0) continue;

      const circularity = (4 * Math.PI * regionArea(c)) / (2 * (c.width + c.height)) ** 2;
      if (circularity > 0.5) {
        const sl = Math.round(c.left / scale), st = Math.round(c.top / scale);
        const sw = Math.round(c.width / scale), sh = Math.round(c.height / scale);
        logos.push({
          bounds: { left: sl, top: st, right: sl + sw, bottom: st + sh, width: sw, height: sh },
          confidence: Math.min(70, Math.round(40 + circularity * 30)),
          method: 'shape'
        });
      }
    }
  } catch (err) {
    log('warn', 'logoDetector', `Shape detection failed: ${String(err)}`);
  }
  return logos;
}

/**
 * Strategy 4: Last-resort heuristic — check the top-left and top-center
 * areas for a compact region surrounded by whitespace.
 */
function detectByFallbackHeuristic(w: number, h: number): DetectedLogo[] {
  if (w < 300 || h < 300) return [];
  const size = Math.round(Math.min(w, h) * 0.07);
  if (size < 20) return [];
  const fl = Math.round(w * 0.05), ft = Math.round(h * 0.03);
  return [{
    bounds: { left: fl, top: ft, right: fl + size, bottom: ft + size, width: size, height: size },
    confidence: 30,
    method: 'position_heuristic'
  }];
}

function deduplicateLogos(logos: DetectedLogo[]): DetectedLogo[] {
  const kept: DetectedLogo[] = [];
  for (const l of logos.sort((a, b) => b.confidence - a.confidence)) {
    if (!kept.some(k => overlapRatio(k.bounds, l.bounds) > 0.5)) {
      kept.push(l);
    }
  }
  return kept;
}
