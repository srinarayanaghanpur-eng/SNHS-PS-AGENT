import type { ComposeInput, Plan, PlanGroup, PlanNode, Rect } from './types';
import { shade, mix } from './composer';
import { fitText } from './textFit';

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
const group = (name: string): PlanGroup => ({ name, nodes: [] });
const r = (x: number, y: number, w: number, h: number): Rect => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });

interface CatPalette { bgA: string; bgB: string; accent: string; panel: string; textOnDark: string; textOnLight: string; muted: string }
interface CatLayout { familyName: string; description: string }

const DEFAULT_PALETTE = { bgA: '14325C', bgB: '1E4B85', accent: 'E9A83B', panel: 'F2F8FF', textOnDark: 'FFFFFF', textOnLight: '2D2D2D', muted: '6B7280' };

function buildPlan(input: ComposeInput, groups: PlanGroup[], pal: CatPalette, familyName: string): Plan {
  const W = input.width; const H = input.height;
  const ordered: PlanGroup[] = [
    groups['bg'] || group('00_BACKGROUND'),
    groups['deco'] || group('01_DECORATION'),
    groups['branding'] || group('02_BRANDING'),
    groups['headline'] || group('03_HEADLINE'),
    groups['content'] || group('04_CONTENT'),
    groups['photos'] || group('05_PHOTOS'),
    groups['footer'] || group('06_FOOTER'),
  ];
  const plan: Plan = { width: W, height: H, baseHex: pal.bgA, groups: ordered };
  plan.metadata = { compositionFamily: familyName, rendererName: 'category-family', legacyRendererUsed: false };
  return plan;
}

function addBranding(input: ComposeInput, g: Record<string, PlanGroup>, W: number, pal: CatPalette): void {
  const x = Math.round(W * 0.05); const y = Math.round(W * 0.04);
  const logo = input.assets?.mainLogo;
  const logoSize = Math.round(W * 0.08);
  if (logo) g.branding.nodes.push({ kind: 'photo', name: 'SCHOOL_LOGO', rect: rect(x, y, logoSize, logoSize), path: logo.path, mask: 'none', fit: 'contain' });
  const tx = logo ? x + logoSize + Math.round(W * 0.03) : x;
  g.branding.nodes.push({ kind: 'text', name: 'SCHOOL_NAME', content: input.school.name, rect: rect(tx, y, W * 0.6, Math.round(W * 0.03)), font: input.brand?.headingFont || 'Arial-BoldMT', size: Math.round(W * 0.025), minSize: 16, maxLines: 1, hex: pal.textOnDark, align: 'left', surfaceHex: pal.bgA });
  g.branding.nodes.push({ kind: 'text', name: 'SCHOOL_ADDRESS', content: input.school.address, rect: rect(tx, y + Math.round(W * 0.032), W * 0.6, Math.round(W * 0.02)), font: input.brand?.bodyFont || 'ArialMT', size: Math.round(W * 0.014), minSize: 11, maxLines: 1, hex: pal.muted, align: 'left', surfaceHex: pal.bgA });
  if (input.assets?.leadLogo) {
    g.branding.nodes.push({ kind: 'photo', name: 'LEAD_LOGO', rect: rect(W - Math.round(W * 0.12), y, Math.round(W * 0.09), Math.round(W * 0.055)), path: input.assets.leadLogo.path, mask: 'none', fit: 'contain' });
  }
  g.branding.nodes.push({ kind: 'rect', name: 'HEADER_RULE', rect: rect(x, y + Math.round(W * 0.06), Math.round(W * 0.2), 3), hex: pal.accent });
}

