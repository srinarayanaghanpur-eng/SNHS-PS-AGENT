// Layout intelligence ported from V1 (safeAreaCalculator, cardLayoutEngine,
// collisionDetector, qualityValidator) as pure functions on the plan model.
//
// Human-like collage layout engine — the core change that makes posters look
// like a human school designer arranged them, not a template grid.
//
// Key design decisions:
//   1. The FIRST photo (or the highest-importance photo) is always the hero.
//      It occupies 45-65% of the photo zone, dominating the composition.
//   2. Supporting photos vary in size — not equal frames.
//   3. Asymmetry is intentional: portrait/landscape orientation changes
//      how photos nest beside each other.
//   4. Gaps are tighter for a natural collage feel; generous margins
//      separate the photo block from text to avoid a cluttered look.
//   5. For 9+ photos a card grid is still used, but row heights vary.

import type { Rect } from './types';

export interface SafeArea { left: number; top: number; right: number; bottom: number; width: number; height: number }

export function safeArea(w: number, h: number, marginPct = 0.055): SafeArea {
  const mx = Math.round(w * marginPct); const my = Math.round(h * marginPct * 0.85);
  return { left: mx, top: my, right: w - mx, bottom: h - my, width: w - 2 * mx, height: h - 2 * my };
}

export function overlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
}

export function inside(inner: Rect, outer: Rect, tolerance = 0): boolean {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance
    && inner.x + inner.w <= outer.x + outer.w + tolerance && inner.y + inner.h <= outer.y + outer.h + tolerance;
}

