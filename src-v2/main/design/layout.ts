// Layout intelligence ported from V1 (safeAreaCalculator, cardLayoutEngine,
// collisionDetector, qualityValidator) as pure functions on the plan model.

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

// ── Adaptive photo layouts ──────────────────────────────────────────────────
// Returns frames for n photos inside `zone`, with importance-weighted sizing.
// 1 → hero; 2 → split; 3 → one large + two stacked; 4 → grid;
// 5–8 → mixed collage; 9–12 → student card grid. Callers page >12.

export interface PhotoFrame extends Rect { importanceScale: number; labelBelow: boolean }

export function photoLayout(n: number, zone: Rect, gap: number, seed = 0): PhotoFrame[] {
  if (n <= 0) return [];
  const frames: PhotoFrame[] = [];
  const put = (x: number, y: number, w: number, h: number, s = 1, label = false) =>
    frames.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), importanceScale: s, labelBelow: label });

  if (n === 1) {
    const w = Math.min(zone.w * 0.72, zone.h * 0.9);
    put(zone.x + (zone.w - w) / 2, zone.y + (zone.h - Math.min(zone.h, w * 1.05)) / 2, w, Math.min(zone.h, w * 1.05), 1.4);
  } else if (n === 2) {
    const w = (zone.w - gap) / 2;
    put(zone.x, zone.y, w, zone.h, 1.1); put(zone.x + w + gap, zone.y, w, zone.h, 1.1);
  } else if (n === 3) {
    if (seed % 2 === 0) {
      const bigW = zone.w * 0.58;
      put(zone.x, zone.y, bigW, zone.h, 1.3);
      const smallH = (zone.h - gap) / 2; const sx = zone.x + bigW + gap;
      put(sx, zone.y, zone.w - bigW - gap, smallH); put(sx, zone.y + smallH + gap, zone.w - bigW - gap, smallH);
    } else {
      const w = (zone.w - 2 * gap) / 3;
      for (let i = 0; i < 3; i++) put(zone.x + i * (w + gap), zone.y + (i === 1 ? 0 : zone.h * 0.08), w, zone.h * (i === 1 ? 1 : 0.84), i === 1 ? 1.2 : 1);
    }
  } else if (n === 4) {
    const w = (zone.w - gap) / 2; const h = (zone.h - gap) / 2;
    for (let i = 0; i < 4; i++) put(zone.x + (i % 2) * (w + gap), zone.y + Math.floor(i / 2) * (h + gap), w, h);
  } else if (n <= 8) {
    // collage: hero row of 2 larger + remaining in a tighter row(s)
    const heroH = zone.h * 0.55; const w2 = (zone.w - gap) / 2;
    put(zone.x, zone.y, w2, heroH, 1.2); put(zone.x + w2 + gap, zone.y, w2, heroH, 1.2);
    const rest = n - 2; const w3 = (zone.w - (rest - 1) * gap) / rest;
    for (let i = 0; i < rest; i++) put(zone.x + i * (w3 + gap), zone.y + heroH + gap, w3, zone.h - heroH - gap, 0.9);
  } else {
    // student cards, up to 12: 3 or 4 columns with name labels below
    const cols = n <= 9 ? 3 : 4; const rows = Math.ceil(n / cols);
    const w = (zone.w - (cols - 1) * gap) / cols;
    const h = (zone.h - (rows - 1) * gap) / rows;
    for (let i = 0; i < n; i++) {
      put(zone.x + (i % cols) * (w + gap), zone.y + Math.floor(i / cols) * (h + gap), w, h, 0.8, true);
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
