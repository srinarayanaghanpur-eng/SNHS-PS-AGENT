/**
 * Pure planning: decide WHERE each piece of new school identity goes before
 * touching Photoshop. Replaced regions inherit their original position/size,
 * so the reference poster's layout is preserved; identity items with no
 * original counterpart go into a footer band.
 */
import type { DetectedRegion, ReferenceProject, SemanticRole, AssetRole, OnlineAssetRequirement } from '../types';
import { fitText, type TextFit } from '../repair/textFitting';

export interface PlannedText {
  group: string;
  name: string;
  text: string;
  box: { left: number; top: number; width: number; height: number };
  fit: TextFit;
  justification: 'left' | 'center' | 'right';
  sourceRegionId?: string;
  isTelugu: boolean;
  display: boolean;
}

export interface PlannedImage {
  group: string;
  name: string;
  mediaRole: 'logo' | 'chairman' | 'principal';
  box: { left: number; top: number; width: number; height: number };
}

export interface PlannedOnlineAsset {
  role: AssetRole;
  group: string;
  name: string;
  localPath: string;
  sourceUrl: string;
  box: { left: number; top: number; width: number; height: number };
  opacity: number;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'softLight';
  licence: string;
}

export interface BrandingPlan {
  texts: PlannedText[];
  images: PlannedImage[];
  onlineAssets: PlannedOnlineAsset[];
  onlineAssetRequirements: OnlineAssetRequirement[];
}

const GROUP_FOR: Partial<Record<SemanticRole, string>> = {
  school_name: '06_SCHOOL_BRANDING',
  academic_year: '06_SCHOOL_BRANDING',
  school_phone: '07_CONTACT_DETAILS',
  school_address: '07_CONTACT_DETAILS',
  contact_information: '07_CONTACT_DETAILS',
  footer: '09_FOOTER',
  poster_title: '05_EVENT_TEXT',
  poster_subtitle: '05_EVENT_TEXT',
  event_date: '05_EVENT_TEXT',
  event_description: '05_EVENT_TEXT'
};

function replacementFor(role: SemanticRole | undefined, p: ReferenceProject['profileSnapshot']): { name: string; text: string } | undefined {
  switch (role) {
    case 'school_name': return { name: 'School Name', text: p.schoolName };
    case 'school_phone': return { name: 'Phone Number', text: `Ph: ${[p.phone, ...p.altPhones].filter(Boolean).join(', ')}` };
    case 'school_address': return { name: 'Footer Address', text: p.location };
    case 'academic_year': return { name: 'Academic Year', text: p.academicYear };
    case 'contact_information': return {
      name: 'Contact Details',
      text: [p.phone && `Ph: ${p.phone}`, p.email, p.website].filter(Boolean).join('  ·  ')
    };
    default: return undefined;
  }
}

function centered(box: { left: number; width: number }, canvasWidth: number): 'left' | 'center' | 'right' {
  const mid = box.left + box.width / 2;
  return Math.abs(mid - canvasWidth / 2) < canvasWidth * 0.12 ? 'center' : box.left < canvasWidth / 2 ? 'left' : 'right';
}

