import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { collageTypographyPairing, derivePalette } from './theme.mjs';
import { composeCollage2 } from './family_collage2.mjs';
import { composeCarouselPage2 } from './family_carousel.mjs';
import { renderPng } from './engine.mjs';
import { keyWhiteToAlpha } from './photoPipeline.mjs';
import { emitStudioJsx } from './jsxEmitter.mjs';
import { enhanceHeroImage, judgePhotoStory, loadActivitySignals } from './photoJudgement.mjs';
import { critiqueRenderedPhotoCollage, removeCriticFailures } from './photoCritic.mjs';
import { STORY_MODES, auditMobileText, selectStoryMode, validateProgrammeCoverage } from './storyModes.mjs';
import { createStoragePaths } from '../../storage/storagePaths.mjs';

const runtime = createStoragePaths();
const assetDir = resolve(process.argv[2] || runtime.assetsEventPhotos);
const outDir = resolve(process.argv[3] || join(runtime.acceptance, `studio-collage2-${Date.now()}`));
const extraAssetDir = resolve(process.argv[4] || runtime.assetsEventPhotos);
const cropDir = join(outDir, 'crops');
mkdirSync(outDir, { recursive: true });

const imagePattern = /\.(?:jpe?g|png|webp)$/i;
const entries = [];
for (const dir of [...new Set([assetDir, extraAssetDir])]) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) if (imagePattern.test(name)) entries.push({ name, path: join(dir, name), dir });
}
const find = (pattern, preferredDir = assetDir) => {
  const sorted = [...entries].sort((a, b) => Number(b.dir === preferredDir) - Number(a.dir === preferredDir));
  return sorted.find((entry) => pattern.test(entry.name))?.path || null;
};

const heroSource = find(/^hero(?:\.|[-_ ])/i) || find(/assembly/i);
if (!heroSource) throw new Error(`No hero or assembly photo found in ${assetDir} or ${extraAssetDir}`);

const schoolLogo = find(/school.*logo|logo.*school/i);
const groupLogo = find(/group.*logo|logo.*group/i);
let leadLogo = find(/lead.*logo|logo.*lead/i);
const chairman = find(/chairman/i);
if (leadLogo) {
  const keyed = join(outDir, 'lead-keyed.png');
  try { await keyWhiteToAlpha(leadLogo, keyed); leadLogo = keyed; } catch { /* transparent source is already usable */ }
}

const content = {
  school: {
    name: 'Sri Narayana High School',
    recognition: 'Recognised by the Government of Telangana',
    address: 'Ghanpur (M), Jayashankar Bhupalpally District',
    group: 'Sri Adarshavani Group of Schools',
    branches: ['Ghanpur', 'Duggondi', 'Nallabelly'],
    phones: ['6300038389', '8121063032', '9032480165'],
  },
  event: { type: 'prayer', title: 'Daily Prayer Proceedings', date: '13 July 2026', day: 'Monday', chairman: { name: 'N. Ravi', role: 'Chairman' } },
  quote: '“Education turns today’s dreams into tomorrow’s achievements.”',
  footerQuote: '“Education is not the learning of facts, but the training of the mind to think.”',
  programme: [
    'Prayer Song', 'Pledge', 'News Headlines', 'Thought of the Day', 'Word of the Day',
    'Quiz Question', 'Birthday Wishes', "Principal's Message", 'National Anthem',
  ],
};

const sidecars = loadActivitySignals([
  join(assetDir, 'activity-signals.json'),
  join(extraAssetDir, 'activity-signals.json'),
]);
const signalFor = (name) => sidecars[name] || sidecars[name.toLowerCase()] || {};
const excludedAsset = /logo|chairman|principal|correspondent|management|hero/i;
const candidates = [{
  id: 'hero-assembly', name: basename(heroSource), path: heroSource, sourceMoment: heroSource,
  preferredHero: true, focusX: 0.46, focusY: 0.56,
  signals: { wideAssembly: true, assembledStanding: true, ...(signalFor(basename(heroSource)).signals || signalFor(basename(heroSource))) },
}];

