import type {
  ReferenceAnalysis, ContentMap, RoleMapping, RequiredAssetsChecklist,
  SlotRole, DetectedRegion,
} from './referenceTypes';

const ROLE_DESCRIPTIONS: Record<SlotRole, string> = {
  schoolLogo: 'School logo',
  schoolName: 'School name text',
  schoolAddress: 'School address text',
  chairmanPortrait: 'Chairman photograph',
  principalPortrait: 'Principal photograph',
  managementPortrait: 'Management photograph',
  eventTitle: 'Event title text',
  posterDate: 'Date text',
  posterDay: 'Day text',
  heroPhoto: 'Main assembly photograph',
  supportingPhoto: 'Supporting photograph',
  programmePhoto: 'Programme photograph',
  quote: 'Quote or message text',
  message: 'Message text',
  footerPhone: 'Phone number',
  footerAddress: 'Footer address',
  footerYear: 'Academic year',
  footerLeadBranding: 'Powered by LEAD text',
  leadLogo: 'LEAD logo',
  groupBranding: 'Group branding logo',
  decorativeShape: 'Decorative shape',
  background: 'Background fill',
  backgroundImage: 'Background image',
  programmeList: 'Programme list',
  prayerContent: 'Prayer content',
  divider: 'Divider line',
  border: 'Border element',
  topAccentEdge: 'Top accent edge',
  unknown: 'Unknown element',
};

export interface ReplacementContent {
  school?: {
    name?: string;
    address?: string;
    phone?: string;
    academicYear?: string;
  };
  logoPath?: string;
  leadLogoPath?: string;
  chairmanPhoto?: string;
  chairmanName?: string;
  principalPhoto?: string;
  principalName?: string;
  headline?: string;
  subheadline?: string;
  details?: string;
  message?: string;
  prayer?: {
    day?: string;
    programme?: string[];
    prayerTitle?: string;
    thought?: string;
    birthdays?: { name: string; className?: string; photo?: string }[];
  };
  photoPaths?: string[];
}

export function buildRequiredChecklist(
  analysis: ReferenceAnalysis,
): RequiredAssetsChecklist {
  const required: RequiredAssetsChecklist['required'] = [];
  const seen = new Set<SlotRole>();

  const addIfNew = (role: SlotRole, description: string, provided = false, path?: string): void => {
    if (!seen.has(role)) {
      seen.add(role);
      required.push({ role, description, provided, path });
    }
  };

  addIfNew('background', ROLE_DESCRIPTIONS.background, true);

  if (analysis.schoolLogoRegion) {
    addIfNew('schoolLogo', ROLE_DESCRIPTIONS.schoolLogo);
  }

  const textRoles = analysis.allRegions.filter((r) => r.type === 'text');
  const roleSet = new Set(textRoles.map((r) => r.role));
  for (const role of roleSet) {
    if (role !== 'unknown' && role !== 'decorativeShape' && role !== 'divider' && role !== 'border') {
      addIfNew(role, ROLE_DESCRIPTIONS[role] || role);
    }
  }

  if (analysis.heroPhotoRegion) {
    addIfNew('heroPhoto', ROLE_DESCRIPTIONS.heroPhoto);
  }

  for (const _ of analysis.supportingPhotoRegions) {
    addIfNew('supportingPhoto', ROLE_DESCRIPTIONS.supportingPhoto);
  }

  for (const _ of analysis.programmePhotoRegions) {
    addIfNew('programmePhoto', ROLE_DESCRIPTIONS.programmePhoto);
  }

  for (const _ of analysis.managementPhotoRegions) {
    addIfNew('chairmanPortrait', ROLE_DESCRIPTIONS.chairmanPortrait);
  }

  if (analysis.leadLogoRegion) {
    addIfNew('leadLogo', ROLE_DESCRIPTIONS.leadLogo);
  }

  const missingCount = required.filter((r) => !r.provided).length;

  return {
    referenceId: analysis.referenceId,
    required,
    missingCount,
    totalCount: required.length,
  };
}

