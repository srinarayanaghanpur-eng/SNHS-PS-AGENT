// Adaptive, photo-rich school-event collage.
//
// Frames are earned by strong, distinct photos. Missing or rejected roles do
// not leave holes: the hero and surviving story cards expand into the space.
import { group, rect, line, image, text, fitFontSize } from './engine.mjs';

const asPhoto = (value) => typeof value === 'string' ? { path: value } : value || null;

function photo(nodes, box, value, opts = {}) {
  const item = asPhoto(value);
  if (!item?.path) return false;
  const {
    shape = 'rect', radius = 18, ring = '#FFFFFF', ringWidth = 6, shadow = true,
    rot = 0, label = item.role?.label || item.label, palette, focusX = item.focusX ?? 0.5,
    focusY = item.focusY ?? 0.48,
  } = opts;
  nodes.push(image({ x: box.x, y: box.y, w: box.w, h: box.h }, item.path, {
    fit: 'cover', shape, radius, ring, ringWidth, shadow, rot, focusX, focusY,
  }));
  if (label) {
    const labelH = Math.max(36, Math.round(box.h * 0.09));
    const labelY = box.y + box.h - labelH;
    const cap = fitFontSize(String(label).toUpperCase(), { w: box.w - 14, h: labelH - 8 }, {
      min: 15, max: 20, kind: 'bodyUpper', maxLines: 1,
    });
    nodes.push(rect({ x: box.x, y: labelY, w: box.w, h: labelH, rot }, { fill: palette.primaryDark, opacity: 0.91 }));
    nodes.push(text({ x: box.x + 7, y: labelY + Math.max(7, (labelH - cap.size) / 2 - 1), w: box.w - 14, h: labelH - 7 }, cap.lines[0], {
      size: cap.size, family: 'Segoe UI', weight: 700, color: '#FFFFFF', align: 'center', tracking: 0.25, rot,
    }));
  }
  return true;
}

function galleryBoxes(count, x, y, width, height, gap) {
  const patterns = {
    1: [1], 2: [1.08, 0.92], 3: [0.94, 1.12, 0.94], 4: [1.05, 0.92, 1.1, 0.93],
    5: [1.08, 0.92, 1.04, 0.9, 1.06], 6: [1.05, 0.9, 1.08, 0.94, 1.1, 0.93],
    7: [1.05, 0.9, 1.08, 0.92, 1.06, 0.9, 1.09],
  };
  const weights = patterns[count] || new Array(count).fill(1);
  const usable = width - gap * (count - 1);
  const unit = usable / weights.reduce((sum, weight) => sum + weight, 0);
  const offsets = [4, 14, 0, 10, 3, 16, 6];
  const trims = [0, 14, 4, 18, 6, 12, 2];
  let cursor = x;
  return weights.map((weight, index) => {
    const w = index === count - 1 ? x + width - cursor : Math.round(unit * weight);
    const topOffset = Math.min(offsets[index], Math.max(0, height * 0.08));
    const box = { x: cursor, y: y + topOffset, w, h: Math.max(80, height - topOffset - trims[index]) };
    cursor += w + gap;
    return box;
  });
}

