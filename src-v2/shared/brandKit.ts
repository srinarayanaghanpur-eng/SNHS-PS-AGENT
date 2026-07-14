// Shared schema for school profiles and brand kits. These types cross the IPC
// boundary, so they live in shared/ and are validated with zod on the main side.

import { z } from 'zod';

// Every brand asset slot the app understands (§2). Kept as a const tuple so the
// renderer can enumerate upload controls and the store can validate keys.
export const BRAND_ASSET_KEYS = [
  'mainLogo', 'secondaryLogo', 'leadLogo', 'groupLogo',
  'chairmanPhoto', 'correspondentPhoto', 'directorPhoto', 'principalPhoto', 'headmasterPhoto',
  'studentPhoto', 'assemblyPhoto', 'campusPhoto', 'buildingPhoto', 'busPhoto',
  'defaultBackground', 'signature', 'stamp', 'qrCode', 'sponsorLogo',
] as const;
export type BrandAssetKey = typeof BRAND_ASSET_KEYS[number];

// Which folder each asset is filed under inside the brand kit (§3).
export const ASSET_SUBFOLDER: Record<BrandAssetKey, string> = {
  mainLogo: 'logos', secondaryLogo: 'logos', leadLogo: 'logos', groupLogo: 'logos',
  chairmanPhoto: 'management', correspondentPhoto: 'management', directorPhoto: 'management',
  principalPhoto: 'management', headmasterPhoto: 'management',
  studentPhoto: 'students', assemblyPhoto: 'campus', campusPhoto: 'campus', buildingPhoto: 'campus', busPhoto: 'campus',
  defaultBackground: 'backgrounds', signature: 'signatures', stamp: 'stamps', qrCode: 'partners', sponsorLogo: 'partners',
};

export const ASSET_LABELS: Record<BrandAssetKey, string> = {
  mainLogo: 'Main school logo', secondaryLogo: 'Secondary school logo', leadLogo: 'LEAD logo', groupLogo: 'School group logo',
  chairmanPhoto: 'Chairman photograph', correspondentPhoto: 'Correspondent photograph', directorPhoto: 'Director photograph',
  principalPhoto: 'Principal photograph', headmasterPhoto: 'Headmaster photograph',
  studentPhoto: 'Student hero photograph', assemblyPhoto: 'Assembly photograph',
  campusPhoto: 'Campus photograph', buildingPhoto: 'School building photograph', busPhoto: 'School bus photograph',
  defaultBackground: 'Default background image', signature: 'Signature image', stamp: 'School stamp',
  qrCode: 'QR code', sponsorLogo: 'Sponsor / partner logo',
};

// Management person details (name + designation stored in profile, not per-poster).
export const managementPersonSchema = z.object({
  name: z.string().max(80).default(''),
  designation: z.string().max(80).default(''),
}).strict();
export type ManagementPersonDetails = z.infer<typeof managementPersonSchema>;

export const managementDetailsSchema = z.object({
  chairman: managementPersonSchema.default({ name: '', designation: '' }),
  correspondent: managementPersonSchema.default({ name: '', designation: '' }),
  director: managementPersonSchema.default({ name: '', designation: '' }),
  principal: managementPersonSchema.default({ name: '', designation: '' }),
  headmaster: managementPersonSchema.default({ name: '', designation: '' }),
}).strict();
export type ManagementDetails = z.infer<typeof managementDetailsSchema>;

// Fixed poster defaults stored per profile.
export const fixedSettingsSchema = z.object({
  footerText: z.string().max(240).default(''),
  defaultOutputFolder: z.string().max(512).default(''),
  defaultWidth: z.number().int().min(600).max(4000).default(1080),
  defaultHeight: z.number().int().min(600).max(4000).default(1350),
  defaultContactNumber: z.string().max(24).default(''),
}).strict();
export type FixedSettings = z.infer<typeof fixedSettingsSchema>;

// A crop the user configured for an asset; applied during cover-fit in Photoshop.
export const cropSchema = z.object({
  zoom: z.number().min(1).max(4).default(1),
  offsetX: z.number().min(-1).max(1).default(0),
  offsetY: z.number().min(-1).max(1).default(0),
}).strict();
export type Crop = z.infer<typeof cropSchema>;

export const brandAssetSchema = z.object({
  path: z.string().min(1),          // absolute path inside the brand kit folder
  originalName: z.string(),
  format: z.enum(['jpg', 'png', 'webp', 'gif', 'bmp', 'psd', 'tiff']),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().nonnegative().default(0),
  height: z.number().int().nonnegative().default(0),
  hasAlpha: z.boolean().default(false),
  importedAt: z.string(),
  crop: cropSchema.optional(),
}).strict();
export type BrandAsset = z.infer<typeof brandAssetSchema>;

