import type { ComposeInput, Plan, PlanGroup, PlanNode, Rect, ResolvedAsset } from './types';
import { DesignGenerationError } from './designGenerationError';
import { composeReferenceExactReconstruction } from './referenceExactFamily';
import type { ReferenceSceneGraph } from './reference/referenceTypes';

export const DAILY_PRAYER_FAMILIES = [
  'fullBleedAssemblyEditorial',
  'asymmetricStudentHero',
  'editorialPhotoSplit',
  'layeredPrayerCollage',
  'premiumEmblematicAssembly',
  'magazineProgrammeLayout',
  'referenceExactReconstruction',
] as const;
export type DailyPrayerFamily = typeof DAILY_PRAYER_FAMILIES[number];

const PHOTO_FAMILIES = new Set<DailyPrayerFamily>([
  'fullBleedAssemblyEditorial', 'asymmetricStudentHero', 'editorialPhotoSplit',
  'layeredPrayerCollage', 'magazineProgrammeLayout',
]);

interface Palette { ink: string; deep: string; mid: string; accent: string; paper: string; white: string; soft: string }
interface FamilyContext {
  input: ComposeInput; W: number; H: number; programme: string[]; family: DailyPrayerFamily;
  hero?: ResolvedAsset; secondary?: ResolvedAsset; palette: Palette; groups: Record<string, PlanGroup>;
}

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
const group = (name: string): PlanGroup => ({ name, nodes: [] });
const polygon = (name: string, points: [number, number][], hex: string, opacity = 100): PlanNode => ({ kind: 'polygon', name, points: points.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y) })), hex, opacity });
const label = (name: string, content: string, box: Rect, size: number, color: string, align: 'left' | 'center' | 'right' = 'left', font = 'ArialMT', minSize = 18, maxLines = 2): PlanNode => ({
  kind: 'text', name, content, rect: box, font, size: Math.round(size), minSize, maxLines, hex: color, align, lineHeight: 1.12,
});
const wrap = (value: string, max = 34): string => {
  const words = value.trim().split(/\s+/); const lines: string[] = []; let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > max) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line); return lines.join('\r');
};

function groups(): Record<string, PlanGroup> {
  return {
    background: group('00_BACKGROUND'), mainPhoto: group('01_MAIN_PHOTO'),
    overlay: group('02_DARK_OVERLAY'), branding: group('03_SCHOOL_BRANDING'),
    title: group('04_TITLE'), date: group('05_DATE'), message: group('06_QUOTE'),
    programme: group('07_PROGRAMME'), footer: group('08_FOOTER'), effects: group('09_EFFECTS'),
  };
}

function paletteFor(family: DailyPrayerFamily): Palette {
  if (family === 'fullBleedAssemblyEditorial') return { ink: '171A1F', deep: '201B2C', mid: '743E45', accent: 'F46D4C', paper: 'F4EBDD', white: 'FFFDF8', soft: 'D9C9B8' };
  if (family === 'asymmetricStudentHero') return { ink: '171321', deep: '28163B', mid: '0D6570', accent: 'FF6B6B', paper: 'F6EFE7', white: 'FFFFFF', soft: 'B9E3DE' };
  if (family === 'editorialPhotoSplit') return { ink: '16332F', deep: '143D36', mid: '3B796D', accent: 'E26D3D', paper: 'F4F0E6', white: 'FFFFFF', soft: 'C9D8CE' };
  if (family === 'layeredPrayerCollage') return { ink: '12162B', deep: '181B3A', mid: '7C2D69', accent: 'F4B942', paper: 'F7F1E3', white: 'FFFFFF', soft: 'D6C3E1' };
  if (family === 'magazineProgrammeLayout') return { ink: '151515', deep: '202020', mid: '305E73', accent: 'E34B3F', paper: 'F3EBDD', white: 'FFFFFF', soft: 'C6D4D9' };
  return { ink: '21152D', deep: '351A45', mid: '8A3B68', accent: 'F0A43A', paper: 'F8EFD9', white: 'FFFFFF', soft: 'DABBD1' };
}