export function mapContent(
  analysis: ReferenceAnalysis,
  content: ReplacementContent,
): ContentMap {
  const mappings: RoleMapping[] = [];
  const missingAssets: ContentMap['missingAssets'] = [];
  const availableAssets: string[] = [];

  const addMapping = (referenceSlot: string, referenceRole: SlotRole, replacementAsset?: string, replacementContent?: string, confidence = 85): void => {
    mappings.push({
      referenceSlot,
      referenceRole,
      replacementAsset,
      replacementContent,
      preserved: !replacementAsset && !replacementContent,
      confidence,
    });
    if (replacementAsset) availableAssets.push(replacementAsset);
  };

  if (analysis.schoolLogoRegion && content.logoPath) {
    addMapping(analysis.schoolLogoRegion.id, 'schoolLogo', content.logoPath);
  } else if (analysis.schoolLogoRegion) {
    missingAssets.push({ role: 'schoolLogo', description: ROLE_DESCRIPTIONS.schoolLogo });
  }

  if (analysis.headerRegion) {
    if (content.school?.name) {
      addMapping('schoolName', 'schoolName', undefined, content.school.name, 90);
    }
    if (content.school?.address) {
      addMapping('schoolAddress', 'schoolAddress', undefined, content.school.address, 85);
    }
  }

  for (const mgmtRegion of analysis.managementPhotoRegions) {
    if (mgmtRegion.role === 'chairmanPortrait' && content.chairmanPhoto) {
      addMapping(mgmtRegion.id, 'chairmanPortrait', content.chairmanPhoto);
    } else if (mgmtRegion.role === 'principalPortrait' && content.principalPhoto) {
      addMapping(mgmtRegion.id, 'principalPortrait', content.principalPhoto);
    } else {
      missingAssets.push({ role: mgmtRegion.role, description: ROLE_DESCRIPTIONS[mgmtRegion.role] });
    }
  }

  if (content.headline) {
    addMapping('eventTitle', 'eventTitle', undefined, content.headline, 90);
  }

  if (content.details) {
    addMapping('posterDate', 'posterDate', undefined, content.details, 90);
  }

  if (analysis.heroPhotoRegion) {
    const heroAsset = content.photoPaths?.[0];
    if (heroAsset) {
      addMapping(analysis.heroPhotoRegion.id, 'heroPhoto', heroAsset);
    } else {
      missingAssets.push({ role: 'heroPhoto', description: ROLE_DESCRIPTIONS.heroPhoto });
    }
  }

  analysis.supportingPhotoRegions.forEach((region, i) => {
    const asset = content.photoPaths?.[i + 1];
    if (asset) {
      addMapping(region.id, 'supportingPhoto', asset);
    } else {
      addMapping(region.id, 'supportingPhoto', undefined, undefined, 30);
    }
  });

  analysis.programmePhotoRegions.forEach((region, i) => {
    const asset = content.photoPaths?.[i + 1 + analysis.supportingPhotoRegions.length];
    if (asset) {
      addMapping(region.id, 'programmePhoto', asset);
    } else {
      addMapping(region.id, 'programmePhoto', undefined, undefined, 30);
    }
  });

  if (content.message) {
    addMapping('quote', 'quote', undefined, content.message, 85);
  }

  if (content.school?.phone) {
    addMapping('footerPhone', 'footerPhone', undefined, content.school.phone, 90);
  }

  if (content.school?.academicYear) {
    addMapping('footerYear', 'footerYear', undefined, content.school.academicYear, 85);
  }

  if (analysis.leadLogoRegion && content.leadLogoPath) {
    addMapping(analysis.leadLogoRegion.id, 'leadLogo', content.leadLogoPath);
  } else if (analysis.leadLogoRegion) {
    missingAssets.push({ role: 'leadLogo', description: ROLE_DESCRIPTIONS.leadLogo });
  }

  return {
    referenceId: analysis.referenceId,
    mappings,
    missingAssets,
    availableAssets,
  };
}