function addFooterBasic(input: ComposeInput, g: Record<string, PlanGroup>, W: number, H: number, pal: CatPalette): void {
  const fh = Math.round(H * 0.07);
  const fy = H - fh;
  g.footer.nodes.push({ kind: 'rect', name: 'FOOTER_BAR', rect: rect(0, fy, W, fh), hex: pal.bgB });
  g.footer.nodes.push({ kind: 'text', name: 'FOOTER_PHONE', content: `Phone: ${input.school.phone}`, rect: rect(Math.round(W * 0.05), fy + Math.round(fh * 0.2), W * 0.5, Math.round(fh * 0.35)), font: input.brand?.bodyFont || 'ArialMT', size: Math.round(W * 0.016), minSize: 12, maxLines: 1, hex: pal.textOnDark, align: 'left', surfaceHex: pal.bgB });
  g.footer.nodes.push({ kind: 'text', name: 'FOOTER_YEAR', content: input.school.academicYear, rect: rect(W * 0.5, fy + Math.round(fh * 0.2), W * 0.45, Math.round(fh * 0.35)), font: input.brand?.bodyFont || 'ArialMT', size: Math.round(W * 0.016), minSize: 12, maxLines: 1, hex: pal.textOnDark, align: 'right', surfaceHex: pal.bgB });
}

function addHeadline(input: ComposeInput, g: Record<string, PlanGroup>, W: number, pal: CatPalette): number {
  const head = input.headline || 'ANNOUNCEMENT';
  const sub = input.subheadline;
  let cursorY = Math.round(W * 0.1);
  const headSize = Math.round(W * 0.045);
  g.headline.nodes.push({ kind: 'text', name: 'MAIN_TITLE', content: head, rect: rect(Math.round(W * 0.05), cursorY, W * 0.9, headSize * 2.2), font: input.brand?.headingFont || 'Arial-BoldMT', size: headSize, minSize: 24, maxLines: 2, hex: pal.textOnDark, align: 'center', surfaceHex: pal.bgA });
  cursorY += headSize * 2.2 + Math.round(W * 0.02);
  g.headline.nodes.push({ kind: 'rect', name: 'TITLE_UNDERLINE', rect: rect(Math.round(W / 2 - W * 0.08), cursorY, Math.round(W * 0.16), 4), hex: pal.accent });
  cursorY += Math.round(W * 0.04);
  if (sub) {
    g.headline.nodes.push({ kind: 'text', name: 'SUBTITLE', content: sub, rect: rect(Math.round(W * 0.08), cursorY, W * 0.84, Math.round(W * 0.03)), font: input.brand?.bodyFont || 'ArialMT', size: Math.round(W * 0.02), minSize: 14, maxLines: 1, hex: pal.muted, align: 'center', surfaceHex: pal.bgA });
    cursorY += Math.round(W * 0.04);
  }
  return cursorY;
}

function addMessage(input: ComposeInput, g: Record<string, PlanGroup>, W: number, startY: number, pal: CatPalette, maxH?: number): number {
  const msg = input.message || '';
  if (!msg) return startY;
  const mh = maxH || Math.round(W * 0.3);
  g.content.nodes.push({ kind: 'text', name: 'CONTENT_BODY', content: msg, rect: rect(Math.round(W * 0.08), startY, W * 0.84, mh), font: input.brand?.bodyFont || 'ArialMT', size: Math.round(W * 0.018), minSize: 13, maxLines: 8, hex: pal.textOnLight, align: 'left', lineHeight: 1.4, surfaceHex: pal.panel });
  return startY + mh + Math.round(W * 0.03);
}

function addDetails(input: ComposeInput, g: Record<string, PlanGroup>, W: number, startY: number, pal: CatPalette): number {
  const detail = input.details || input.venue || '';
  if (!detail) return startY;
  g.content.nodes.push({ kind: 'text', name: 'DETAIL_LINE', content: detail, rect: rect(Math.round(W * 0.08), startY, W * 0.84, Math.round(W * 0.03)), font: input.brand?.bodyFont || 'ArialMT', size: Math.round(W * 0.017), minSize: 12, maxLines: 1, hex: pal.accent, align: 'center', surfaceHex: pal.panel });
  return startY + Math.round(W * 0.04);
}

