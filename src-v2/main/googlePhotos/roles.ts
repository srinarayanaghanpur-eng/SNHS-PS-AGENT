// Semantic roles a picked photo can be assigned to (§9), and how each role is
// filed: permanent school branding lands in the Approved Asset Library (the
// brand-kit profile, §10) while daily/event photos stay in the current job
// folder only (§11).

import type { BrandAssetKey } from '../../shared/brandKit';

export const PHOTO_ROLES = [
  'school-logo', 'lead-logo', 'chairman', 'correspondent', 'principal',
  'student', 'birthday-student', 'activity-photo', 'campus', 'background',
] as const;
export type PhotoRole = typeof PHOTO_ROLES[number];

export const ROLE_LABELS: Record<PhotoRole, string> = {
  'school-logo': 'School logo',
  'lead-logo': 'LEAD logo',
  chairman: 'Chairman',
  correspondent: 'Correspondent',
  principal: 'Principal',
  student: 'Student',
  'birthday-student': 'Birthday student',
  'activity-photo': 'Activity photo',
  campus: 'Campus',
  background: 'Background',
};

// Permanent roles map to a brand-kit asset slot; daily roles map to null.
export const ROLE_TO_ASSET_KEY: Record<PhotoRole, BrandAssetKey | null> = {
  'school-logo': 'mainLogo',
  'lead-logo': 'leadLogo',
  chairman: 'chairmanPhoto',
  correspondent: 'correspondentPhoto',
  principal: 'principalPhoto',
  campus: 'campusPhoto',
  background: 'defaultBackground',
  student: null,
  'birthday-student': null,
  'activity-photo': null,
};

export function isPermanentRole(role: PhotoRole): boolean { return ROLE_TO_ASSET_KEY[role] !== null; }
export function assetKeyForRole(role: PhotoRole): BrandAssetKey | null { return ROLE_TO_ASSET_KEY[role]; }
