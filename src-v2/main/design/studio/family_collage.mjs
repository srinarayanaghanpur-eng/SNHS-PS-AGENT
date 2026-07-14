import { group, rect, line, image, text, fitFontSize, measureLineWidth } from './engine.mjs';

function photoSlot(nodes, box, path, opts = {}) {
  const { shape = 'rect', radius = 18, ring, ringWidth = 6, shadow = true, rot = 0, label, roleLabel, palette } = opts;
  if (path) {
    nodes.push(image({ x: box.x, y: box.y, w: box.w, h: box.h }, path,
      { fit: 'cover', shape, radius, ring: ring || '#FFFFFF', ringWidth, shadow, rot }));
  } else {
    nodes.push(rect({ x: box.x, y: box.y, w: box.w, h: box.h, radius }, { fill: '#E7E2D6', stroke: '#B9AE97', strokeWidth: 2, rot }));
    const rl = fitFontSize(roleLabel || 'PHOTO', { w: box.w - 12, h: 24 }, { min: 11, max: 17, kind: 'bodyUpper', maxLines: 2, lineHeight: 1.1 });
    nodes.push(text({ x: box.x + 6, y: box.y + box.h / 2 - 26 - (rl.lines.length - 1) * rl.size * 0.5, w: box.w - 12, h: 40 }, roleLabel || 'PHOTO',
      { size: rl.size, lines: rl.lines, family: 'Poppins', weight: 600, color: '#8A7F68', align: 'center', tracking: 0.5, lineHeight: 1.1, rot }));
    nodes.push(text({ x: box.x, y: box.y + box.h / 2 + 8, w: box.w, h: 20 }, 'pending upload',
      { size: 13, family: 'Lato', weight: 400, color: '#A99C82', align: 'center', rot }));
  }
  if (label && path) {
    const ly = box.y + box.h - 28;
    const cap = fitFontSize(label, { w: box.w - 8, h: 18 }, { min: 10, max: 14, kind: 'bodyUpper', maxLines: 1 });
    nodes.push(rect({ x: box.x, y: ly, w: box.w, h: 28, radius: 0, rot }, { fill: palette.primary, opacity: 0.88 }));
    nodes.push(text({ x: box.x + 4, y: ly + 7, w: box.w - 8, h: 18 }, cap.lines[0],
      { size: cap.size, family: 'Poppins', weight: 600, color: '#FFFFFF', align: 'center', tracking: 0.5, rot }));
  }
}