function addPhotos(input: ComposeInput, g: Record<string, PlanGroup>, W: number, startY: number, maxH: number, pal: CatPalette): number {
  const photos = input.photos || [];
  if (!photos.length) return startY;
  const count = Math.min(photos.length, 6);
  const gap = Math.round(W * 0.02);
  const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const photoSize = Math.min(Math.round((W * 0.84 - gap * (cols - 1)) / cols), Math.round(maxH / rows - gap));
  const totalW = cols * photoSize + gap * (cols - 1);
  const startX = Math.round((W - totalW) / 2);
  for (let i = 0; i < count; i++) {
    const col = i % cols; const row = Math.floor(i / cols);
    const px = startX + col * (photoSize + gap);
    const py = startY + row * (photoSize + gap);
    g.photos.nodes.push({ kind: 'rect', name: `PHOTO_${i + 1}_FRAME`, rect: rect(px - 4, py - 4, photoSize + 8, photoSize + 8), hex: pal.accent, radius: 6, effects: { shadow: { hex: '000000', opacity: 30, distance: 4, size: 10, angle: 120 } } });
    g.photos.nodes.push({ kind: 'photo', name: `PHOTO_${i + 1}`, rect: rect(px, py, photoSize, photoSize), path: photos[i].path, mask: 'rounded', radius: 4, fit: 'cover' });
    if (photos[i].name) {
      g.photos.nodes.push({ kind: 'text', name: `PHOTO_${i + 1}_NAME`, content: photos[i].name || '', rect: rect(px, py + photoSize + 4, photoSize, Math.round(W * 0.025)), font: 'ArialMT', size: Math.round(W * 0.013), minSize: 10, maxLines: 1, hex: pal.textOnLight, align: 'center', surfaceHex: pal.panel });
    }
  }
  return startY + rows * (photoSize + gap) + Math.round(W * 0.04);
}

function composeCategoryPoster(input: ComposeInput, pal: CatPalette, familyName: string): Plan {
  const W = input.width; const H = input.height;
  const g: Record<string, PlanGroup> = {
    bg: group('00_BACKGROUND'), deco: group('01_DECORATION'),
    branding: group('02_BRANDING'), headline: group('03_HEADLINE'),
    content: group('04_CONTENT'), photos: group('05_PHOTOS'), footer: group('06_FOOTER'),
  };
  g.bg.nodes.push({ kind: 'gradient', name: 'BG_GRADIENT', rect: r(0, 0, W, H), stops: [{ hex: pal.bgA, position: 0 }, { hex: pal.bgB, position: 100 }], angle: 90 });
  g.bg.nodes.push({ kind: 'ellipse', name: 'BG_GLOW', rect: r(Math.round(W * 0.1), Math.round(H * 0.15), Math.round(W * 0.8), Math.round(H * 0.4)), hex: pal.bgB, opacity: 30 });
  addBranding(input, g, W, pal);
  const titleEnd = addHeadline(input, g, W, pal);
  addFooterBasic(input, g, W, H, pal);
  const footerH = Math.round(H * 0.07);
  const contentArea = H - footerH - Math.round(W * 0.12);
  let cursorY = titleEnd + Math.round(W * 0.03);
  const msgEnd = addMessage(input, g, W, cursorY, pal);
  cursorY = msgEnd + Math.round(W * 0.02);
  cursorY = addDetails(input, g, W, cursorY, pal);
  const photoH = Math.max(100, contentArea - cursorY);
  addPhotos(input, g, W, cursorY, photoH, pal);
  return buildPlan(input, g, pal, familyName);
}

export function composeAdmissionsPoster(input: ComposeInput): Plan {
  return composeCategoryPoster(input, DEFAULT_PALETTE, 'admissionsHero');
}

export function composeBirthdayPoster(input: ComposeInput): Plan {
  const pal: CatPalette = { bgA: 'FFE4E6', bgB: 'FECDD3', accent: 'E11D48', panel: 'FFF1F2', textOnDark: 'FFFFFF', textOnLight: '2D2D2D', muted: '6B7280' };
  return composeCategoryPoster(input, pal, 'portraitCelebration');
}