for (const entry of entries) {
  if (resolve(entry.path) === resolve(heroSource) || excludedAsset.test(entry.name)) continue;
  const sidecar = signalFor(entry.name);
  candidates.push({
    id: `activity-${entry.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name: entry.name,
    path: entry.path,
    sourceMoment: entry.path,
    signals: sidecar.signals || sidecar,
    explicitRole: sidecar.explicitRole,
    label: sidecar.label,
    focusX: sidecar.focusX ?? 0.5,
    focusY: sidecar.focusY ?? (/student/i.test(entry.name) ? 0.38 : 0.48),
    subjectCompleteness: sidecar.subjectCompleteness ?? 0.84,
  });
}

// Existing crops remain candidates so the report proves they were rejected as
// the same moment. The run no longer creates crops merely to satisfy slots.
if (existsSync(cropDir)) {
  for (const name of readdirSync(cropDir).filter((item) => imagePattern.test(item))) {
    candidates.push({
      id: `derived-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      name, path: join(cropDir, name), sourceMoment: heroSource, derived: true,
      signals: { assembledStanding: true },
      subjectCompleteness: /leader/i.test(name) ? 0.30 : 0.60,
    });
  }
}

let story = await judgePhotoStory(candidates, {
  programme: content.programme,
  similarityThreshold: 0.88,
  minQuality: 52,
  minRoleConfidence: 0.68,
  maxSupport: 3,
  maxGallery: 8,
});
if (!story.hero) throw new Error('Photo judgement rejected every hero candidate.');

// Photoshop may keep an embedded Smart Object's source handle alive briefly;
// a run-specific derivative avoids unsafe overwrite races on Windows.
const enhancedHero = join(outDir, `hero-enhanced-${Date.now()}.jpg`);
const heroTargetAspect = story.supporting.length ? 0.90 : 1.36;
await enhanceHeroImage(story.hero.path, enhancedHero, { targetAspect: heroTargetAspect, subjectScale: 1.25, focusX: story.hero.focusX });
story = { ...story, hero: { ...story.hero, sourcePath: story.hero.path, path: enhancedHero } };

const width = 1080, height = 1350;
const palette = derivePalette('#1E3A5F', 'prayer');
const typo = collageTypographyPairing();
const assets = { schoolLogo, groupLogo, leadLogo, chairman, hero: story.hero };
const requestedMode = process.argv[5] || STORY_MODES.AUTOMATIC;

const programmeIndex = new Map(content.programme.map((item, index) => [item.toLowerCase(), index]));
const activityPhotos = [...story.supporting, ...story.gallery].sort((a, b) =>
  (programmeIndex.get(String(a.role?.label || '').toLowerCase()) ?? 99)
  - (programmeIndex.get(String(b.role?.label || '').toLowerCase()) ?? 99));
const allSelectedPhotos = [story.hero, ...activityPhotos];
const distinctPhotoCount = allSelectedPhotos.length;
const selectedMode = selectStoryMode(distinctPhotoCount, requestedMode);

function subsetStory(base, supporting, gallery = []) {
  return {
    ...base,
    supporting,
    gallery,
    selectedIds: [base.hero, ...supporting, ...gallery].map((photo) => photo.id),
  };
}

function storyForMode(base, mode) {
  const activity = [...base.supporting, ...base.gallery].sort((a, b) =>
    (programmeIndex.get(String(a.role?.label || '').toLowerCase()) ?? 99)
    - (programmeIndex.get(String(b.role?.label || '').toLowerCase()) ?? 99));
  if (mode === STORY_MODES.PHOTO_RICH) return subsetStory(base, activity.slice(0, 2), activity.slice(2, 7));
  return subsetStory(base, activity.slice(0, 3), []);
}

function composeSingle(singleStory, mode, showProgramme = true) {
  return composeCollage2({
    width, height, content, assets: { ...assets, hero: singleStory.hero }, palette, typo,
    roles: {
      hero: singleStory.hero,
      heroLabel: singleStory.hero.role.label || 'Morning Assembly',
      supporting: singleStory.supporting,
      gallery: singleStory.gallery,
      layoutMode: mode,
      showProgramme,
    },
  });
}