export function composeCollage({ width, height, content, assets, palette, typo, roles = {} }) {
  const m = Math.round(width * 0.045);
  const nodes = [];
  const accent = palette.accent;

  nodes.push(group('00_BACKGROUND', [rect({ x: 0, y: 0, w: width, h: height }, { fill: palette.canvas })]));

  const deco = [];
  for (let i = 0; i < 7; i++) deco.push(rect({ x: -60 + i * 180, y: -60, w: 120, h: 120, radius: 60 }, { fill: palette.primaryLight, opacity: 0.06 }));
  nodes.push(group('01_DECORATIVE_PATTERN', deco));

  const headerH = Math.round(height * 0.205);
  const header = [];
  header.push(rect({ x: 0, y: 0, w: width, h: headerH }, { fill: palette.canvasAlt }));
  header.push(rect({ x: 0, y: headerH - 5, w: width, h: 5 }, { fill: accent }));
  const logoD = Math.round(headerH * 0.5);
  const logoY = Math.round(headerH * 0.16);
  if (assets.schoolLogo) header.push(image({ x: m, y: logoY, w: logoD, h: logoD }, assets.schoolLogo, { fit: 'contain', shape: 'rect' }));
  if (content.school.recognition) header.push(text({ x: m + logoD, y: Math.round(headerH * 0.14), w: width - (m + logoD) * 2, h: 22 }, content.school.recognition,
    { size: 18, family: typo.body.family, weight: 400, color: palette.inkSoft, align: 'center', tracking: 1 }));
  const nameFit = fitFontSize(content.school.name, { w: width - (m + logoD) * 2, h: Math.round(headerH * 0.34) }, { min: 40, max: 62, kind: 'displayUpper', maxLines: 2, tracking: 0 });
  header.push(text({ x: m + logoD, y: Math.round(headerH * 0.24), w: width - (m + logoD) * 2, h: nameFit.size * 2 }, content.school.name.toUpperCase(),
    { size: nameFit.size, lines: nameFit.lines.map((l) => l.toUpperCase()), family: typo.display.family, weight: 700, color: palette.primary, align: 'center', lineHeight: 1.0, tracking: 0 }));
  if (content.school.address) header.push(text({ x: m + logoD, y: Math.round(headerH * 0.24) + nameFit.lines.length * nameFit.size + 8, w: width - (m + logoD) * 2, h: 24 }, content.school.address,
    { size: 19, family: typo.body.family, weight: 400, color: palette.ink, align: 'center' }));
  const chD = Math.round(headerH * 0.52);
  const chX = width - m - chD, chY = Math.round(headerH * 0.13);
  photoSlot(header, { x: chX, y: chY, w: chD, h: chD }, assets.chairman, { shape: 'circle', ring: accent, ringWidth: 5, shadow: true, roleLabel: 'CHAIRMAN', palette });
  if (content.event.chairman) {
    header.push(text({ x: chX - 30, y: chY + chD + 6, w: chD + 60, h: 22 }, content.event.chairman.name,
      { size: 18, family: typo.bodyBold.family, weight: 700, color: palette.ink, align: 'center' }));
    header.push(text({ x: chX - 30, y: chY + chD + 28, w: chD + 60, h: 18 }, content.event.chairman.role,
      { size: 14, family: typo.body.family, weight: 400, color: palette.inkSoft, align: 'center' }));
  }
  nodes.push(group('02_HEADER', header));
  nodes.push(group('03_SCHOOL_LOGO', []));
  nodes.push(group('04_SCHOOL_NAME', []));
  nodes.push(group('05_CHAIRMAN', []));

  const barY = headerH + Math.round(height * 0.006);
  const barH = Math.round(height * 0.055);
  const evt = [];
  evt.push(rect({ x: m, y: barY, w: width - m * 2, h: barH, radius: 10 }, { gradient: { angle: 0, stops: [{ at: 0, color: palette.primary, opacity: 1 }, { at: 100, color: palette.primaryDark, opacity: 1 }] } }));
  const etFit = fitFontSize(content.event.title, { w: width - m * 2 - 300, h: barH * 0.6 }, { min: 26, max: 40, kind: 'displayUpper', maxLines: 1 });
  evt.push(text({ x: m + 26, y: barY + barH / 2 - etFit.size * 0.62, w: width - m * 2 - 300, h: barH }, content.event.title.toUpperCase(),
    { size: etFit.size, family: typo.display.family, weight: 700, color: '#FFFFFF', align: 'left', tracking: 0.5 }));
  const dateStr = [content.event.date, content.event.day].filter(Boolean).join('  ·  ').toUpperCase();
  evt.push(text({ x: width - m - 300 - 20, y: barY + barH / 2 - 12, w: 300, h: 24 }, dateStr,
    { size: 20, family: typo.label.family, weight: 600, color: accent, align: 'right', tracking: 1 }));
  nodes.push(group('06_EVENT_TITLE_DATE', evt));

  const collageTop = barY + barH + Math.round(height * 0.02);
  const collageH = Math.round(height * 0.30);
  const heroGrp = [], supGrp = [];
  const heroW = Math.round(width * 0.60), heroHh = Math.round(collageH * 0.86);
  const heroX = Math.round((width - heroW) / 2), heroY = collageTop + Math.round(collageH * 0.06);
  photoSlot(heroGrp, { x: heroX, y: heroY, w: heroW, h: heroHh }, assets.hero, { shape: 'rect', radius: 26, ring: '#FFFFFF', ringWidth: 8, shadow: true, roleLabel: 'HERO ASSEMBLY', palette });
  const lfD = Math.round(collageH * 0.5);
  photoSlot(supGrp, { x: m - 4, y: collageTop + Math.round(collageH * 0.30), w: lfD, h: lfD }, roles.leftFeature, { shape: 'circle', ring: accent, ringWidth: 6, shadow: true, rot: -2, roleLabel: 'PRAYER LEADER', palette });
  const rW = Math.round(width * 0.20), rH = Math.round(collageH * 0.40);
  const rX = width - m - rW;
  photoSlot(supGrp, { x: rX, y: collageTop + Math.round(collageH * 0.04), w: rW, h: rH }, roles.rightTop, { shape: 'rect', radius: 16, ring: '#FFFFFF', ringWidth: 5, shadow: true, rot: 2, roleLabel: 'ACHIEVEMENT', palette });
  photoSlot(supGrp, { x: rX, y: collageTop + Math.round(collageH * 0.50), w: rW, h: rH }, roles.rightBottom, { shape: 'rect', radius: 16, ring: '#FFFFFF', ringWidth: 5, shadow: true, rot: -2, roleLabel: 'BIRTHDAY', palette });
  nodes.push(group('07_HERO_PHOTO', heroGrp));
  nodes.push(group('08_SUPPORTING_PHOTOS', supGrp));

  const quoteY = collageTop + collageH + Math.round(height * 0.012);
  const quoteH = Math.round(height * 0.07);
  const q = [];
  q.push(line(m, quoteY, m + 60, quoteY, { stroke: accent, strokeWidth: 3 }));
  q.push(line(width - m - 60, quoteY + quoteH - 10, width - m, quoteY + quoteH - 10, { stroke: accent, strokeWidth: 3 }));
  const qFit = fitFontSize(content.quote, { w: width - m * 2 - 40, h: quoteH }, { min: 24, max: 34, kind: 'body', maxLines: 2, lineHeight: 1.2 });
  q.push(text({ x: m + 20, y: quoteY + (quoteH - qFit.lines.length * qFit.size) / 2, w: width - m * 2 - 40, h: quoteH }, content.quote,
    { size: qFit.size, lines: qFit.lines, family: typo.display.family, weight: 600, italic: true, color: palette.primary, align: 'center', lineHeight: 1.2 }));
  nodes.push(group('09_QUOTE', q));

  const galTop = quoteY + quoteH + Math.round(height * 0.012);
  const footerH = Math.round(height * 0.16);
  const footerY = height - footerH;
  const galH = footerY - galTop - Math.round(height * 0.015);
  const labels = content.programme || [];
  const galleryPhotos = roles.lowerGallery || [];
  const count = Math.min(7, Math.max(5, Math.max(labels.length, galleryPhotos.length, 6)));
  const gap = Math.round(width * 0.02);
  const cardW = Math.round((width - m * 2 - gap * (count - 1)) / count);
  const cardH = Math.round(galH * 0.9);
  const gal = [];
  gal.push(text({ x: m, y: galTop - 2, w: width - m * 2, h: 24 }, 'PROCEEDINGS OF THE DAY',
    { size: 18, family: typo.label.family, weight: 600, color: palette.primary, align: 'left', tracking: 3 }));
  const rowY = galTop + 30;
  for (let i = 0; i < count; i++) {
    const gx = m + i * (cardW + gap);
    const rot = (i % 2 === 0 ? -1.5 : 1.5);
    photoSlot(gal, { x: gx, y: rowY, w: cardW, h: cardH }, galleryPhotos[i], {
      shape: 'rect', radius: 12, ring: '#FFFFFF', ringWidth: 5, shadow: true, rot,
      label: labels[i] ? labels[i].toUpperCase() : null, roleLabel: (labels[i] || 'ACTIVITY').toUpperCase(), palette,
    });
  }
  nodes.push(group('10_PROGRAMME_GALLERY', gal));
  nodes.push(group('11_BIRTHDAY_OR_AWARD', []));

  const foot = [];
  foot.push(rect({ x: 0, y: footerY, w: width, h: footerH }, { gradient: { angle: 90, stops: [{ at: 0, color: palette.primary, opacity: 1 }, { at: 100, color: palette.primaryDark, opacity: 1 }] } }));
  foot.push(rect({ x: 0, y: footerY, w: width, h: 6 }, { fill: accent }));
  for (let i = 0; i < 8; i++) foot.push(rect({ x: -40 + i * 160, y: footerY - 20, w: 90, h: 90, radius: 45 }, { fill: '#FFFFFF', opacity: 0.03 }));
  const gLogoD = Math.round(footerH * 0.42);
  const gy = footerY + Math.round(footerH * 0.16);
  photoSlot(foot, { x: m, y: gy, w: gLogoD, h: gLogoD }, assets.groupLogo, { shape: 'circle', ring: accent, ringWidth: 3, shadow: false, roleLabel: 'GROUP LOGO', palette });
  foot.push(text({ x: m + gLogoD + 20, y: footerY + Math.round(footerH * 0.16), w: Math.round(width * 0.5), h: 20 }, 'A Unit of',
    { size: 16, family: typo.body.family, weight: 400, color: '#C9D4E4', align: 'left' }));
  foot.push(text({ x: m + gLogoD + 20, y: footerY + Math.round(footerH * 0.28), w: Math.round(width * 0.56), h: 30 }, (content.school.group || '').toUpperCase(),
    { size: 26, family: typo.display.family, weight: 700, color: '#FFFFFF', align: 'left', tracking: 0.5 }));
  if (content.school.branches) foot.push(text({ x: m + gLogoD + 20, y: footerY + Math.round(footerH * 0.46), w: Math.round(width * 0.56), h: 22 }, content.school.branches.join('   |   '),
    { size: 18, family: typo.body.family, weight: 400, color: accent, align: 'left' }));
  if (content.school.phones) foot.push(text({ x: m + gLogoD + 20, y: footerY + Math.round(footerH * 0.62), w: Math.round(width * 0.6), h: 24 }, '☎  ' + content.school.phones.join('   |   '),
    { size: 20, family: typo.bodyBold.family, weight: 700, color: '#FFFFFF', align: 'left' }));
  if (content.footerQuote) foot.push(text({ x: m, y: footerY + footerH - Math.round(footerH * 0.16), w: width - m * 2, h: 20 }, content.footerQuote,
    { size: 15, family: typo.body.family, weight: 400, italic: true, color: '#B9C6DA', align: 'left' }));
  if (assets.leadLogo) {
    const chipH = Math.round(footerH * 0.26), chipW = Math.round(chipH * 2.4);
    const lx = width - m - chipW, ly = footerY + Math.round(footerH * 0.16);
    foot.push(rect({ x: lx, y: ly, w: chipW, h: chipH, radius: 8 }, { fill: '#FFFFFF' }));
    const pad = Math.round(chipH * 0.16);
    foot.push(image({ x: lx + pad, y: ly + pad, w: chipW - pad * 2, h: chipH - pad * 2 }, assets.leadLogo, { fit: 'contain', shape: 'rect' }));
    foot.push(text({ x: lx - 10, y: ly + chipH + 8, w: chipW + 10, h: 18 }, 'Powered by LEAD Curriculum',
      { size: 13, family: typo.body.family, weight: 400, color: '#B9C6DA', align: 'right' }));
  }
  nodes.push(group('12_FOOTER', foot));
  nodes.push(group('13_GROUP_LOGO', []));
  nodes.push(group('14_LEAD_LOGO', []));
  nodes.push(group('15_CONTACT_DETAILS', []));
  nodes.push(group('16_EFFECTS', []));

  return { scene: { width, height, root: nodes }, meta: { family: 'photoCollageSchoolEvent', galleryCount: count } };
}