function resolved(path?: string, asset?: ResolvedAsset): ResolvedAsset | undefined { return asset ?? (path ? { path } : undefined); }

function selectFamily(input: ComposeInput): { family: DailyPrayerFamily; hero?: ResolvedAsset; secondary?: ResolvedAsset; fallbackReason: string } {
  const assembly = input.assets?.assemblyPhoto;
  const student = input.assets?.studentPhoto;
  const campus = input.assets?.campusPhoto ?? input.assets?.background;
  const uploaded = input.photos.map((photo) => resolved(photo.path)).filter((asset): asset is ResolvedAsset => Boolean(asset));
  const anyHero = assembly ?? student ?? campus ?? uploaded[0];
  const requested = input.requestedCompositionFamily as DailyPrayerFamily | undefined;
  if (requested && !DAILY_PRAYER_FAMILIES.includes(requested)) {
    throw new DesignGenerationError({ code: 'VALID_COMPOSITION_NOT_AVAILABLE', requestedFamily: requested, attemptedFamilies: [...DAILY_PRAYER_FAMILIES], fallbackReason: 'Unknown Daily Prayer composition family.' });
  }
  if (requested) {
    const requestedHero = requested === 'asymmetricStudentHero' || requested === 'layeredPrayerCollage'
      ? (student ?? uploaded[0] ?? assembly ?? campus)
      : (assembly ?? campus ?? uploaded[0] ?? student);
    if (PHOTO_FAMILIES.has(requested) && !requestedHero) {
      throw new DesignGenerationError({ code: 'VALID_COMPOSITION_NOT_AVAILABLE', requestedFamily: requested, missingAssets: ['assemblyPhoto or studentPhoto or campusPhoto'], attemptedFamilies: [requested], fallbackReason: 'The requested composition is photo-dependent.' });
    }
    if (requested === 'premiumEmblematicAssembly' && anyHero) {
      throw new DesignGenerationError({ code: 'VALID_COMPOSITION_NOT_AVAILABLE', requestedFamily: requested, attemptedFamilies: [requested], fallbackReason: 'A supplied hero image would be omitted by the requested no-photo family.' });
    }
    return { family: requested, hero: requestedHero, secondary: campus ?? assembly ?? student ?? uploaded[1], fallbackReason: 'REQUESTED_FAMILY_VALIDATED' };
  }
  if (assembly) {
    const choices: DailyPrayerFamily[] = ['fullBleedAssemblyEditorial', 'editorialPhotoSplit', 'magazineProgrammeLayout'];
    return { family: choices[input.variationSeed % choices.length], hero: assembly, secondary: student ?? campus ?? uploaded[0], fallbackReason: 'AUTO_ASSEMBLY_PHOTO_MATCH' };
  }
  if (student) {
    const choices: DailyPrayerFamily[] = ['asymmetricStudentHero', 'layeredPrayerCollage', 'magazineProgrammeLayout'];
    return { family: choices[input.variationSeed % choices.length], hero: student, secondary: campus ?? uploaded[0], fallbackReason: 'AUTO_STUDENT_PHOTO_MATCH' };
  }
  if (campus || uploaded[0]) {
    const choices: DailyPrayerFamily[] = ['magazineProgrammeLayout', 'editorialPhotoSplit', 'fullBleedAssemblyEditorial'];
    return { family: choices[input.variationSeed % choices.length], hero: campus ?? uploaded[0], secondary: uploaded[1], fallbackReason: 'AUTO_GENERAL_HERO_MATCH' };
  }
  return { family: 'premiumEmblematicAssembly', fallbackReason: 'AUTO_NO_PHOTO_EMBLEMATIC_MATCH' };
}