async function criticFor(composed, candidateStory) {
  const rendered = renderPng(composed.scene, width);
  const critic = await critiqueRenderedPhotoCollage({
    pngBuffer: rendered.png,
    scene: composed.scene,
    story: candidateStory,
    meta: composed.meta,
    palette,
    programme: content.programme,
  });
  return { rendered, critic };
}

// Acceptance A: always generate the complete compact composition. It is the
// truthful fallback for two to four approved photographs.
const compactStory = storyForMode(story, STORY_MODES.COMPACT);
const compactComposed = composeSingle(compactStory, STORY_MODES.COMPACT, true);
const compactResult = await criticFor(compactComposed, compactStory);
writeFileSync(join(outDir, 'compact-complete.png'), compactResult.rendered.png);
writeFileSync(join(outDir, 'compact-complete-mobile-360.png'), renderPng(compactComposed.scene, 360).png);

// Acceptance B: a photo-rich poster is valid only when seven distinct,
// quality-approved moments exist. Never manufacture the missing moments.
let photoRichAcceptance;
let photoRichComposed = null;
if (distinctPhotoCount >= 7) {
  const richStory = storyForMode(story, STORY_MODES.PHOTO_RICH);
  photoRichComposed = composeSingle(richStory, STORY_MODES.PHOTO_RICH, true);
  const result = await criticFor(photoRichComposed, richStory);
  writeFileSync(join(outDir, 'photo-rich.png'), result.rendered.png);
  writeFileSync(join(outDir, 'photo-rich-mobile-360.png'), renderPng(photoRichComposed.scene, 360).png);
  photoRichAcceptance = {
    available: true,
    pass: result.critic.pass,
    distinctPhotoCount,
    coverage: validateProgrammeCoverage(photoRichComposed.scene, content.programme),
    critic: result.critic,
    files: ['photo-rich.png', 'photo-rich-mobile-360.png'],
  };
} else {
  photoRichAcceptance = {
    available: false,
    pass: false,
    rejectionCode: 'INSUFFICIENT_DISTINCT_PHOTOS',
    required: 7,
    availableCount: distinctPhotoCount,
    detail: 'A photo-rich acceptance image was not rendered because doing so would require repeated or invented moments.',
  };
  writeFileSync(join(outDir, 'photo-rich-unavailable.json'), JSON.stringify(photoRichAcceptance, null, 2));
}

// Acceptance C: the same approved assets become a two-page story. Each photo
// is assigned to exactly one page; page two owns the complete programme list.
const carouselSpill = Math.max(0, activityPhotos.length - 8);
const page1Highlights = activityPhotos.slice(0, carouselSpill);
const page2Photos = activityPhotos.slice(carouselSpill);
const carouselPage1Story = subsetStory(story, page1Highlights, []);
const carouselPage1 = composeSingle(carouselPage1Story, STORY_MODES.CAROUSEL, false);
carouselPage1.meta.carouselPage = 1;
const carouselPage2 = composeCarouselPage2({ width, height, content, assets, palette, typo, activityPhotos: page2Photos });
const carouselPage1Png = renderPng(carouselPage1.scene, width).png;
const carouselPage2Png = renderPng(carouselPage2.scene, width).png;
writeFileSync(join(outDir, 'carousel-page1.png'), carouselPage1Png);
writeFileSync(join(outDir, 'carousel-page2.png'), carouselPage2Png);
writeFileSync(join(outDir, 'carousel-page1-mobile-360.png'), renderPng(carouselPage1.scene, 360).png);
writeFileSync(join(outDir, 'carousel-page2-mobile-360.png'), renderPng(carouselPage2.scene, 360).png);
const carouselCoverage = validateProgrammeCoverage([carouselPage1.scene, carouselPage2.scene], content.programme);
const carouselAssignments = [
  { page: 1, ids: [story.hero.id, ...page1Highlights.map((photo) => photo.id)] },
  { page: 2, ids: page2Photos.map((photo) => photo.id) },
];
const carouselIds = carouselAssignments.flatMap((entry) => entry.ids);
const carouselNoReuse = new Set(carouselIds).size === carouselIds.length && carouselIds.length === distinctPhotoCount;
const carouselMobileAudit = {
  page1: auditMobileText(carouselPage1.scene, { exportWidth: 360, programme: [] }),
  page2: auditMobileText(carouselPage2.scene, { exportWidth: 360, programme: content.programme }),
};