export function composeCollage2({ width, height, content, assets, palette, typo, roles = {} }) {
  const margin = Math.round(width * 0.04);
  const gap = Math.round(width * 0.014);
  const nodes = [];
  const accent = palette.accent;
  const storyFrames = [];
  let assetImageCount = 0;
  const P = (target, box, value, opts = {}, kind = 'support') => {
    if (photo(target, box, value, { ...opts, palette })) {
      assetImageCount++;
      if (kind === 'hero' || kind === 'support' || kind === 'gallery') storyFrames.push({ kind, ...box });
      return true;
    }
    return false;
  };

  const programmeOrder = new Map((content.programme || []).map((item, index) => [String(item).toLowerCase(), index]));
  const storyOrder = (item) => programmeOrder.get(String(item.role?.label || item.label || '').toLowerCase()) ?? 99;
  const support = (roles.supporting || []).filter((item) => asPhoto(item)?.path).slice(0, 3)
    .sort((a, b) => storyOrder(a) - storyOrder(b));
  const gallery = (roles.gallery || roles.lowerGallery || []).filter((item) => asPhoto(item)?.path).slice(0, 7);
  const layoutMode = roles.layoutMode || 'single-page-compact';
  const showProgramme = roles.showProgramme !== false;

  nodes.push(group('00_BACKGROUND', [rect({ x: 0, y: 0, w: width, h: height }, { fill: palette.canvas })]));
  const decorative = [];
  for (let i = 0; i < 7; i++) decorative.push(rect({ x: -65 + i * 190, y: -92, w: 150, h: 150, radius: 75 }, { fill: palette.primaryLight, opacity: 0.035 }));
  nodes.push(group('01_DECORATIVE_PATTERN', decorative));

  // Header: dedicated identity and chairman zones prevent accidental overlap.
  const headerH = Math.round(height * 0.17);
  const header = [
    rect({ x: 0, y: 0, w: width, h: headerH }, { fill: palette.canvasAlt }),
    rect({ x: 0, y: headerH - 6, w: width, h: 6 }, { fill: accent }),
  ];
  const logoD = Math.round(headerH * 0.57);
  const logoX = margin + 8, logoY = Math.round((headerH - logoD) / 2) - 4;
  if (assets.schoolLogo) header.push(image({ x: logoX, y: logoY, w: logoD, h: logoD }, assets.schoolLogo, { fit: 'contain', shape: 'rect' }));

  const chairPanel = { x: width - margin - 166, y: 20, w: 166, h: headerH - 38 };
  const identityX = logoX + logoD + 24;
  const identityW = chairPanel.x - identityX - 22;
  if (content.school.recognition) header.push(text({ x: identityX, y: 24, w: identityW, h: 24 }, content.school.recognition, {
    size: 18, family: typo.body.family, weight: 400, color: palette.inkSoft, align: 'center', tracking: 0.7,
  }));
  const schoolName = String(content.school.name || '').toUpperCase();
  const nameFit = fitFontSize(schoolName, { w: identityW, h: 96 }, { min: 43, max: 62, kind: 'displayUpper', maxLines: 2, lineHeight: 0.96 });
  header.push(text({ x: identityX, y: 54, w: identityW, h: 100 }, schoolName, {
    size: nameFit.size, lines: nameFit.lines.map((item) => item.toUpperCase()), family: typo.display.family,
    weight: 700, color: palette.primary, align: 'center', lineHeight: 0.96,
  }));
  if (content.school.address) header.push(text({ x: identityX, y: 54 + nameFit.lines.length * nameFit.size + 10, w: identityW, h: 25 }, content.school.address, {
    size: 19, family: typo.body.family, weight: 400, color: palette.ink, align: 'center',
  }));

  if (assets.chairman) {
    header.push(rect(chairPanel, { fill: palette.canvas, radius: 18, stroke: '#E7DED0', strokeWidth: 1 }));
    const portraitD = 108;
    const portraitX = chairPanel.x + Math.round((chairPanel.w - portraitD) / 2), portraitY = chairPanel.y + 7;
    P(header, { x: portraitX, y: portraitY, w: portraitD, h: portraitD }, assets.chairman, { shape: 'circle', ring: accent, ringWidth: 5, shadow: false }, 'management');
    if (content.event.chairman) {
      header.push(text({ x: chairPanel.x + 8, y: portraitY + portraitD + 7, w: chairPanel.w - 16, h: 23 }, content.event.chairman.name, {
        size: 19, family: typo.bodyBold.family, weight: 700, color: palette.ink, align: 'center',
      }));
      header.push(text({ x: chairPanel.x + 8, y: portraitY + portraitD + 31, w: chairPanel.w - 16, h: 18 }, content.event.chairman.role, {
        size: 14, family: typo.body.family, weight: 400, color: palette.inkSoft, align: 'center', tracking: 0.5,
      }));
    }
  }
  nodes.push(group('02_HEADER_IDENTITY', header));

  // Compact event bar keeps the photography as the main focal point.
  const barY = headerH + 12, barH = 72;
  const eventBar = [rect({ x: margin, y: barY, w: width - margin * 2, h: barH, radius: 13 }, {
    gradient: { angle: 0, stops: [{ at: 0, color: palette.primary, opacity: 1 }, { at: 100, color: palette.primaryDark, opacity: 1 }] },
  })];
  const titleFit = fitFontSize(content.event.title, { w: width - margin * 2 - 330, h: 50 }, { min: 29, max: 43, kind: 'displayUpper', maxLines: 1 });
  eventBar.push(text({ x: margin + 27, y: barY + 14, w: width - margin * 2 - 350, h: 48 }, String(content.event.title || '').toUpperCase(), {
    size: titleFit.size, family: typo.display.family, weight: 700, color: '#FFFFFF', align: 'left', tracking: 0.25,
  }));
  const date = [content.event.date, content.event.day].filter(Boolean).join('  ·  ').toUpperCase();
  eventBar.push(text({ x: width - margin - 320, y: barY + 24, w: 292, h: 29 }, date, {
    size: 21, family: typo.label.family, weight: 600, color: accent, align: 'right', tracking: 0.7,
  }));
  nodes.push(group('03_EVENT_TITLE_DATE', eventBar));

  const footerH = Math.round(height * 0.148), footerY = height - footerH;
  const quoteH = 44;
  const programmeRailH = showProgramme ? (gallery.length ? 106 : 128) : 0;
  const galleryReserve = gallery.length ? Math.round(height * 0.155) : 0;
  const collageTop = barY + barH + 16;
  const collageH = footerY - collageTop - quoteH - galleryReserve - programmeRailH - 42;
  const heroGroup = [], supportGroup = [];
  let heroFrame;

  if (!support.length) {
    heroFrame = { x: margin, y: collageTop, w: width - margin * 2, h: collageH };
  } else {
    const sideW = support.length === 1 ? Math.round(width * 0.29) : Math.round(width * 0.30);
    heroFrame = { x: margin, y: collageTop, w: width - margin * 2 - sideW - gap, h: collageH };
    const sideX = heroFrame.x + heroFrame.w + gap;
    if (support.length === 1) {
      P(supportGroup, { x: sideX, y: collageTop + 12, w: sideW, h: collageH - 20 }, support[0], {
        radius: 18, ring: accent, ringWidth: 5, label: support[0].role?.label, focusY: support[0].focusY ?? 0.42,
      }, 'support');
    } else {
      const firstRatio = support[0].technical?.orientation === 'portrait' ? 0.58 : 0.50;
      const firstH = Math.round((collageH - gap) * firstRatio);
      P(supportGroup, { x: sideX, y: collageTop + 3, w: sideW, h: firstH - 3 }, support[0], {
        radius: 18, ring: '#FFFFFF', ringWidth: 6, label: support[0].role?.label, focusY: support[0].focusY ?? 0.40,
      }, 'support');
      const remainingY = collageTop + firstH + gap;
      const remaining = support.slice(1);
      const remainingH = collageH - firstH - gap;
      const each = Math.round((remainingH - gap * Math.max(0, remaining.length - 1)) / remaining.length);
      remaining.forEach((item, index) => P(supportGroup, {
        x: sideX + (index % 2 ? 3 : 0), y: remainingY + index * (each + gap), w: sideW - (index % 2 ? 3 : 0), h: each,
      }, item, {
        radius: 16, ring: index === 0 ? accent : '#FFFFFF', ringWidth: 5, label: item.role?.label,
        rot: index === 1 ? 0.45 : 0, focusY: item.focusY ?? 0.46,
      }, 'support'));
    }
  }
  P(heroGroup, heroFrame, assets.hero, {
    radius: 24, ring: '#FFFFFF', ringWidth: 8, shadow: true, label: roles.heroLabel || 'Morning Assembly',
    focusX: roles.hero?.focusX ?? 0.46, focusY: roles.hero?.focusY ?? 0.56,
  }, 'hero');
  nodes.push(group('04_HERO_PHOTO', heroGroup));
  if (supportGroup.length) nodes.push(group('05_VERIFIED_ACTIVITY_PHOTOS', supportGroup));

  // Quote is a refined divider, not a competing headline.
  const quoteY = collageTop + collageH + 12;
  const quote = [
    line(margin, quoteY + 7, margin + 64, quoteY + 7, { stroke: accent, strokeWidth: 4 }),
    line(width - margin - 64, quoteY + quoteH - 9, width - margin, quoteY + quoteH - 9, { stroke: accent, strokeWidth: 4 }),
  ];
  const quoteFit = fitFontSize(content.quote, { w: width - margin * 2 - 110, h: quoteH }, { min: 19, max: 23, kind: 'body', maxLines: 2, lineHeight: 1.06 });
  quote.push(text({ x: margin + 55, y: quoteY + Math.max(2, (quoteH - quoteFit.lines.length * quoteFit.size * 1.08) / 2), w: width - margin * 2 - 110, h: quoteH }, content.quote, {
    size: quoteFit.size, lines: quoteFit.lines, family: typo.display.family, weight: 600, italic: true,
    color: palette.primary, align: 'center', lineHeight: 1.06,
  }));
  nodes.push(group('06_QUOTE_DIVIDER', quote));

  if (gallery.length) {
    const galleryTop = quoteY + quoteH + 8;
    const galleryNodes = [text({ x: margin, y: galleryTop, w: width - margin * 2, h: 25 }, 'MOMENTS FROM THE MORNING', {
      size: 20, family: typo.label.family, weight: 600, color: palette.primary, align: 'left', tracking: 2.4,
    })];
    const rowY = galleryTop + 31, rowH = galleryReserve - 39;
    const boxes = galleryBoxes(gallery.length, margin, rowY, width - margin * 2, rowH, gap);
    const rotations = [-0.55, 0.25, 0, 0.5, -0.25, 0.35, -0.4];
    gallery.forEach((item, index) => P(galleryNodes, boxes[index], item, {
      radius: 13, ring: index % 3 === 1 ? accent : '#FFFFFF', ringWidth: 5, shadow: true,
      rot: rotations[index], label: item.role?.label, focusY: item.focusY ?? 0.46,
    }, 'gallery'));
    nodes.push(group('07_DISTINCT_MOMENT_GALLERY', galleryNodes));
  }

  // Every programme item remains visible even when there are too few honest
  // photographs to illustrate all nine moments. Gold markers mean that a
  // verified photo for that exact activity appears elsewhere on the poster.
  if (showProgramme && content.programme?.length) {
    const programmeTop = quoteY + quoteH + galleryReserve + 8;
    const programme = content.programme;
    const illustrated = new Set([...support, ...gallery].map((item) => String(item.role?.label || item.label || '').toLowerCase()));
    const rail = [
      text({ x: margin, y: programmeTop, w: 270, h: 23 }, "TODAY'S PROCEEDINGS", {
        size: 18, family: typo.label.family, weight: 700, color: palette.primary, align: 'left', tracking: 1.8,
      }),
      line(margin + 280, programmeTop + 11, width - margin, programmeTop + 11, { stroke: '#DCCCA9', strokeWidth: 2 }),
    ];
    const rows = [programme.slice(0, 5), programme.slice(5)];
    rows.forEach((row, rowIndex) => {
      const rowY = programmeTop + 35 + rowIndex * 44;
      const cellW = (width - margin * 2) / row.length;
      row.forEach((item, cellIndex) => {
        const itemIndex = programme.indexOf(item);
        const x = margin + cellIndex * cellW;
        const isIllustrated = illustrated.has(String(item).toLowerCase());
        rail.push(rect({ x, y: rowY + 3, w: 23, h: 23, radius: 12 }, {
          fill: isIllustrated ? accent : palette.canvasAlt,
          stroke: isIllustrated ? accent : '#D8D2C8', strokeWidth: 1,
        }));
        rail.push(text({ x, y: rowY + 4, w: 23, h: 20 }, String(itemIndex + 1).padStart(2, '0'), {
          size: 12, family: typo.bodyBold.family, weight: 700,
          color: isIllustrated ? palette.primaryDark : palette.inkSoft, align: 'center',
        }));
        const fit = fitFontSize(item, { w: cellW - 31, h: 35 }, { min: 14, max: 16, kind: 'body', maxLines: 2, lineHeight: 1.05 });
        rail.push(text({ x: x + 30, y: rowY, w: cellW - 35, h: 36 }, item, {
          size: fit.size, lines: fit.lines, family: typo.body.family, weight: isIllustrated ? 700 : 500,
          color: isIllustrated ? palette.primary : palette.inkSoft, align: 'left', lineHeight: 1.05,
        }));
      });
    });
    nodes.push(group('08_TODAYS_PROCEEDINGS_RAIL', rail));
  }

  // Cleaner three-zone footer: group identity, contacts, partner logo.
  const footer = [
    rect({ x: 0, y: footerY, w: width, h: footerH }, { gradient: { angle: 90, stops: [{ at: 0, color: palette.primary, opacity: 1 }, { at: 100, color: palette.primaryDark, opacity: 1 }] } }),
    rect({ x: 0, y: footerY, w: width, h: 6 }, { fill: accent }),
  ];
  for (let i = 0; i < 7; i++) footer.push(rect({ x: -20 + i * 175, y: footerY + 5, w: 120, h: 84, radius: 42 }, { fill: '#FFFFFF', opacity: 0.025 }));
  const logoChip = { x: margin, y: footerY + 29, w: 96, h: 96 };
  const groupLogo = assets.groupLogo || assets.schoolLogo;
  if (groupLogo) {
    footer.push(rect(logoChip, { fill: '#FFFFFF', opacity: 0.94, radius: 17 }));
    footer.push(image({ x: logoChip.x + 9, y: logoChip.y + 9, w: logoChip.w - 18, h: logoChip.h - 18 }, groupLogo, { fit: 'contain', shape: 'rect' }));
  }
  const footerTextX = logoChip.x + logoChip.w + 24;
  footer.push(text({ x: footerTextX, y: footerY + 22, w: 590, h: 20 }, 'A Unit of', {
    size: 17, family: typo.body.family, weight: 400, color: '#D4DDEA', align: 'left',
  }));
  footer.push(text({ x: footerTextX, y: footerY + 43, w: 590, h: 31 }, String(content.school.group || '').toUpperCase(), {
    size: 29, family: typo.display.family, weight: 700, color: '#FFFFFF', align: 'left', tracking: 0.2,
  }));
  if (content.school.branches) footer.push(text({ x: footerTextX, y: footerY + 79, w: 590, h: 24 }, content.school.branches.join('   |   '), {
    size: 20, family: typo.body.family, weight: 500, color: accent, align: 'left',
  }));
  if (content.school.phones) footer.push(text({ x: footerTextX, y: footerY + 108, w: 650, h: 27 }, 'TEL  ' + content.school.phones.join('   |   '), {
    size: 23, family: typo.bodyBold.family, weight: 700, color: '#FFFFFF', align: 'left',
  }));
  if (content.footerQuote) footer.push(text({ x: footerTextX, y: footerY + footerH - 29, w: 655, h: 18 }, content.footerQuote, {
    size: 15, family: typo.body.family, weight: 400, italic: true, color: '#C7D1E0', align: 'left',
  }));
  if (assets.leadLogo) {
    const chip = { x: width - margin - 154, y: footerY + 32, w: 154, h: 70 };
    footer.push(rect(chip, { fill: '#FFFFFF', radius: 12 }));
    footer.push(image({ x: chip.x + 14, y: chip.y + 12, w: chip.w - 28, h: chip.h - 24 }, assets.leadLogo, { fit: 'contain', shape: 'rect' }));
    footer.push(text({ x: chip.x - 18, y: chip.y + chip.h + 10, w: chip.w + 18, h: 18 }, 'Powered by LEAD Curriculum', {
      size: 15, family: typo.body.family, weight: 500, color: '#D4DDEA', align: 'right',
    }));
  }
  nodes.push(group('09_FOOTER_BRANDING', footer));

  return {
    scene: { width, height, root: nodes },
    meta: {
      family: 'adaptivePhotoStoryCollage',
      photosUsed: storyFrames.length,
      storyPhotoCount: storyFrames.length,
      supportCount: support.length,
      galleryCount: gallery.length,
      assetImageCount,
      heroFrame,
      photoFrames: storyFrames,
      fixedSlotCount: false,
      layoutMode,
      renderedProgrammeItems: showProgramme ? [...(content.programme || [])] : [],
      chairmanPanel: chairPanel,
      footerTextSizes: { group: 29, branches: 20, phones: 23, motto: 15, partner: 15 },
    },
  };
}
