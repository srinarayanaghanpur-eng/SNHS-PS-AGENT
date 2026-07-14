// Hero Editorial family (v2) — face-aware, content-derived layout.
// Variants: photo-overlay (title on a face-free scrim), photo-below (title in a
// navy band beneath the photo when faces fill the frame), and no-photo.

import { group, rect, line, image, text, fitFontSize, measureLineWidth } from './engine.mjs';
import { layoutSchedule } from './schedule.mjs';

export function composeHero({ width, height, content, assets, palette, typo, analysis }) {
  const margin = Math.round(width * 0.06);
  const cw = width - margin * 2;
  const nodes = [];
  const boxes = {};

  // ---- header sizing ----
  const headerH = Math.round(height * 0.085);
  const headerY = margin;
  boxes.header = { x: margin, y: headerY, w: cw, h: headerH };

  // ---- decide hero mode ----
  const hasPhoto = !!assets.hero;
  const titleLen = content.event.title.length;
  const twoLine = titleLen > 16;
  const titleNeed = Math.round(height * (twoLine ? 0.16 : 0.10)); // vertical need for title text
  let mode;
  if (!hasPhoto) mode = 'no-photo';
  else {
    const heroH0 = Math.round(height * 0.36);
    const clearPx = (analysis?.clearBottomFrac ?? 0) * heroH0;
    mode = clearPx >= titleNeed + 40 ? 'overlay' : 'below';
  }

  const footerH = Math.round(height * 0.08);
  const footerY = height - footerH;
  boxes.footer = { x: 0, y: footerY, w: width, h: footerH };

  const heroTop = headerY + headerH + Math.round(height * 0.012);

  // ================= BACKGROUND =================
  nodes.push(group('00_BACKGROUND', [
    rect({ x: 0, y: 0, w: width, h: height }, { fill: palette.canvas }),
    rect({ x: 0, y: 0, w: width, h: heroTop }, { fill: palette.canvasAlt }),
  ]));
  nodes.push(group('01_LIGHTING_AND_TEXTURE', [
    rect({ x: 0, y: height - Math.round(height * 0.26), w: width, h: Math.round(height * 0.26) },
      { gradient: { angle: 90, stops: [{ at: 0, color: palette.canvas, opacity: 0 }, { at: 100, color: palette.primaryLight, opacity: 0.12 }] } }),
  ]));

  // ================= BRANDING (header) =================
  const branding = [];
  let nameX = margin;
  const logoSize = Math.round(headerH * 0.94);
  if (assets.schoolLogo) {
    branding.push(image({ x: margin, y: headerY, w: logoSize, h: logoSize }, assets.schoolLogo, { fit: 'contain', shape: 'rect' }));
    nameX = margin + logoSize + Math.round(width * 0.022);
  }
  const nameW = margin + cw - nameX;
  const nameFit = fitFontSize(content.school.name, { w: nameW, h: Math.round(headerH * 0.5) }, { min: 28, max: 44, kind: 'display', maxLines: 2, tracking: 0.5 });
  branding.push(text({ x: nameX, y: headerY + Math.round(headerH * 0.06), w: nameW, h: headerH }, content.school.name,
    { size: nameFit.size, lines: nameFit.lines, family: typo.displaySemi.family, weight: 600, color: palette.primary, align: 'left', lineHeight: 1.04 }));
  const subParts = [content.school.branch, content.school.academicYear].filter(Boolean).join('  ·  ');
  if (subParts) branding.push(text({ x: nameX, y: headerY + headerH - Math.round(headerH * 0.04), w: nameW, h: 22 }, subParts,
    { size: 19, family: typo.body.family, weight: 400, color: palette.inkSoft, align: 'left' }));
  branding.push(line(nameX, headerY + headerH - Math.round(headerH * 0.14), nameX + Math.round(nameW * 0.42), headerY + headerH - Math.round(headerH * 0.14), { stroke: palette.accent, strokeWidth: 4, cap: 'round' }));
  nodes.push(group('02_BRANDING', branding));

  // ================= HERO MEDIA + TITLE =================
  let scheduleTop;
  const heroGrp = [];
  const titleGrp = [];

  const forceUpper = content.event.titleCase === 'upper';
  const badgeH = content.event.date ? Math.round(height * 0.038) : 0;
  const badgeGap = content.event.date ? Math.round(height * 0.016) : 0;

  // Compute the title fit for a given width/maxSize, then render it at (tx, ty).
  const computeTitle = (tw, maxSize) => {
    const disp = forceUpper ? content.event.title.toUpperCase() : content.event.title;
    const fit = fitFontSize(disp, { w: tw, h: maxSize * 2.3 }, { min: 60, max: maxSize, kind: forceUpper ? 'displayUpper' : 'display', maxLines: 2, tracking: -0.5, lineHeight: 1.0 });
    const titleH = fit.lines.length * fit.size;
    return { disp, fit, titleH, blockH: badgeH + badgeGap + titleH };
  };
  const renderTitle = (tx, ty, tw, t, onDark) => {
    let cy = ty;
    if (content.event.date) {
      const bw = Math.round(measureLineWidth(content.event.date, 21, 'bodyUpper', 1.4)) + Math.round(width * 0.045);
      titleGrp.push(rect({ x: tx, y: cy, w: bw, h: badgeH, radius: Math.round(badgeH / 2) }, { fill: palette.accent }));
      titleGrp.push(text({ x: tx, y: cy + Math.round(badgeH * 0.2), w: bw, h: badgeH }, content.event.date,
        { size: 21, family: typo.label.family, weight: 600, color: palette.onAccent, align: 'center', tracking: 1.4 }));
      cy += badgeH + badgeGap;
    }
    titleGrp.push(text({ x: tx, y: cy, w: tw, h: t.titleH + 8 }, t.disp,
      { size: t.fit.size, lines: t.fit.lines, family: typo.display.family, weight: 700, color: onDark ? '#FFFFFF' : palette.ink, align: 'left', tracking: -0.5, lineHeight: 1.0, shadow: onDark }));
  };

  if (mode === 'overlay') {
    const heroH = Math.round(height * 0.36);
    heroGrp.push(image({ x: 0, y: heroTop, w: width, h: heroH }, assets.hero, { fit: 'cover', shape: 'rect' }));
    const scrim = analysis?.recommendedScrim ?? 0.7;
    heroGrp.push(rect({ x: 0, y: heroTop, w: width, h: heroH }, { gradient: { angle: 90, stops: [
      { at: 0, color: palette.primaryDark, opacity: 0.04 },
      { at: 60, color: palette.primaryDark, opacity: scrim * 0.5 },
      { at: 100, color: palette.primaryDark, opacity: scrim } ] } }));
    heroGrp.push(rect({ x: 0, y: heroTop + heroH - 6, w: width, h: 6 }, { fill: palette.accent }));
    const t = computeTitle(cw, twoLine ? 104 : 118);
    renderTitle(margin, heroTop + heroH - t.blockH - Math.round(height * 0.03), cw, t, true);
    scheduleTop = heroTop + heroH + Math.round(height * 0.03);
  } else if (mode === 'below') {
    const photoH = Math.round(height * 0.23);
    heroGrp.push(image({ x: 0, y: heroTop, w: width, h: photoH }, assets.hero, { fit: 'cover', shape: 'rect' }));
    heroGrp.push(rect({ x: 0, y: heroTop, w: width, h: Math.round(photoH * 0.16) }, { gradient: { angle: 90, stops: [
      { at: 0, color: palette.primaryDark, opacity: 0.26 }, { at: 100, color: palette.primaryDark, opacity: 0 } ] } }));
    const bandY = heroTop + photoH;
    const t = computeTitle(cw, twoLine ? 84 : 100);
    const bandPad = Math.round(height * 0.016);
    const bandH = bandPad * 2 + t.blockH;
    heroGrp.push(rect({ x: 0, y: bandY, w: width, h: bandH }, { gradient: { angle: 60, stops: [
      { at: 0, color: palette.primary, opacity: 1 }, { at: 100, color: palette.primaryDark, opacity: 1 } ] } }));
    heroGrp.push(rect({ x: 0, y: bandY, w: width, h: 6 }, { fill: palette.accent }));
    renderTitle(margin, bandY + bandPad, cw, t, true);
    scheduleTop = bandY + bandH + Math.round(height * 0.026);
  } else {
    const bandY = heroTop;
    const t = computeTitle(Math.round(cw * 0.82), twoLine ? 104 : 124);
    const bandH = Math.max(Math.round(height * 0.22), t.blockH + Math.round(height * 0.09));
    heroGrp.push(rect({ x: 0, y: bandY, w: width, h: bandH }, { gradient: { angle: 55, stops: [
      { at: 0, color: palette.primary, opacity: 1 }, { at: 100, color: palette.primaryDark, opacity: 1 } ] } }));
    heroGrp.push(text({ x: width - Math.round(width * 0.42), y: bandY, w: Math.round(width * 0.42), h: bandH },
      '✦', { size: Math.round(bandH * 0.8), family: typo.body.family, weight: 700, color: palette.accent, align: 'center', lineHeight: 1 }));
    heroGrp.push(rect({ x: 0, y: bandY + bandH - 6, w: width, h: 6 }, { fill: palette.accent }));
    renderTitle(margin, bandY + Math.round(bandH * 0.26), Math.round(cw * 0.82), t, true);
    scheduleTop = bandY + bandH + Math.round(height * 0.03);
  }
  nodes.push(group('03_HERO_MEDIA', heroGrp));
  nodes.push(group('04_TITLE', titleGrp));

  // ================= EVENT DETAILS (subtitle / motto) =================
  const detailGrp = [];
  const motto = content.event.subtitle || content.school.motto;
  if (motto) {
    const mf = fitFontSize(motto, { w: cw, h: Math.round(height * 0.05) }, { min: 28, max: 40, kind: 'body', maxLines: 2, lineHeight: 1.15 });
    detailGrp.push(text({ x: margin, y: scheduleTop, w: cw, h: mf.size * 1.4 }, motto,
      { size: mf.size, lines: mf.lines, family: typo.body.family, weight: 400, italic: true, color: palette.inkSoft, align: 'left' }));
    scheduleTop += mf.lines.length * mf.size + Math.round(height * 0.02);
  }
  nodes.push(group('05_EVENT_DETAILS', detailGrp));

  // ================= SCHEDULE =================
  const schedBox = { x: margin, y: scheduleTop, w: cw, h: footerY - scheduleTop - Math.round(height * 0.02) };
  const sched = layoutSchedule({ items: content.event.schedule || [], box: schedBox, palette, typo });
  nodes.push(group('06_SCHEDULE', sched.nodes));

  // ================= MANAGEMENT (optional) =================
  const mgmt = (content.assets?.management || []).filter((m) => m.name && m.imageResolved);
  // (kept minimal for hero family; collage family features management prominently)

  // ================= FOOTER =================
  const foot = [];
  const m = margin;
  foot.push(rect({ x: 0, y: footerY, w: width, h: footerH }, { fill: palette.primary }));
  foot.push(rect({ x: 0, y: footerY, w: width, h: 5 }, { fill: palette.accent }));
  const hasLead = !!assets.leadLogo;
  // LEAD sits on a small light chip at far right (secondary partner mark).
  let leadLeft = width - m;
  if (hasLead) {
    const chipH = Math.round(footerH * 0.5), chipW = Math.round(chipH * 2.0);
    leadLeft = width - m - chipW;
    foot.push(rect({ x: leadLeft, y: footerY + (footerH - chipH) / 2, w: chipW, h: chipH, radius: 8 }, { fill: '#FFFFFF' }));
    const pad = Math.round(chipH * 0.16);
    foot.push(image({ x: leadLeft + pad, y: footerY + (footerH - chipH) / 2 + pad, w: chipW - pad * 2, h: chipH - pad * 2 }, assets.leadLogo, { fit: 'contain', shape: 'rect' }));
    foot.push(text({ x: leadLeft - Math.round(width * 0.14), y: footerY + footerH / 2 - 8, w: Math.round(width * 0.13), h: 20 }, 'In partnership with',
      { size: 14, family: typo.body.family, weight: 400, color: '#9FB0C6', align: 'right' }));
  }
  const contactRight = (hasLead ? leadLeft - Math.round(width * 0.15) : width - m);
  const fy = footerY + Math.round(footerH * 0.34);
  if (content.school.phone) foot.push(text({ x: m, y: fy, w: Math.round(width * 0.4), h: 30 }, '☎  ' + content.school.phone,
    { size: 27, family: typo.bodyBold.family, weight: 700, color: palette.onPrimary, align: 'left' }));
  if (content.school.address) {
    const addrW = Math.round(width * 0.5);
    const af = fitFontSize(content.school.address, { w: addrW, h: 26 }, { min: 20, max: 24, kind: 'body', maxLines: 1 });
    foot.push(text({ x: m, y: footerY + footerH - Math.round(footerH * 0.3), w: addrW, h: 26 }, content.school.address,
      { size: af.size, lines: [af.lines[0]], family: typo.body.family, weight: 400, color: '#C9D4E4', align: 'left' }));
  }
  nodes.push(group('08_FOOTER', foot));

  return {
    scene: { width, height, root: nodes },
    meta: { mode, scheduleMode: sched.mode, scheduleMinSize: sched.minSize, scheduleOverflow: sched.overflow, boxes: { ...boxes, schedule: schedBox } },
  };
}
