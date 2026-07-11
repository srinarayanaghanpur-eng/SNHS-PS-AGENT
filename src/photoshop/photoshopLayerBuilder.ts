import type { DetectedRegion, ReferenceProject, SchoolProfile } from '../types';
import { log } from '../utils/logger';
import { psCreateDocument, psAddGroup, psAddTextLayer, psPlaceImage, psSetVisibility, psMoveLayerIntoGroup, psSetOpacity } from '../bridge/apiClient';

export interface BuildLayersResult {
  docId: number;
  groupIds: Record<string, number>;
  layerCount: number;
  failedCount: number;
  errors: string[];
}

const GROUP_NAMES = [
  '01_BACKGROUND', '02_DECORATIONS', '03_MAIN_IMAGES', '04_STUDENT_PHOTOS',
  '05_EVENT_TEXT', '06_SCHOOL_BRANDING', '07_CONTACT_DETAILS', '08_EFFECTS', '09_FOOTER'
] as const;

const GROUP_FOR_ROLE: Record<string, string> = {
  background: '01_BACKGROUND', decorative_element: '02_DECORATIONS', icon: '02_DECORATIONS',
  event_image: '03_MAIN_IMAGES', student_photo: '04_STUDENT_PHOTOS', birthday_photo: '04_STUDENT_PHOTOS',
  achievement_photo: '04_STUDENT_PHOTOS', teacher_photo: '04_STUDENT_PHOTOS',
  poster_title: '05_EVENT_TEXT', event_name: '05_EVENT_TEXT', event_date: '05_EVENT_TEXT', event_description: '05_EVENT_TEXT',
  school_name: '06_SCHOOL_BRANDING', school_logo: '06_SCHOOL_BRANDING', academic_year: '06_SCHOOL_BRANDING',
  school_phone: '07_CONTACT_DETAILS', school_address: '07_CONTACT_DETAILS', email: '07_CONTACT_DETAILS', website: '07_CONTACT_DETAILS',
  contact_information: '07_CONTACT_DETAILS', social_media: '07_CONTACT_DETAILS', school_address_element: '07_CONTACT_DETAILS',
  footer: '09_FOOTER', powered_by_lead: '09_FOOTER'
};

function groupForRegion(r: DetectedRegion): string {
  const mapped = r.semanticRole ? GROUP_FOR_ROLE[r.semanticRole] : undefined;
  if (mapped) return mapped;
  switch (r.kind) {
    case 'logo': return '06_SCHOOL_BRANDING';
    case 'face': case 'person': return '03_MAIN_IMAGES';
    case 'shape': return '02_DECORATIONS';
    case 'background': return '01_BACKGROUND';
    case 'decoration': return '02_DECORATIONS';
    default: return '05_EVENT_TEXT';
  }
}

export async function buildPhotoshopLayers(
  project: ReferenceProject,
  profile: SchoolProfile
): Promise<BuildLayersResult> {
  const errors: string[] = [];
  let layerCount = 0;
  let failedCount = 0;

  const createResult = await psCreateDocument(
    project.reference.width,
    project.reference.height,
    project.reference.resolution,
    `SNHS_${project.name}`.slice(0, 60)
  );
  const docIdMatch = createResult.stdout?.match(/DOC_ID:(\d+)/);
  const docId = docIdMatch ? Number(docIdMatch[1]) : -1;

  const groupIds: Record<string, number> = {};
  for (const g of GROUP_NAMES) {
    try {
      const result = await psAddGroup(g);
      const idMatch = result.stdout?.match(/LAYER_ID:(\d+)/);
      if (idMatch) { groupIds[g] = Number(idMatch[1]); layerCount++; }
    } catch (err) {
      errors.push(`Failed to create group ${g}: ${String(err)}`);
      failedCount++;
    }
  }

  for (const region of project.regions) {
    try {
      await placeRegion(region, groupIds, profile, project);
      layerCount++;
    } catch (err) {
      errors.push(`Failed to place region ${region.id} (${region.semanticRole ?? region.kind}): ${String(err)}`);
      failedCount++;
    }
  }

  return { docId, groupIds, layerCount, failedCount, errors };
}

async function placeRegion(
  region: DetectedRegion,
  groupIds: Record<string, number>,
  profile: SchoolProfile,
  project: ReferenceProject
): Promise<void> {
  const groupName = groupForRegion(region);
  const groupId = groupIds[groupName];
  if (!groupId) return;

  if (region.kind === 'text' && region.text) {
    const result = await psAddTextLayer(
      getReplacementText(region, profile),
      profile.preferredFonts[0] ?? 'Arial',
      Math.round(Math.max(10, region.bounds.height * 0.6)),
      [26, 26, 26],
      region.bounds.left,
      region.bounds.top,
      'center'
    );
    const idMatch = result.stdout?.match(/LAYER_ID:(\d+)/);
    if (idMatch) {
      if (!region.replace) await psSetVisibility(Number(idMatch[1]), false);
      await psMoveLayerIntoGroup(Number(idMatch[1]), groupId);
    }
    return;
  }

  if (region.kind === 'face' || region.kind === 'person') {
    const result = await psPlaceImage('', 'Placeholder');
    const idMatch = result.stdout?.match(/LAYER_ID:(\d+)/);
    if (idMatch) {
      await psSetOpacity(Number(idMatch[1]), 30);
      await psMoveLayerIntoGroup(Number(idMatch[1]), groupId);
    }
    return;
  }
}

function getReplacementText(region: DetectedRegion, profile: SchoolProfile): string {
  if (!region.replace) return region.text ?? '';
  switch (region.semanticRole) {
    case 'school_name': return profile.schoolName;
    case 'school_phone': return `Ph: ${profile.phone}`;
    case 'school_address': return profile.location;
    case 'academic_year': return profile.academicYear;
    case 'email': return profile.email || (region.text ?? '');
    case 'website': return profile.website || (region.text ?? '');
    case 'contact_information': return [profile.phone && `Ph: ${profile.phone}`, profile.email, profile.website].filter(Boolean).join('  ·  ');
    default: return region.text ?? '';
  }
}

export { buildPhotoshopLayers as buildLayerStructure };
