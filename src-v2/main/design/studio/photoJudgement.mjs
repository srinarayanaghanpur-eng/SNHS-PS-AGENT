// Human-like photo judgement for the Studio collage family.
//
// This stage runs before layout. It measures technical quality, computes a
// perceptual similarity fingerprint, honours source-moment provenance, and
// assigns only activity labels supported by filenames or visual signals.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';

const ROLE_LABELS = {
  wide_assembly: 'Morning Assembly',
  prayer_song: 'Prayer Song',
  pledge: 'Pledge',
  news_headlines: 'News Headlines',
  thought_of_day: 'Thought of the Day',
  word_of_day: 'Word of the Day',
  quiz_question: 'Quiz Question',
  birthday_wishes: 'Birthday Wishes',
  principals_message: "Principal's Message",
  national_anthem: 'National Anthem',
  teacher_participation: 'Teacher Participation',
  award_achievement: 'Award & Achievement',
  student_address: 'Student Address',
  assembled_standing: 'Students Assembled',
};

const FILENAME_ROLES = [
  [/prayer|bhajan|song/i, 'prayer_song', 0.92],
  [/pledge/i, 'pledge', 0.98],
  [/news|headline/i, 'news_headlines', 0.98],
  [/thought/i, 'thought_of_day', 0.98],
  [/word.?of.?the.?day|vocabulary/i, 'word_of_day', 0.96],
  [/quiz|question/i, 'quiz_question', 0.96],
  [/birthday|cake/i, 'birthday_wishes', 0.99],
  [/principal|headmaster|message/i, 'principals_message', 0.96],
  [/anthem/i, 'national_anthem', 0.99],
  [/teacher|staff/i, 'teacher_participation', 0.90],
  [/award|achievement|certificate|trophy|medal/i, 'award_achievement', 0.99],
  [/assembly|assembled|standing/i, 'assembled_standing', 0.78],
];

const PROGRAMME_ROLE_ALIASES = [
  [/prayer/i, 'prayer_song'], [/pledge/i, 'pledge'], [/news/i, 'news_headlines'],
  [/thought/i, 'thought_of_day'], [/word/i, 'word_of_day'], [/quiz/i, 'quiz_question'],
  [/birthday/i, 'birthday_wishes'], [/principal/i, 'principals_message'], [/anthem/i, 'national_anthem'],
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));

function programmeRole(label) {
  return PROGRAMME_ROLE_ALIASES.find(([pattern]) => pattern.test(String(label || '')))?.[1] || null;
}

