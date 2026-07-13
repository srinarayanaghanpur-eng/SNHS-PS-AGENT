import type { ComposeInput, Plan, PlanGroup, PlanNode, Rect, ResolvedAsset } from './types';
import { fitText } from './textFit';

const group = (name: string): PlanGroup => ({ name, nodes: [] });

export const DAILY_PRAYER_GROUPS = [
  '00_BACKGROUND',
  '01_DECORATIONS',
  '02_SCHOOL_HEADER',
  '03_TITLE_AND_DATE',
  '04_MANAGEMENT_PHOTOS',
  '05_STUDENT_PHOTOS',
  '06_PROGRAMME',
  '07_MESSAGE',
  '08_FOOTER',
  '09_EFFECTS',
] as const;

function cleanHex(value: string | undefined, fallback: string): string {
  return value && /^[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}

function dateLabel(raw: string | undefined, day: string): string {
  if (!raw?.trim()) return '';
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return day ? value.replace(new RegExp(`\\s*[·|—-]\\s*${day}$`, 'i'), '').trim() : value;
}

function fittedText(
  name: string,
  content: string,
  rect: Rect,
  font: string,
  maxSize: number,
  minSize: number,
  maxLines: number,
  hex: string,
  align: 'left' | 'center' | 'right',
  lineHeight = 1.18,
  tracking = 0,
  surfaceHex?: string,
): PlanNode {
  const fitted = fitText(content, rect, maxSize, minSize, maxLines, font, lineHeight, tracking);
  return {
    kind: 'text', name, content: fitted.lines.join('\r'), rect,
    font, size: fitted.size, minSize, maxLines, hex, align, lineHeight, tracking, surfaceHex,
  };
}

function photoNode(name: string, asset: ResolvedAsset, rect: Rect, mask: 'rounded' | 'circle' | 'none' = 'rounded'): PlanNode {
  return {
    kind: 'photo', name, path: asset.path, rect, mask,
    radius: mask === 'rounded' ? Math.round(rect.w * 0.06) : undefined,
    fit: mask === 'none' ? 'contain' : 'cover', focusY: 0.28,
    zoom: asset.crop?.zoom, offsetX: asset.crop?.offsetX, offsetY: asset.crop?.offsetY,
    effects: { shadow: { hex: '06152C', opacity: 36, distance: 5, size: 14, angle: 120 }, stroke: { hex: 'FFFFFF', size: 4, opacity: 90 } },
  };
}

export function composeDailyPrayer(input: ComposeInput): Plan {
  const W = input.width;
  const H = input.height;
  const sx = (value: number) => Math.round(value * W / 1080);
  const sy = (value: number) => Math.round(value * H / 1350);
  const r = (x: number, y: number, w: number, h: number): Rect => ({ x: sx(x), y: sy(y), w: sx(w), h: sy(h) });

  const primary = cleanHex(input.brand?.colors?.primary, '122E55');
  const secondary = cleanHex(input.brand?.colors?.secondary, '21599B');
  const accent = cleanHex(input.brand?.colors?.accent, 'F0B33D');
  const paper = cleanHex(input.brand?.colors?.background, 'F5F8FC');
  const white = 'FFFFFF';
  const ink = '102A4E';
  const muted = '60728A';
  const orange = 'C9531E';
  const heading = input.brand?.headingFont || 'Arial-BoldMT';
  const body = input.brand?.bodyFont || 'ArialMT';

  const background = group(DAILY_PRAYER_GROUPS[0]);
  const decorations = group(DAILY_PRAYER_GROUPS[1]);
  const header = group(DAILY_PRAYER_GROUPS[2]);
  const title = group(DAILY_PRAYER_GROUPS[3]);
  const management = group(DAILY_PRAYER_GROUPS[4]);
  const students = group(DAILY_PRAYER_GROUPS[5]);
  const programme = group(DAILY_PRAYER_GROUPS[6]);
  const message = group(DAILY_PRAYER_GROUPS[7]);
  const footer = group(DAILY_PRAYER_GROUPS[8]);
  const effects = group(DAILY_PRAYER_GROUPS[9]);

  if (input.assets?.background) {
    background.nodes.push({ kind: 'photo', name: 'BACKGROUND_IMAGE', path: input.assets.background.path, rect: r(0, 0, 1080, 1350), mask: 'none', fit: 'cover', focusY: 0.45 });
  }
  background.nodes.push({
    kind: 'gradient', name: 'ACADEMIC_NAVY_BACKGROUND', rect: r(0, 0, 1080, 1350),
    stops: [{ hex: primary, position: 0 }, { hex: secondary, position: 100 }], angle: 90,
    opacity: input.assets?.background ? 90 : 100,
  });

  decorations.nodes.push({ kind: 'rect', name: 'TOP_GOLD_RULE', rect: r(0, 0, 1080, 11), hex: accent });
  decorations.nodes.push({ kind: 'ellipse', name: 'ACADEMIC_HALO', rect: r(175, 14, 730, 315), hex: white, opacity: 7 });
  decorations.nodes.push({ kind: 'ellipse', name: 'DECORATIVE_ORBIT', rect: r(824, 356, 280, 280), hex: accent, opacity: 9 });
  decorations.nodes.push({ kind: 'rect', name: 'LEFT_ACCENT', rect: r(58, 98, 5, 1110), hex: accent, opacity: 82 });
  for (let i = 0; i < 5; i += 1) {
    decorations.nodes.push({ kind: 'ellipse', name: `ACADEMIC_DOT_${i + 1}`, rect: r(938 + i * 17, 394, 6, 6), hex: accent, opacity: 55 });
  }

  const mainLogo = input.assets?.mainLogo ?? (input.school.logoPath ? { path: input.school.logoPath } : undefined);
  const leadLogo = input.assets?.leadLogo;
  const showLead = input.brand?.showLead ?? true;
  const headerTop = 42;
  const logoSize = mainLogo ? 106 : 0;
  if (mainLogo) {
    header.nodes.push({ kind: 'rect', name: 'SCHOOL_LOGO_PLATE', rect: r(73, headerTop, logoSize, logoSize), hex: white, radius: sx(18), opacity: 96, effects: { shadow: { hex: '071A35', opacity: 30, distance: 4, size: 12, angle: 120 } } });
    header.nodes.push(photoNode('SCHOOL_LOGO', mainLogo, r(82, headerTop + 9, logoSize - 18, logoSize - 18), 'none'));
  }
  if (leadLogo && showLead) {
    header.nodes.push({ kind: 'rect', name: 'LEAD_LOGO_PLATE', rect: r(868, 53, 136, 76), hex: white, radius: sx(14), opacity: 96 });
    header.nodes.push(photoNode('LEAD_LOGO', leadLogo, r(880, 63, 112, 56), 'none'));
  }
  const headerX = mainLogo ? 205 : 80;
  const headerRight = leadLogo && showLead ? 848 : 1008;
  const schoolFit = fittedText('SCHOOL_NAME', input.school.name.toUpperCase(), r(headerX, 52, headerRight - headerX, 58), heading, sx(42), sx(24), 2, white, 'left', 1.08, 12, primary);
  header.nodes.push(schoolFit);
  header.nodes.push(fittedText('SCHOOL_ADDRESS', input.school.address, r(headerX, 116, headerRight - headerX, 35), body, sx(19), sx(13), 2, 'DCE8F7', 'left', 1.12, 0, primary));
  header.nodes.push({ kind: 'rect', name: 'HEADER_DIVIDER', rect: r(headerX, 163, Math.min(650, headerRight - headerX), 3), hex: accent, opacity: 92 });

  const titleFit = fittedText('POSTER_TITLE', input.headline.toUpperCase(), r(82, 205, 916, 118), heading, sx(58), sx(34), 2, white, 'center', 1.02, 8, primary);
  title.nodes.push(titleFit);
  if (input.subheadline?.trim()) {
    title.nodes.push(fittedText('POSTER_SUBTITLE', input.subheadline.trim(), r(120, 327, 840, 42), body, sx(28), sx(17), 2, 'E6EEF9', 'center', 1.1, 0, primary));
  }
  const day = input.prayer?.day?.trim() || '';
  const date = dateLabel(input.details, day);
  const dateBadgeW = day ? 430 : 310;
  const dateBadgeX = Math.round((1080 - dateBadgeW) / 2);
  title.nodes.push({ kind: 'rect', name: 'DATE_BADGE', rect: r(dateBadgeX, 384, dateBadgeW, 58), hex: accent, radius: sx(29), effects: { shadow: { hex: '071A35', opacity: 34, distance: 5, size: 12, angle: 120 } } });
  if (date) title.nodes.push(fittedText('DATE', date, r(dateBadgeX + 24, 399, day ? 276 : dateBadgeW - 48, 30), heading, sx(23), sx(15), 1, ink, 'center', 1, 0, accent));
  if (day) {
    title.nodes.push({ kind: 'rect', name: 'DAY_BADGE', rect: r(dateBadgeX + dateBadgeW - 136, 391, 126, 44), hex: orange, radius: sx(22) });
    title.nodes.push(fittedText('DAY', day.toUpperCase(), r(dateBadgeX + dateBadgeW - 128, 402, 110, 24), heading, sx(18), sx(13), 1, white, 'center', 1, 25, orange));
  }

  const realManagement = [
    { key: 'CHAIRMAN', person: input.management?.chairman },
    { key: 'PRINCIPAL', person: input.management?.principal },
  ].filter((entry) => entry.person?.show && entry.person.asset) as { key: string; person: NonNullable<typeof input.management>['chairman'] & { asset: ResolvedAsset } }[];
  const studentPhotos = input.photos.filter((photo) => Boolean(photo.path)).slice(0, 8);
  const hasVisuals = realManagement.length + studentPhotos.length > 0;
  const contentTop = 470;
  const panelX = 80;
  const panelW = hasVisuals ? 606 : 920;
  const visualX = 708;
  const visualW = 292;
  const items = (input.prayer?.programme?.length ? input.prayer.programme : ['Prayer Song', 'Pledge', 'Thought for the Day', 'News Headlines', 'Word of the Day', 'Quiz Question', 'Birthday Wishes', 'Principal’s Message', 'National Anthem']).slice(0, 14);
  const itemHeight = items.length > 10 ? 40 : items.length > 8 ? 46 : 51;
  const programmeH = Math.min(606, 76 + items.length * itemHeight + 24);

  programme.nodes.push({ kind: 'rect', name: 'PROGRAMME_PANEL_SHADOW', rect: r(panelX + 7, contentTop + 9, panelW, programmeH), hex: '06152C', radius: sx(24), opacity: 24 });
  programme.nodes.push({ kind: 'rect', name: 'PROGRAMME_PANEL', rect: r(panelX, contentTop, panelW, programmeH), hex: paper, radius: sx(24) });
  programme.nodes.push({ kind: 'rect', name: 'PROGRAMME_HEADER', rect: r(panelX, contentTop, panelW, 66), hex: accent, radius: sx(24) });
  programme.nodes.push({ kind: 'rect', name: 'PROGRAMME_HEADER_SQUARE_OFF', rect: r(panelX, contentTop + 38, panelW, 28), hex: accent });
  programme.nodes.push(fittedText('PROGRAMME_TITLE', 'MORNING PROGRAMME', r(panelX + 27, contentTop + 18, panelW - 54, 31), heading, sx(26), sx(17), 1, ink, 'left', 1, 35, accent));
  items.forEach((item, index) => {
    const y = contentTop + 78 + index * itemHeight;
    if (index % 2 === 0) programme.nodes.push({ kind: 'rect', name: `PROGRAMME_ROW_${String(index + 1).padStart(2, '0')}`, rect: r(panelX + 18, y - 5, panelW - 36, itemHeight - 3), hex: 'E7EEF7', radius: sx(12), opacity: 72 });
    programme.nodes.push({ kind: 'ellipse', name: `PROGRAMME_NUMBER_BADGE_${String(index + 1).padStart(2, '0')}`, rect: r(panelX + 30, y + 2, 31, 31), hex: index === items.length - 1 ? orange : secondary });
    programme.nodes.push(fittedText(`PROGRAMME_NUMBER_${String(index + 1).padStart(2, '0')}`, String(index + 1), r(panelX + 30, y + 8, 31, 20), heading, sx(15), sx(11), 1, white, 'center', 1, 0, secondary));
    programme.nodes.push(fittedText(`PROGRAMME_ITEM_${String(index + 1).padStart(2, '0')}`, item, r(panelX + 78, y + 2, panelW - 112, 33), body, sx(23), sx(15), 1, ink, 'left', 1.05, 0, paper));
  });

  const visualEntries: { type: 'management' | 'student'; name: string; designation?: string; asset: ResolvedAsset }[] = [
    ...realManagement.map((entry) => ({ type: 'management' as const, name: entry.person.name || entry.key[0] + entry.key.slice(1).toLowerCase(), designation: entry.person.designation || entry.key, asset: entry.person.asset })),
    ...studentPhotos.map((photo, index) => ({
      type: 'student' as const, name: photo.name || `Student ${index + 1}`, designation: photo.className,
      asset: { path: photo.path, crop: { zoom: photo.zoom ?? 1, offsetX: photo.offsetX ?? 0, offsetY: photo.offsetY ?? 0 } },
    })),
  ];
  if (visualEntries.length) {
    const cols = visualEntries.length === 1 ? 1 : 2;
    const rows = Math.ceil(visualEntries.length / cols);
    const gap = 14;
    const cellW = cols === 1 ? visualW : Math.floor((visualW - gap) / 2);
    const cellH = Math.floor((programmeH - (rows - 1) * gap) / rows);
    visualEntries.forEach((entry, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = visualX + col * (cellW + gap);
      const y = contentTop + row * (cellH + gap);
      const imageH = Math.max(70, cellH - 42);
      const rect = r(x, y, cellW, imageH);
      const target = entry.type === 'management' ? management : students;
      target.nodes.push(photoNode(`${entry.type === 'management' ? 'MANAGEMENT' : 'STUDENT'}_PHOTO_${index + 1}`, entry.asset, rect, entry.type === 'management' && cols === 1 ? 'circle' : 'rounded'));
      target.nodes.push(fittedText(`${entry.type === 'management' ? 'MANAGEMENT' : 'STUDENT'}_NAME_${index + 1}`, entry.name, r(x, y + imageH + 7, cellW, 18), heading, sx(15), sx(10), 1, white, 'center', 1, 0, secondary));
      if (entry.designation) target.nodes.push(fittedText(`${entry.type === 'management' ? 'MANAGEMENT' : 'STUDENT'}_ROLE_${index + 1}`, entry.designation, r(x, y + imageH + 25, cellW, 15), body, sx(12), sx(9), 1, 'D7E5F7', 'center', 1, 0, secondary));
    });
  }

  const messageY = contentTop + programmeH + 20;
  const footerY = 1240;
  const availableH = Math.max(105, footerY - messageY - 18);
  const prayerName = input.prayer?.prayerTitle?.trim();
  const thought = input.prayer?.thought?.trim();
  const mainMessage = input.message?.trim();
  const announcements = [input.prayer?.examInfo?.trim(), input.prayer?.festivalInfo?.trim()].filter(Boolean).join('  •  ');
  const cards = [
    prayerName ? { label: 'PRAYER', body: prayerName, accent: secondary } : null,
    thought ? { label: 'THOUGHT OF THE DAY', body: thought, accent } : null,
    mainMessage ? { label: 'MESSAGE', body: mainMessage, accent: orange } : null,
    announcements ? { label: 'SPECIAL ANNOUNCEMENT', body: announcements, accent } : null,
  ].filter(Boolean) as { label: string; body: string; accent: string }[];
  const visibleCards = cards.slice(0, availableH < 150 ? 2 : 4);
  if (visibleCards.length) {
    const cols = visibleCards.length === 1 ? 1 : 2;
    const rows = Math.ceil(visibleCards.length / cols);
    const gap = 14;
    const cardW = cols === 1 ? 920 : 453;
    const cardH = Math.min(Math.floor((availableH - (rows - 1) * gap) / rows), visibleCards.length <= 2 ? 158 : 126);
    visibleCards.forEach((card, index) => {
      const x = 80 + (index % cols) * (cardW + gap);
      const y = messageY + Math.floor(index / cols) * (cardH + gap);
      message.nodes.push({ kind: 'rect', name: `MESSAGE_CARD_${index + 1}`, rect: r(x, y, cardW, cardH), hex: white, radius: sx(18), opacity: 96, effects: { shadow: { hex: '071A35', opacity: 25, distance: 4, size: 12, angle: 120 } } });
      message.nodes.push({ kind: 'rect', name: `MESSAGE_ACCENT_${index + 1}`, rect: r(x, y, 8, cardH), hex: card.accent, radius: sx(4) });
      message.nodes.push(fittedText(`MESSAGE_LABEL_${index + 1}`, card.label, r(x + 27, y + 16, cardW - 49, 23), heading, sx(16), sx(11), 1, card.accent === accent ? ink : card.accent, 'left', 1, 45, white));
      message.nodes.push(fittedText(`MESSAGE_TEXT_${index + 1}`, card.body, r(x + 27, y + 45, cardW - 49, Math.max(34, cardH - 57)), body, sx(22), sx(13), cardH > 95 ? 3 : 2, ink, 'left', 1.15, 0, white));
    });
  }

  footer.nodes.push({ kind: 'gradient', name: 'FOOTER_GOLD_BAR', rect: r(0, footerY, 1080, 110), stops: [{ hex: accent, position: 0 }, { hex: 'D99523', position: 100 }], angle: 0 });
  footer.nodes.push({ kind: 'rect', name: 'FOOTER_TOP_RULE', rect: r(0, footerY, 1080, 5), hex: white, opacity: 70 });
  footer.nodes.push(fittedText('PHONE_NUMBER', `Phone: ${input.school.phone}`, r(64, footerY + 27, 360, 29), heading, sx(20), sx(13), 1, ink, 'left', 1, 0, accent));
  footer.nodes.push(fittedText('LEAD_BRANDING', 'Powered by LEAD Curriculum', r(610, footerY + 27, leadLogo && showLead ? 270 : 400, 29), heading, sx(20), sx(13), 1, ink, 'right', 1, 0, accent));
  footer.nodes.push(fittedText('FOOTER_ADDRESS', input.school.address, r(64, footerY + 65, 760, 24), body, sx(15), sx(10), 1, ink, 'left', 1, 0, accent));
  if (leadLogo && showLead) footer.nodes.push(photoNode('LEAD_LOGO_FOOTER', leadLogo, r(902, footerY + 19, 110, 58), 'none'));

  effects.nodes.push({ kind: 'gradient', name: 'BOTTOM_HIGHLIGHT', rect: r(0, 1338, 1080, 12), stops: [{ hex: orange, position: 0 }, { hex: accent, position: 100 }], angle: 0 });

  return {
    width: W, height: H, baseHex: primary,
    groups: [background, decorations, header, title, management, students, programme, message, footer, effects],
  };
}
