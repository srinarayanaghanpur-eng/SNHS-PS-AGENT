// Editorial Minimal Design Family
// Characteristics: strong whitespace, asymmetric grid, refined typography,
// editorial list programme, thin rules, no heavy panels, no ornamental decorations.

import type { SceneGraph, GroupNode, SceneNode, Rect } from '../sceneGraph';
import type { DerivedPalette } from '../colour';
import type { FontPairing } from '../typography';
import type { BatchPhotoAnalysis } from '../photo';
import type { ContentInput } from '../nodeFactory';
import { makeSceneGraph, makeGroup, makeText, makeImage, makeShape, makeLine } from '../nodeFactory';

export function composeEditorialMinimal(
  width: number,
  height: number,
  palette: DerivedPalette,
  typography: FontPairing,
  photoBatch: BatchPhotoAnalysis,
  content: ContentInput,
  seed: number
): SceneGraph {
  const sg = makeSceneGraph(width, height, palette, 'editorial-minimal', seed);
  const safeMargin = Math.round(Math.min(width, height) * 0.06);
  const contentWidth = width - safeMargin * 2;
  const contentHeight = height - safeMargin * 2;

  const titleLeft = seed % 2 === 0;
  let zIdx = 0;

  // 00_BACKGROUND
  const bgGroup = makeGroup('00_BACKGROUND', 'background', 0, 0, width, height, zIdx++);
  bgGroup.children.push(makeShape('BG_RECT', 'background', { x: 0, y: 0, w: width, h: height }, {
    fill: palette.background, radius: 0
  }, zIdx++));

  // 01_STRUCTURAL_GRAPHICS - thin accent rules
  const structGroup = makeGroup('01_STRUCTURAL_GRAPHICS', 'structuralGraphic', 0, 0, width, height, zIdx++);
  structGroup.children.push(makeLine('TOP_RULE', 'structuralGraphic',
    { x: safeMargin, y: safeMargin + Math.round(height * 0.05), w: Math.round(contentWidth * 0.3), h: 0 },
    palette.accent, 1, zIdx++));
  const ruleSide = seed % 2 === 0 ? 'right' : 'left';
  const ruleX = ruleSide === 'right' ? width - safeMargin : safeMargin;
  structGroup.children.push(makeLine('VERTICAL_RULE', 'structuralGraphic',
    { x: ruleX - 1, y: safeMargin + Math.round(height * 0.08), w: 2, h: Math.round(height * 0.55) },
    palette.accent, 2, zIdx++));

  // 02_HEADER
  const headerGroup = makeGroup('02_HEADER', 'header', safeMargin, Math.round(height * 0.02), contentWidth, Math.round(height * 0.12), zIdx++);
  if (content.school.logoPath) {
    headerGroup.children.push(makeImage('SCHOOL_LOGO', 'header', content.school.logoPath,
      { x: safeMargin, y: Math.round(height * 0.04), w: Math.round(height * 0.06), h: Math.round(height * 0.06) },
      'contain', 'none', zIdx++, palette));
  }
  const logoOffset = content.school.logoPath ? Math.round(height * 0.08) : 0;
  headerGroup.children.push(makeText('SCHOOL_NAME', 'schoolIdentity', content.school.name,
    { x: safeMargin + logoOffset, y: Math.round(height * 0.05), w: Math.round(contentWidth * 0.6), h: Math.round(height * 0.04) },
    typography, 'schoolIdentity', palette, zIdx++));
  headerGroup.children.push(makeText('SCHOOL_ADDRESS', 'header', content.school.address,
    { x: safeMargin + logoOffset, y: Math.round(height * 0.085), w: Math.round(contentWidth * 0.5), h: Math.round(height * 0.025) },
    typography, 'footer', palette, zIdx++));

  // 03_TITLE_DATE
  const titleGroupWidth = Math.round(contentWidth * (titleLeft ? 0.65 : 0.7));
  const titleX = titleLeft ? safeMargin : width - safeMargin - titleGroupWidth;
  const titleY = Math.round(height * 0.16);
  const titleGroup = makeGroup('03_TITLE_DATE', 'displayTitle', titleX, titleY, titleGroupWidth, Math.round(height * 0.22), zIdx++);

  const dateStr = content.details || '';
  titleGroup.children.push(makeText('DATE_LABEL', 'dateLabel', dateStr,
    { x: titleX, y: titleY, w: Math.round(titleGroupWidth * 0.5), h: Math.round(height * 0.025) },
    typography, 'dateLabel', palette, zIdx++));

  titleGroup.children.push(makeText('MAIN_TITLE', 'displayTitle', content.headline,
    { x: titleX, y: titleY + Math.round(height * 0.035), w: titleGroupWidth, h: Math.round(height * 0.1) },
    typography, 'displayTitle', palette, zIdx++));

  titleGroup.children.push(makeLine('TITLE_DIVIDER', 'structuralGraphic',
    { x: titleX, y: titleY + Math.round(height * 0.15), w: Math.round(titleGroupWidth * 0.6), h: 0 },
    palette.accent, 1, zIdx++));

  if (content.subheadline) {
    titleGroup.children.push(makeText('SUBTITLE', 'subtitle', content.subheadline,
      { x: titleX, y: titleY + Math.round(height * 0.17), w: Math.round(titleGroupWidth * 0.8), h: Math.round(height * 0.04) },
      typography, 'subtitle', palette, zIdx++));
  }

  // 04_MANAGEMENT
  const mgmtGroup = makeGroup('04_MANAGEMENT', 'managementPhoto', safeMargin, 0, contentWidth, Math.round(height * 0.1), zIdx++);
  const managerEntries = [
    content.management?.chairman?.show ? { person: content.management.chairman, role: 'CHAIRMAN' } : null,
    content.management?.principal?.show ? { person: content.management.principal, role: 'PRINCIPAL' } : null,
  ].filter(Boolean) as { person: NonNullable<ContentInput['management']>['chairman'] & { asset: { path: string } }; role: string }[];

  if (managerEntries.length > 0) {
    const mgmtY = titleY + Math.round(height * 0.24);
    managerEntries.forEach((m, i) => {
      const portraitD = Math.round(height * 0.055);
      const mgmtX = titleLeft ? safeMargin : safeMargin + i * (portraitD + Math.round(height * 0.025));
      mgmtGroup.children.push(makeImage(`${m.role}_PHOTO`, 'managementPhoto', m.person.asset!.path,
        { x: mgmtX, y: mgmtY, w: portraitD, h: portraitD },
        'cover', 'circle', zIdx++, palette));
      mgmtGroup.children.push(makeText(`${m.role}_NAME`, 'managementName', m.person.name || m.role,
        { x: mgmtX - Math.round(portraitD * 0.5), y: mgmtY + portraitD + Math.round(height * 0.01), w: portraitD * 2, h: Math.round(height * 0.02) },
        typography, 'managementName', palette, zIdx++));
    });
  }

  // 05_STUDENT_PHOTOS - compact, below title
  const photoY = titleY + Math.round(height * 0.26);
  const photoGroup = makeGroup('05_STUDENT_PHOTOS', 'studentPhoto', titleX, photoY, titleGroupWidth, Math.round(contentHeight * 0.18), zIdx++);
  if (photoBatch.photos.length > 0) {
    const hero = photoBatch.heroCandidate;
    if (hero) {
      const heroW = Math.round(titleGroupWidth * 0.85);
      const heroH = Math.min(Math.round(heroW / hero.aspectRatio), Math.round(contentHeight * 0.15));
      photoGroup.children.push(makeImage('HERO_PHOTO', 'studentPhoto', 'PLACEHOLDER',
        { x: titleX + Math.round(titleGroupWidth * 0.02), y: photoY, w: heroW, h: heroH },
        'cover', 'none', zIdx++, palette));
    }
    const others = photoBatch.secondaryCandidates.slice(0, 3);
    if (others.length > 0) {
      const thumbSize = Math.round(height * 0.05);
      const gap = Math.round(height * 0.012);
      const totalW = others.length * (thumbSize + gap) - gap;
      const startX = titleX + Math.round((titleGroupWidth - totalW) / 2);
      others.forEach((_p, i) => {
        photoGroup.children.push(makeImage(`PHOTO_${i + 1}`, 'studentPhoto', 'PLACEHOLDER',
          { x: startX + i * (thumbSize + gap), y: photoY + Math.round(contentHeight * 0.12), w: thumbSize, h: thumbSize },
          'cover', 'circle', zIdx++, palette));
      });
    }
  }

  // 06_PROGRAMME - editorial list opposite title
  const progX = titleLeft ? width - safeMargin - Math.round(contentWidth * 0.35) : safeMargin;
  const progW = Math.round(contentWidth * 0.35);
  const progY = Math.round(height * 0.16);
  const progGroup = makeGroup('06_PROGRAMME', 'programmeHeading', progX, progY, progW, Math.round(contentHeight * 0.6), zIdx++);

  if (content.programme && content.programme.length > 0) {
    progGroup.children.push(makeText('PROG_HEADING', 'programmeHeading', 'PROGRAMME',
      { x: progX, y: progY, w: progW, h: Math.round(height * 0.025) },
      typography, 'programmeHeading', palette, zIdx++));
    progGroup.children.push(makeLine('PROG_UNDERLINE', 'structuralGraphic',
      { x: progX, y: progY + Math.round(height * 0.03), w: progW, h: 0 },
      palette.divider, 1, zIdx++));
    const itemStartY = progY + Math.round(height * 0.045);
    content.programme.slice(0, 14).forEach((item, i) => {
      const iy = itemStartY + i * Math.round(height * 0.032);
      const numW = Math.round(height * 0.025);
      progGroup.children.push(makeText(`PROG_NUM_${i + 1}`, 'dateLabel', `${i + 1}`,
        { x: progX, y: iy, w: numW, h: Math.round(height * 0.02) },
        typography, 'dateLabel', palette, zIdx++));
      progGroup.children.push(makeText(`PROG_ITEM_${i + 1}`, 'programmeItem', item,
        { x: progX + numW + Math.round(height * 0.01), y: iy, w: progW - numW - Math.round(height * 0.01), h: Math.round(height * 0.02) },
        typography, 'programmeItem', palette, zIdx++));
    });
  }

  // 07_MESSAGE
  let msgGroup: GroupNode | null = null;
  if (content.message) {
    msgGroup = makeGroup('07_MESSAGE', 'quoteMessage', safeMargin, 0, Math.round(contentWidth * 0.7), Math.round(height * 0.08), zIdx++);
    msgGroup.children.push(makeText('MESSAGE', 'quoteMessage', content.message,
      { x: safeMargin, y: Math.round(height * 0.68), w: Math.round(contentWidth * 0.65), h: Math.round(height * 0.06) },
      typography, 'quoteMessage', palette, zIdx++));
  }

  // 08_FOOTER
  const footerY = height - safeMargin - Math.round(height * 0.06);
  const footerGroup = makeGroup('08_FOOTER', 'footer', 0, footerY, width, Math.round(height * 0.06), zIdx++);
  footerGroup.children.push(makeLine('FOOTER_LINE', 'footer',
    { x: safeMargin, y: footerY, w: contentWidth, h: 0 }, palette.divider, 1, zIdx++));
  footerGroup.children.push(makeText('FOOTER_PHONE', 'footerPhone', content.school.phone,
    { x: safeMargin, y: footerY + Math.round(height * 0.015), w: Math.round(contentWidth * 0.45), h: Math.round(height * 0.025) },
    typography, 'footer', palette, zIdx++));
  footerGroup.children.push(makeText('FOOTER_ADDRESS', 'footerAddress', content.school.address,
    { x: width / 2, y: footerY + Math.round(height * 0.015), w: Math.round(contentWidth * 0.45), h: Math.round(height * 0.025) },
    typography, 'footer', palette, zIdx++));

  // Assemble
  sg.root.children.push(bgGroup, structGroup, headerGroup, titleGroup, mgmtGroup, photoGroup, progGroup);
  if (msgGroup) sg.root.children.push(msgGroup);
  sg.root.children.push(footerGroup);

  return sg;
}