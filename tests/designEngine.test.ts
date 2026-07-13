import { describe, expect, it } from 'vitest';
import { composePoster } from '../src-v2/main/design/composer';
import { validateAndFix } from '../src-v2/main/design/quality';
import { photoLayout, contrastRatio } from '../src-v2/main/design/layout';
import { fitText } from '../src-v2/main/design/textFit';
import { emitJsx } from '../src-v2/main/design/jsxEmitter';
import { PRESETS } from '../src-v2/main/design/presets';
import { DEFAULT_SCHOOL, type ComposeInput } from '../src-v2/main/design/types';

const baseInput = (overrides: Partial<ComposeInput> = {}): ComposeInput => ({
  category: 'prayer', headline: 'Prayer Proceedings', subheadline: 'A meaningful start',
  message: 'Students gathered for prayer and reflection.', details: '11/07/2026',
  photos: [], school: DEFAULT_SCHOOL, width: 1080, height: 1350, variationSeed: 0,
  ...overrides,
});

describe('design engine', () => {
  it('has 12 presets with complete design directions', () => {
    expect(PRESETS).toHaveLength(12);
    for (const p of PRESETS) {
      expect(p.decorations.length).toBeGreaterThan(0);
      expect(p.palette.accent).toMatch(/^[0-9A-F]{6}$/i);
    }
  });

  it('composes the required editable Daily Prayer layer structure', () => {
    const plan = composePoster(baseInput());
    expect(plan.groups.map((group) => group.name)).toEqual([
      '00_BACKGROUND', '01_DECORATIONS', '02_SCHOOL_HEADER', '03_TITLE_AND_DATE',
      '04_MANAGEMENT_PHOTOS', '05_STUDENT_PHOTOS', '06_PROGRAMME', '07_MESSAGE',
      '08_FOOTER', '09_EFFECTS',
    ]);
    expect(plan.groups[0].nodes.length).toBeGreaterThan(0);
  });

  it('prioritises birthday students when birthdays are present', () => {
    const plan = composePoster(baseInput({
      prayer: { birthdays: [{ name: 'Anu', className: '7B' }], thought: 'Kindness wins.' },
    }));
    const messages = plan.groups.find((group) => group.name === '07_MESSAGE')!;
    const birthdayTitle = messages.nodes.find((node) => node.kind === 'text' && node.content.includes('BIRTHDAY'));
    expect(birthdayTitle && birthdayTitle.kind === 'text' ? birthdayTitle.content : '').toContain('BIRTHDAY');
  });

  it('produces genuinely different compositions per variation seed', () => {
    const a = JSON.stringify(composePoster(baseInput({ variationSeed: 0 })).groups.map((g) => g.nodes.map((n) => [n.name, n.kind, (n as any).rect])));
    const b = JSON.stringify(composePoster(baseInput({ variationSeed: 1 })).groups.map((g) => g.nodes.map((n) => [n.name, n.kind, (n as any).rect])));
    expect(a).not.toEqual(b);
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
    const plan = composePoster(baseInput());
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
    const plan = composePoster(baseInput({ photos: [{ path: 'C:/tmp/a.jpg', name: 'Ravi' }] }));
    const jsx = emitJsx(plan, { outputDir: 'C:/tmp/out', exportPng: true, exportJpg: true, docName: 'TEST' });
    expect(jsx).toContain('00_BACKGROUND');
    expect(jsx).toContain('placeFile');
    expect(jsx).toContain('gradientLayer');
    expect((jsx.match(/\{/g) ?? []).length).toBe((jsx.match(/\}/g) ?? []).length);
    expect((jsx.match(/\(/g) ?? []).length).toBe((jsx.match(/\)/g) ?? []).length);
  });
});
