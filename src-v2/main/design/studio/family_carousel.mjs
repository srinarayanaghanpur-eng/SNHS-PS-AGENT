import { group, rect, line, image, text, fitFontSize } from './engine.mjs';

function photoBoxes(count, area, gap) {
  if (count <= 0) return [];
  if (count === 1) return [{ ...area }];
  if (count === 2) {
    const left = Math.round((area.w - gap) * 0.53);
    return [
      { x: area.x, y: area.y + 9, w: left, h: area.h - 18 },
      { x: area.x + left + gap, y: area.y, w: area.w - left - gap, h: area.h },
    ];
  }
  const rows = count <= 4 ? 1 : 2;
  const rowCounts = rows === 1 ? [count] : [Math.ceil(count / 2), Math.floor(count / 2)];
  const rowH = Math.round((area.h - gap * (rows - 1)) / rows);
  const boxes = [];
  let index = 0;
  for (let row = 0; row < rows; row++) {
    const columns = rowCounts[row];
    const weights = new Array(columns).fill(1).map((_, i) => [1.04, 0.94, 1.08, 0.94][(i + row) % 4]);
    const unit = (area.w - gap * (columns - 1)) / weights.reduce((sum, value) => sum + value, 0);
    let x = area.x;
    for (let col = 0; col < columns; col++) {
      const w = col === columns - 1 ? area.x + area.w - x : Math.round(unit * weights[col]);
      const offset = (index % 3) * 5;
      boxes.push({ x, y: area.y + row * (rowH + gap) + offset, w, h: rowH - offset });
      x += w + gap;
      index++;
    }
  }
  return boxes;
}

function addPhoto(target, box, item, palette, rotation = 0) {
  if (!item?.path) return;
  target.push(image(box, item.path, {
    fit: 'cover', shape: 'rect', radius: 18, ring: '#FFFFFF', ringWidth: 6,
    shadow: true, rot: rotation, focusX: item.focusX ?? 0.5, focusY: item.focusY ?? 0.46,
  }));
  const label = item.role?.label || item.label || 'School Activity';
  const labelH = 38;
  target.push(rect({ x: box.x, y: box.y + box.h - labelH, w: box.w, h: labelH, rot: rotation }, {
    fill: palette.primaryDark, opacity: 0.92,
  }));
  const fit = fitFontSize(String(label).toUpperCase(), { w: box.w - 18, h: 28 }, {
    min: 15, max: 19, kind: 'bodyUpper', maxLines: 1,
  });
  target.push(text({ x: box.x + 9, y: box.y + box.h - labelH + 8, w: box.w - 18, h: 26 }, String(label).toUpperCase(), {
    size: fit.size, lines: fit.lines, family: 'Segoe UI', weight: 700, color: '#FFFFFF', align: 'center', rot: rotation,
  }));
}

