import { describe, it, expect } from 'vitest';
import { getTextRegionForRole } from '../src/layout/layoutHelpers';

describe('text region presets', () => {
  it('headline region allows 2 lines at large font', () => {
    const region = getTextRegionForRole('poster_title', 1080, 1080);
    expect(region.maxLines).toBe(2);
    expect(region.minFontSize).toBe(18);
    expect(region.maxFontSize).toBe(120);
    expect(region.alignment).toBe('center');
  });

  it('address region allows 2 lines at smaller font', () => {
    const region = getTextRegionForRole('school_address', 1080, 1080);
    expect(region.maxLines).toBe(2);
    expect(region.minFontSize).toBe(8);
    expect(region.maxFontSize).toBe(24);
  });

  it('footer region allows 2 lines', () => {
    const region = getTextRegionForRole('footer', 1080, 1080);
    expect(region.maxLines).toBe(2);
    expect(region.minFontSize).toBe(8);
  });

  it('date region is single line', () => {
    const region = getTextRegionForRole('event_date', 1080, 1080);
    expect(region.maxLines).toBe(1);
  });

  it('features region allows 3 lines', () => {
    const region = getTextRegionForRole('features', 1080, 1080);
    expect(region.maxLines).toBe(3);
  });

  it('school name region is single line left-aligned', () => {
    const region = getTextRegionForRole('school_name', 1080, 1080);
    expect(region.maxLines).toBe(1);
    expect(region.alignment).toBe('left');
  });

  it('section region overrides base dimensions', () => {
    const sectionRegion = { x: 50, y: 50, width: 900, height: 150 };
    const region = getTextRegionForRole('poster_title', 1080, 1080, sectionRegion);
    expect(region.x).toBeGreaterThanOrEqual(sectionRegion.x);
    expect(region.y).toBeGreaterThanOrEqual(sectionRegion.y);
    expect(region.width).toBeLessThan(sectionRegion.width);
    expect(region.height).toBeLessThan(sectionRegion.height);
  });
});
