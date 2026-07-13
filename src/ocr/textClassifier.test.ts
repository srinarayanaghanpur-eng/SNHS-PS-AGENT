import { describe, expect, it } from 'vitest';
import { classifyText, detectLanguage, nameSimilarity } from './textClassifier';
import type { SchoolProfile } from '../types';

const profile: SchoolProfile = {
  schemaVersion: 1,
  schoolName: 'SRI NARAYANA HIGH SCHOOL', shortName: 'SNHS',
  location: 'Ghanpur (M), Jayashankar Bhupalpally District',
  phone: '6300038389', altPhones: ['9876543210'],
  email: 'info@snhs.edu.in', website: 'www.snhs.edu.in',
  academicYear: '2026-27', groupName: 'Adarshavani Group of Schools',
  branchName: '', curriculum: 'Powered by LEAD',
  brandColors: [], preferredFonts: [], footerStyle: '',
  preferredLanguages: ['English', 'Telugu'], socialMedia: {}, media: {},
  updatedAt: ''
};

describe('classifyText — replace vs keep', () => {
  it("replaces another school's name", () => {
    const c = classifyText('SUNSHINE CONCEPT HIGH SCHOOL', profile);
    expect(c.textClass).toBe('school_name');
    expect(c.replace).toBe(true);
  });
  it('keeps the configured school name', () => {
    const c = classifyText('SRI NARAYANA HIGH SCHOOL', profile);
    expect(c.textClass).toBe('school_name');
    expect(c.replace).toBe(false);
  });
  it('replaces a foreign phone number', () => {
    const c = classifyText('Call: 9848012345', profile);
    expect(c.textClass).toBe('phone');
    expect(c.replace).toBe(true);
  });
  it('keeps the configured phone number', () => {
    const c = classifyText('Ph: 63000 38389', profile);
    expect(c.textClass).toBe('phone');
    expect(c.replace).toBe(false);
  });
  it('keeps "Admissions Open"', () => {
    const c = classifyText('ADMISSIONS OPEN', profile);
    expect(c.textClass).toBe('generic_keep');
    expect(c.replace).toBe(false);
  });
  it('keeps "Qualified Faculty"', () => {
    expect(classifyText('Qualified Faculty', profile).replace).toBe(false);
  });
  it('classifies academic year and replaces a different one', () => {
    const c = classifyText('Academic Year 2024-25', profile);
    expect(c.textClass).toBe('academic_year');
    expect(c.replace).toBe(true);
  });
  it('keeps the configured academic year', () => {
    expect(classifyText('2026-27', profile).replace).toBe(false);
  });
  it('replaces a foreign address', () => {
    const c = classifyText('Beside Bus Stand, Main Road, Warangal District', profile);
    expect(c.textClass).toBe('address');
    expect(c.replace).toBe(true);
  });
  it('detects emails and websites', () => {
    expect(classifyText('admissions@otherschool.com', profile).textClass).toBe('email');
    expect(classifyText('www.otherschool.com', profile).textClass).toBe('website');
    expect(classifyText('www.otherschool.com', profile).replace).toBe(true);
  });
  it('keeps dates', () => {
    const c = classifyText('15th August 2026', profile);
    expect(c.textClass).toBe('date');
    expect(c.replace).toBe(false);
  });
  it('uses layout context for footers and titles', () => {
    expect(classifyText('Some closing line here', profile, { yNorm: 0.96 }).textClass).toBe('footer');
    expect(classifyText('GRAND ANNUAL CELEBRATION', profile, { yNorm: 0.1, heightNorm: 0.06 }).textClass).toBe('event_title');
  });
});

describe('nameSimilarity', () => {
  it('is high for the same school with noise', () => {
    expect(nameSimilarity('SRI NARAYANA HIGH SCHOOL, GHANPUR', 'SRI NARAYANA HIGH SCHOOL')).toBeGreaterThan(0.6);
  });
  it('is low for different schools', () => {
    expect(nameSimilarity('SUNSHINE TECHNO SCHOOL', 'SRI NARAYANA HIGH SCHOOL')).toBeLessThan(0.5);
  });
});

describe('detectLanguage', () => {
  it('detects Telugu, English, and mixed', () => {
    expect(detectLanguage('ప్రవేశాలు ప్రారంభం')).toBe('te');
    expect(detectLanguage('Admissions Open')).toBe('en');
    expect(detectLanguage('Admissions ప్రారంభం')).toBe('mixed');
  });
});
