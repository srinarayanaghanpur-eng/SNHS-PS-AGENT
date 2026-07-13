import { describe, it, expect } from 'vitest';
import { detectLayoutCollisions } from '../src/layout/collisionDetector';
import { layer } from './helpers';
import type { ClassifiedLayer } from '../src/types';

function classifiedLayer(overrides: Partial<ClassifiedLayer>): ClassifiedLayer {
  return {
    ...layer(overrides),
    semanticRole: overrides.semanticRole ?? 'unknown',
    confidence: overrides.confidence ?? 80,
    reasons: overrides.reasons ?? [],
    optional: overrides.optional ?? false,
    repeatable: overrides.repeatable ?? false,
  };
}

describe('collision detection', () => {
  it('detects headline overlapping school name', () => {
    const headline = classifiedLayer({
      layerId: 1, name: 'Headline', path: 'Headline',
      semanticRole: 'poster_title', type: 'text',
      bounds: { left: 100, top: 100, right: 900, bottom: 200, width: 800, height: 100 },
      boundsNoEffects: { left: 100, top: 100, right: 900, bottom: 200, width: 800, height: 100 },
    });
    const schoolName = classifiedLayer({
      layerId: 2, name: 'SchoolName', path: 'SchoolName',
      semanticRole: 'school_name', type: 'text',
      bounds: { left: 200, top: 80, right: 600, bottom: 130, width: 400, height: 50 },
      boundsNoEffects: { left: 200, top: 80, right: 600, bottom: 130, width: 400, height: 50 },
    });

    const issues = detectLayoutCollisions([headline, schoolName], 1080, 1080);
    expect(issues.some(i => i.code === 'HEADLINE_OVER_SCHOOL_NAME')).toBe(true);
  });

  it('headline overlapping powered_by_lead', () => {
    const headline = classifiedLayer({
      layerId: 1, semanticRole: 'poster_title', type: 'text',
      bounds: { left: 100, top: 100, right: 900, bottom: 200, width: 800, height: 100 },
      boundsNoEffects: { left: 100, top: 100, right: 900, bottom: 200, width: 800, height: 100 },
    });
    const lead = classifiedLayer({
      layerId: 2, semanticRole: 'powered_by_lead', type: 'text',
      bounds: { left: 300, top: 150, right: 500, bottom: 180, width: 200, height: 30 },
      boundsNoEffects: { left: 300, top: 150, right: 500, bottom: 180, width: 200, height: 30 },
    });

    const issues = detectLayoutCollisions([headline, lead], 1080, 1080);
    expect(issues.some(i => i.code === 'HEADLINE_OVER_POWERED_BY_LEAD')).toBe(true);
  });

  it('ignores decorative elements', () => {
    const headline = classifiedLayer({
      layerId: 1, semanticRole: 'poster_title', type: 'text',
      bounds: { left: 100, top: 100, right: 900, bottom: 200, width: 800, height: 100 },
      boundsNoEffects: { left: 100, top: 100, right: 900, bottom: 200, width: 800, height: 100 },
    });
    const decoration = classifiedLayer({
      layerId: 2, semanticRole: 'decorative_element', type: 'shape',
      bounds: { left: 200, top: 80, right: 600, bottom: 130, width: 400, height: 50 },
      boundsNoEffects: { left: 200, top: 80, right: 600, bottom: 130, width: 400, height: 50 },
    });

    const issues = detectLayoutCollisions([headline, decoration], 1080, 1080);
    const headlineIssues = issues.filter(i => i.code.startsWith('HEADLINE'));
    expect(headlineIssues.length).toBe(0);
  });

  it('detects duplicated non-repeatable roles', () => {
    const layers = [
      classifiedLayer({ layerId: 1, semanticRole: 'school_name', type: 'text', name: 'Name1', path: 'Name1', confidence: 90, bounds: { left: 10, top: 10, right: 200, bottom: 50, width: 190, height: 40 }, boundsNoEffects: { left: 10, top: 10, right: 200, bottom: 50, width: 190, height: 40 } }),
      classifiedLayer({ layerId: 2, semanticRole: 'school_name', type: 'text', name: 'Name2', path: 'Name2', confidence: 70, bounds: { left: 10, top: 60, right: 200, bottom: 100, width: 190, height: 40 }, boundsNoEffects: { left: 10, top: 60, right: 200, bottom: 100, width: 190, height: 40 } }),
    ];

    const issues = detectLayoutCollisions(layers, 1080, 1080);
    expect(issues.some(i => i.code === 'DUPLICATE_ROLE')).toBe(true);
  });

  it('detects outside canvas', () => {
    const layer = classifiedLayer({
      layerId: 1, semanticRole: 'poster_title', type: 'text',
      bounds: { left: -50, top: 100, right: 900, bottom: 200, width: 950, height: 100 },
      boundsNoEffects: { left: -50, top: 100, right: 900, bottom: 200, width: 950, height: 100 },
    });

    const issues = detectLayoutCollisions([layer], 1080, 1080);
    expect(issues.some(i => i.code === 'OUTSIDE_CANVAS')).toBe(true);
  });

  it('detects footer text over portrait', () => {
    const portrait = classifiedLayer({
      layerId: 1, semanticRole: 'chairman_photo', type: 'pixel',
      bounds: { left: 100, top: 800, right: 250, bottom: 950, width: 150, height: 150 },
      boundsNoEffects: { left: 100, top: 800, right: 250, bottom: 950, width: 150, height: 150 },
    });
    const text = classifiedLayer({
      layerId: 2, semanticRole: 'footer', type: 'text',
      bounds: { left: 100, top: 900, right: 600, bottom: 950, width: 500, height: 50 },
      boundsNoEffects: { left: 100, top: 900, right: 600, bottom: 950, width: 500, height: 50 },
    });

    const issues = detectLayoutCollisions([portrait, text], 1080, 1080);
    expect(issues.some(i => i.code === 'FOOTER_TEXT_OVER_PORTRAIT')).toBe(true);
  });
});