export function inferActivityRole(candidate, analysis = {}, programme = []) {
  if (candidate.explicitRole && ROLE_LABELS[candidate.explicitRole]) {
    return { role: candidate.explicitRole, label: candidate.label || ROLE_LABELS[candidate.explicitRole], confidence: 1, evidence: ['explicit role'] };
  }

  const evidence = [];
  const scores = new Map();
  const add = (role, score, reason) => {
    if (!role) return;
    if (score > (scores.get(role) || 0)) scores.set(role, score);
    evidence.push(`${role}: ${reason}`);
  };
  const signals = candidate.signals || {};
  const name = `${candidate.name || ''} ${basename(candidate.path || '')}`;

  for (const [pattern, role, score] of FILENAME_ROLES) {
    if (pattern.test(name)) add(role, score, 'filename');
  }

  const progMatch = name.match(/(?:prog|programme|activity)[-_ ]?(\d+)/i);
  if (progMatch) {
    const index = Number(progMatch[1]) - 1;
    const role = programmeRole(programme[index]);
    if (role) add(role, 0.90, `programme position ${index + 1}`);
  }

  if (signals.wideAssembly || (analysis.aspectRatio || 0) >= 1.65) add('wide_assembly', signals.wideAssembly ? 0.96 : 0.70, 'wide assembly signal');
  if (signals.assembledStanding) add('assembled_standing', 0.86, 'assembled-standing signal');
  if (signals.prayerGesture) add('prayer_song', 0.97, 'prayer gesture');
  if (signals.pledgeGesture || signals.raisedHand) add('pledge', 0.96, 'pledge gesture');
  if (signals.microphone && signals.readingPaper) add('news_headlines', 0.96, 'microphone plus paper');
  else if (signals.microphone && signals.student) add('student_address', 0.78, 'student at microphone');
  if (signals.thoughtCard) add('thought_of_day', 0.95, 'thought card');
  if (signals.wordCard) add('word_of_day', 0.95, 'word card');
  if (signals.quizCard || signals.questionCard) add('quiz_question', 0.95, 'question card');
  if (signals.birthdayCake || signals.birthdayBanner) add('birthday_wishes', 0.99, 'birthday evidence');
  if (signals.principalSpeaking) add('principals_message', 0.98, 'principal speaking');
  if (signals.teacherPresent) add('teacher_participation', 0.86, 'teacher participation');
  if (signals.certificate || signals.trophy || signals.medal) add('award_achievement', 0.99, 'achievement evidence');
  if (signals.anthemFormation) add('national_anthem', 0.96, 'anthem formation');

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { role: null, label: null, confidence: 0, evidence: ['no reliable activity evidence'] };
  const [role, confidence] = ranked[0];
  return { role, label: candidate.label || ROLE_LABELS[role], confidence: round(confidence), evidence };
}

async function fingerprints(path) {
  const [hashPixels, colourPixels] = await Promise.all([
    sharp(path).rotate().resize(9, 8, { fit: 'fill' }).greyscale().raw().toBuffer(),
    sharp(path).rotate().resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer(),
  ]);
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += hashPixels[y * 9 + x] > hashPixels[y * 9 + x + 1] ? '1' : '0';
  }
  const histogram = new Array(24).fill(0);
  for (let i = 0; i < colourPixels.length; i += 3) {
    histogram[Math.min(7, colourPixels[i] >> 5)]++;
    histogram[8 + Math.min(7, colourPixels[i + 1] >> 5)]++;
    histogram[16 + Math.min(7, colourPixels[i + 2] >> 5)]++;
  }
  const total = 32 * 32 * 3;
  return { dHash: bits, histogram: histogram.map((value) => value / total) };
}

export function fingerprintSimilarity(a, b) {
  if (!a || !b) return 0;
  let sameBits = 0;
  for (let i = 0; i < Math.min(a.dHash.length, b.dHash.length); i++) if (a.dHash[i] === b.dHash[i]) sameBits++;
  const hashSimilarity = sameBits / Math.max(1, Math.min(a.dHash.length, b.dHash.length));
  const colourSimilarity = (a.histogram || []).reduce((sum, value, index) => sum + Math.min(value, b.histogram?.[index] || 0), 0);
  return round(hashSimilarity * 0.78 + colourSimilarity * 0.22);
}