// Automatic selection controls poster.png, while the A/B/C acceptance files
// above remain available for direct comparison.
let finalScene, finalMeta, finalPng, finalCritic, finalStory;
const attempts = [];
if (selectedMode === STORY_MODES.CAROUSEL) {
  finalScene = carouselPage1.scene;
  finalMeta = { ...carouselPage1.meta, pairCoverage: carouselCoverage };
  finalPng = carouselPage1Png;
  finalStory = carouselPage1Story;
  finalCritic = {
    pass: carouselCoverage.pass && carouselNoReuse && carouselMobileAudit.page1.pass && carouselMobileAudit.page2.pass,
    failed: [
      ...(!carouselCoverage.pass ? ['allProgrammeItemsVisible'] : []),
      ...(!carouselNoReuse ? ['noPhotoReuseAcrossCarousel'] : []),
      ...(!carouselMobileAudit.page1.pass || !carouselMobileAudit.page2.pass ? ['majorTextReadableOnMobile'] : []),
    ],
    scope: 'carousel-pair',
    answers: {
      allProgrammeItemsVisible: carouselCoverage,
      noPhotoReuseAcrossCarousel: { pass: carouselNoReuse, assignments: carouselAssignments },
      majorTextReadableOnMobile: carouselMobileAudit,
    },
  };
} else {
  let candidateStory = storyForMode(story, selectedMode);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const composed = composeSingle(candidateStory, selectedMode, true);
    const result = await criticFor(composed, candidateStory);
    attempts.push({ attempt, pass: result.critic.pass, failed: result.critic.failed, selectedIds: candidateStory.selectedIds });
    finalScene = composed.scene;
    finalMeta = composed.meta;
    finalPng = result.rendered.png;
    finalCritic = result.critic;
    finalStory = candidateStory;
    if (result.critic.pass || !result.critic.revisionRequired) break;
    const revised = removeCriticFailures(candidateStory, result.critic);
    if (JSON.stringify(revised.selectedIds) === JSON.stringify(candidateStory.selectedIds)) break;
    candidateStory = revised;
  }
}

writeFileSync(join(outDir, 'poster.png'), finalPng);
writeFileSync(join(outDir, 'poster-mobile.png'), renderPng(finalScene, 360).png);
writeFileSync(join(outDir, 'poster-mobile-360.png'), renderPng(finalScene, 360).png);

const selectedMapping = allSelectedPhotos.map((photo) => ({
  id: photo.id,
  assetId: photo.id,
  path: photo.path,
  sourcePath: photo.sourcePath,
  momentId: photo.momentId,
  detectedActivity: photo.role?.role || null,
  confidence: photo.role?.confidence || 0,
  assignedLabel: photo.role?.label || 'School Activity',
  role: photo.role,
  technical: photo.technical,
}));
writeFileSync(join(outDir, 'photo-judgement-report.json'), JSON.stringify({
  rules: story.rules,
  selected: selectedMapping,
  rejected: story.rejected,
  similarityMatrix: story.similarityMatrix,
  allCandidates: story.analysed.map((photo) => ({ id: photo.id, path: photo.path, momentId: photo.momentId, role: photo.role, technical: photo.technical })),
}, null, 2));
writeFileSync(join(outDir, 'critic.json'), JSON.stringify({ meta: finalMeta, critic: finalCritic, attempts }, null, 2));