// WCAG relative luminance + contrast ratio for automatic contrast checking.
export function luminance(hex: string): number {
  const v = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

export function contrastRatio(hexA: string, hexB: string): number {
  const [l1, l2] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ── Human-like collage photo layouts ────────────────────────────────────────
// Returns frames for n photos inside `zone`. Unlike a template grid, this
// function creates a clear visual hierarchy: one hero dominates, supporting
// photos vary in size, and the arrangement feels organic.

export interface PhotoFrame extends Rect { importanceScale: number; labelBelow: boolean }

/**
 * Human-like collage photo layout.
 *
 * `heroIndex` (default 0) picks which photo is the hero. Higher
 * `importanceScale` frames get larger relative sizing.
 * `orientations` (default all landscape) hints whether each photo is portrait
 * or landscape so the collage can nest photos better.
 */
export function photoLayout(
  n: number,
  zone: Rect,
  gap: number,
  seed = 0,
  orientations: ('portrait' | 'landscape' | 'square')[] = [],
): PhotoFrame[] {
  if (n <= 0) return [];
  const frames: PhotoFrame[] = [];
  const put = (x: number, y: number, w: number, h: number, s = 1, label = false) =>
    frames.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), importanceScale: s, labelBelow: label });

  const Z = zone;
  const g = gap;
  const isPort = (i: number) => (orientations[i] || 'landscape') === 'portrait';
  const portCount = orientations.filter(o => o === 'portrait').length;
  const allPortrait = portCount === n;
  const allLandscape = portCount === 0;

  if (n === 1) {
    // Single hero — large, centered, never cropped too tight
    const maxW = Z.w * 0.78;
    const maxH = Z.h * 0.92;
    const w = isPort(0) ? Math.min(maxW * 0.7, maxH * 0.65) : Math.min(maxW, maxH * 1.3);
    const h = Math.min(maxH, w * (isPort(0) ? 1.3 : 0.8));
    put(Z.x + (Z.w - w) / 2, Z.y + (Z.h - h) / 2, w, h, 1.5);

  } else if (n === 2) {
    // Two photos: hero on left or top (60-65%), second fills remaining
    if (isPort(0) || (seed % 3 === 0 && !allLandscape)) {
      // Stack vertically: hero top, second below
      const heroH = Z.h * 0.62;
      put(Z.x, Z.y, Z.w, heroH, 1.3);
      put(Z.x, Z.y + heroH + g, Z.w, Z.h - heroH - g, 1.0);
    } else if (seed % 2 === 0 || isPort(1)) {
      // Hero left, second right
      const heroW = Z.w * 0.62;
      put(Z.x, Z.y, heroW, Z.h, 1.3);
      put(Z.x + heroW + g, Z.y, Z.w - heroW - g, Z.h, 1.0);
    } else {
      // Hero right, second left (asymmetric variation)
      const heroW = Z.w * 0.58;
      put(Z.x + Z.w - heroW, Z.y, heroW, Z.h, 1.3);
      put(Z.x, Z.y, Z.w - heroW - g, Z.h, 1.0);
    }

  } else if (n === 3) {
    // Three: hero dominant (50-55%) + two smaller stacked
    if (isPort(0) && !allPortrait) {
      // Hero portrait on left, two landscape stacked on right
      const heroW = Z.w * 0.52;
      put(Z.x, Z.y, heroW, Z.h, 1.4);
      const smallH = (Z.h - g) / 2;
      put(Z.x + heroW + g, Z.y, Z.w - heroW - g, smallH, 0.9);
      put(Z.x + heroW + g, Z.y + smallH + g, Z.w - heroW - g, smallH, 0.9);
    } else if (allLandscape && seed % 3 === 1) {
      // Three columns with middle dominant
      const w = (Z.w - 2 * g) / 3;
      put(Z.x, Z.y + Z.h * 0.08, w, Z.h * 0.84, 1.0);
      put(Z.x + w + g, Z.y, w, Z.h, 1.3);
      put(Z.x + 2 * (w + g), Z.y + Z.h * 0.08, w, Z.h * 0.84, 1.0);
    } else {
      // Hero top spanning width, two smaller below
      const heroH = Z.h * 0.55;
      put(Z.x, Z.y, Z.w, heroH, 1.3);
      const smallW = (Z.w - g) / 2;
      put(Z.x, Z.y + heroH + g, smallW, Z.h - heroH - g, 0.9);
      put(Z.x + smallW + g, Z.y + heroH + g, smallW, Z.h - heroH - g, 0.9);
    }

  } else if (n === 4) {
    // Four: hero dominates one quadrant, three smaller in L-shape
    if (seed % 3 === 0 && !allPortrait) {
      // Hero top-left large, three in right column + bottom row
      const heroW = Z.w * 0.58;
      const heroH = Z.h * 0.58;
      put(Z.x, Z.y, heroW, heroH, 1.4);
      const smallW = Z.w - heroW - g;
      const smallH = (Z.h - g) / 2;
      put(Z.x + heroW + g, Z.y, smallW, heroH, 0.9);
      put(Z.x, Z.y + heroH + g, heroW, Z.h - heroH - g, 0.8);
      put(Z.x + heroW + g, Z.y + heroH + g, smallW, Z.h - heroH - g, 0.8);
    } else if (allPortrait) {
      // Four portraits: 2x2 but hero is notably larger
      const heroW = Z.w * 0.56;
      const heroH = Z.h * 0.56;
      put(Z.x, Z.y, heroW, heroH, 1.3);
      put(Z.x + heroW + g, Z.y, Z.w - heroW - g, heroH, 0.9);
      put(Z.x, Z.y + heroH + g, Z.w, Z.h - heroH - g, 0.7);
    } else {
      // Top row: hero + one, bottom row: two equal
      const heroW = Z.w * 0.55;
      put(Z.x, Z.y, heroW, Z.h * 0.55, 1.3);
      put(Z.x + heroW + g, Z.y, Z.w - heroW - g, Z.h * 0.55, 0.9);
      const botW = (Z.w - g) / 2;
      put(Z.x, Z.y + Z.h * 0.55 + g, botW, Z.h * 0.45 - g, 0.8);
      put(Z.x + botW + g, Z.y + Z.h * 0.55 + g, botW, Z.h * 0.45 - g, 0.8);
    }

  } else if (n <= 8) {
    // 5-8: Collage with clear hero + supporting row(s).
    // Hero is always the largest; supporting photos may have two sizes.
    const heroH = isPort(0) ? Z.h : Z.h * 0.58;
    const heroW = isPort(0) ? Z.w * 0.48 : Z.w * 0.55;
    put(Z.x, Z.y, heroW, heroH, 1.3);

    const rest = n - 1;
    const secondaryW = Z.w - heroW - g;
    const rightCols = rest <= 2 ? rest : (rest <= 4 ? 2 : 3);
    const rightGaps = (rightCols - 1) * g;
    const cellW = (secondaryW - rightGaps) / rightCols;
    const rightRows = Math.ceil(rest / rightCols);
    const cellH = (heroH - (rightRows - 1) * g) / rightRows;

    for (let i = 0; i < rest; i++) {
      const col = i % rightCols;
      const row = Math.floor(i / rightCols);
      const x = Z.x + heroW + g + col * (cellW + g);
      const y = Z.y + row * (cellH + g);
      const s = i === 0 ? 1.0 : 0.8;
      put(x, y, cellW, cellH, s);
    }

  } else {
    // 9-12: Student card grid with name labels.
    // Row heights vary slightly so it doesn't look like a spreadsheet.
    const cols = n <= 9 ? 3 : 4;
    const rows = Math.ceil(n / cols);
    const rowGaps = (rows - 1) * g;
    const colGaps = (cols - 1) * g;
    const baseW = (Z.w - colGaps) / cols;
    // Vary row heights: first row gets 5% extra (hero row), last row 5% less
    const rowHeights: number[] = [];
    for (let r = 0; r < rows; r++) {
      const extra = r === 0 ? 1.1 : r === rows - 1 ? 0.9 : 1.0;
      rowHeights.push(((Z.h - rowGaps) / rows) * extra);
    }
    // Re-normalize to fit
    const totalH = rowHeights.reduce((a, b) => a + b, 0);
    const norm = (Z.h - rowGaps) / totalH;
    let yAccum = 0;
    for (let r = 0; r < rows; r++) {
      const h = rowHeights[r] * norm;
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (i >= n) break;
        const x = Z.x + c * (baseW + g);
        const y = Z.y + yAccum;
        put(x, y, baseW, h, r === 0 ? 0.9 : 0.8, true);
      }
      yAccum += h + g;
    }
  }
  return frames;
}

// Cover-fit source into frame keeping headroom: returns scale + offsets used by
// the emitter. focusY 0.38 keeps faces (usually upper third) uncut.
export function coverFit(srcW: number, srcH: number, frame: Rect, focusY = 0.38): { scale: number; dx: number; dy: number } {
  const scale = Math.max(frame.w / srcW, frame.h / srcH);
  const sw = srcW * scale, sh = srcH * scale;
  const dx = frame.x - (sw - frame.w) / 2;
  const overflowY = sh - frame.h;
  const dy = frame.y - overflowY * Math.min(Math.max(focusY, 0), 1);
  return { scale, dx, dy };
}