export const brandingPresetSchema = z.object({
  primary: z.string().regex(/^[0-9A-Fa-f]{6}$/).default('14325C'),
  secondary: z.string().regex(/^[0-9A-Fa-f]{6}$/).default('1E4B85'),
  accent: z.string().regex(/^[0-9A-Fa-f]{6}$/).default('E9A83B'),
  background: z.string().regex(/^[0-9A-Fa-f]{6}$/).default('F2F8FF'),
  headingFont: z.string().default('PalatinoLinotype-Bold'),
  bodyFont: z.string().default('ArialMT'),
  logoPlacement: z.enum(['left', 'center', 'right']).default('left'),
  footerStyle: z.enum(['solid-bar', 'gradient-bar', 'minimal-line']).default('gradient-bar'),
  leadPlacement: z.enum(['top-right', 'footer-right', 'beside-powered-by']).default('footer-right'),
  showLead: z.boolean().default(true),
}).strict();
export type BrandingPreset = z.infer<typeof brandingPresetSchema>;

export const schoolProfileSchema = z.object({
  id: z.string().min(1),
  // Basic details (§1)
  name: z.string().min(1).max(120),
  shortName: z.string().max(60).default(''),
  groupName: z.string().max(120).default(''),
  addressLine1: z.string().max(160).default(''),
  addressLine2: z.string().max(160).default(''),
  village: z.string().max(80).default(''),
  mandal: z.string().max(80).default(''),
  district: z.string().max(80).default(''),
  state: z.string().max(80).default(''),
  pin: z.string().max(12).default(''),
  phone1: z.string().max(24).default(''),
  phone2: z.string().max(24).default(''),
  whatsapp: z.string().max(24).default(''),
  email: z.string().max(120).default(''),
  website: z.string().max(120).default(''),
  academicYear: z.string().max(40).default(''),
  tagline: z.string().max(160).default(''),
  footerText: z.string().max(240).default(''),
  affiliation: z.string().max(160).default(''),
  admissionsText: z.string().max(240).default(''),
  // Management details (names + designations stored in profile).
  management: managementDetailsSchema.default(() => managementDetailsSchema.parse({})),
  // Fixed poster defaults.
  defaultWidth: z.number().int().min(600).max(4000).default(1080),
  defaultHeight: z.number().int().min(600).max(4000).default(1350),
  defaultOutputFolder: z.string().max(512).default(''),
  // Brand kit. Key is validated as a string here; the typed key surface is
  // restored on the exported type below so keys can be absent (partial).
  assets: z.record(z.string(), brandAssetSchema).default({}),
  branding: brandingPresetSchema.default(() => brandingPresetSchema.parse({})),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();
export type SchoolProfile = Omit<z.infer<typeof schoolProfileSchema>, 'assets' | 'management'> & {
  assets: Partial<Record<BrandAssetKey, BrandAsset>>;
  management: ManagementDetails;
};

// Composed one-line address from the structured parts, for footers/headers.
export function formatAddress(p: Pick<SchoolProfile, 'addressLine1' | 'addressLine2' | 'village' | 'mandal' | 'district' | 'state' | 'pin'>): string {
  const parts = [p.addressLine1, p.addressLine2, p.village, p.mandal, p.district, p.state].map((s) => s.trim()).filter(Boolean);
  const line = parts.join(', ');
  return p.pin ? `${line}${line ? ' · ' : ''}PIN ${p.pin}` : line;
}

// The built-in Sri Narayana High School defaults (§1). No invented details.
export const SNHS_DEFAULT: Omit<SchoolProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Sri Narayana High School', shortName: 'SNHS', groupName: '',
  addressLine1: 'Ghanpur (M)', addressLine2: '', village: 'Ghanpur', mandal: '',
  district: 'Jayashankar Bhupalpally District', state: '', pin: '506135',
  phone1: '6300038389', phone2: '', whatsapp: '', email: '', website: '',
  academicYear: '2026–27', tagline: '', footerText: '',
  affiliation: 'Powered by LEAD', admissionsText: '',
  management: managementDetailsSchema.parse({}),
  defaultWidth: 1080, defaultHeight: 1350, defaultOutputFolder: '',
  assets: {}, branding: brandingPresetSchema.parse({}),
};