function addBranding(ctx: FamilyContext, dark = true): void {
  const { input, W, groups: g, palette: p } = ctx;
  const color = dark ? p.white : p.ink; const x = 58; const y = 42; const logo = input.assets?.mainLogo;
  if (logo) g.branding.nodes.push({ kind: 'photo', name: 'SCHOOL_LOGO', rect: rect(x, y, 74, 74), path: logo.path, mask: 'none', fit: 'contain' });
  const tx = logo ? 150 : x;
  g.branding.nodes.push(label('SCHOOL_NAME', input.school.name, rect(tx, y + 2, 650, 38), 30, color, 'left', input.brand?.headingFont || 'Arial-BoldMT', 20, 1));
  g.branding.nodes.push(label('SCHOOL_ADDRESS', input.school.address, rect(tx, y + 42, 690, 30), 18, dark ? p.soft : p.mid, 'left', input.brand?.bodyFont || 'ArialMT', 13, 1));
  g.branding.nodes.push(polygon('BRAND_ACCENT_SLASH', [[tx, y + 78], [tx + 150, y + 78], [tx + 134, y + 84], [tx, y + 84]], p.accent));
  const lead = input.assets?.leadLogo;
  if (lead) g.branding.nodes.push({ kind: 'photo', name: 'LEAD_LOGO', rect: rect(W - 160, 44, 100, 62), path: lead.path, mask: 'none', fit: 'contain' });
}

function addFooter(ctx: FamilyContext, dark = true): void {
  const { input, W, H, groups: g, palette: p } = ctx; const y = H - 92;
  g.footer.nodes.push(polygon('FOOTER_WEDGE', [[0, y - 18], [W, y], [W, H], [0, H]], dark ? p.ink : p.paper, 96));
  g.footer.nodes.push(label('PHONE_NUMBER', `Phone: ${input.school.phone}`, rect(58, y + 18, 270, 28), 20, dark ? p.white : p.ink, 'left', 'Arial-BoldMT', 16, 1));
  g.footer.nodes.push(label('FOOTER_ADDRESS', input.school.address, rect(58, y + 50, 610, 25), 15, dark ? p.soft : p.mid, 'left', 'ArialMT', 12, 1));
  g.footer.nodes.push(label('LEAD_BRANDING', 'Powered by LEAD Curriculum', rect(W - 380, y + 25, 320, 34), 20, dark ? p.white : p.ink, 'right', 'Arial-BoldMT', 15, 1));
}

function addTitle(ctx: FamilyContext, box: Rect, color: string, align: 'left' | 'center' | 'right' = 'left', size = 68): void {
  const title = ctx.input.headline.toUpperCase().replace('DAILY PRAYER PROCEEDINGS', 'DAILY PRAYER\rPROCEEDINGS');
  ctx.groups.title.nodes.push(label('MAIN_TITLE', title, box, size, color, align, ctx.input.brand?.headingFont || 'Arial-BoldMT', 38, 2));
}

function addDateBadge(ctx: FamilyContext, x: number, y: number, darkText = false): void {
  const { input, groups: g, palette: p } = ctx; const day = (input.prayer?.day || 'TODAY').toUpperCase();
  g.date.nodes.push(polygon('DATE_BADGE', [[x, y], [x + 290, y], [x + 272, y + 62], [x, y + 62]], p.accent));
  g.date.nodes.push(label('POSTER_DATE', input.details || '', rect(x + 18, y + 15, 184, 30), 23, darkText ? p.ink : p.white, 'left', 'Arial-BoldMT', 17, 1));
  g.date.nodes.push(label('POSTER_DAY', day, rect(x + 198, y + 15, 70, 30), 18, darkText ? p.ink : p.white, 'right', 'Arial-BoldMT', 14, 1));
}

function addQuote(ctx: FamilyContext, box: Rect, color: string, accent: string): void {
  const message = ctx.input.message || 'Let us begin the day with discipline, confidence and positive thoughts.';
  ctx.groups.message.nodes.push(label('QUOTE_MARK', '“', rect(box.x, box.y - 14, 45, 60), 58, accent, 'left', 'Georgia-Bold', 36, 1));
  ctx.groups.message.nodes.push(label('PRAYER_MESSAGE_QUOTE', wrap(message, 38), rect(box.x + 42, box.y, box.w - 42, box.h), 25, color, 'left', 'Georgia-Italic', 18, 4));
}

