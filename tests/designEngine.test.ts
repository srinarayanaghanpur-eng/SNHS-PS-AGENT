import { describe, expect, it } from 'vitest';
import { composePoster } from '../src-v2/main/design/composer';
import { validateAndFix } from '../src-v2/main/design/quality';
import { photoLayout, contrastRatio } from '../src-v2/main/design/layout';
import { fitText } from '../src-v2/main/design/textFit';
import { emitJsx } from '../src-v2/main/design/jsxEmitter';
import { PRESETS } from '../src-v2/main/design/presets';
import { DEFAULT_SCHOOL, type ComposeInput } from '../src-v2/main/design/types';
import type { Plan } from '../src-v2/main/design/types';
import { DAILY_PRAYER_FAMILIES } from '../src-v2/main/design/dailyPrayerFamilies';

const baseInput = (overrides: Partial<ComposeInput> = {}): ComposeInput => ({
  category: 'prayer', headline: 'Prayer Proceedings', subheadline: 'A meaningful start',
  message: 'Students gathered for prayer and reflection.', details: '11/07/2026',
  photos: [], school: DEFAULT_SCHOOL, width: 1080, height: 1350, variationSeed: 0,
  ...overrides,
});
const prayerPlan = (overrides: Partial<ComposeInput> = {}): Plan => composePoster(baseInput(overrides)) as Plan;

describe('design engine', () => {
  it('has 12 presets with complete design directions', () => {
    expect(PRESETS).toHaveLength(12);
    for (const p of PRESETS) {
      expect(p.decorations.length).toBeGreaterThan(0);
      expect(p.palette.accent).toMatch(/^[0-9A-F]{6}$/i);
    }
  });

  it('composes the required editable Daily Prayer layer structure', () => {
    const plan = prayerPlan();
    expect(plan.groups.map((group) => group.name)).toEqual([
      '00_BACKGROUND_AND_HERO', '01_DEPTH_AND_SHAPES', '02_SCHOOL_BRANDING',
      '03_EDITORIAL_TITLE', '04_MORNING_PROGRAMME', '05_PRAYER_MESSAGE', '06_CONTACT_AND_LEAD',
    ]);
    expect(plan.groups[0].nodes.length).toBeGreaterThan(0);
    expect(plan.metadata?.legacyRendererUsed).toBe(false);
  });

  it('provides six structurally distinct Daily Prayer composition families', () => {
    expect(DAILY_PRAYER_FAMILIES).toHaveLength(6);
    const photo = { path: 'C:/tmp/assembly.jpg' };
    const signatures = DAILY_PRAYER_FAMILIES.map((family) => {
      const assets = family === 'premiumEmblematicAssembly' ? {} : { assemblyPhoto: photo };
      const plan = prayerPlan({ requestedCompositionFamily: family, assets });
      return JSON.stringify(plan.groups.map((g) => g.nodes.map((n) => [n.name, n.kind, 'rect' in n ? n.rect : null])));
    });
    expect(new Set(signatures).size).toBe(6);
  });

  it('selects families from valid asset roles without a legacy fallback', () => {
    const assembly = prayerPlan({ assets: { assemblyPhoto: { path: 'C:/tmp/assembly.jpg' } } });
    const student = prayerPlan({ assets: { studentPhoto: { path: 'C:/tmp/student.jpg' } } });
    const noPhoto = prayerPlan();
    expect(assembly.metadata?.compositionFamily).toBe('fullBleedAssemblyEditorial');
    expect(student.metadata?.compositionFamily).toBe('asymmetricStudentHero');
    expect(noPhoto.metadata?.compositionFamily).toBe('premiumEmblematicAssembly');
    expect([assembly, student, noPhoto].every((plan) => !plan.groups.some((g) => g.nodes.some((n) => n.name === 'CONTENT_PANEL' || n.name.startsWith('PROGRAMME_ROW'))))).toBe(true);
  });

  it('adapts photo layouts from hero to card grid', () => {
    const zone = { x: 0, y: 0, w: 900, h: 600 };
    expect(photoLayout(1, zone, 20)).toHaveLength(1);
    expect(photoLayout(4, zone, 20)).toHaveLength(4);
    expect(photoLayout(7, zone, 20)).toHaveLength(7);
    const cards = photoLayout(12, zone, 20);
    expect(cards).toHaveLength(12);
    expect(cards[0].labelBelow).toBe(true);
  });

  it('quality validation scores a sane plan above 60 and flags empty text', () => {
    const plan = prayerPlan();
    const report = validateAndFix(plan);
    expect(report.score).toBeGreaterThan(60);
    expect(report.warnings.filter((w) => w.code === 'EMPTY_TEXT')).toHaveLength(0);
  });

  it('shrinks oversized text to fit its box', () => {
    const fit = fitText('An extremely long headline that will never fit at full size', { w: 300, h: 80 }, 60, 20, 2, 'Arial-Black');
    expect(fit.size).toBeLessThan(60);
  });

  it('contrast math matches WCAG expectations', () => {
    expect(contrastRatio('FFFFFF', '000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('FFFFFF', 'FFFFFF')).toBeCloseTo(1, 1);
  });

  it('emits balanced, parse-safe JSX with editable groups', () => {
    const plan = prayerPlan({ photos: [{ path: 'C:/tmp/a.jpg', name: 'Ravi' }] });
    const jsx = emitJsx(plan, { outputDir: 'C:/tmp/out', exportPng: true, exportJpg: true, docName: 'TEST' });
    expect(jsx).toContain('00_BACKGROUND_AND_HERO');
    expect(jsx).toContain('placeFile');
    expect(jsx).toContain('gradientLayer');
    expect((jsx.match(/\{/g) ?? []).length).toBe((jsx.match(/\}/g) ?? []).length);
    expect((jsx.match(/\(/g) ?? []).length).toBe((jsx.match(/\)/g) ?? []).length);
  });
});