export async function analysePhotoCandidate(candidate, index = 0, programme = []) {
  const path = resolve(candidate.path);
  const [metadata, stats, fingerprint, file] = await Promise.all([
    sharp(path).metadata(),
    sharp(path).stats(),
    fingerprints(path),
    Promise.resolve(readFileSync(path)),
  ]);
  const width = metadata.width || 0, height = metadata.height || 0;
  const megapixels = width * height / 1_000_000;
  const aspectRatio = height ? width / height : 1;
  const orientation = aspectRatio > 1.15 ? 'landscape' : aspectRatio < 0.86 ? 'portrait' : 'square';
  const contrast = (stats.channels || []).slice(0, 3).reduce((sum, channel) => sum + channel.stdev, 0) / 3;
  const subjectCompleteness = candidate.subjectCompleteness ?? (candidate.derived ? 0.58 : 0.82);
  const resolutionScore = clamp(megapixels / 2.2);
  const sharpnessScore = clamp((stats.sharpness || 0) / 3.2);
  const entropyScore = clamp(((stats.entropy || 0) - 5.1) / 2.5);
  const contrastScore = clamp(contrast / 72);
  const qualityScore = Math.round(
    resolutionScore * 27 + sharpnessScore * 23 + entropyScore * 18 + contrastScore * 17 + clamp(subjectCompleteness) * 15,
  );
  const technical = {
    width, height, megapixels: round(megapixels, 2), aspectRatio: round(aspectRatio), orientation,
    sharpness: round(stats.sharpness || 0), entropy: round(stats.entropy || 0), contrast: round(contrast),
    subjectCompleteness: round(subjectCompleteness), qualityScore,
  };
  const role = inferActivityRole(candidate, technical, programme);
  const momentId = candidate.momentId || candidate.sourceMoment || path;
  return {
    id: candidate.id || `photo-${index + 1}-${createHash('sha1').update(path).digest('hex').slice(0, 7)}`,
    name: candidate.name || basename(path), path, momentId: resolve(momentId), derived: Boolean(candidate.derived),
    preferredHero: Boolean(candidate.preferredHero), signals: candidate.signals || {},
    focusX: candidate.focusX ?? 0.5, focusY: candidate.focusY ?? 0.48,
    technical, fingerprint, role,
  };
}

function pairSimilarity(a, b) {
  if (resolve(a.path) === resolve(b.path)) return { score: 1, reason: 'exact-file' };
  if (a.momentId === b.momentId) return { score: 1, reason: 'same-source-moment' };
  return { score: fingerprintSimilarity(a.fingerprint, b.fingerprint), reason: 'perceptual' };
}

function heroScore(photo) {
  const roleBonus = photo.role.role === 'wide_assembly' ? 24 : photo.role.role === 'assembled_standing' ? 10 : 0;
  const preferred = photo.preferredHero ? 30 : 0;
  const landscape = photo.technical.orientation === 'landscape' ? 12 : 0;
  return photo.technical.qualityScore + roleBonus + preferred + landscape;
}