function addTimeline(ctx: FamilyContext, x: number, y: number, width: number, rowH: number, color: string): void {
  const { groups: g, programme, palette: p } = ctx;
  g.programme.nodes.push(label('PROGRAMME_HEADING', 'MORNING PROGRAMME', rect(x, y - 50, width, 34), 24, p.accent, 'left', 'Arial-BoldMT', 18, 1));
  g.programme.nodes.push({ kind: 'rect', name: 'PROGRAMME_TIMELINE_SPINE', rect: rect(x + 22, y + 10, 4, rowH * (programme.length - 1)), hex: p.accent, opacity: 75 });
  programme.forEach((item, i) => {
    const yy = y + i * rowH; const offset = i % 2 ? 26 : 0;
    g.programme.nodes.push({ kind: 'ellipse', name: `PROGRAMME_NUMBER_BADGE_${i + 1}`, rect: rect(x + 4, yy, 42, 42), hex: i === programme.length - 1 ? p.accent : p.mid });
    g.programme.nodes.push(label(`PROGRAMME_NUMBER_${i + 1}`, String(i + 1), rect(x + 4, yy + 7, 42, 25), 18, p.white, 'center', 'Arial-BoldMT', 15, 1));
    g.programme.nodes.push(label(`PROGRAMME_ITEM_${i + 1}`, item, rect(x + 62 + offset, yy + 5, width - 70 - offset, 32), 23, color, 'left', 'ArialMT', 18, 1));
  });
}

function addTwoColumnProgramme(ctx: FamilyContext, x: number, y: number, width: number, color: string): void {
  const { groups: g, programme, palette: p } = ctx; const colW = width / 2; const rowH = 84;
  g.programme.nodes.push(label('PROGRAMME_HEADING', 'MORNING PROGRAMME', rect(x, y - 62, width, 38), 25, p.accent, 'left', 'Arial-BoldMT', 18, 1));
  programme.forEach((item, i) => {
    const col = i % 2; const row = Math.floor(i / 2); const xx = x + col * colW; const yy = y + row * rowH;
    g.programme.nodes.push(label(`PROGRAMME_NUMBER_${i + 1}`, String(i + 1).padStart(2, '0'), rect(xx, yy, 58, 52), 38, p.accent, 'left', 'Arial-BoldMT', 28, 1));
    g.programme.nodes.push(label(`PROGRAMME_ITEM_${i + 1}`, wrap(item, 20), rect(xx + 62, yy + 7, colW - 74, 54), 22, color, 'left', 'ArialMT', 17, 2));
    g.programme.nodes.push(polygon(`PROGRAMME_RULE_${i + 1}`, [[xx + 62, yy + 61], [xx + colW - 18, yy + 61], [xx + colW - 30, yy + 65], [xx + 62, yy + 65]], p.mid, 38));
  });
}

function addCompactGrid(ctx: FamilyContext, x: number, y: number, width: number, color: string): void {
  const { groups: g, programme, palette: p } = ctx; const cols = 3; const gap = 16; const colW = (width - gap * 2) / 3; const rowH = 92;
  g.programme.nodes.push(label('PROGRAMME_HEADING', 'MORNING PROGRAMME', rect(x, y - 54, width, 36), 24, p.accent, 'left', 'Arial-BoldMT', 18, 1));
  programme.forEach((item, i) => {
    const xx = x + (i % cols) * (colW + gap); const yy = y + Math.floor(i / cols) * rowH;
    g.programme.nodes.push(polygon(`PROGRAMME_TAB_${i + 1}`, [[xx, yy], [xx + colW, yy], [xx + colW - 14, yy + 74], [xx, yy + 74]], i % 2 ? p.mid : p.ink, 90));
    g.programme.nodes.push(label(`PROGRAMME_NUMBER_${i + 1}`, String(i + 1), rect(xx + 10, yy + 13, 30, 32), 25, p.accent, 'left', 'Arial-BoldMT', 20, 1));
    g.programme.nodes.push(label(`PROGRAMME_ITEM_${i + 1}`, wrap(item, 16), rect(xx + 44, yy + 12, colW - 54, 50), 18, color, 'left', 'ArialMT', 15, 2));
  });
}