export function buildBrandingPlan(project: ReferenceProject, onlineReqs: OnlineAssetRequirement[] = []): BrandingPlan {
  const p = project.profileSnapshot;
  const W = project.reference.width, H = project.reference.height;
  const texts: PlannedText[] = [];
  const images: PlannedImage[] = [];
  const plannedOnline: PlannedOnlineAsset[] = [];
  const placedRoles = new Set<SemanticRole>();
  const usesTelugu = (t: string) => /[ఀ-౿]/.test(t);

  // 1. Replace in place: every replace-flagged region with a known counterpart.
  for (const r of project.regions.filter(r => r.replace && r.kind === 'text')) {
    const rep = replacementFor(r.semanticRole, p);
    if (!rep || !rep.text.trim()) continue;
    // grow the box slightly — new names are often longer (e.g. SRI NARAYANA HIGH SCHOOL)
    const grow = r.semanticRole === 'school_name' ? 0.25 : 0.1;
    const box = {
      left: Math.max(0, Math.round(r.bounds.left - r.bounds.width * grow / 2)),
      top: r.bounds.top,
      width: Math.min(W, Math.round(r.bounds.width * (1 + grow))),
      height: r.bounds.height
    };
    if (box.left + box.width > W) box.left = Math.max(0, W - box.width);
    texts.push({
      group: GROUP_FOR[r.semanticRole ?? 'unknown'] ?? '06_SCHOOL_BRANDING',
      name: rep.name,
      text: rep.text,
      box,
      fit: fitText(rep.text, { width: box.width, height: box.height, maxLines: r.semanticRole === 'school_name' ? 2 : 3 }),
      justification: centered(box, W),
      sourceRegionId: r.id,
      isTelugu: usesTelugu(rep.text),
      display: r.semanticRole === 'school_name'
    });
    if (r.semanticRole) placedRoles.add(r.semanticRole);
  }

  // 2. Logo replacement: replace-flagged logo regions, else top-left slot.
  if ((p.media.logo?.length ?? 0) > 0) {
    const logoRegion = project.regions.find(r => r.replace && (r.kind === 'logo' || r.semanticRole === 'school_logo'));
    const box = logoRegion
      ? { left: logoRegion.bounds.left, top: logoRegion.bounds.top, width: logoRegion.bounds.width, height: logoRegion.bounds.height }
      : { left: Math.round(W * 0.03), top: Math.round(H * 0.02), width: Math.round(Math.min(W, H) * 0.12), height: Math.round(Math.min(W, H) * 0.12) };
    images.push({ group: '06_SCHOOL_BRANDING', name: 'School Logo', mediaRole: 'logo', box });
  }

  // 3. Mandatory identity with no original counterpart → footer band.
  const footerTop = Math.round(H * 0.93);
  const footerItems: { name: string; text: string; role: SemanticRole }[] = [];
  if (!placedRoles.has('school_name'))
    footerItems.push({ name: 'School Name', text: p.schoolName, role: 'school_name' });
  if (!placedRoles.has('school_phone') && !placedRoles.has('contact_information') && p.phone)
    footerItems.push({ name: 'Phone Number', text: `Ph: ${p.phone}`, role: 'school_phone' });
  if (!placedRoles.has('school_address') && p.location)
    footerItems.push({ name: 'Footer Address', text: p.location, role: 'school_address' });
  if (!placedRoles.has('academic_year') && p.academicYear)
    footerItems.push({ name: 'Academic Year', text: p.academicYear, role: 'academic_year' });
  if (p.curriculum) footerItems.push({ name: 'Curriculum Branding', text: p.curriculum, role: 'powered_by_lead' });

  const bandH = Math.round(H * 0.055);
  footerItems.forEach((item, i) => {
    const cols = Math.min(footerItems.length, 3);
    const col = i % cols, row = Math.floor(i / cols);
    const box = {
      left: Math.round((W / cols) * col + W * 0.01),
      top: footerTop - row * bandH,
      width: Math.round(W / cols - W * 0.02),
      height: bandH - 4
    };
    texts.push({
      group: '09_FOOTER', name: item.name, text: item.text, box,
      fit: fitText(item.text, { width: box.width, height: box.height, maxLines: 2 }),
      justification: 'center', isTelugu: usesTelugu(item.text), display: false
    });
  });

  for (const req of onlineReqs) {
    if (!req.selectedAssetPath) continue;
    const role = req.role;
    const group = role === 'heroBackground' ? '01_BACKGROUND' :
      role === 'decorativeOverlay' || role === 'lightEffect' || role === 'confetti' ? '03_OVERLAYS' :
      role === 'academicIcon' || role === 'scheduleIcons' ? '08_ICONS' :
      role === 'texture' ? '02_TEXTURES' : '04_DECORATIONS';
    const box = {
      left: Math.round(W * 0.05),
      top: Math.round(H * 0.05),
      width: Math.round(W * 0.9),
      height: Math.round(H * 0.9)
    };
    const name = role === 'heroBackground' ? `ONLINE_BG_${req.searchQuery.split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}` :
      role === 'decorativeOverlay' || role === 'lightEffect' || role === 'confetti' ? `ONLINE_PNG_${role.charAt(0).toUpperCase() + role.slice(1)}` :
      role === 'academicIcon' ? `ONLINE_ICON_${role.charAt(0).toUpperCase() + role.slice(1)}` :
      `ONLINE_DECOR_${role.charAt(0).toUpperCase() + role.slice(1)}`;
    plannedOnline.push({
      role,
      group,
      name,
      localPath: req.selectedAssetPath,
      sourceUrl: req.sourceUrl || '',
      box,
      opacity: role === 'heroBackground' ? 1.0 :
        role === 'lightEffect' ? 0.4 :
        role === 'texture' ? 0.3 : 0.7,
      blendMode: role === 'lightEffect' ? 'screen' :
        role === 'texture' ? 'multiply' :
        role === 'decorativeOverlay' ? 'overlay' : 'normal',
      licence: req.licenceStatus || ''
    });
  }

  return { texts, images, onlineAssets: plannedOnline, onlineAssetRequirements: onlineReqs };
}