export function composeAchievementPoster(input: ComposeInput): Plan {
  const pal: CatPalette = { bgA: '1E3A5F', bgB: '2D5A8E', accent: 'F5B400', panel: 'F0F4F8', textOnDark: 'FFFFFF', textOnLight: '1E3A5F', muted: '6B7280' };
  return composeCategoryPoster(input, pal, 'goldAwardEditorial');
}

export function composeHolidayPoster(input: ComposeInput): Plan {
  const pal: CatPalette = { bgA: '166534', bgB: '22C55E', accent: 'FACC15', panel: 'F0FDF4', textOnDark: 'FFFFFF', textOnLight: '2D2D2D', muted: '6B7280' };
  return composeCategoryPoster(input, pal, 'formalNotice');
}

export function composeRecruitmentPoster(input: ComposeInput): Plan {
  const pal: CatPalette = { bgA: '1E293B', bgB: '334155', accent: '3B82F6', panel: 'F8FAFC', textOnDark: 'FFFFFF', textOnLight: '1E293B', muted: '6B7280' };
  return composeCategoryPoster(input, pal, 'professionalHiring');
}

export function composeFestivalPoster(input: ComposeInput): Plan {
  const pal: CatPalette = { bgA: '7C2D12', bgB: 'C2410C', accent: 'FCD34D', panel: 'FFF7ED', textOnDark: 'FFFFFF', textOnLight: '2D2D2D', muted: '6B7280' };
  return composeCategoryPoster(input, pal, 'culturalGreeting');
}

export function composeSportsPoster(input: ComposeInput): Plan {
  const pal: CatPalette = { bgA: '1E3A5F', bgB: '0F766E', accent: '22C55E', panel: 'F0FDF4', textOnDark: 'FFFFFF', textOnLight: '1E3A5F', muted: '6B7280' };
  return composeCategoryPoster(input, pal, 'dynamicAction');
}

export function composeCustomPoster(input: ComposeInput): Plan {
  const pal: CatPalette = { bgA: '1E1B4B', bgB: '312E81', accent: '818CF8', panel: 'EEF2FF', textOnDark: 'FFFFFF', textOnLight: '1E1B4B', muted: '6B7280' };
  return composeCategoryPoster(input, pal, 'customPoster');
}

const CATEGORY_MAP: Record<string, (input: ComposeInput) => Plan> = {
  'admissions-open': composeAdmissionsPoster,
  'school-reopening': composeHolidayPoster,
  'holiday-notice': composeHolidayPoster,
  'birthday-wishes': composeBirthdayPoster,
  'student-achievement': composeAchievementPoster,
  'award-congratulations': composeAchievementPoster,
  'exam-notice': composeHolidayPoster,
  'results-announcement': composeAchievementPoster,
  'fee-notice': composeHolidayPoster,
  'transport-notice': composeHolidayPoster,
  'teacher-recruitment': composeRecruitmentPoster,
  'staff-announcement': composeHolidayPoster,
  'festival-greetings': composeFestivalPoster,
  'national-day': composeFestivalPoster,
  'sports-event': composeSportsPoster,
  'cultural-event': composeFestivalPoster,
  'parent-meeting': composeHolidayPoster,
  'educational-awareness': composeHolidayPoster,
  'health-camp': composeHolidayPoster,
  'competition': composeAchievementPoster,
  'educational-quote': composeBirthdayPoster,
  'general-announcement': composeHolidayPoster,
  'social-media-promo': composeBirthdayPoster,
  'custom': composeCustomPoster,
};

export function composeForCategory(input: ComposeInput): Plan {
  const composer = CATEGORY_MAP[input.category];
  if (composer) return composer(input);
  return composeCategoryPoster(input, DEFAULT_PALETTE, 'generalAnnouncement');
}