function fullBleed(ctx: FamilyContext): void {
  const { W, H, hero, groups: g, palette: p } = ctx;
  g.mainPhoto.nodes.push({ kind: 'photo', name: 'HERO_ASSEMBLY_PHOTO', rect: rect(0, 0, W, H), path: hero!.path, mask: 'none', fit: 'cover', focusY: 0.36 });
  g.overlay.nodes.push({ kind: 'gradient', name: 'HERO_DARK_SCRIM', rect: rect(0, 0, W, H), stops: [{ hex: p.ink, position: 0 }, { hex: p.deep, position: 52 }, { hex: p.mid, position: 100 }], angle: 15, opacity: 78 });
  g.overlay.nodes.push(polygon('EDITORIAL_DIAGONAL_FIELD', [[0, 0], [760, 0], [620, H], [0, H]], p.ink, 62));
  addBranding(ctx, true); addTitle(ctx, rect(62, 155, 620, 180), p.white, 'left', 68); addDateBadge(ctx, 62, 344);
  addQuote(ctx, rect(62, 430, 590, 120), p.paper, p.accent); addTimeline(ctx, 64, 620, 560, 58, p.white); addFooter(ctx, true);
}

function asymmetric(ctx: FamilyContext): void {
  const { W, H, hero, groups: g, palette: p } = ctx;
  g.background.nodes.push({ kind: 'gradient', name: 'ASYMMETRIC_BG', rect: rect(0, 0, W, H), stops: [{ hex: p.deep, position: 0 }, { hex: p.mid, position: 100 }], angle: 120 });
  g.mainPhoto.nodes.push({ kind: 'photo', name: 'HERO_STUDENT_PHOTO', rect: rect(W * 0.49, 0, W * 0.51, H), path: hero!.path, mask: 'none', fit: 'cover', focusY: 0.3 });
  g.overlay.nodes.push(polygon('ASYMMETRIC_OVERLAP', [[0, 0], [650, 0], [510, H], [0, H]], p.deep, 96));
  g.overlay.nodes.push(polygon('CORAL_DEPTH_RIBBON', [[430, 0], [540, 0], [400, H], [320, H]], p.accent, 80));
  addBranding(ctx, true); addTitle(ctx, rect(58, 158, 430, 178), p.white, 'left', 64); addDateBadge(ctx, 58, 340);
  addQuote(ctx, rect(58, 430, 400, 136), p.soft, p.accent); addTimeline(ctx, 58, 640, 400, 57, p.white); addFooter(ctx, true);
}

function photoSplit(ctx: FamilyContext): void {
  const { W, H, hero, groups: g, palette: p } = ctx; const split = Math.round(W * 0.47);
  g.mainPhoto.nodes.push({ kind: 'photo', name: 'HERO_PHOTO_SPLIT', rect: rect(0, 0, split, H), path: hero!.path, mask: 'none', fit: 'cover', focusY: 0.35 });
  g.background.nodes.push({ kind: 'gradient', name: 'EDITORIAL_PAPER', rect: rect(split, 0, W - split, H), stops: [{ hex: p.paper, position: 0 }, { hex: p.soft, position: 100 }], angle: 90 });
  g.overlay.nodes.push(polygon('PHOTO_SPLIT_CHEVRON', [[split - 70, 0], [split + 35, 0], [split - 45, H], [split - 125, H]], p.accent, 94));
  g.overlay.nodes.push({ kind: 'gradient', name: 'PHOTO_SPLIT_SCRIM', rect: rect(0, 0, split, H), stops: [{ hex: p.ink, position: 0 }, { hex: p.deep, position: 100 }], angle: 90, opacity: 45 });
  addBranding(ctx, false); addTitle(ctx, rect(split + 55, 150, W - split - 90, 178), p.ink, 'left', 58); addDateBadge(ctx, split + 55, 336, true);
  addQuote(ctx, rect(58, 850, split - 112, 170), p.white, p.accent); addTwoColumnProgramme(ctx, split + 55, 525, W - split - 90, p.ink); addFooter(ctx, true);
}

