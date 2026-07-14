import { describe, expect, it } from 'vitest';
import { validatePosterRequest } from '../src-v2/main/brandKit/validatePoster';
import { schoolProfileSchema, SNHS_DEFAULT, type SchoolProfile } from '../src-v2/shared/brandKit';
import type { PosterRequest } from '../src-v2/shared/ipc';

const profile = (over: Partial<SchoolProfile> = {}): SchoolProfile =>
  schoolProfileSchema.parse({ ...SNHS_DEFAULT, id: 'p1', createdAt: 'now', updatedAt: 'now', ...over });

const request = (over: Partial<PosterRequest> = {}): PosterRequest => ({
  category: 'prayer', headline: 'Prayer', subheadline: '', message: 'Thought for today.', details: '11/07/2026',
  schoolProfileId: 'p1', ...over,
} as PosterRequest);

describe('poster request validation (§9)', () => {
  it('flags a missing school profile', async () => {
    const result = await validatePosterRequest(request({ schoolProfileId: undefined }), null);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.field === 'schoolProfileId')).toBe(true);
  });

  it('flags a missing date', async () => {
    const result = await validatePosterRequest(request({ details: '' }), profile());
    expect(result.issues.some((i) => i.field === 'date')).toBe(true);
  });

  it('flags missing prayer content', async () => {
    const result = await validatePosterRequest(request({ message: '', prayer: undefined }), profile());
    expect(result.issues.some((i) => i.field === 'prayerContent')).toBe(true);
  });

  it('requires the logo, LEAD logo, and prayer photo for Daily Prayer', async () => {
    const result = await validatePosterRequest(request(), profile());
    expect(result.issues.some((issue) => issue.field === 'schoolLogo')).toBe(true);
    expect(result.issues.some((issue) => issue.field === 'leadLogo')).toBe(true);
    expect(result.issues.some((issue) => issue.field === 'prayerPhoto')).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('flags a student photo path that does not exist', async () => {
    const result = await validatePosterRequest(request({ photos: [{ path: 'C:/nope/x.jpg' }] }), profile());
    expect(result.issues.some((i) => i.field === 'photo[0]')).toBe(true);
  });

  it('flags a chairman photo enabled without an image', async () => {
    const result = await validatePosterRequest(request({ management: { chairman: { show: true } } }), profile());
    expect(result.issues.some((i) => i.field === 'chairmanPhoto')).toBe(true);
  });
});
