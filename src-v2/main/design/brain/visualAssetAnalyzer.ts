// Layer 1: Visual Asset Analyzer
//
// Understands the input assets before any design decisions are made.
// Analyses photos, logos, branding assets, and reference posters.

import type { ComposeInput } from '../types';
import type { AssetManifest, CropAnchors } from './brainTypes';

export interface AssetAnalysis {
  manifest: AssetManifest;
  photoCount: number;
  photoOrientations: Array<'portrait' | 'landscape' | 'square'>;
  photoFileSizes: number[];
  hasBirthdays: boolean;
  hasManagement: boolean;
  hasSchoolLogo: boolean;
  hasLeadLogo: boolean;
  hasReference: boolean;
  heroCandidates: Array<{ path: string; score: number; reason: string }>;
  totalAssets: number;
  eventEmphasis: EmphasisType;
  managementRole: 'both' | 'chairman-only' | 'principal-only' | 'none';
  birthdayCount: number;
  programmeItems: number;
}

export type EmphasisType = 'birthday' | 'lively' | 'exam' | 'festival' | 'programme' | 'general';

export function analyzeAssets(input: ComposeInput): AssetAnalysis {
  const photos = input.photos || [];
  const management = input.management || {};
  const prayer = input.prayer;
  const brandAssets = input.assets;

  const hasChairman = management.chairman?.show === true;
  const hasPrincipal = management.principal?.show === true;
  const managementRole: AssetAnalysis['managementRole'] =
    hasChairman && hasPrincipal ? 'both'
    : hasChairman ? 'chairman-only'
    : hasPrincipal ? 'principal-only'
    : 'none';

  const hasBirthdays = !!(prayer?.birthdays && prayer.birthdays.length > 0);
  const birthdayCount = prayer?.birthdays?.length || 0;
  const programmeItems = prayer?.programme?.length || 0;

  const eventEmphasis = decideEmphasis(input);
  const hasSchoolLogo = !!brandAssets?.mainLogo || !!input.brand?.logoPlacement;
  const hasLeadLogo = !!brandAssets?.leadLogo || !!input.brand?.leadPlacement;
  const hasReference = false;

  const heroCandidates: Array<{ path: string; score: number; reason: string }> = [];
  for (const p of photos) {
    let score = 50;
    const reasons: string[] = [];
    if (p.name?.toLowerCase().includes('hero') || p.name?.toLowerCase().includes('main')) {
      score += 30; reasons.push('naming suggests hero');
    }
    if (p.className) { score += 10; reasons.push('has class label'); }
    heroCandidates.push({ path: p.path, score, reason: reasons.join(', ') || 'default' });
  }
  heroCandidates.sort((a, b) => b.score - a.score);

  return {
    manifest: buildManifest(input),
    photoCount: photos.length,
    photoOrientations: photos.map(() => 'portrait'),
    photoFileSizes: photos.map(() => 0),
    hasBirthdays, hasManagement: managementRole !== 'none',
    hasSchoolLogo, hasLeadLogo, hasReference,
    heroCandidates,
    totalAssets: photos.length + (hasSchoolLogo ? 1 : 0) + (hasLeadLogo ? 1 : 0) + (hasChairman ? 1 : 0) + (hasPrincipal ? 1 : 0),
    eventEmphasis,
    managementRole, birthdayCount, programmeItems,
  };
}

function decideEmphasis(input: ComposeInput): EmphasisType {
  const prayer = input.prayer;
  if (!prayer) return 'general';

  if (prayer.birthdays && prayer.birthdays.length > 0) return 'birthday';
  if (prayer.examInfo) return 'exam';
  if (prayer.festivalInfo) return 'festival';
  if (prayer.programme && prayer.programme.length > 3) return 'programme';
  if (prayer.thought || prayer.prayerTitle) return 'lively';

  return 'general';
}

function buildManifest(input: ComposeInput): AssetManifest {
  const photos = (input.photos || []).map(p => ({
    path: p.path,
    name: p.name || '',
    className: p.className,
  }));
  const logos: AssetManifest['logos'] = [];
  if (input.brand?.logoPlacement) logos.push({ path: '', type: 'school' });
  if (input.brand?.leadPlacement) logos.push({ path: '', type: 'lead' });
  const mgmt: Array<{ path: string; role: 'chairman' | 'principal' }> = [];
  const chairmanAsset = input.management?.chairman?.asset;
  if (input.management?.chairman?.show && chairmanAsset) {
    mgmt.push({ path: typeof chairmanAsset === 'string' ? chairmanAsset : chairmanAsset.path, role: 'chairman' });
  }
  const principalAsset = input.management?.principal?.asset;
  if (input.management?.principal?.show && principalAsset) {
    mgmt.push({ path: typeof principalAsset === 'string' ? principalAsset : principalAsset.path, role: 'principal' });
  }
  return { photos, logos, managementPhotos: mgmt, referencePoster: null };
}

export function estimateCropAnchors(photoPath: string, focusY?: number): CropAnchors {
  const f = focusY ?? 0.5;
  const headroom = 0.08;
  return {
    top: Math.max(0, f - headroom),
    right: 0.95,
    bottom: Math.min(1, f + 1 - headroom),
    left: 0.05,
  };
}
