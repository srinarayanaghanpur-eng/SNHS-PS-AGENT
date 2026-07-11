import { describe, expect, it } from 'vitest';
import { buildBrandingPlan } from './brandingPlan';
import { runQualityControl, type PlacedElement } from './qualityControl';
import type { DetectedRegion, ReferenceProject, SchoolProfile } from '../types';

const profile: SchoolProfile = {
  schemaVersion: 1, schoolName: 'SRI NARAYANA HIGH SCHOOL', shortName: 'SNHS',
  location: 'Ghanpur (M), Jayashankar Bhupalpally District', phone: '6300038389', altPhones: [],
  email: '', website: '', academicYear: '2026-27', groupName: 'Adarshavani Group of Schools',
  branchName: '', curriculum: 'Powered by LEAD', brandColors: [], preferredFonts: ['Arial'],
  footerStyle: 'brand-band', preferredLanguages: ['English', 'Telugu'],
  socialMedia: {}, media: { logo: ['logo.png'] }, updatedAt: ''
};

const region = (id: string, role: any, text: string, replace: boolean, left: number, top: number, width: number, height: number): DetectedRegion =>
  ({ id, kind: 'text', bounds: { left, top, right: left + width, bottom: top + height, width, height }, text, confidence: 80, semanticRole: role, replace });

const project = (regions: DetectedRegion[]): ReferenceProject => ({
  schemaVersion: 1, projectId: 'p1', name: 'test', createdAt: '', updatedAt: '',
  status: 'analyzed', mode: 'pending', overallConfidence: 80,
  reference: { originalFileName: 'x.jpg', storedFileName: 'reference.jpg', ext: 'jpg', bytes: 1, contentHash: '', sha256: '', width: 1000, height: 1400, resolution: 300 },
  profileSnapshot: profile, regions, replacementDecisions: {}, exports: [], failedElements: []
});

describe('buildBrandingPlan', () => {
  it('replaces the old school name in place with a grown box', () => {
    const p = project([region('r1', 'school_name', 'SUNSHINE HIGH SCHOOL', true, 200, 50, 600, 80)]);
    const plan = buildBrandingPlan(p);
    const name = plan.texts.find(t => t.name === 'School Name')!;
    expect(name.sourceRegionId).toBe('r1');
    expect(name.text).toBe('SRI NARAYANA HIGH SCHOOL');
    expect(name.box.width).toBeGreaterThan(600); // grown for the longer name
    expect(name.box.left + name.box.width).toBeLessThanOrEqual(1000);
    expect(name.fit.fits).toBe(true);
  });
  it('replaces phone in place and keeps generic text untouched', () => {
    const p = project([
      region('r1', 'school_phone', 'Call 9848098480', true, 100, 1300, 300, 30),
      region('r2', 'unknown', 'ADMISSIONS OPEN', false, 100, 600, 400, 60)
    ]);
    const plan = buildBrandingPlan(p);
    expect(plan.texts.find(t => t.name === 'Phone Number')!.text).toContain('6300038389');
    expect(plan.texts.some(t => t.text.includes('ADMISSIONS'))).toBe(false);
  });
  it('adds missing identity to the footer and plans the logo', () => {
    const p = project([]);
    const plan = buildBrandingPlan(p);
    const names = plan.texts.map(t => t.name);
    expect(names).toContain('School Name');
    expect(names).toContain('Phone Number');
    expect(names).toContain('Curriculum Branding');
    expect(plan.images.some(i => i.name === 'School Logo')).toBe(true);
    for (const t of plan.texts) expect(t.box.top + t.box.height).toBeLessThanOrEqual(1400);
  });
  it('logo replaces a detected logo region in place', () => {
    const p = project([{ ...region('lg', 'school_logo', '', true, 30, 30, 140, 140), kind: 'logo' }]);
    const plan = buildBrandingPlan(p);
    expect(plan.images[0].box.left).toBe(30);
    expect(plan.images[0].box.width).toBe(140);
  });
});

describe('runQualityControl', () => {
  const covered = [region('r1', 'school_name', 'OLD SCHOOL', true, 100, 50, 500, 60)];
  const okText = (name: string, content: string, top = 100): PlacedElement =>
    ({ kind: 'text', name, content, left: 100, top, width: 500, height: 60, ok: true, fit: { fontSize: 40, tracking: 0, leading: 46, lines: [content], fits: true } });

  it('passes a complete build', () => {
    const p = project(covered);
    const qc = runQualityControl(p, [
      okText('School Name', 'SRI NARAYANA HIGH SCHOOL'),
      okText('Phone Number', 'Ph: 6300038389', 1300),
      okText('Academic Year', '2026-27', 1200),
      { kind: 'image', name: 'School Logo', left: 20, top: 20, width: 100, height: 100, ok: true }
    ], { width: 1000, height: 1400 }, covered);
    expect(qc.pass).toBe(true);
    expect(qc.scores.replacementCompleteness).toBe(100);
  });
  it('flags visible old identity as critical', () => {
    const p = project(covered);
    const qc = runQualityControl(p, [okText('School Name', 'SRI NARAYANA HIGH SCHOOL')], { width: 1000, height: 1400 }, []);
    expect(qc.pass).toBe(false);
    expect(qc.issues.some(i => i.code === 'OLD_IDENTITY_VISIBLE')).toBe(true);
  });
  it('flags missing school name, out-of-canvas text, and covered faces', () => {
    const face: DetectedRegion = { id: 'f1', kind: 'face', bounds: { left: 400, top: 400, right: 500, bottom: 520, width: 100, height: 120 }, confidence: 90 };
    const p = project([...covered, face]);
    const qc = runQualityControl(p, [
      { ...okText('Rogue Text', 'something', 380), left: 380, top: 380, width: 200, height: 100 },
      { ...okText('Escapee', 'text', 1390), height: 100 }
    ], { width: 1000, height: 1400 }, covered);
    expect(qc.issues.map(i => i.code)).toEqual(expect.arrayContaining(['SCHOOL_NAME_MISSING', 'FACE_COVERED', 'TEXT_OUT_OF_CANVAS']));
    expect(qc.scores.faceSafety).toBe(0);
  });
  it('flags unreadable fits', () => {
    const p = project([]);
    const bad: PlacedElement = { kind: 'text', name: 'School Name', content: 'SRI NARAYANA HIGH SCHOOL', left: 0, top: 0, width: 40, height: 12, ok: true, fit: { fontSize: 12, tracking: -50, leading: 14, lines: ['SRI'], fits: false } };
    const qc = runQualityControl(p, [bad], { width: 1000, height: 1400 }, []);
    expect(qc.issues.some(i => i.code === 'TEXT_UNREADABLE')).toBe(true);
  });
});
