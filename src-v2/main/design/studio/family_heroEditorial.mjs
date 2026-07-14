// Composition family: Hero Editorial (premium institutional).
// Full-bleed hero photo band with gradient scrim + oversized title overlay,
// numbered schedule cards, navy footer. Fills the whole canvas — no dead column.

import { group, rect, line, image, text, fitFontSize, wrapText, measureLineWidth } from './engine.mjs';

export function composeHeroEditorial({ plan, content, assets, palette, typo }) {
  const { width, height } = plan.canvas;
  const B = plan.sectionBoundingBoxes;
  const nodes = [];

  // 00_BACKGROUND — warm premium canvas (never navy-on-black).
  nodes.push(group('00_BACKGROUND', [
    rect({ x: 0, y: 0, w: width, h: height }, { fill: palette.canvas }),
    // subtle top tint block behind header for depth
    rect({ x: 0, y: 0, w: width, h: B.hero.y }, { fill: palette.canvasAlt }),
  ]));

  // 01_LIGHTING_AND_TEXTURE — faint accent corner wash (purpose: depth, not dead space).
  nodes.push(group('01_LIGHTING_AND_TEXTURE', [
    rect({ x: 0, y: height - Math.round(height * 0.28), w: width, h: Math.round(height * 0.28) },
      { gradient: { angle: 90, stops: [{ at: 0, color: palette.canvas, opacity: 0 }, { at: 100, color: palette.primaryLight, opacity: 0.14 }] } }),
  ]));

  // 02_BRANDING — header: logo + school name + accent rule + academic year.
  const branding = [];
  let nameX = B.header.x;
  const logoSize = Math.round(B.header.h * 0.92);
  if (assets.schoolLogo) {
    branding.push(image({ x: B.header.x, y: B.header.y, w: logoSize, h: logoSize }, assets.schoolLogo, { fit: 'contain', shape: 'rect' }));
    nameX = B.header.x + logoSize + Math.round(width * 0.02);
  }
  const nameW = B.header.x + B.header.w - nameX;
  const nameFit = fitFontSize(content.school.name, { w: nameW, h: Math.round(B.header.h * 0.55) }, { min: 30, max: 46, kind: 'display', maxLines: 2, tracking: 0.5 });
  branding.push(text({ x: nameX, y: B.header.y + Math.round(B.header.h * 0.12), w: nameW, h: B.header.h },
    content.school.name, { size: nameFit.size, lines: nameFit.lines, family: typo.displaySemi.family, weight: 600, color: palette.primary, align: 'left', lineHeight: 1.05 }));
  if (content.school.academicYear) {
    branding.push(text({ x: nameX, y: B.header.y + B.header.h - Math.round(B.header.h * 0.02), w: nameW, h: 24 },
      content.school.academicYear, { size: 20, family: typo.body.family, weight: 400, color: palette.inkSoft, align: 'left' }));
  }
  branding.push(line(nameX, B.header.y + B.header.h - Math.round(B.header.h * 0.16), nameX + Math.round(nameW * 0.5), B.header.y + B.header.h - Math.round(B.header.h * 0.16), { stroke: palette.accent, strokeWidth: 4, cap: 'round' }));
  nodes.push(group('02_BRANDING', branding));

  // 03_HERO_MEDIA — full-width hero band + gradient scrim. If no photo, a rich navy band.
  const hero = [];
  if (assets.hero) {
    hero.push(image({ x: B.hero.x, y: B.hero.y, w: B.hero.w, h: B.hero.h }, assets.hero, { fit: 'cover', shape: 'rect' }));
    // navy scrim bottom for title legibility
    hero.push(rect({ x: B.hero.x, y: B.hero.y, w: B.hero.w, h: B.hero.h },
      { gradient: { angle: 90, stops: [
        { at: 0, color: palette.primaryDark, opacity: 0.05 },
        { at: 55, color: palette.primaryDark, opacity: 0.35 },
        { at: 100, color: palette.primaryDark, opacity: 0.92 } ] } }));
  } else {
    hero.push(rect({ x: B.hero.x, y: B.hero.y, w: B.hero.w, h: B.hero.h },
      { gradient: { angle: 60, stops: [{ at: 0, color: palette.primary, opacity: 1 }, { at: 100, color: palette.primaryDark, opacity: 1 }] } }));
    // large ghost typographic mark to fill space meaningfully
    hero.push(text({ x: B.hero.x, y: B.hero.y + Math.round(B.hero.h * 0.62), w: B.hero.w, h: B.hero.h },
      '✦', { size: Math.round(B.hero.h * 0.5), family: typo.body.family, weight: 700, color: palette.accent, align: 'center', lineHeight: 1 }));
  }
  // thin accent keyline at hero base
  hero.push(rect({ x: 0, y: B.hero.y + B.hero.h - 6, w: width, h: 6 }, { fill: palette.accent }));
  nodes.push(group('03_HERO_MEDIA', hero));

  // 04_TITLE — date badge + oversized event title over the hero scrim.
  const titleGrp = [];
  const titleFit = fitFontSize(content.title, { w: B.titleBlock.w, h: B.titleBlock.h }, { min: 62, max: 108, kind: 'displayUpper', maxLines: 2, tracking: -1, lineHeight: 1.0 });
  const tLines = titleFit.lines.map((l) => l.toUpperCase());
  // Anchor so the LAST line's baseline sits just above the hero base -> whole title on the dark scrim.
  const lastBaseline = B.hero.y + B.hero.h - Math.round(height * 0.05);
  const startY = lastBaseline - titleFit.size - (tLines.length - 1) * titleFit.size;
  // Date badge sits directly above the first title line.
  const badge = content.date;
  if (badge) {
    const bh = B.dateBadge.h;
    const bw = Math.round(measureLineWidth(badge, 22, 'bodyUpper', 1.5)) + Math.round(width * 0.05);
    const by = startY - bh - Math.round(height * 0.014);
    titleGrp.push(rect({ x: B.titleBlock.x, y: by, w: bw, h: bh, radius: Math.round(bh / 2) }, { fill: palette.accent }));
    titleGrp.push(text({ x: B.titleBlock.x, y: by + Math.round(bh * 0.22), w: bw, h: bh },
      badge, { size: 22, family: typo.label.family, weight: 600, color: palette.onAccent, align: 'center', tracking: 1.5 }));
  }
  titleGrp.push(text({ x: B.titleBlock.x, y: startY, w: B.titleBlock.w, h: B.titleBlock.h },
    content.title, { size: titleFit.size, lines: tLines, family: typo.display.family, weight: 700, color: '#FFFFFF', align: 'left', tracking: -1, lineHeight: 1.0, shadow: true }));
  nodes.push(group('04_TITLE', titleGrp));

  // 05_EVENT_DETAILS — subtitle / motto.
  if (content.subtitle) {
    const subFit = fitFontSize(content.subtitle, { w: B.subtitle.w, h: B.subtitle.h }, { min: 30, max: 44, kind: 'body', maxLines: 2, lineHeight: 1.15 });
    nodes.push(group('05_EVENT_DETAILS', [
      text({ x: B.subtitle.x, y: B.subtitle.y + subFit.size, w: B.subtitle.w, h: B.subtitle.h },
        content.subtitle, { size: subFit.size, lines: subFit.lines, family: typo.body.family, weight: 400, italic: true, color: palette.inkSoft, align: 'left', lineHeight: 1.15 }),
    ]));
  }

  // 06_SCHEDULE — numbered cards in a two-column grid, readable.
  const sched = [];
  const items = (content.schedule || []).slice(0, 12);
  if (items.length) {
    sched.push(text({ x: B.schedule.x, y: B.schedule.y + 30, w: B.schedule.w, h: 40 },
      'PROGRAMME', { size: 26, family: typo.label.family, weight: 600, color: palette.primary, align: 'left', tracking: 4 }));
    sched.push(line(B.schedule.x + Math.round(measureLineWidth('PROGRAMME', 26, 'bodyUpper', 4)) + 24, B.schedule.y + 46, B.schedule.x + B.schedule.w, B.schedule.y + 46, { stroke: palette.accent, strokeWidth: 2 }));

    const cols = items.length > 6 ? 2 : 1;
    const gapX = Math.round(width * 0.03);
    const cardW = cols === 2 ? Math.round((B.schedule.w - gapX) / 2) : B.schedule.w;
    const rows = Math.ceil(items.length / cols);
    const areaY = B.schedule.y + 56;
    const areaH = B.schedule.h - 56;
    const cardH = Math.min(Math.round(height * 0.05), Math.round((areaH - (rows - 1) * 10) / rows));
    const gapY = rows > 1 ? Math.round((areaH - rows * cardH) / (rows - 1)) : 0;

    items.forEach((it, i) => {
      const col = cols === 2 ? i % 2 : 0;
      const row = cols === 2 ? Math.floor(i / 2) : i;
      const cx = B.schedule.x + col * (cardW + gapX);
      const cy = areaY + row * (cardH + gapY);
      sched.push(rect({ x: cx, y: cy, w: cardW, h: cardH, radius: 12 }, { fill: palette.canvasAlt, stroke: '#E6E0D4', strokeWidth: 1 }));
      // number chip — vertically centred inside the card
      const pad = Math.round(cardH * 0.18);
      const chip = cardH - pad * 2;
      const chx = cx + pad, chy = cy + pad;
      sched.push(rect({ x: chx, y: chy, w: chip, h: chip, radius: 9 }, { fill: palette.primary }));
      const numSize = Math.round(chip * 0.5);
      sched.push(text({ x: chx, y: chy + chip * 0.5 - numSize * 0.65, w: chip, h: chip },
        String(i + 1), { size: numSize, family: typo.displaySemi.family, weight: 700, color: palette.onPrimary, align: 'center' }));
      const txX = chx + chip + Math.round(cardH * 0.24);
      const txW = cx + cardW - txX - 16;
      const itFit = fitFontSize(it, { w: txW, h: cardH }, { min: 24, max: 30, kind: 'body', maxLines: 1 });
      sched.push(text({ x: txX, y: cy + cardH * 0.5 - itFit.size * 0.66, w: txW, h: cardH },
        it, { size: itFit.size, lines: [itFit.lines[0]], family: typo.bodyBold.family, weight: 700, color: palette.ink, align: 'left' }));
    });
  }
  nodes.push(group('06_SCHEDULE', sched));

  // 07_MANAGEMENT — optional circular portraits row above footer.
  const mgmt = (content.management || []).filter((m) => m.name && m.image);
  if (mgmt.length) {
    const mg = [];
    const pd = Math.round(height * 0.06);
    const totalW = mgmt.length * pd + (mgmt.length - 1) * Math.round(width * 0.04);
    let mx = Math.round((width - totalW) / 2);
    const my = B.footer.y - pd - Math.round(height * 0.03);
    mgmt.forEach((m) => {
      mg.push(image({ x: mx, y: my, w: pd, h: pd }, m.image, { fit: 'cover', shape: 'circle', ring: palette.accent, ringWidth: 3 }));
      mg.push(text({ x: mx - 20, y: my + pd + 22, w: pd + 40, h: 24 }, m.name, { size: 18, family: typo.bodyBold.family, weight: 700, color: palette.ink, align: 'center' }));
      mg.push(text({ x: mx - 20, y: my + pd + 44, w: pd + 40, h: 20 }, m.role || '', { size: 15, family: typo.body.family, weight: 400, color: palette.inkSoft, align: 'center' }));
      mx += pd + Math.round(width * 0.04);
    });
    nodes.push(group('07_MANAGEMENT', mg));
  }

  // 08_FOOTER — navy bar with phone + address (readable) and LEAD co-brand.
  const foot = [];
  const m = plan.canvas.margin;
  foot.push(rect({ x: 0, y: B.footer.y, w: width, h: B.footer.h }, { fill: palette.primary }));
  foot.push(rect({ x: 0, y: B.footer.y, w: width, h: 5 }, { fill: palette.accent }));
  // Reserve the far right for the LEAD co-brand so nothing collides.
  const hasLead = !!assets.leadLogo;
  const leadW = hasLead ? Math.round(B.footer.h * 1.5) : 0;
  const leadLeft = width - m - leadW;
  const contactRight = (hasLead ? leadLeft : width - m) - Math.round(width * 0.02);
  const fyTop = B.footer.y + Math.round(B.footer.h * 0.4);
  if (content.school.phone) {
    foot.push(text({ x: m, y: fyTop, w: Math.round(width * 0.4), h: 30 },
      '☎  ' + content.school.phone, { size: 27, family: typo.bodyBold.family, weight: 700, color: palette.onPrimary, align: 'left' }));
  }
  if (content.leadBranding) {
    foot.push(text({ x: m, y: B.footer.y + B.footer.h - 16, w: Math.round(width * 0.5), h: 20 },
      content.leadBranding, { size: 16, family: typo.body.family, weight: 400, color: '#9FB0C6', align: 'left' }));
  }
  if (content.school.address) {
    const addrW = contactRight - Math.round(width * 0.44);
    const addrFit = fitFontSize(content.school.address, { w: addrW, h: 30 }, { min: 22, max: 25, kind: 'body', maxLines: 1 });
    foot.push(text({ x: Math.round(width * 0.44), y: fyTop, w: addrW, h: 30 },
      content.school.address, { size: addrFit.size, lines: [addrFit.lines[0]], family: typo.body.family, weight: 400, color: '#D8E0EC', align: 'right' }));
  }
  if (hasLead) {
    const lh = Math.round(B.footer.h * 0.52);
    foot.push(image({ x: leadLeft, y: B.footer.y + (B.footer.h - lh) / 2, w: leadW, h: lh }, assets.leadLogo, { fit: 'contain', shape: 'rect' }));
  }
  nodes.push(group('08_FOOTER', foot));

  return { width, height, root: nodes };
}