export async function judgePhotoStory(candidates, options = {}) {
  const programme = options.programme || [];
  const similarityThreshold = options.similarityThreshold ?? 0.88;
  const minQuality = options.minQuality ?? 52;
  const minRoleConfidence = options.minRoleConfidence ?? 0.68;
  const maxSupport = Math.max(0, Math.min(3, options.maxSupport ?? 3));
  const maxGallery = Math.max(0, Math.min(8, options.maxGallery ?? 8));
  const analysed = await Promise.all(candidates.map((candidate, index) => analysePhotoCandidate(candidate, index, programme)));
  if (!analysed.length) return { hero: null, supporting: [], gallery: [], analysed: [], rejected: [], similarityMatrix: [], rules: { similarityThreshold, minQuality, minRoleConfidence } };

  const similarityMatrix = [];
  for (let i = 0; i < analysed.length; i++) {
    for (let j = i + 1; j < analysed.length; j++) {
      const similarity = pairSimilarity(analysed[i], analysed[j]);
      similarityMatrix.push({ a: analysed[i].id, b: analysed[j].id, score: similarity.score, reason: similarity.reason });
    }
  }

  const hero = [...analysed].sort((a, b) => heroScore(b) - heroScore(a))[0];
  const selected = [hero];
  const rejected = [];
  const eligible = analysed.filter((photo) => photo !== hero).sort((a, b) => {
    const aScore = a.technical.qualityScore + a.role.confidence * 20;
    const bScore = b.technical.qualityScore + b.role.confidence * 20;
    return bScore - aScore;
  });

  for (const photo of eligible) {
    if (photo.technical.qualityScore < minQuality) {
      rejected.push({ id: photo.id, path: photo.path, reason: 'weak-photo', qualityScore: photo.technical.qualityScore });
      continue;
    }
    if (!photo.role.role || photo.role.confidence < minRoleConfidence) {
      rejected.push({ id: photo.id, path: photo.path, reason: 'unverified-activity-role', roleConfidence: photo.role.confidence });
      continue;
    }
    const duplicate = selected.map((kept) => ({ kept, ...pairSimilarity(photo, kept) })).sort((a, b) => b.score - a.score)[0];
    if (duplicate && duplicate.score >= similarityThreshold) {
      const reason = duplicate.reason === 'same-source-moment' ? 'same-moment' : duplicate.reason === 'exact-file' ? 'exact-duplicate' : 'near-duplicate';
      rejected.push({ id: photo.id, path: photo.path, reason, similarity: duplicate.score, kept: duplicate.kept.id });
      continue;
    }
    if (selected.some((kept) => kept.role.role === photo.role.role)) {
      rejected.push({ id: photo.id, path: photo.path, reason: 'duplicate-activity-role', role: photo.role.role });
      continue;
    }
    selected.push(photo);
  }

  const activityPhotos = selected.slice(1);
  // Compact stories keep up to three large support cards. Once five or more
  // distinct photos exist, two support cards lead into an adaptive gallery.
  // Carousel-sized stories may reserve three page-one highlights.
  const desiredSupport = activityPhotos.length <= 3 ? activityPhotos.length : activityPhotos.length >= 8 ? 3 : 2;
  const supportCount = Math.min(maxSupport, desiredSupport);
  const supporting = activityPhotos.slice(0, supportCount);
  const gallery = activityPhotos.slice(supportCount, supportCount + maxGallery);
  for (const unused of activityPhotos.slice(supportCount + gallery.length)) {
    rejected.push({ id: unused.id, path: unused.path, reason: 'maximum-story-photo-count-reached' });
  }

  return {
    hero, supporting, gallery, analysed, rejected, similarityMatrix,
    selectedIds: [hero, ...supporting, ...gallery].map((photo) => photo.id),
    rules: { similarityThreshold, minQuality, minRoleConfidence, maxSupport, maxGallery },
  };
}

export async function enhanceHeroImage(sourcePath, outputPath, options = {}) {
  const source = sharp(sourcePath).rotate();
  const metadata = await source.metadata();
  const sourceW = metadata.width || 1, sourceH = metadata.height || 1;
  const targetAspect = clamp(options.targetAspect ?? sourceW / sourceH, 0.72, 1.8);
  const subjectScale = clamp(options.subjectScale ?? 1.18, 1, 1.5);
  let cropH = Math.round(sourceH / subjectScale);
  let cropW = Math.round(cropH * targetAspect);
  if (cropW > sourceW) { cropW = sourceW; cropH = Math.round(cropW / targetAspect); }
  const focusX = clamp(options.focusX ?? 0.5);
  const left = Math.max(0, Math.min(sourceW - cropW, Math.round(sourceW * focusX - cropW / 2)));
  // Assembly subjects sit in the lower field. Anchoring south removes empty
  // canopy without guessing face coordinates or cutting the front row.
  const top = Math.max(0, sourceH - cropH);
  const outputW = Math.max(900, Math.min(1400, cropW * 2));
  const outputH = Math.round(outputW / targetAspect);
  await source
    .extract({ left, top, width: cropW, height: cropH })
    .resize(outputW, outputH, { fit: 'fill' })
    .modulate({ brightness: 1.055, saturation: 1.035 })
    .linear(1.055, -4)
    .sharpen({ sigma: 0.72, m1: 0.45, m2: 0.9 })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toFile(outputPath);
  return outputPath;
}

export function loadActivitySignals(paths) {
  const merged = {};
  for (const path of paths.filter(Boolean)) {
    try { Object.assign(merged, JSON.parse(readFileSync(path, 'utf8'))); } catch { /* optional sidecar */ }
  }
  return merged;
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || null;
}