function collage(ctx: FamilyContext): void {
  const { W, H, hero, secondary, groups: g, palette: p } = ctx;
  const bg = secondary ?? ctx.input.assets?.campusPhoto ?? hero;
  g.mainPhoto.nodes.push({ kind: 'photo', name: 'COLLAGE_CAMPUS_HERO', rect: rect(0, 0, W, H), path: bg!.path, mask: 'none', fit: 'cover', focusY: 0.45 });
  g.overlay.nodes.push({ kind: 'gradient', name: 'COLLAGE_COLOR_WASH', rect: rect(0, 0, W, H), stops: [{ hex: p.deep, position: 0 }, { hex: p.mid, position: 100 }], angle: 45, opacity: 76 });
  g.overlay.nodes.push(polygon('COLLAGE_LEFT_PLANE', [[0, 0], [665, 0], [520, 850], [0, 980]], p.deep, 88));
  g.overlay.nodes.push(polygon('COLLAGE_GOLD_SLASH', [[635, 120], [710, 92], [610, 850], [535, 880]], p.accent, 86));
  g.mainPhoto.nodes.push({ kind: 'photo', name: 'HERO_STUDENT_COLLAGE', rect: rect(610, 185, 405, 615), path: hero!.path, mask: 'rounded', radius: 54, fit: 'cover', focusY: 0.28, effects: { shadow: { hex: '000000', opacity: 55, distance: 18, size: 36, angle: 120 }, stroke: { hex: p.paper, size: 5, opacity: 90 } } });
  addBranding(ctx, true); addTitle(ctx, rect(58, 160, 500, 180), p.white, 'left', 63); addDateBadge(ctx, 58, 348);
  addQuote(ctx, rect(58, 440, 470, 140), p.soft, p.accent); addCompactGrid(ctx, 58, 890, W - 116, p.white); addFooter(ctx, true);
}

function premiumEmblematic(ctx: FamilyContext): void {
  const { W, H, groups: g, palette: p } = ctx;
  g.background.nodes.push({ kind: 'gradient', name: 'EMBLEMATIC_BG', rect: rect(0, 0, W, H), stops: [{ hex: p.deep, position: 0 }, { hex: p.mid, position: 60 }, { hex: p.ink, position: 100 }], angle: 90 });
  // Purposeful sunrise and prayer-book emblem: every ellipse/polygon belongs to
  // the focal illustration, never generic decoration.
  g.overlay.nodes.push({ kind: 'ellipse', name: 'FOCAL_SUNRISE_DISC', rect: rect(W / 2 - 122, 178, 244, 244), hex: p.accent, opacity: 94, effects: { glow: { hex: p.accent, opacity: 48, size: 38 } } });
  for (let i = 0; i < 7; i++) {
    const x = W / 2 + (i - 3) * 88;
    g.overlay.nodes.push(polygon(`FOCAL_SUN_RAY_${i + 1}`, [[W / 2 - 18, 330], [W / 2 + 18, 330], [x + 30, 535], [x - 30, 535]], p.accent, 24));
  }
  g.overlay.nodes.push(polygon('FOCAL_OPEN_BOOK_LEFT', [[270, 490], [520, 430], [520, 650], [270, 715], [220, 670]], p.paper, 96));
  g.overlay.nodes.push(polygon('FOCAL_OPEN_BOOK_RIGHT', [[560, 430], [810, 490], [860, 670], [560, 650]], p.white, 96));
  g.overlay.nodes.push(polygon('FOCAL_PRAYER_HAND_LEFT', [[420, 570], [505, 440], [535, 470], [505, 640]], p.soft, 98));
  g.overlay.nodes.push(polygon('FOCAL_PRAYER_HAND_RIGHT', [[575, 440], [660, 570], [575, 640], [545, 470]], p.soft, 98));
  addBranding(ctx, true); addTitle(ctx, rect(85, 650, W - 170, 130), p.white, 'center', 58); addDateBadge(ctx, W / 2 - 145, 785);
  addQuote(ctx, rect(150, 855, W - 300, 92), p.paper, p.accent); addCompactGrid(ctx, 58, 995, W - 116, p.white); addFooter(ctx, true);
}

