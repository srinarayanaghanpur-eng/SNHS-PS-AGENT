import { describe, expect, it } from 'vitest';
import { adaptiveThreshold, crop, encodeGrayBmp, estimateSkew, invert, resize, rotate, stretchContrast, type GrayImage } from './imaging';
import { buildVariants } from './preprocess';
import { connectedComponents, detectTextRegions, mergeBoxes } from './regionDetector';
import { iou, mergeCandidates } from './merge';

/** Synthetic white canvas with black filled rectangles ("text blobs"). */
function canvas(width: number, height: number, rects: [number, number, number, number][]): GrayImage {
  const data = new Uint8Array(width * height).fill(255);
  for (const [l, t, w, h] of rects)
    for (let y = t; y < t + h; y++) for (let x = l; x < l + w; x++) data[y * width + x] = 0;
  return { data, width, height };
}

describe('imaging primitives', () => {
  const img = canvas(64, 48, [[10, 10, 20, 8]]);
  it('invert flips values', () => {
    expect(invert(img).data[0]).toBe(0);
    expect(invert(img).data[10 * 64 + 10]).toBe(255);
  });
  it('resize preserves dimensions and content', () => {
    const r = resize(img, 128, 96);
    expect(r.width).toBe(128); expect(r.height).toBe(96);
    expect(r.data[24 * 128 + 30]).toBeLessThan(64); // inside scaled black rect
  });
  it('crop extracts the region', () => {
    const c = crop(img, 10, 10, 20, 8);
    expect(c.width).toBe(20); expect(c.height).toBe(8);
    expect(c.data.every(v => v === 0)).toBe(true);
  });
  it('adaptiveThreshold produces binary output', () => {
    const b = adaptiveThreshold(img);
    expect(new Set(b.data).size).toBeLessThanOrEqual(2);
  });
  it('stretchContrast expands dynamic range', () => {
    const flat: GrayImage = { data: new Uint8Array(100).map((_, i) => 100 + (i % 20)), width: 10, height: 10 };
    const s = stretchContrast(flat);
    expect(Math.max(...s.data) - Math.min(...s.data)).toBeGreaterThan(100);
  });
  it('rotate(0) is identity and rotate keeps size', () => {
    expect(rotate(img, 0)).toBe(img);
    const r = rotate(img, 5);
    expect(r.width).toBe(img.width); expect(r.height).toBe(img.height);
  });
  it('estimateSkew detects an obvious rotation direction', () => {
    const straight = canvas(200, 120, [[20, 30, 160, 6], [20, 60, 160, 6], [20, 90, 160, 6]]);
    expect(Math.abs(estimateSkew(straight))).toBeLessThanOrEqual(1);
  });
  it('encodeGrayBmp writes a valid header', () => {
    const bmp = encodeGrayBmp(img);
    expect(bmp[0]).toBe(0x42); expect(bmp[1]).toBe(0x4d);
    const dv = new DataView(bmp.buffer);
    expect(dv.getUint32(2, true)).toBe(bmp.length);
    expect(dv.getInt32(18, true)).toBe(64);
    expect(dv.getInt32(22, true)).toBe(48);
  });
});

describe('preprocess variants', () => {
  it('produces the mandated variant set', () => {
    const names = buildVariants(canvas(300, 200, [[40, 40, 100, 10]])).map(v => v.name);
    for (const n of ['original', 'upscaled', 'high-contrast', 'adaptive-threshold', 'sharpened', 'inverted'])
      expect(names).toContain(n);
  });
});

describe('regionDetector', () => {
  it('finds separate text blocks', () => {
    const img = canvas(400, 300, [
      [40, 40, 30, 14], [80, 40, 30, 14], [120, 40, 30, 14], // one line
      [40, 200, 90, 14]                                      // separate block
    ]);
    const regions = detectTextRegions(img);
    expect(regions.length).toBeGreaterThanOrEqual(2);
    expect(regions[0].top).toBeLessThan(regions[regions.length - 1].top); // reading order
  });
  it('connectedComponents ignores specks and giant blobs', () => {
    const img = canvas(200, 200, [[5, 5, 1, 1], [0, 50, 195, 120], [20, 10, 20, 10]]);
    const comps = connectedComponents(adaptiveThreshold(img));
    expect(comps.some(c => c.width === 20 && c.height === 10)).toBe(true);
    expect(comps.some(c => c.height >= 110)).toBe(false);
  });
  it('mergeBoxes unions near neighbours of similar height', () => {
    const merged = mergeBoxes([
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 12, top: 0, width: 10, height: 10 },
      { left: 100, top: 100, width: 10, height: 10 }
    ], 5, 3);
    expect(merged.length).toBe(2);
  });
});

describe('merge (confidence dedupe + reading order)', () => {
  const box = (text: string, confidence: number, left: number, top: number): any =>
    ({ text, confidence, left, top, width: 100, height: 20, source: 't' });
  it('iou is 1 for identical and 0 for disjoint boxes', () => {
    expect(iou(box('a', 1, 0, 0), box('b', 1, 0, 0))).toBe(1);
    expect(iou(box('a', 1, 0, 0), box('b', 1, 500, 500))).toBe(0);
  });
  it('keeps the highest-confidence duplicate', () => {
    const out = mergeCandidates([box('blurry', 40, 10, 10), box('SHARP', 90, 12, 11)]);
    expect(out.length).toBe(1);
    expect(out[0].text).toBe('SHARP');
  });
  it('sorts into reading order', () => {
    const out = mergeCandidates([box('second', 80, 0, 100), box('first', 80, 0, 0), box('first-right', 80, 200, 2)]);
    expect(out.map(o => o.text)).toEqual(['first', 'first-right', 'second']);
  });
  it('drops empty text', () => {
    expect(mergeCandidates([box('  ', 99, 0, 0)]).length).toBe(0);
  });
});