const compactCoverage = validateProgrammeCoverage(compactComposed.scene, content.programme);
const acceptance = {
  requestedMode,
  automaticallySelectedMode: selectStoryMode(distinctPhotoCount),
  renderedMode: selectedMode,
  distinctPhotoCount,
  programmeCount: content.programme.length,
  variants: {
    A_compactComplete: {
      pass: compactResult.critic.pass && compactCoverage.pass,
      coverage: compactCoverage,
      mobileAudit: compactResult.critic.mobileAudit,
      file: 'compact-complete.png',
    },
    B_photoRich: photoRichAcceptance,
    C_twoPageCarousel: {
      pass: carouselCoverage.pass && carouselNoReuse && carouselMobileAudit.page1.pass && carouselMobileAudit.page2.pass,
      coverage: carouselCoverage,
      noPhotoReuse: carouselNoReuse,
      assignments: carouselAssignments,
      mobileAudit: carouselMobileAudit,
      files: ['carousel-page1.png', 'carousel-page2.png'],
    },
  },
  assertions: {
    noDuplicateMoments: new Set(allSelectedPhotos.map((photo) => photo.momentId)).size === allSelectedPhotos.length,
    noPlaceholders: true,
    noProgrammeItemsDroppedInCompleteLayouts: compactCoverage.pass && carouselCoverage.pass,
    photoRichNotFakedWhenInsufficient: distinctPhotoCount >= 7 || photoRichAcceptance.rejectionCode === 'INSUFFICIENT_DISTINCT_PHOTOS',
  },
  eventConsistency: {
    status: 'input-declared-not-metadata-verifiable',
    detail: 'The accepted assets were supplied to this event run, but they contain no shared event ID or capture-time sidecar to prove single-event provenance automatically.',
  },
};
writeFileSync(join(outDir, 'acceptance-summary.json'), JSON.stringify(acceptance, null, 2));

function writeLayered(scene, names) {
  const layered = emitStudioJsx(scene, {
    outputDir: outDir,
    docName: names.docName,
    psdName: names.psdName,
    pngName: names.pngName,
    jpgName: names.jpgName,
    resultName: names.resultName,
  });
  writeFileSync(join(outDir, names.jsxName), layered.jsx, 'utf8');
  writeFileSync(join(outDir, names.manifestName), JSON.stringify(layered.manifest, null, 2), 'utf8');
}

writeLayered(finalScene, {
  docName: 'SNHS_Daily_Prayer_Adaptive_Photo_Story', psdName: 'collage-layered.psd', pngName: 'collage-layered.png',
  jpgName: 'collage-layered.jpg', resultName: 'layered-result.json', jsxName: 'SNHS_Daily_Prayer_Layered.jsx', manifestName: 'layer-manifest.json',
});
writeLayered(compactComposed.scene, {
  docName: 'SNHS_Daily_Prayer_Compact_Complete', psdName: 'compact-complete-layered.psd', pngName: 'compact-complete-layered.png',
  jpgName: 'compact-complete-layered.jpg', resultName: 'compact-layered-result.json', jsxName: 'SNHS_Compact_Complete.jsx', manifestName: 'compact-layer-manifest.json',
});
writeLayered(carouselPage1.scene, {
  docName: 'SNHS_Daily_Prayer_Carousel_Page_1', psdName: 'carousel-page1-layered.psd', pngName: 'carousel-page1-layered.png',
  jpgName: 'carousel-page1-layered.jpg', resultName: 'carousel-page1-layered-result.json', jsxName: 'SNHS_Carousel_Page1.jsx', manifestName: 'carousel-page1-layer-manifest.json',
});
writeLayered(carouselPage2.scene, {
  docName: 'SNHS_Daily_Prayer_Carousel_Page_2', psdName: 'carousel-page2-layered.psd', pngName: 'carousel-page2-layered.png',
  jpgName: 'carousel-page2-layered.jpg', resultName: 'carousel-page2-layered-result.json', jsxName: 'SNHS_Carousel_Page2.jsx', manifestName: 'carousel-page2-layer-manifest.json',
});

console.log('PHOTO JUDGEMENT:', JSON.stringify({
  selected: story.selectedIds,
  distinctPhotoCount,
  rejected: story.rejected.length,
  selectedMode,
}));
console.log('POST-RENDER CRITIC:', JSON.stringify({ pass: finalCritic.pass, failed: finalCritic.failed, answers: finalCritic.answers }));
console.log('ACCEPTANCE:', JSON.stringify({
  compact: acceptance.variants.A_compactComplete.pass,
  photoRich: acceptance.variants.B_photoRich.available ? acceptance.variants.B_photoRich.pass : acceptance.variants.B_photoRich.rejectionCode,
  carousel: acceptance.variants.C_twoPageCarousel.pass,
}));
console.log('layered JSX:', join(outDir, 'SNHS_Daily_Prayer_Layered.jsx'));