function magazine(ctx: FamilyContext): void {
  const { W, H, hero, groups: g, palette: p } = ctx;
  g.background.nodes.push({ kind: 'rect', name: 'MAGAZINE_PAPER', rect: rect(0, 0, W, H), hex: p.paper });
  g.mainPhoto.nodes.push({ kind: 'photo', name: 'HERO_MAGAZINE_CROP', rect: rect(W * 0.47, 0, W * 0.53, H * 0.56), path: hero!.path, mask: 'none', fit: 'cover', focusY: 0.3 });
  g.overlay.nodes.push(polygon('MAGAZINE_BLACK_FIELD', [[0, 0], [610, 0], [490, 770], [0, 720]], p.ink, 98));
  g.overlay.nodes.push(polygon('MAGAZINE_RED_CUT', [[455, 0], [535, 0], [410, 770], [330, 748]], p.accent, 92));
  addBranding(ctx, true); addTitle(ctx, rect(58, 160, 430, 190), p.white, 'left', 64); addDateBadge(ctx, 58, 366);
  addQuote(ctx, rect(58, 458, 390, 150), p.soft, p.accent); addTwoColumnProgramme(ctx, 58, 820, W - 116, p.ink); addFooter(ctx, true);
}

export function composeDailyPrayerEditorial(input: ComposeInput): Plan {
  const selected = selectFamily(input); const g = groups();
  const programme = (input.prayer?.programme?.length ? input.prayer.programme : [
    'Prayer Song', 'Pledge', 'Thought for the Day', 'News Headlines', 'Word of the Day',
    'Quiz Question', 'Birthday Wishes', 'Principal’s Message', 'National Anthem',
  ]).slice(0, 9);
  const ctx: FamilyContext = { input, W: input.width, H: input.height, programme, family: selected.family, hero: selected.hero, secondary: selected.secondary, palette: paletteFor(selected.family), groups: g };
  if (selected.family === 'fullBleedAssemblyEditorial') fullBleed(ctx);
  else if (selected.family === 'asymmetricStudentHero') asymmetric(ctx);
  else if (selected.family === 'editorialPhotoSplit') photoSplit(ctx);
  else if (selected.family === 'layeredPrayerCollage') collage(ctx);
  else if (selected.family === 'magazineProgrammeLayout') magazine(ctx);
  else premiumEmblematic(ctx);

  const plan: Plan = { width: input.width, height: input.height, baseHex: ctx.palette.deep, groups: Object.values(g) };
  const used = plan.groups.flatMap((item) => item.nodes).filter((node): node is Extract<PlanNode, { kind: 'photo' }> => node.kind === 'photo').map((node) => node.path);
  plan.metadata = {
    compositionFamily: selected.family,
    requestedCompositionFamily: input.requestedCompositionFamily,
    fallbackReason: selected.fallbackReason,
    rendererName: 'immutable-design-plan-jsx', legacyRendererUsed: false,
    heroImagePath: selected.hero?.path,
    assetUsage: { used: [...new Set(used)], missing: [], invalid: [] },
  };
  return plan;
}
