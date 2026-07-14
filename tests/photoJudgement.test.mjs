import { describe, expect, it } from 'vitest';
import { fingerprintSimilarity, inferActivityRole, judgePhotoStory } from '../src-v2/main/design/studio/photoJudgement.mjs';
import { composeCollage2 } from '../src-v2/main/design/studio/family_collage2.mjs';
import { collageTypographyPairing, derivePalette } from '../src-v2/main/design/studio/theme.mjs';
import { STORY_MODES, selectStoryMode, validateProgrammeCoverage } from '../src-v2/main/design/studio/storyModes.mjs';

describe('human-like photo judgement', () => {
  it('selects compact, photo-rich, and carousel modes from distinct photo count', () => {
    expect(selectStoryMode(3)).toBe(STORY_MODES.COMPACT);
    expect(selectStoryMode(5)).toBe(STORY_MODES.PHOTO_RICH);
    expect(selectStoryMode(8)).toBe(STORY_MODES.PHOTO_RICH);
    expect(selectStoryMode(9)).toBe(STORY_MODES.CAROUSEL);
    expect(selectStoryMode(3, 'carousel')).toBe(STORY_MODES.CAROUSEL);
  });

  it('hard-fails when a programme item is silently dropped', () => {
    const programme = ['Prayer Song', 'Pledge', 'National Anthem'];
    const scene = { width: 1080, root: [{ type: 'group', name: 'RAIL', children: [
      { type: 'text', text: 'Prayer Song' },
      { type: 'text', text: 'National Anthem' },
    ] }] };
    expect(validateProgrammeCoverage(scene, programme)).toMatchObject({
      pass: false,
      missing: ['Pledge'],
      rejectionCode: 'PROGRAMME_ITEMS_DROPPED',
    });
  });

  it('maps labels only from supported visual evidence', () => {
    const news = inferActivityRole({ path: 'student.jpg', signals: { microphone: true, readingPaper: true } }, { aspectRatio: 0.6 });
    expect(news).toMatchObject({ role: 'news_headlines', label: 'News Headlines' });
    expect(news.confidence).toBeGreaterThan(0.9);

    const unknown = inferActivityRole({ path: 'IMG_2034.jpg' }, { aspectRatio: 1 });
    expect(unknown.role).toBeNull();
  });

  it('computes deterministic perceptual similarity', () => {
    const same = { dHash: '1010', histogram: [0.4, 0.6] };
    const different = { dHash: '0101', histogram: [0, 1] };
    expect(fingerprintSimilarity(same, same)).toBe(1);
    expect(fingerprintSimilarity(same, different)).toBeLessThan(0.4);
  });

  it('keeps distinct real moments and rejects another crop from the hero moment', async () => {
    const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
    const assembly = `${root}/acceptance-assets/assembly.jpg`;
    const student = `${root}/acceptance-assets/student.jpg`;
    const story = await judgePhotoStory([
      { id: 'hero', path: assembly, sourceMoment: assembly, preferredHero: true, signals: { wideAssembly: true, assembledStanding: true } },
      { id: 'hero-crop', path: assembly, sourceMoment: assembly, derived: true, signals: { assembledStanding: true } },
      { id: 'speaker', path: student, sourceMoment: student, signals: { student: true, microphone: true, readingPaper: true } },
    ], { minQuality: 40 });
    expect(story.hero.id).toBe('hero');
    expect(story.supporting.map((photo) => photo.id)).toEqual(['speaker']);
    expect(story.rejected).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'hero-crop', reason: 'exact-duplicate' })]));
  });

  it('uses variable gallery frames and never assumes a fixed slot count', () => {
    const gallery = Array.from({ length: 5 }, (_, index) => ({
      path: `activity-${index + 1}.jpg`,
      role: { label: `Activity ${index + 1}` },
      technical: { orientation: index % 2 ? 'portrait' : 'landscape' },
    }));
    const { meta } = composeCollage2({
      width: 1080,
      height: 1350,
      palette: derivePalette('#1E3A5F', 'prayer'),
      typo: collageTypographyPairing(),
      assets: { hero: 'hero.jpg' },
      roles: { gallery },
      content: {
        school: { name: 'Test School', recognition: 'Recognised', address: 'Test Address', group: 'Test Group', branches: [], phones: [] },
        event: { title: 'Daily Prayer', date: '14 July 2026', day: 'Tuesday' },
        quote: 'A short quote.', footerQuote: '',
      },
    });
    const galleryFrames = meta.photoFrames.filter((frame) => frame.kind === 'gallery');
    expect(meta.fixedSlotCount).toBe(false);
    expect(meta.galleryCount).toBe(5);
    expect(new Set(galleryFrames.map((frame) => `${frame.w}x${frame.h}`)).size).toBeGreaterThan(2);
  });
});