export function composeCarouselPage2({ width, height, content, assets, palette, typo, activityPhotos = [] }) {
  const margin = Math.round(width * 0.04);
  const nodes = [];
  const accent = palette.accent;
  const photos = activityPhotos.filter((item) => item?.path).slice(0, 8);
  const programmeOrder = new Map((content.programme || []).map((item, index) => [String(item).toLowerCase(), index]));
  photos.sort((a, b) => (programmeOrder.get(String(a.role?.label || '').toLowerCase()) ?? 99)
    - (programmeOrder.get(String(b.role?.label || '').toLowerCase()) ?? 99));

  nodes.push(group('00_BACKGROUND', [rect({ x: 0, y: 0, w: width, h: height }, { fill: palette.canvas })]));

  const headerH = 176;
  const header = [
    rect({ x: 0, y: 0, w: width, h: headerH }, { fill: palette.canvasAlt }),
    rect({ x: 0, y: headerH - 6, w: width, h: 6 }, { fill: accent }),
  ];
  const logoD = 105;
  if (assets.schoolLogo) header.push(image({ x: margin, y: 31, w: logoD, h: logoD }, assets.schoolLogo, { fit: 'contain', shape: 'rect' }));
  const identityX = margin + logoD + 22;
  const identityW = width - identityX - margin - 120;
  header.push(text({ x: identityX, y: 23, w: identityW, h: 58 }, String(content.school.name || '').toUpperCase(), {
    size: 45, family: typo.display.family, weight: 700, color: palette.primary, align: 'left',
  }));
  header.push(text({ x: identityX, y: 83, w: identityW, h: 26 }, 'DAILY PRAYER  •  PROCEEDINGS', {
    size: 21, family: typo.label.family, weight: 700, color: palette.ink, align: 'left', tracking: 1.4,
  }));
  header.push(text({ x: identityX, y: 117, w: identityW, h: 22 }, [content.event.date, content.event.day].filter(Boolean).join('  •  '), {
    size: 18, family: typo.body.family, weight: 500, color: palette.inkSoft, align: 'left',
  }));
  header.push(rect({ x: width - margin - 92, y: 46, w: 92, h: 54, radius: 27 }, { fill: palette.primary }));
  header.push(text({ x: width - margin - 92, y: 59, w: 92, h: 28 }, '2 / 2', {
    size: 20, family: typo.bodyBold.family, weight: 700, color: '#FFFFFF', align: 'center',
  }));
  nodes.push(group('01_HEADER_IDENTITY', header));

  const photoTop = 205;
  const photoH = photos.length > 4 ? 500 : 480;
  const photoNodes = [text({ x: margin, y: photoTop - 8, w: width - margin * 2, h: 26 }, 'VERIFIED MOMENTS FROM THE MORNING', {
    size: 19, family: typo.label.family, weight: 700, color: palette.primary, align: 'left', tracking: 2,
  })];
  const frames = photoBoxes(photos.length, { x: margin, y: photoTop + 28, w: width - margin * 2, h: photoH }, 16);
  const rotations = [-0.25, 0.2, 0, 0.28, -0.18, 0.15, -0.12, 0.2];
  photos.forEach((item, index) => addPhoto(photoNodes, frames[index], item, palette, rotations[index]));
  nodes.push(group('02_VERIFIED_ACTIVITY_PHOTOS', photoNodes));

  const programmeTop = photoTop + photoH + 68;
  const programmeNodes = [
    text({ x: margin, y: programmeTop, w: 360, h: 32 }, "TODAY'S COMPLETE PROCEEDINGS", {
      size: 23, family: typo.label.family, weight: 700, color: palette.primary, align: 'left', tracking: 1.3,
    }),
    line(margin + 475, programmeTop + 15, width - margin, programmeTop + 15, { stroke: '#D8C79E', strokeWidth: 2 }),
  ];
  const illustrated = new Set(photos.map((item) => String(item.role?.label || item.label || '').toLowerCase()));
  const columns = [(content.programme || []).slice(0, 5), (content.programme || []).slice(5)];
  columns.forEach((items, col) => {
    const colX = margin + col * ((width - margin * 2 + 28) / 2);
    items.forEach((item, row) => {
      const y = programmeTop + 45 + row * 48;
      const index = content.programme.indexOf(item);
      const hasPhoto = illustrated.has(String(item).toLowerCase());
      programmeNodes.push(text({ x: colX, y, w: 36, h: 29 }, String(index + 1).padStart(2, '0'), {
        size: 17, family: typo.bodyBold.family, weight: 700, color: accent, align: 'left',
      }));
      programmeNodes.push(text({ x: colX + 41, y, w: 320, h: 31 }, item, {
        size: 22, family: typo.body.family, weight: hasPhoto ? 700 : 500,
        color: hasPhoto ? palette.primary : palette.ink, align: 'left',
      }));
      if (hasPhoto) programmeNodes.push(text({ x: colX + 368, y: y + 4, w: 72, h: 20 }, 'PHOTO', {
        size: 11, family: typo.label.family, weight: 700, color: palette.primary, align: 'center', tracking: 0.9,
      }));
    });
  });
  nodes.push(group('03_TODAYS_PROCEEDINGS_RAIL', programmeNodes));

  const footerH = 160, footerY = height - footerH;
  const footer = [
    rect({ x: 0, y: footerY, w: width, h: footerH }, { fill: palette.primaryDark }),
    rect({ x: 0, y: footerY, w: width, h: 6 }, { fill: accent }),
  ];
  const groupLogo = assets.groupLogo || assets.schoolLogo;
  if (groupLogo) {
    footer.push(rect({ x: margin, y: footerY + 28, w: 82, h: 82, radius: 14 }, { fill: '#FFFFFF' }));
    footer.push(image({ x: margin + 9, y: footerY + 37, w: 64, h: 64 }, groupLogo, { fit: 'contain', shape: 'rect' }));
  }
  footer.push(text({ x: margin + 104, y: footerY + 25, w: 610, h: 32 }, String(content.school.group || '').toUpperCase(), {
    size: 27, family: typo.display.family, weight: 700, color: '#FFFFFF', align: 'left',
  }));
  footer.push(text({ x: margin + 104, y: footerY + 65, w: 610, h: 23 }, (content.school.branches || []).join('   |   '), {
    size: 18, family: typo.body.family, weight: 500, color: accent, align: 'left',
  }));
  footer.push(text({ x: margin + 104, y: footerY + 96, w: 675, h: 25 }, 'TEL  ' + (content.school.phones || []).join('   |   '), {
    size: 21, family: typo.bodyBold.family, weight: 700, color: '#FFFFFF', align: 'left',
  }));
  if (content.footerQuote) footer.push(text({ x: margin + 104, y: footerY + 130, w: 690, h: 19 }, content.footerQuote, {
    size: 15, family: typo.body.family, weight: 400, italic: true, color: '#C7D1E0', align: 'left',
  }));
  if (assets.leadLogo) {
    footer.push(rect({ x: width - margin - 144, y: footerY + 31, w: 144, h: 64, radius: 11 }, { fill: '#FFFFFF' }));
    footer.push(image({ x: width - margin - 130, y: footerY + 42, w: 116, h: 42 }, assets.leadLogo, { fit: 'contain', shape: 'rect' }));
    footer.push(text({ x: width - margin - 165, y: footerY + 105, w: 165, h: 20 }, 'Powered by LEAD', {
      size: 15, family: typo.body.family, weight: 500, color: '#D4DDEA', align: 'right',
    }));
  }
  nodes.push(group('04_FOOTER_BRANDING', footer));

  return {
    scene: { width, height, root: nodes },
    meta: {
      family: 'adaptivePhotoStoryCarouselPage2',
      layoutMode: 'two-page-carousel',
      carouselPage: 2,
      photosUsed: photos.length,
      storyPhotoCount: photos.length,
      photoFrames: frames.map((frame) => ({ kind: 'support', ...frame })),
      renderedProgrammeItems: [...(content.programme || [])],
      fixedSlotCount: false,
    },
  };
}
