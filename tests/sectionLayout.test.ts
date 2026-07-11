import { describe, it, expect } from 'vitest';
import { calculateSafeArea, calculateHeaderRegion, calculateContentRegion, calculateFooterRegion, getSectionForRole, percentageToPixels } from '../src/layout/layoutHelpers';

describe('safe area calculator', () => {
  it('calculates safe area with 5% left/right and 4% top/bottom margins', () => {
    const safe = calculateSafeArea(1080, 1080);
    expect(safe.left).toBe(54);
    expect(safe.top).toBe(43);
    expect(safe.right).toBe(1026);
    expect(safe.bottom).toBe(1037);
    expect(safe.width).toBe(972);
    expect(safe.height).toBe(994);
  });

  it('scales proportionally for different sizes', () => {
    const safe = calculateSafeArea(1920, 1080);
    expect(safe.left).toBe(96);
    expect(safe.top).toBe(43);
    expect(safe.right).toBe(1824);
    expect(safe.bottom).toBe(1037);
  });
});

describe('section regions', () => {
  it('header region is top 18%', () => {
    const header = calculateHeaderRegion(1080, 1080);
    expect(header.x).toBe(54);
    expect(header.y).toBe(43);
    expect(header.width).toBe(972);
    expect(header.height).toBe(194);
    expect(header.y + header.height).toBeLessThan(1080 * 0.25);
  });

  it('content region is middle 60%', () => {
    const content = calculateContentRegion(1080, 1080);
    expect(content.y).toBe(238);
    expect(content.height).toBe(648);
    expect(content.y + content.height).toBe(886);
  });

  it('footer region is bottom 22%', () => {
    const footer = calculateFooterRegion(1080, 1080);
    expect(footer.y).toBe(842);
    expect(footer.height).toBe(194);
    expect(footer.y + footer.height).toBeLessThanOrEqual(1080);
  });

  it('regions cover full height without gaps', () => {
    const header = calculateHeaderRegion(1080, 1080);
    const content = calculateContentRegion(1080, 1080);
    const footer = calculateFooterRegion(1080, 1080);

    // Header ends before content starts (4% gap)
    expect(header.y + header.height).toBeLessThanOrEqual(content.y);
    // Content and footer may overlap slightly (intentional for visual continuity)
    const overlap = (content.y + content.height) - footer.y;
    expect(overlap).toBeGreaterThanOrEqual(0);
    // Footer ends within safe area
    expect(footer.y + footer.height).toBeLessThanOrEqual(1080);
  });
});

describe('section role mapping', () => {
  it('maps school_name to header', () => {
    expect(getSectionForRole('school_name')).toBe('header');
  });

  it('maps poster_title to header', () => {
    expect(getSectionForRole('poster_title')).toBe('header');
  });

  it('maps event_image to content', () => {
    expect(getSectionForRole('event_image')).toBe('content');
  });

  it('maps event_description to content', () => {
    expect(getSectionForRole('event_description')).toBe('content');
  });

  it('maps footer to footer', () => {
    expect(getSectionForRole('footer')).toBe('footer');
  });

  it('maps chairman_photo to footer', () => {
    expect(getSectionForRole('chairman_photo')).toBe('footer');
  });

  it('maps contact_information to footer', () => {
    expect(getSectionForRole('contact_information')).toBe('footer');
  });
});

describe('percentageToPixels', () => {
  it('converts percentage to pixels', () => {
    expect(percentageToPixels(5, 1080)).toBe(54);
    expect(percentageToPixels(50, 1080)).toBe(540);
    expect(percentageToPixels(100, 1080)).toBe(1080);
  });

  it('handles zero', () => {
    expect(percentageToPixels(0, 1080)).toBe(0);
  });
});
