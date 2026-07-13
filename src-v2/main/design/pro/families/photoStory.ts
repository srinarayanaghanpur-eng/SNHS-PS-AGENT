// Photo Story Design Family
// Characteristics: full-bleed hero photograph, photo-led hierarchy, gradient overlay
// for readability, overlapping secondary photographs, caption-style management,
// editorial narrative flow, programme integrated into the photo composition.

import type { SceneGraph, Rect, GroupNode } from '../sceneGraph';
import type { DerivedPalette } from '../colour';
import type { FontPairing } from '../typography';
import type { BatchPhotoAnalysis } from '../photo';
import type { ContentInput } from '../nodeFactory';
import { makeSceneGraph, makeGroup, makeText, makeImage, makeShape, makeGradient, makeGradientDef, makeLine } from '../nodeFactory';

export function composePhotoStory(
  width: number,
  height: number,
  palette: DerivedPalette,
  typography: FontPairing,
  photoBatch: BatchPhotoAnalysis,
  content: ContentInput,
  seed: number
): SceneGraph {
  const sg = makeSceneGraph(width, height, palette, 'photo-story', seed);
  const safeMargin = Math.round(Math.min(width, height) * 0.055);
  const contentWidth = width - safeMargin * 2;
  const contentHeight = height - safeMargin * 2;

  let zIdx = 0;

  // 00_BACKGROUND - full-bleed hero photo if available
  const bgGroup = makeGroup('00_BACKGROUND', 'background', 0, 0, width, height, zIdx++);

  const hasHeroPhoto = photoBatch.heroCandidate !== null;
  if (hasHeroPhoto) {
    bgGroup.children.push(makeImage('HERO_BACKGROUND', 'background', 'PLACEHOLDER',
      { x: 0, y: 0, w: width, h: height }, 'cover', 'none', zIdx++, palette, {
        opacity: 100,
        overlay: { color: '#000000', opacity: 0.4, blendMode: 'multiply' },
      }));
  } else {
    bgGroup.children.push(makeShape('BG_COLOR', 'background',
      { x: 0, y: 0, w: width, h: height }, { fill: palette.primary, radius: 0 }, zIdx++));
    bgGroup.children.push(makeGradient('BG_GRADIENT', 'background',
      { x: 0, y: 0, w: width, h: height },
      makeGradientDef('linear', [
        { color: palette.primaryDark, position: 0 },
        { color: palette.primary, position: 60 },
        { color: palette.secondary, position: 100 },
      ], 90), zIdx++));
  }

  // Gradient overlay at bottom for text readability
  bgGroup.children.push(makeGradient('READABILITY_OVERLAY', 'photoOverlay',
    { x: 0, y: Math.round(height * 0.4), w: width, h: Math.round(height * 0.6) },
    makeGradientDef('linear', [
      { color: 'transparent', position: 0 },
      { color: 'rgba(0,0,0,0.85)', position: 100 },
    ], 90), zIdx++));

  // 01_STRUCTURAL_GRAPHICS
  const structGroup = makeGroup('01_STRUCTURAL_GRAPHICS', 'structuralGraphic', 0, 0, width, height, zIdx++);

  // 02_HEADER - overlaid on photo, white text
  const headerGroup = makeGroup('02_HEADER', 'header', safeMargin, Math.round(height * 0.03), contentWidth, Math.round(height * 0.1), zIdx++);
  if (content.school.logoPath) {
    headerGroup.children.push(makeImage('SCHOOL_LOGO', 'header', content.school.logoPath,
      { x: safeMargin, y: Math.round(height * 0.035), w: Math.round(height * 0.06), h: Math.round(height * 0.06) },
      'contain', 'none', zIdx++, palette));
  }
  const logoOff = content.school.logoPath ? Math.round(height * 0.08) : 0;
  headerGroup.children.push(makeText('SCHOOL_NAME', 'schoolIdentity', content.school.name,
    { x: safeMargin + logoOff, y: Math.round(height * 0.04), w: Math.round(contentWidth * 0.7), h: Math.round(height * 0.035) },
    typography, 'schoolIdentity', palette, zIdx++, { color: '#FFFFFF', tracking: 30 }));
  headerGroup.children.push(makeText('SCHOOL_ADDRESS', 'header', content.school.address,
    { x: safeMargin + logoOff, y: Math.round(height * 0.075), w: Math.round(contentWidth * 0.5), h: Math.round(height * 0.025) },
    typography, 'footer', palette, zIdx++, { color: 'rgba(255,255,255,0.7)' }));

  // 03_TITLE_DATE
  const titleGroup = makeGroup('03_TITLE_DATE', 'displayTitle', safeMargin, Math.round(height * 0.55), contentWidth, Math.round(height * 0.2), zIdx++);

  titleGroup.children.push(makeText('DATE_LABEL', 'dateLabel', content.details || '',
    { x: safeMargin, y: 0, w: Math.round(contentWidth * 0.4), h: Math.round(height * 0.025) },
    typography, 'dateLabel', palette, zIdx++, { color: palette.accent }));

  titleGroup.children.push(makeText('MAIN_TITLE', 'displayTitle', content.headline,
    { x: safeMargin, y: Math.round(height * 0.03), w: Math.round(contentWidth * 0.85), h: Math.round(height * 0.1) },
    typography, 'displayTitle', palette, zIdx++, { color: '#FFFFFF', fontSize: Math.round(width * 0.06), lineHeight: 1.05, textCase: 'none', tracking: -10 }));

  if (content.subheadline) {
    titleGroup.children.push(makeText('SUBTITLE', 'subtitle', content.subheadline,
      { x: safeMargin, y: Math.round(height * 0.14), w: Math.round(contentWidth * 0.6), h: Math.round(height * 0.035) },
      typography, 'subtitle', palette, zIdx++, { color: 'rgba(255,255,255,0.85)' }));
  }

  // 04_MANAGEMENT - caption-style
  const mgmtGroup = makeGroup('04_MANAGEMENT', 'managementPhoto', 0, 0, Math.round(contentWidth * 0.35), Math.round(height * 0.12), zIdx++);
  const managerEntries = [
    content.management?.chairman?.show ? { person: content.management.chairman, role: 'CHAIRMAN' } : null,
    content.management?.principal?.show ? { person: content.management.principal, role: 'PRINCIPAL' } : null,
  ].filter(Boolean) as { person: NonNullable<ContentInput['management']>['chairman'] & { asset: { path: string } }; role: string }[];

  if (managerEntries.length > 0) {
    const mgmtY = Math.round(height * 0.72);
    let mgmtX = safeMargin;
    managerEntries.forEach((m, i) => {
      const pd = Math.round(height * 0.065);
      mgmtGroup.children.push(makeImage(`${m.role}_PHOTO`, 'managementPhoto', m.person.asset!.path,
        { x: mgmtX, y: mgmtY, w: pd, h: pd }, 'cover', 'circle', zIdx++, palette));
      mgmtGroup.children.push(makeText(`${m.role}_NAME`, 'managementName', m.person.name || m.role,
        { x: mgmtX + pd + Math.round(height * 0.01), y: mgmtY + Math.round(height * 0.005), w: Math.round(contentWidth * 0.25), h: Math.round(height * 0.025) },
        typography, 'managementName', palette, zIdx++, { color: '#FFFFFF' }));
      if (m.person.designation) {
        mgmtGroup.children.push(makeText(`${m.role}_DES`, 'managementDesignation', m.person.designation,
          { x: mgmtX + pd + Math.round(height * 0.01), y: mgmtY + Math.round(height * 0.035), w: Math.round(contentWidth * 0.25), h: Math.round(height * 0.02) },
          typography, 'footer', palette, zIdx++, { color: 'rgba(255,255,255,0.7)' }));
      }
      mgmtX += pd + Math.round(height * 0.12);
    });
  }

  // 05_STUDENT_PHOTOS - overlapping
  const photoGroup = makeGroup('05_STUDENT_PHOTOS', 'studentPhoto', 0, 0, width, height, zIdx++);
  if (photoBatch.photos.length > 0) {
    const others = photoBatch.secondaryCandidates;
    if (others.length > 0) {
      const stackY = Math.round(height * 0.58);
      const stackSize = Math.round(height * 0.065);
      const overlap = Math.round(stackSize * 0.3);
      const totalW = Math.min(others.length, 4) * (stackSize - overlap) + overlap;
      const startX = Math.round(width - safeMargin - totalW);

      others.slice(0, 4).forEach((_p, i) => {
        photoGroup.children.push(makeImage(`PHOTO_${i + 1}`, 'studentPhoto', 'PLACEHOLDER',
          { x: startX + i * (stackSize - overlap), y: stackY, w: stackSize, h: stackSize },
          'cover', 'circle', zIdx++, palette, {
            border: { color: '#FFFFFF', width: 2, opacity: 100 },
            shadow: { color: '#000000', opacity: 40, distance: 4, blur: 8, angle: 120 },
            rotation: (i % 2 === 0 ? 5 : -5),
          }));
      });
    }
  }

  // 06_PROGRAMME
  const progGroup = makeGroup('06_PROGRAMME', 'programmeHeading', 0, 0, Math.round(contentWidth * 0.5), Math.round(contentHeight * 0.15), zIdx++);
  const progX = safeMargin;
  const progY = Math.round(height * 0.78);
  progGroup.rect = { x: progX, y: progY, w: Math.round(contentWidth * 0.5), h: Math.round(contentHeight * 0.15) };

  if (content.programme && content.programme.length > 0) {
    progGroup.children.push(makeText('PROG_HEADING', 'programmeHeading', 'MORNING PROGRAMME',
      { x: progX, y: 0, w: Math.round(contentWidth * 0.4), h: Math.round(height * 0.025) },
      typography, 'programmeHeading', palette, zIdx++, { color: palette.accent, tracking: 50, textCase: 'uppercase' }));
    const itemStartY = Math.round(height * 0.035);
    content.programme.slice(0, 8).forEach((item, i) => {
      const iy = itemStartY + i * Math.round(height * 0.025);
      progGroup.children.push(makeText(`PROG_${i + 1}`, 'programmeItem', `${i + 1}. ${item}`,
        { x: progX, y: iy, w: Math.round(contentWidth * 0.45), h: Math.round(height * 0.02) },
        typography, 'programmeItem', palette, zIdx++, { color: 'rgba(255,255,255,0.9)' }));
    });
  }

  // 07_MESSAGE
  let msgGroup: GroupNode | null = null;
  if (content.message) {
    msgGroup = makeGroup('07_MESSAGE', 'quoteMessage', 0, 0, Math.round(contentWidth * 0.85), Math.round(height * 0.06), zIdx++);
    msgGroup.children.push(makeText('MESSAGE', 'quoteMessage', content.message,
      { x: safeMargin, y: Math.round(height * 0.88), w: Math.round(contentWidth * 0.85), h: Math.round(height * 0.06) },
      typography, 'quoteMessage', palette, zIdx++, { color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }));
  }

  // 08_FOOTER
  const footerGroup = makeGroup('08_FOOTER', 'footer', 0, Math.round(height * 0.94), width, Math.round(height * 0.06), zIdx++);
  footerGroup.children.push(makeShape('FOOTER_OVERLAY', 'footer',
    { x: 0, y: Math.round(height * 0.94), w: width, h: Math.round(height * 0.06) },
    { fill: '#000000' }, zIdx++, { opacity: 50 }));
  footerGroup.children.push(makeText('FOOTER_PHONE', 'footerPhone', content.school.phone,
    { x: safeMargin, y: Math.round(height * 0.955), w: Math.round(contentWidth * 0.4), h: Math.round(height * 0.025) },
    typography, 'footer', palette, zIdx++, { color: 'rgba(255,255,255,0.8)' }));
  footerGroup.children.push(makeText('FOOTER_YEAR', 'footerAddress', content.school.academicYear,
    { x: Math.round(width * 0.55), y: Math.round(height * 0.955), w: Math.round(contentWidth * 0.4), h: Math.round(height * 0.025) },
    typography, 'footer', palette, zIdx++, { color: 'rgba(255,255,255,0.8)', align: 'right' }));

  // 09_EFFECTS - vignette
  const effectsGroup = makeGroup('09_EFFECTS', 'decorative', 0, 0, width, height, zIdx++);
  effectsGroup.children.push(makeGradient('VIGNETTE', 'decorative',
    { x: 0, y: 0, w: width, h: height },
    makeGradientDef('radial', [
      { color: 'transparent', position: 0 },
      { color: 'rgba(0,0,0,0.3)', position: 50 },
      { color: 'rgba(0,0,0,0.5)', position: 100 },
    ]), zIdx++));

  sg.root.children.push(bgGroup, structGroup, headerGroup, titleGroup, mgmtGroup, photoGroup, progGroup);
  if (msgGroup) sg.root.children.push(msgGroup);
  sg.root.children.push(footerGroup, effectsGroup);

  return sg;
}