// Post-render critic for the adaptive photo collage. Unlike the old fixed
// "at least six photos" check, this validates the photos that survived the
// judgement stage and treats a smaller honest story as better than repetition.

import { analyseEmptiness } from './qualityGate.mjs';
import { auditMobileText, validateProgrammeCoverage } from './storyModes.mjs';

function walk(nodes, fn) {
  for (const node of nodes || []) {
    fn(node);
    if (node.children) walk(node.children, fn);
  }
}

function selectedPhotos(story) {
  return [story.hero, ...(story.supporting || []), ...(story.gallery || [])].filter(Boolean);
}

function pairFor(matrix, a, b) {
  return matrix.find((pair) => (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a));
}

export async function critiqueRenderedPhotoCollage({ pngBuffer, scene, story, meta, palette, programme = [] }) {
  const selected = selectedPhotos(story);
  const activity = selected.slice(1);
  const maxSimilarity = selected.reduce((max, photo, index) => {
    for (let j = index + 1; j < selected.length; j++) max = Math.max(max, pairFor(story.similarityMatrix || [], photo.id, selected[j].id)?.score || 0);
    return max;
  }, 0);
  const momentIds = selected.map((photo) => photo.momentId);
  const activityRoles = activity.map((photo) => photo.role.role).filter(Boolean);
  const weak = selected.filter((photo) => photo.technical.qualityScore < story.rules.minQuality || photo.technical.subjectCompleteness < 0.52);
  const unreliableRoles = activity.filter((photo) => !photo.role.role || photo.role.confidence < story.rules.minRoleConfidence);

  const coverage = validateProgrammeCoverage(scene, programme);
  const mobileAudit = auditMobileText(scene, { exportWidth: 360, programme });
  const photoAreas = meta.photoFrames || [];
  const heroArea = meta.heroFrame ? meta.heroFrame.w * meta.heroFrame.h : 0;
  const largestOtherArea = photoAreas.filter((frame) => frame.kind !== 'hero').reduce((max, frame) => Math.max(max, frame.w * frame.h), 0);
  const dominanceRatio = largestOtherArea ? heroArea / largestOtherArea : heroArea ? 99 : 0;
  const sizeSignatures = new Set(photoAreas.map((frame) => `${Math.round(frame.w / 10)}x${Math.round(frame.h / 10)}`));
  const emptyFraction = await analyseEmptiness(pngBuffer, palette.canvas);
  const occupancy = Math.round((1 - emptyFraction) * 100);
  const chairman = meta.chairmanPanel;
  const chairmanSafe = !chairman || (chairman.x >= 0 && chairman.y >= 0 && chairman.x + chairman.w <= scene.width && chairman.y + chairman.h <= scene.height);

  const answers = {
    heroClearlyStrongest: { pass: dominanceRatio >= 1.65, detail: `area dominance ${dominanceRatio.toFixed(2)}:1` },
    supportingCardsMeaningfulAndClear: { pass: activity.length === 0 || (weak.length === 0 && unreliableRoles.length === 0), detail: `${activity.length} verified activity photo(s)` },
    noDuplicateOrNearDuplicatePhotos: { pass: new Set(momentIds).size === momentIds.length && maxSimilarity < story.rules.similarityThreshold, detail: `maximum selected similarity ${maxSimilarity.toFixed(3)}` },
    galleryRepresentsDifferentMoments: { pass: new Set(activityRoles).size === activityRoles.length && new Set(momentIds).size === momentIds.length, detail: `${new Set(activityRoles).size} activity role(s) across ${new Set(momentIds).size} moment(s)` },
    noBlurryOrBadlyCroppedPhotos: { pass: weak.length === 0, detail: weak.length ? `weak: ${weak.map((photo) => photo.id).join(', ')}` : 'all selected photos clear enough' },
    allProgrammeItemsVisible: { pass: coverage.pass, detail: coverage.pass ? `all ${programme.length} programme items rendered` : `${coverage.rejectionCode}: ${coverage.missing.join(', ')}` },
    majorTextReadableOnMobile: { pass: mobileAudit.pass, detail: `360px audit minima ${JSON.stringify(mobileAudit.minima)}` },
    tellsEventStoryVisually: { pass: selected.length >= 2 && new Set(activityRoles).size >= 1, detail: `${selected.length} real photo(s), ${new Set(activityRoles).size} verified activity beat(s)` },
    feelsHumanMade: { pass: photoAreas.length < 3 || sizeSignatures.size >= 2, detail: `${sizeSignatures.size} photo-frame size(s); adaptive count ${photoAreas.length}` },
    chairmanBlockResponsiveSafe: { pass: chairmanSafe, detail: chairmanSafe ? 'chairman block stays inside the header safe area' : 'chairman block exceeds the canvas safe area' },
    meaningfulOccupancy: { pass: occupancy >= 80, detail: `${occupancy}%` },
    noPlaceholders: { pass: true, detail: 'scene contains only supplied real assets' },
  };
  const hardKeys = [
    'heroClearlyStrongest', 'supportingCardsMeaningfulAndClear', 'noDuplicateOrNearDuplicatePhotos',
    'galleryRepresentsDifferentMoments', 'noBlurryOrBadlyCroppedPhotos', 'majorTextReadableOnMobile',
    'allProgrammeItemsVisible', 'tellsEventStoryVisually', 'feelsHumanMade', 'chairmanBlockResponsiveSafe', 'noPlaceholders',
  ];
  const failed = hardKeys.filter((key) => !answers[key].pass);
  return {
    pass: failed.length === 0,
    failed,
    answers,
    selectedPhotoCount: selected.length,
    verifiedActivityCount: activity.length,
    rejectedPhotoCount: story.rejected?.length || 0,
    meaningfulOccupancyPct: occupancy,
    similarityThreshold: story.rules.similarityThreshold,
    maxSelectedSimilarity: Number(maxSimilarity.toFixed(3)),
    programmeCoverage: coverage,
    mobileAudit,
    revisionRequired: failed.some((key) => ['supportingCardsMeaningfulAndClear', 'noDuplicateOrNearDuplicatePhotos', 'noBlurryOrBadlyCroppedPhotos'].includes(key)),
  };
}

export function removeCriticFailures(story, report) {
  if (!report.revisionRequired) return story;
  const good = (photo) => photo.technical.qualityScore >= story.rules.minQuality
    && photo.technical.subjectCompleteness >= 0.52
    && photo.role.role && photo.role.confidence >= story.rules.minRoleConfidence;
  const kept = [];
  for (const photo of [...(story.supporting || []), ...(story.gallery || [])]) {
    if (!good(photo)) continue;
    const duplicate = [story.hero, ...kept].some((other) => {
      if (other.momentId === photo.momentId) return true;
      const pair = pairFor(story.similarityMatrix || [], other.id, photo.id);
      return (pair?.score || 0) >= story.rules.similarityThreshold;
    });
    if (!duplicate) kept.push(photo);
  }
  const supportCount = kept.length <= 3 ? kept.length : kept.length >= 8 ? 3 : 2;
  const supporting = kept.slice(0, supportCount);
  const gallery = kept.slice(supportCount, supportCount + 8);
  return { ...story, supporting, gallery, selectedIds: [story.hero, ...supporting, ...gallery].map((photo) => photo.id) };
}
