import { describe, expect, it } from 'vitest';
import { clampRect, estimateInkColor, sampleSurroundings, surroundingVariance, type RGBAImage } from './rgba';
import { buildRepairRects } from './maskBuilder';
import { DesignCoverProvider, DiffusionInpaintingProvider, repairRect } from './inpainting';
import { estimateWidth, fitText, wrapText, MIN_READABLE_PX } from './textFitting';
import { fontScore, pickFont } from './fontMatching';
import type { DetectedRegion } from '../types';

function solid(width: number, height: number, [r, g, b]: [number, number, number]): RGBAImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  return { data, width, height };
}
function paint(img: RGBAImage, l: number, t: number, w: number, h: number, [r, g, b]: [number, number, number]) {
  for (let y = t; y < t + h; y++) for (let x = l; x < l + w; x++) {
    const i = (y * img.width + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
  }
}
const region = (id: string, left: number, top: number, width: number, height: number, replace = true): DetectedRegion => ({
  id, kind: 'text', bounds: { left, top, right: left + width, bottom: top + height, width, height }, confidence: 80, replace
});

describe('rgba helpers', () => {
  const img = solid(100, 100, [200, 200, 200]);
  paint(img, 40, 40, 20, 10, [10, 10, 10]); // dark "text"
  it('sampleSurroundings reads the ring, not the region', () => {
    const [r] = sampleSurroundings(img, { left: 40, top: 40, width: 20, height: 10 });
    expect(r).toBeGreaterThan(150);
  });
  it('estimateInkColor finds the dark ink', () => {
    const [r, g, b] = estimateInkColor(img, { left: 40, top: 40, width: 20, height: 10 });
    expect((r + g + b) / 3).toBeLessThan(100);
  });
  it('surroundingVariance is 0 on flat background', () => {
    expect(surroundingVariance(img, { left: 40, top: 40, width: 20, height: 10 })).toBe(0);
  });
  it('clampRect keeps rects inside', () => {
    const r = clampRect({ left: -10, top: 90, width: 200, height: 50 }, 100, 100);
    expect(r.left).toBe(0); expect(r.top + r.height).toBeLessThanOrEqual(100);
  });
});

describe('maskBuilder', () => {
  it('pads and merges overlapping replace-regions, skips keep-regions', () => {
    const rects = buildRepairRects([
      region('a', 10, 10, 40, 10),
      region('b', 45, 12, 40, 10),        // overlaps a after padding
      region('c', 10, 80, 40, 10, false)  // keep — excluded
    ], 200, 200);
    expect(rects.length).toBe(1);
    expect(rects[0].left).toBeLessThanOrEqual(10);
  });
});

describe('inpainting providers', () => {
  it('diffusion erases text on a flat background', () => {
    const img = solid(120, 60, [220, 210, 200]);
    paint(img, 30, 20, 50, 12, [0, 0, 0]);
    const out = new DiffusionInpaintingProvider().inpaint(img, { left: 28, top: 18, width: 54, height: 16 });
    expect(out.ok).toBe(true);
    const i = (26 * 120 + 55) * 4; // centre of former text
    expect(img.data[i]).toBeGreaterThan(180);
  });
  it('diffusion declines huge/complex regions; design cover never declines', () => {
    const img = solid(1200, 800, [128, 128, 128]);
    const big = { left: 10, top: 10, width: 900, height: 400 };
    expect(new DiffusionInpaintingProvider().suitable(img, big)).toBe(false);
    expect(new DesignCoverProvider().suitable()).toBe(true);
    expect(repairRect(img, big).ok).toBe(true); // falls through to cover
  });
  it('design cover blends a vertical gradient from surroundings', () => {
    const img = solid(100, 100, [50, 50, 50]);
    paint(img, 0, 50, 100, 50, [200, 200, 200]); // bottom half light
    paint(img, 20, 40, 60, 20, [255, 0, 0]);     // red logo across the seam
    new DesignCoverProvider().inpaint(img, { left: 20, top: 40, width: 60, height: 20 });
    const topI = (41 * 100 + 50) * 4, botI = (58 * 100 + 50) * 4;
    expect(img.data[topI]).toBeLessThan(img.data[botI]); // gradient dark→light
    expect(img.data[topI + 1]).toBeGreaterThan(20);      // red is gone
  });
});

describe('textFitting', () => {
  it('fits the long name into a wide box at a readable size', () => {
    const fit = fitText('SRI NARAYANA HIGH SCHOOL', { width: 800, height: 90, maxLines: 2 });
    expect(fit.fits).toBe(true);
    expect(fit.fontSize).toBeGreaterThanOrEqual(MIN_READABLE_PX);
    expect(fit.lines.length).toBeLessThanOrEqual(2);
  });
  it('wraps rather than overflowing in a narrow box', () => {
    const fit = fitText('SRI NARAYANA HIGH SCHOOL', { width: 220, height: 120, maxLines: 3 });
    expect(fit.fits).toBe(true);
    expect(fit.lines.length).toBeGreaterThan(1);
    for (const line of fit.lines) expect(estimateWidth(line, fit.fontSize, fit.tracking)).toBeLessThanOrEqual(220);
  });
  it('flags impossible fits instead of silently overflowing', () => {
    const fit = fitText('EXTRAORDINARILY LONG UNBREAKABLE-WORD-THAT-CANNOT-FIT', { width: 40, height: 14, maxLines: 1 });
    expect(fit.fits).toBe(false);
  });
  it('wrapText returns undefined when a word cannot fit', () => {
    expect(wrapText('Supercalifragilistic', 40, 100)).toBeUndefined();
  });
  it('Telugu text is measured wider than Latin', () => {
    expect(estimateWidth('పాఠశాల', 20)).toBeGreaterThan(estimateWidth('school', 20));
  });
});

describe('fontMatching', () => {
  const installed = [
    { name: 'Arial', postScriptName: 'ArialMT', family: 'Arial', style: 'Regular' },
    { name: 'Montserrat', postScriptName: 'Montserrat-Regular', family: 'Montserrat', style: 'Regular' },
    { name: 'Nirmala UI', postScriptName: 'NirmalaUI', family: 'Nirmala UI', style: 'Regular' }
  ];
  it('exact preference wins', () => {
    expect(pickFont(installed, ['Montserrat']).family).toBe('Montserrat');
  });
  it('telugu need selects a telugu-capable font', () => {
    expect(pickFont(installed, ['Montserrat'], { telugu: true }).family).toBe('Nirmala UI');
  });
  it('falls back to category, then hard default on empty list', () => {
    expect(pickFont(installed, ['NonexistentFont']).family).toBe('Arial');
    expect(pickFont([], ['Whatever']).postScriptName).toBe('ArialMT');
  });
  it('fontScore ranks exact > prefix > substring', () => {
    expect(fontScore('Arial', 'Arial')).toBeGreaterThan(fontScore('Arial', 'Arial Black'));
    expect(fontScore('Arial', 'Arial Black')).toBeGreaterThan(fontScore('Arial', 'Times'));
  });
});
