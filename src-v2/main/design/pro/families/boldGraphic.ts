// Bold Graphic Design Family
// Characteristics: large geometric colour regions, oversized title, high contrast,
// knockout text, controlled diagonal/vertical/split composition, cropped photos
// interacting with graphic shapes, minimal structural decoration.

import type { SceneGraph, Rect, GroupNode } from '../sceneGraph';
import type { DerivedPalette } from '../colour';
import type { FontPairing } from '../typography';
import type { BatchPhotoAnalysis } from '../photo';
import type { ContentInput } from '../nodeFactory';
import { makeSceneGraph, makeGroup, makeText, makeImage, makeShape, makeLine, makeGradient, makeGradientDef } from '../nodeFactory';

export function composeBoldGraphic(
  width: number,
  height: number,
  palette: DerivedPalette,
  typography: FontPairing,
  photoBatch: BatchPhotoAnalysis,
  content: ContentInput,
  seed: number
): SceneGraph {
  const sg = makeSceneGraph(width, height, palette, 'bold-graphic', seed);
  const safeMargin = Math.round(Math.min(width, height) * 0.04);
  const contentWidth = width - safeMargin * 2;
  const contentHeight = height - safeMargin * 2;

  // Split composition type
  const splitType = seed % 3; // 0=diagonal, 1=vertical, 2=horizontal
  let zIdx = 0;

  // 00_BACKGROUND - split color region or bold gradient
  const bgGroup = makeGroup('00_BACKGROUND', 'background', 0, 0, width, height, zIdx++);

  switch (splitType) {
    case 0: { // Diagonal split
      const splitAngle = seed % 2 === 0 ? 45 : -45;
      bgGroup.children.push(makeGradient('BG_DIAGONAL', 'background',
        { x: 0, y: 0, w: width, h: height },
        makeGradientDef('linear', [
          { color: palette.primary, position: 0 },
          { color: palette.secondary, position: 60 },
          { color: palette.background, position: 100 },
        ], splitAngle), zIdx++));
      // Bold geometric shape in the color region
      bgGroup.children.push(makeShape('BG_SHAPE', 'structuralGraphic',
        { x: Math.round(width * 0.05), y: Math.round(height * 0.05), w: Math.round(width * 0.5), h: Math.round(height * 0.5) },
        { fill: palette.accent, opacity: 0.08, radius: 0 }, zIdx++, { opacity: 8 }));
      break;
    }
    case 1: { // Vertical split - left/right
      const splitX = Math.round(width * 0.42);
      bgGroup.children.push(makeShape('BG_LEFT', 'background', { x: 0, y: 0, w: splitX, h: height },
        { fill: palette.primary, radius: 0 }, zIdx++));
      bgGroup.children.push(makeShape('BG_RIGHT', 'background', { x: splitX, y: 0, w: width - splitX, h: height },
        { fill: palette.background, radius: 0 }, zIdx++));
      // Accent stripe along the split
      bgGroup.children.push(makeShape('BG_SPLIT_STRIPE', 'structuralGraphic',
        { x: splitX - 4, y: 0, w: 8, h: height }, { fill: palette.accent, radius: 0 }, zIdx++));
      break;
    }
    default: { // Horizontal split - top/bottom
      const splitY = Math.round(height * 0.55);
      bgGroup.children.push(makeGradient('BG_TOP', 'background',
        { x: 0, y: 0, w: width, h: splitY },
        makeGradientDef('linear', [
          { color: palette.primaryDark, position: 0 },
          { color: palette.primary, position: 100 },
        ], 90), zIdx++));
      bgGroup.children.push(makeShape('BG_BOTTOM', 'background', { x: 0, y: splitY, w: width, h: height - splitY },
        { fill: palette.background, radius: 0 }, zIdx++));
      bgGroup.children.push(makeShape('BG_ACCENT_BAND', 'structuralGraphic',
        { x: 0, y: splitY - 6, w: width, h: 12 }, { fill: palette.accent, radius: 0 }, zIdx++));
    }
  }

  // 01_STRUCTURAL_GRAPHICS - bold, minimal
  const structGroup = makeGroup('01_STRUCTURAL_GRAPHICS', 'structuralGraphic', 0, 0, width, height, zIdx++);
  structGroup.children.push(makeLine('EDGE_LINE_TOP', 'structuralGraphic',
    { x: safeMargin, y: safeMargin, w: Math.round(width * 0.15), h: 0 }, palette.accent, 3, zIdx++));
  structGroup.children.push(makeLine('EDGE_LINE_BOTTOM', 'structuralGraphic',
    { x: width - safeMargin - Math.round(width * 0.15), y: height - safeMargin, w: Math.round(width * 0.15), h: 0 }, palette.accent, 3, zIdx++));

  // 02_HEADER - school branding, compact
  const headerGroup = makeGroup('02_HEADER', 'header', safeMargin, Math.round(height * 0.03), contentWidth, Math.round(height * 0.08), zIdx++);
  if (content.school.logoPath) {
    headerGroup.children.push(makeImage('SCHOOL_LOGO', 'header', content.school.logoPath,
      { x: safeMargin, y: Math.round(height * 0.03), w: Math.round(height * 0.05), h: Math.round(height * 0.05) },
      'contain', 'none', zIdx++, palette));
  }
  headerGroup.children.push(makeText('SCHOOL_NAME', 'schoolIdentity', content.school.name,
    { x: safeMargin + Math.round(height * 0.07), y: Math.round(height * 0.035), w: Math.round(contentWidth * 0.6), h: Math.round(height * 0.035) },
    typography, 'schoolIdentity', palette, zIdx++));

  // 03_TITLE_DATE - oversized, positioned in the bold color region
  let titleX: number, titleY: number, titleW: number, titleH: number;
  let titleAlign: 'left' | 'center' | 'right' = 'center';

  switch (splitType) {
    case 0: { // Diagonal - title follows the diagonal
      titleX = Math.round(width * 0.08);
      titleY = Math.round(height * 0.18);
      titleW = Math.round(contentWidth * 0.55);
      titleH = Math.round(height * 0.22);
      titleAlign = 'left';
      break;
    }
    case 1: { // Vertical - title spans the light region
      titleX = Math.round(width * 0.48);
      titleY = Math.round(height * 0.25);
      titleW = Math.round(contentWidth * 0.45);
      titleH = Math.round(height * 0.2);
      break;
    }
    default: { // Horizontal - title in top dark region, knockout
      titleX = Math.round(width * 0.1);
      titleY = Math.round(height * 0.12);
      titleW = Math.round(contentWidth * 0.8);
      titleH = Math.round(height * 0.25);
    }
  }

  const titleGroup = makeGroup('03_TITLE_DATE', 'displayTitle', titleX, titleY, titleW, titleH, zIdx++);
  const dateStr = content.details || '';

  // Date badge/pill
  titleGroup.children.push(makeShape('DATE_BADGE', 'dateLabel',
    { x: titleX, y: titleY, w: Math.round(titleW * 0.35), h: Math.round(height * 0.03) },
    { fill: palette.accent, radius: Math.round(height * 0.015) }, zIdx++));
  titleGroup.children.push(makeText('DATE_LABEL', 'dateLabel', dateStr,
    { x: titleX + Math.round(height * 0.01), y: titleY + Math.round(height * 0.004), w: Math.round(titleW * 0.3), h: Math.round(height * 0.02) },
    typography, 'dateLabel', palette, zIdx++, { color: palette.textOnAccent, textCase: 'uppercase' }));

  // Main title - oversized
  titleGroup.children.push(makeText('MAIN_TITLE', 'displayTitle', content.headline,
    { x: titleX, y: titleY + Math.round(height * 0.04), w: titleW, h: Math.round(height * 0.15) },
    typography, 'displayTitle', palette, zIdx++, {
      fontSize: splitType === 2 ? Math.round(width * 0.08) : Math.round(width * 0.065),
      align: titleAlign,
      textCase: 'uppercase',
      color: splitType === 2 ? '#FFFFFF' : palette.textPrimary,
      tracking: -10,
    }));

  if (content.subheadline) {
    titleGroup.children.push(makeText('SUBTITLE', 'subtitle', content.subheadline,
      { x: titleX, y: titleY + Math.round(height * 0.18), w: Math.round(titleW * 0.8), h: Math.round(height * 0.035) },
      typography, 'subtitle', palette, zIdx++, { color: splitType === 2 ? palette.textOnDark : palette.textSecondary }));
  }

  // 04_MANAGEMENT - compact, placed alongside the main graphic split
  const mgmtGroup = makeGroup('04_MANAGEMENT', 'managementPhoto', 0, 0, contentWidth, Math.round(height * 0.1), zIdx++);
  const managerEntries = [
    content.management?.chairman?.show ? { person: content.management.chairman, role: 'CHAIRMAN' } : null,
    content.management?.principal?.show ? { person: content.management.principal, role: 'PRINCIPAL' } : null,
  ].filter(Boolean) as { person: NonNullable<ContentInput['management']>['chairman'] & { asset: { path: string } }; role: string }[];

  if (managerEntries.length > 0) {
    const mgmtY = Math.round(height * 0.42);
    managerEntries.forEach((m, i) => {
      const pd = Math.round(height * 0.07);
      const mgmtX = safeMargin + i * (pd + Math.round(height * 0.03));
      mgmtGroup.children.push(makeImage(`${m.role}_PHOTO`, 'managementPhoto', m.person.asset!.path,
        { x: mgmtX, y: mgmtY, w: pd, h: pd }, 'cover', 'circle', zIdx++, palette));
      mgmtGroup.children.push(makeText(`${m.role}_NAME`, 'managementName', m.person.name || m.role,
        { x: mgmtX - Math.round(pd * 0.3), y: mgmtY + pd + Math.round(height * 0.01), w: pd * 1.6, h: Math.round(height * 0.025) },
        typography, 'managementName', palette, zIdx++));
    });
  }

  // 05_STUDENT_PHOTOS - bold placement interacting with the graphic split
  const photoGroup = makeGroup('05_STUDENT_PHOTOS', 'studentPhoto', 0, 0, width, height, zIdx++);
  if (photoBatch.photos.length > 0) {
    const hero = photoBatch.heroCandidate;
    if (hero && splitType === 1) {
      // In vertical split, photo goes in the dark left panel, overlapping the split line
      const pX = Math.round(width * 0.02);
      const pW = Math.round(width * 0.42);
      const pH = Math.round(pW / hero.aspectRatio);
      const pY = Math.round(height * 0.35);
      photoGroup.children.push(makeImage('HERO_PHOTO', 'studentPhoto', 'PLACEHOLDER',
        { x: pX, y: pY, w: pW, h: Math.min(pH, Math.round(height * 0.4)) },
        'cover', 'rect', zIdx++, palette, { blendMode: 'multiply' }));
    } else if (hero && splitType === 2) {
      // In horizontal split, photo sits in the bottom light region
      const pH = Math.round(contentHeight * 0.4);
      const pW = Math.round(pH * hero.aspectRatio);
      const pX = Math.round(width * 0.55);
      const pY = Math.round(height * 0.65);
      photoGroup.children.push(makeImage('HERO_PHOTO', 'studentPhoto', 'PLACEHOLDER',
        { x: pX, y: pY, w: pW, h: pH }, 'cover', 'none', zIdx++, palette));
    } else {
      // Default bold placement
      const pW = Math.round(contentWidth * 0.35);
      const pH = Math.round(pW / 1.4);
      photoGroup.children.push(makeImage('HERO_PHOTO', 'studentPhoto', 'PLACEHOLDER',
        { x: Math.round(width * 0.58), y: Math.round(height * 0.35), w: pW, h: pH },
        'cover', 'rect', zIdx++, palette));
    }

    // Remaining photos in a controlled overlap arrangement
    const others = photoBatch.secondaryCandidates.slice(0, 3);
    others.forEach((p, i) => {
      const s = Math.round(height * 0.06);
      const ox = Math.round(width * 0.52 + i * (s * 0.4));
      const oy = Math.round(height * 0.65 + i * (s * 0.4));
      photoGroup.children.push(makeImage(`PHOTO_${i + 1}`, 'studentPhoto', 'PLACEHOLDER',
        { x: ox, y: oy, w: s, h: s }, 'cover', 'circle', zIdx++, palette));
    });
  }

  // 06_PROGRAMME - compact, integrated with the bold composition
  const progGroup = makeGroup('06_PROGRAMME', 'programmeHeading', 0, 0, Math.round(contentWidth * 0.45), Math.round(contentHeight * 0.4), zIdx++);
  let progX: number, progY: number;
  switch (splitType) {
    case 0: { progX = Math.round(width * 0.52); progY = Math.round(height * 0.45); break; }
    case 1: { progX = Math.round(width * 0.5); progY = Math.round(height * 0.55); break; }
    default: { progX = Math.round(width * 0.1); progY = Math.round(height * 0.65); break; }
  }
  progGroup.rect = { x: progX, y: progY, w: Math.round(contentWidth * 0.42), h: Math.round(contentHeight * 0.3) };

  if (content.programme && content.programme.length > 0) {
    progGroup.children.push(makeText('PROG_HEADING', 'programmeHeading', 'SCHEDULE',
      { x: progX, y: progY, w: Math.round(contentWidth * 0.35), h: Math.round(height * 0.03) },
      typography, 'programmeHeading', palette, zIdx++, {
        tracking: 80, textCase: 'uppercase',
        color: splitType === 2 ? palette.textOnDark : palette.textPrimary,
      }));
    const itemStartY = progY + Math.round(height * 0.045);
    content.programme.slice(0, 10).forEach((item, i) => {
      const iy = itemStartY + i * Math.round(height * 0.028);
      progGroup.children.push(makeText(`PROG_${i + 1}`, 'programmeItem', `${i + 1}. ${item}`,
        { x: progX, y: iy, w: Math.round(contentWidth * 0.4), h: Math.round(height * 0.022) },
        typography, 'programmeItem', palette, zIdx++, {
          color: splitType === 2 ? palette.textOnDark : palette.textPrimary,
        }));
    });
  }

  // 07_MESSAGE - integrated
  let msgGroup: GroupNode | null = null;
  if (content.message) {
    msgGroup = makeGroup('07_MESSAGE', 'quoteMessage', 0, 0, Math.round(contentWidth * 0.45), Math.round(height * 0.08), zIdx++);
    const msgX = splitType === 2 ? Math.round(width * 0.55) : safeMargin;
    const msgY = Math.round(height * 0.85);
    msgGroup.children.push(makeText('MESSAGE', 'quoteMessage', content.message,
      { x: msgX, y: msgY, w: Math.round(contentWidth * 0.4), h: Math.round(height * 0.06) },
      typography, 'quoteMessage', palette, zIdx++, { color: palette.textSecondary }));
  }

  // 08_FOOTER - solid bar or minimal
  const footerGroup = makeGroup('08_FOOTER', 'footer', 0, Math.round(height * 0.92), width, Math.round(height * 0.08), zIdx++);
  footerGroup.children.push(makeShape('FOOTER_BAR', 'footer',
    { x: 0, y: Math.round(height * 0.92), w: width, h: Math.round(height * 0.08) },
    { fill: palette.primary, radius: 0 }, zIdx++));
  footerGroup.children.push(makeText('FOOTER_PHONE', 'footerPhone', content.school.phone,
    { x: safeMargin, y: Math.round(height * 0.935), w: Math.round(contentWidth * 0.4), h: Math.round(height * 0.03) },
    typography, 'footer', palette, zIdx++, { color: palette.textOnDark }));
  footerGroup.children.push(makeText('FOOTER_ADDRESS', 'footerAddress', content.school.address,
    { x: Math.round(width * 0.55), y: Math.round(height * 0.935), w: Math.round(contentWidth * 0.4), h: Math.round(height * 0.03) },
    typography, 'footer', palette, zIdx++, { color: palette.textOnDark, align: 'right' }));

  // 09_EFFECTS - minimal
  const effectsGroup = makeGroup('09_EFFECTS', 'decorative', 0, 0, width, height, zIdx++);

  // Assemble
  sg.root.children.push(bgGroup, structGroup, headerGroup, titleGroup, mgmtGroup, photoGroup, progGroup);
  if (msgGroup) sg.root.children.push(msgGroup);
  sg.root.children.push(footerGroup, effectsGroup);

  return sg;
}