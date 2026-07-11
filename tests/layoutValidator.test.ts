import { describe, it, expect, beforeAll } from 'vitest';
import { validatePosterLayout } from '../src/layout/layoutValidator';
import { layer } from './helpers';
import type { ClassifiedLayer, TemplateManifest, PosterData } from '../src/types';

function classifiedLayer(overrides: Partial<ClassifiedLayer>): ClassifiedLayer {
  return {
    ...layer(overrides),
    semanticRole: overrides.semanticRole ?? 'unknown',
    confidence: overrides.confidence ?? 90,
    reasons: overrides.reasons ?? [],
    optional: overrides.optional ?? false,
    repeatable: overrides.repeatable ?? false,
  };
}

const mockManifest: TemplateManifest = {
  schemaVersion: 1,
  templateId: 'test-1',
  templateName: 'Test Template',
  sourceFilename: 'test.psd',
  documentWidth: 1080,
  documentHeight: 1080,
  resolution: 72,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  fingerprint: 'test-fp',
  layers: [],
  hierarchy: [],
  reviewLayerIds: [],
  tagged: false,
};

function mockData(extra?: Partial<PosterData>): PosterData {
  return {
    mode: 'prayer',
    values: {
      poster_title: 'PRAYER PROCEEDINGS',
      event_name: 'Prayer',
      school_name: 'Sri Narayana High School',
      ...extra?.values,
    },
    students: extra?.students ?? [],
    files: extra?.files ?? {},
    exportFormats: extra?.exportFormats ?? ['png'],
  };
}

describe('layout validator', () => {
  it('passes a valid poster layout with score >= 75', async () => {
    const layers: ClassifiedLayer[] = [
      classifiedLayer({
        layerId: 1, semanticRole: 'school_logo', type: 'pixel', visible: true,
        bounds: { left: 54, top: 43, right: 154, bottom: 143, width: 100, height: 100 },
        boundsNoEffects: { left: 54, top: 43, right: 154, bottom: 143, width: 100, height: 100 },
      }),
      classifiedLayer({
        layerId: 2, semanticRole: 'school_name', type: 'text', visible: true,
        bounds: { left: 170, top: 50, right: 600, bottom: 90, width: 430, height: 40 },
        boundsNoEffects: { left: 170, top: 50, right: 600, bottom: 90, width: 430, height: 40 },
      }),
      classifiedLayer({
        layerId: 3, semanticRole: 'poster_title', type: 'text', visible: true,
        bounds: { left: 100, top: 200, right: 980, bottom: 280, width: 880, height: 80 },
        boundsNoEffects: { left: 100, top: 200, right: 980, bottom: 280, width: 880, height: 80 },
        text: { contents: 'PRAYER PROCEEDINGS', size: 48 },
      }),
      classifiedLayer({
        layerId: 4, semanticRole: 'footer', type: 'text', visible: true,
        bounds: { left: 200, top: 1000, right: 880, bottom: 1030, width: 680, height: 30 },
        boundsNoEffects: { left: 200, top: 1000, right: 880, bottom: 1030, width: 680, height: 30 },
        text: { contents: 'Footer text', size: 12 },
      }),
    ];

    const result = await validatePosterLayout(1080, 1080, layers, mockManifest, mockData());
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('flags missing required poster_title content', async () => {
    const layers: ClassifiedLayer[] = [
      classifiedLayer({
        layerId: 1, semanticRole: 'poster_title', type: 'text', visible: true,
        bounds: { left: 100, top: 200, right: 980, bottom: 280, width: 880, height: 80 },
        boundsNoEffects: { left: 100, top: 200, right: 980, bottom: 280, width: 880, height: 80 },
      }),
    ];

    const data = mockData({ values: { poster_title: '', event_name: '', school_name: '' } });
    const result = await validatePosterLayout(1080, 1080, layers, mockManifest, data);
    expect(result.issues.some(i => i.code === 'MISSING_INPUT')).toBe(true);
  });

  it('flags layers outside canvas as critical', async () => {
    const layers: ClassifiedLayer[] = [
      classifiedLayer({
        layerId: 1, semanticRole: 'poster_title', type: 'text', visible: true,
        bounds: { left: -100, top: 200, right: 980, bottom: 280, width: 1080, height: 80 },
        boundsNoEffects: { left: -100, top: 200, right: 980, bottom: 280, width: 1080, height: 80 },
      }),
    ];

    const result = await validatePosterLayout(1080, 1080, layers, mockManifest, mockData());
    expect(result.issues.some(i => i.code === 'OUTSIDE_CANVAS' && i.severity === 'critical')).toBe(true);
  });

  it('detects small text', async () => {
    const layers: ClassifiedLayer[] = [
      classifiedLayer({
        layerId: 1, semanticRole: 'poster_title', type: 'text', visible: true,
        bounds: { left: 100, top: 200, right: 980, bottom: 280, width: 880, height: 80 },
        boundsNoEffects: { left: 100, top: 200, right: 980, bottom: 280, width: 880, height: 80 },
        text: { contents: 'Small', size: 8 },
      }),
    ];

    const result = await validatePosterLayout(1080, 1080, layers, mockManifest, mockData());
    expect(result.issues.some(i => i.code === 'SMALL_TEXT')).toBe(true);
  });

  it('detects hidden required layers', async () => {
    const layers: ClassifiedLayer[] = [
      classifiedLayer({
        layerId: 1, semanticRole: 'school_logo', type: 'pixel', visible: false,
        bounds: { left: 54, top: 43, right: 154, bottom: 143, width: 100, height: 100 },
        boundsNoEffects: { left: 54, top: 43, right: 154, bottom: 143, width: 100, height: 100 },
      }),
      classifiedLayer({
        layerId: 2, semanticRole: 'school_name', type: 'text', visible: true,
        bounds: { left: 170, top: 50, right: 600, bottom: 90, width: 430, height: 40 },
        boundsNoEffects: { left: 170, top: 50, right: 600, bottom: 90, width: 430, height: 40 },
      }),
      classifiedLayer({
        layerId: 3, semanticRole: 'poster_title', type: 'text', visible: true,
        bounds: { left: 100, top: 200, right: 980, bottom: 280, width: 880, height: 80 },
        boundsNoEffects: { left: 100, top: 200, right: 980, bottom: 280, width: 880, height: 80 },
      }),
    ];

    const result = await validatePosterLayout(1080, 1080, layers, mockManifest, mockData());
    expect(result.issues.some(i => i.code === 'HIDDEN_REQUIRED')).toBe(true);
  });

  it('returns valid=false when critical issues exist', async () => {
    const layers: ClassifiedLayer[] = [
      classifiedLayer({
        layerId: 1, semanticRole: 'poster_title', type: 'text', visible: true,
        bounds: { left: -200, top: 200, right: 980, bottom: 280, width: 1180, height: 80 },
        boundsNoEffects: { left: -200, top: 200, right: 980, bottom: 280, width: 1180, height: 80 },
      }),
    ];

    const result = await validatePosterLayout(1080, 1080, layers, mockManifest, mockData());
    expect(result.valid).toBe(false);
    expect(result.criticalIssueCount).toBeGreaterThan(0);
  });
});
