// Professional poster composition engine. Consumes ComposeInput, decides the
// visual hierarchy (what deserves emphasis), and emits an ordered layer Plan
// with groups 00_BACKGROUND … 08_EFFECTS. Genuinely different results per
// variation seed: composition, photo placement, title treatment, decorations
// and background all change — not just colours.

import type { ComposeInput, Plan, PlanGroup, PlanNode, Rect, StudentPhoto } from './types';
import { autoPreset, presetById, type DesignPreset } from './presets';
import { fitText } from './textFit';
import { photoLayout, safeArea } from './layout';
import { composeDailyPrayerEditorial } from './dailyPrayerFamilies';
import { analyzeBatch } from './photoAnalysis';
import { critiquePoster, type VisualCritiqueReport } from './visualCritique';
import { composeForCategory } from './categoryFamilies';

type Emphasis = 'birthday' | 'lively' | 'exam' | 'festival' | 'programme' | 'general';

function decideEmphasis(input: ComposeInput): Emphasis {
  const p = input.prayer;
  if (p?.birthdays?.length || input.category === 'birthday') return 'birthday';
  if (p?.examInfo || input.category === 'examination') return 'exam';
  if (p?.festivalInfo || input.category === 'festival') return 'festival';
  if (p?.dance || p?.karate || input.category === 'dance' || input.category === 'sports') return 'lively';
  if (input.category === 'prayer') return 'programme';
  return 'general';
}

function pickPreset(input: ComposeInput, emphasis: Emphasis): DesignPreset {
  const chosen = presetById(input.presetId);
  if (chosen) return chosen;
  if (input.category === 'prayer') {
    if (emphasis === 'birthday') return presetById('birthday-celebration')!;
    if (emphasis === 'festival') return presetById('festival-celebration')!;
    if (emphasis === 'exam') return presetById('examination-notice')!;
    if (emphasis === 'lively') return presetById('energetic-youth')!;
    return presetById('daily-prayer')!;
  }
  return autoPreset(input.category, input.variationSeed);
}

const g = (name: string, nodes: PlanNode[] = []): PlanGroup => ({ name, nodes });
const r = (x: number, y: number, w: number, h: number): Rect => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });

export function shouldRunCritique(): boolean {
  return true; // always run visual critique after composition
}

export function composePoster(input: ComposeInput): Plan | Promise<Plan> {
  if (input.category === 'prayer' || input.category === 'daily-prayer') return composeDailyPrayerEditorial(input);
  return composeForCategory(input);
}

async function composePosterWithAnalysis(input: ComposeInput): Promise<Plan> {
  const emphasis = decideEmphasis(input);
  const preset = pickPreset(input, emphasis);
  const seed = input.variationSeed;
  const { width: W, height: H } = input;
  const safe = safeArea(W, H);
  const S = Math.round(preset.spacing * (W / 1080));
  // Start from the preset palette, then let the school's brand kit override the
  // colours so each school uses its own identity instead of one template.
  const bc = input.brand?.colors;
  const pal = bc
    ? { ...preset.palette, bgA: bc.primary, bgB: bc.secondary, accent: bc.accent, panel: bc.background, primary: bc.primary }
    : preset.palette;
  const ty = input.brand?.headingFont || input.brand?.bodyFont
    ? { ...preset.typography, title: input.brand?.headingFont || preset.typography.title, body: input.brand?.bodyFont || preset.typography.body }
    : preset.typography;
  const lightBase = parseInt(pal.bgA, 16) > 0xbbbbbb;

  const background = g('00_BACKGROUND');
  const decoration = g('01_DECORATION');
  const branding = g('02_SCHOOL_BRANDING');
  const headlineG = g('03_TITLE');
  const managementG = g('04_MANAGEMENT');
  const photosG = g('05_STUDENT_PHOTOS');
  const specialG = g('06_SPECIAL_EVENT');
  const prayerG = g('07_PRAYER_CONTENT');
  const programmeG = g('08_PROGRAMME_ORDER');
  const footerG = g('09_FOOTER');
  const effectsG = g('10_EFFECTS');
  const content = prayerG; // alias: legacy content nodes default to prayer group

  // ── 00 BACKGROUND ─────────────────────────────────────────────────────────
  const full = r(0, 0, W, H);
  const bgStyle = seed === 2 && preset.background !== 'split-panel' ? 'diagonal-gradient' : preset.background;
  if (bgStyle === 'vertical-gradient') background.nodes.push({ kind: 'gradient', name: 'BG_GRADIENT', rect: full, stops: [{ hex: pal.bgA, position: 0 }, { hex: pal.bgB, position: 100 }], angle: 90 });
  else if (bgStyle === 'diagonal-gradient') background.nodes.push({ kind: 'gradient', name: 'BG_GRADIENT', rect: full, stops: [{ hex: pal.bgA, position: 0 }, { hex: pal.bgB, position: 100 }], angle: seed % 2 ? 55 : 125 });
  else if (bgStyle === 'split-panel') {
    background.nodes.push({ kind: 'rect', name: 'BG_BASE', rect: full, hex: pal.panel });
    background.nodes.push({ kind: 'rect', name: 'BG_TOP_PANEL', rect: r(0, 0, W, H * 0.30), hex: pal.bgA });
    background.nodes.push({ kind: 'rect', name: 'BG_TOP_EDGE', rect: r(0, H * 0.30, W, 8), hex: pal.accent });
  } else if (bgStyle === 'radial-glow') {
    background.nodes.push({ kind: 'gradient', name: 'BG_GRADIENT', rect: full, stops: [{ hex: pal.bgB, position: 0 }, { hex: pal.bgA, position: 100 }], angle: 90 });
    background.nodes.push({ kind: 'ellipse', name: 'BG_GLOW', rect: r(W * 0.15, -H * 0.12, W * 0.7, H * 0.38), hex: pal.bgB, opacity: 45 });
  } else { // deep-vignette
    background.nodes.push({ kind: 'gradient', name: 'BG_GRADIENT', rect: full, stops: [{ hex: pal.bgB, position: 0 }, { hex: shade(pal.bgB, -15), position: 40 }, { hex: pal.bgA, position: 78 }, { hex: shade(pal.bgA, -10), position: 100 }], angle: 90 });
    background.nodes.push({ kind: 'gradient', name: 'BG_VIGNETTE', rect: r(0, H * 0.55, W, H * 0.45), stops: [{ hex: pal.bgA, position: 100 }, { hex: pal.bgB, position: 0 }], angle: 90, opacity: 65 });
    background.nodes.push({ kind: 'ellipse', name: 'BG_CORE_GLOW', rect: r(W * 0.1, H * 0.3, W * 0.8, H * 0.5), hex: shade(pal.bgB, 18), opacity: 10 });
  }

  // ── 01 DECORATION ─────────────────────────────────────────────────────────
  const decos = preset.decorations.filter((_, i) => (i + seed) % 3 !== 2 || preset.decorations.length <= 2);
  const decoHex = lightBase ? pal.primary : pal.accent;
  for (const deco of decos) {
    if (deco === 'circles') {
      decoration.nodes.push({ kind: 'ellipse', name: 'DECO_CIRCLE_L', rect: r(-W * 0.14, H * 0.16, W * 0.3, W * 0.3), hex: decoHex, opacity: 18 });
      decoration.nodes.push({ kind: 'ellipse', name: 'DECO_CIRCLE_R', rect: r(W * 0.82, H * 0.55, W * 0.3, W * 0.3), hex: pal.bgB, opacity: 28 });
      if (seed % 3 !== 0) decoration.nodes.push({ kind: 'ellipse', name: 'DECO_CIRCLE_M', rect: r(W * 0.45, H * 0.85, W * 0.22, W * 0.22), hex: pal.accent, opacity: 12 });
    } else if (deco === 'diagonal-ribbons') {
      decoration.nodes.push({ kind: 'gradient', name: 'DECO_RIBBON', rect: r(0, H * 0.24, W, H * 0.05), stops: [{ hex: pal.accent, position: 0 }, { hex: shade(pal.accent, -25), position: 50 }, { hex: pal.bgB, position: 100 }], angle: 0, opacity: 60 });
      if (seed % 2 === 0) decoration.nodes.push({ kind: 'gradient', name: 'DECO_RIBBON_ALT', rect: r(0, H * 0.72, W, H * 0.032), stops: [{ hex: pal.accent, position: 0 }, { hex: shade(pal.accent, -20), position: 100 }], angle: 0, opacity: 35 });
    } else if (deco === 'corner-frames') {
      const frameSize = Math.round(W * 0.15);
      decoration.nodes.push({ kind: 'rect', name: 'DECO_FRAME_TL_H', rect: r(safe.left, safe.top, frameSize, 6), hex: pal.accent, opacity: 92, effects: { glow: { hex: pal.accent, opacity: 35, size: 8 } } });
      decoration.nodes.push({ kind: 'rect', name: 'DECO_FRAME_TL_V', rect: r(safe.left, safe.top, 6, frameSize), hex: pal.accent, opacity: 92, effects: { glow: { hex: pal.accent, opacity: 35, size: 8 } } });
      decoration.nodes.push({ kind: 'rect', name: 'DECO_FRAME_BR_H', rect: r(safe.right - frameSize, safe.bottom - 6, frameSize, 6), hex: pal.accent, opacity: 92, effects: { glow: { hex: pal.accent, opacity: 35, size: 8 } } });
      decoration.nodes.push({ kind: 'rect', name: 'DECO_FRAME_BR_V', rect: r(safe.right - 6, safe.bottom - frameSize, 6, frameSize), hex: pal.accent, opacity: 92, effects: { glow: { hex: pal.accent, opacity: 35, size: 8 } } });
    } else if (deco === 'dot-grid') {
      for (let iy = 0; iy < 5; iy++) for (let ix = 0; ix < 7; ix++)
        decoration.nodes.push({ kind: 'ellipse', name: `DECO_DOT_${iy}_${ix}`, rect: r(W * 0.64 + ix * S * 0.9, H * 0.06 + iy * S * 0.9, 8, 8), hex: decoHex, opacity: 32 });
    } else if (deco === 'rays') {
      for (let i = 0; i < 7; i++)
        decoration.nodes.push({ kind: 'gradient', name: `DECO_RAY_${i}`, rect: r(W * (0.02 + i * 0.14), 0, W * 0.05, H * 0.28), stops: [{ hex: pal.accent, position: 0 }, { hex: pal.bgA, position: 100 }], angle: 90, opacity: 20 });
    } else if (deco === 'confetti') {
      const rand = mulberry(seed + 7);
      for (let i = 0; i < 40; i++) {
        const size = 6 + Math.round(rand() * 16);
        decoration.nodes.push({ kind: rand() > 0.5 ? 'ellipse' : 'rect', name: `DECO_CONFETTI_${i}`, rect: r(rand() * W, rand() * H * 0.38, size, size), hex: rand() > 0.4 ? pal.accent : (rand() > 0.5 ? pal.panel : pal.primary), opacity: 25 + Math.round(rand() * 35) } as PlanNode);
      }
    } else if (deco === 'waves') {
      for (let i = 0; i < 4; i++)
        decoration.nodes.push({ kind: 'ellipse', name: `DECO_WAVE_${i}`, rect: r(-W * 0.2, H * (0.82 + i * 0.045), W * 1.4, H * 0.22), hex: i % 3 === 0 ? pal.accent : (i % 3 === 1 ? pal.bgB : mix(pal.accent, pal.panel, 0.5)), opacity: 14 + i * 7 });
    } else if (deco === 'side-band') {
      decoration.nodes.push({ kind: 'rect', name: 'DECO_SIDE_BAND', rect: r(0, 0, Math.round(S / 2.2), H), hex: pal.accent, opacity: 96 });
    } else if (deco === 'arch') {
      decoration.nodes.push({ kind: 'ellipse', name: 'DECO_ARCH', rect: r(W * 0.5 - W * 0.42, H * 0.035, W * 0.84, W * 0.84), hex: pal.accent, opacity: 12 });
    } else if (deco === 'halo') {
      decoration.nodes.push({ kind: 'ellipse', name: 'DECO_HALO', rect: r(W / 2 - W * 0.31, H * 0.015, W * 0.62, W * 0.2), hex: pal.accent, opacity: 16 });
    }
  }

  // ── 02 SCHOOL BRANDING (header) ──────────────────────────────────────────
  const headerTextHex = bgStyle === 'split-panel' || !lightBase ? pal.textOnDark : pal.textOnLight;
  let cursorY = safe.top + Math.round(S * 0.4);
  const logoSize = Math.round(W * 0.10);
  // Prefer the resolved brand-kit main logo; fall back to the legacy logoPath.
  const mainLogo = input.assets?.mainLogo ?? (input.school.logoPath ? { path: input.school.logoPath } : undefined);
  const hasLogo = Boolean(mainLogo);
  const headerX = safe.left + (hasLogo ? logoSize + S : 0);
  if (mainLogo) {
    // §6: preserve aspect (contain), no crop, and no fake white plate behind a
    // transparent PNG. Only opaque logos get a subtle contrast plate.
    if (mainLogo.hasAlpha === false) {
      branding.nodes.push({ kind: 'rect', name: 'LOGO_PLATE', rect: r(safe.left - 4, cursorY - 4, logoSize + 8, logoSize + 8), hex: 'FFFFFF', radius: 10, opacity: 95, effects: { shadow: { hex: '000000', opacity: 25, distance: 3, size: 8, angle: 120 } } });
    }
    branding.nodes.push({ kind: 'photo', name: 'SCHOOL_LOGO', rect: r(safe.left, cursorY, logoSize, logoSize), path: mainLogo.path, mask: 'none', fit: 'contain', zoom: mainLogo.crop?.zoom, offsetX: mainLogo.crop?.offsetX, offsetY: mainLogo.crop?.offsetY });
  }
  // LEAD / partner logo — smaller than the main logo (§6), top-right by default.
  const showLead = input.brand?.showLead ?? true;
  const leadLogo = input.assets?.leadLogo;
  const leadPlacement = input.brand?.leadPlacement ?? 'top-right';
  if (leadLogo && showLead && leadPlacement === 'top-right') {
    const leadW = Math.round(logoSize * 0.82); // never larger than the main logo
    branding.nodes.push({ kind: 'photo', name: 'LEAD_LOGO', rect: r(safe.right - leadW, cursorY, leadW, Math.round(leadW * 0.6)), path: leadLogo.path, mask: 'none', fit: 'contain' });
  }
  const nameFit = fitText(input.school.name, { w: safe.right - headerX, h: 60 }, Math.round(W * 0.037), 22, 2, ty.title, 1.12, ty.titleTracking);
  branding.nodes.push({ kind: 'text', name: 'SCHOOL_NAME', content: input.school.name, rect: r(headerX, cursorY + 2, safe.right - headerX, nameFit.height + 8), font: ty.title, size: nameFit.size, minSize: 20, maxLines: 2, hex: headerTextHex, align: 'left', tracking: ty.titleTracking, surfaceHex: lightBase && bgStyle !== 'split-panel' ? pal.bgA : pal.bgA });
  branding.nodes.push({ kind: 'text', name: 'SCHOOL_ADDRESS', content: input.school.address, rect: r(headerX, cursorY + nameFit.height + 12, safe.right - headerX, 26), font: ty.body, size: Math.round(W * 0.0155), minSize: 12, maxLines: 1, hex: headerTextHex, align: 'left', surfaceHex: pal.bgA });
  branding.nodes.push({ kind: 'rect', name: 'HEADER_RULE', rect: r(headerX, cursorY + nameFit.height + 44, Math.round(W * 0.2), 4), hex: pal.accent });
  cursorY += Math.max(logoSize, nameFit.height + 48) + S;

  // ── 03 HEADLINE ──────────────────────────────────────────────────────────
  const titlePos = seed === 1 && preset.titlePosition === 'top-center' ? 'banner' : preset.titlePosition;
  const headline = ty.titleCase ? input.headline.toUpperCase() : input.headline;
  const titleAlign = titlePos === 'top-left' ? 'left' : 'center';
  const titleMax = Math.round(W * (titlePos === 'banner' ? 0.052 : 0.062));
  const titleBoxW = safe.width * (titlePos === 'top-left' ? 0.86 : 0.92);
  const titleFit = fitText(headline, { w: titleBoxW, h: titleMax * 2.6 }, titleMax, 30, 2, ty.title, 1.12, ty.titleTracking);
  const titleX = titlePos === 'top-left' ? safe.left : Math.round((W - titleBoxW) / 2);

  if (titlePos === 'banner') {
    const bannerH = titleFit.height + S * 1.8;
    headlineG.nodes.push({ kind: 'gradient', name: 'TITLE_BANNER', rect: r(0, cursorY, W, bannerH), stops: [{ hex: pal.accent, position: 0 }, { hex: shade(pal.accent, 18), position: 35 }, { hex: shade(pal.accent, -28), position: 100 }], angle: 0, opacity: 100 });
    headlineG.nodes.push({ kind: 'rect', name: 'TITLE_BANNER_EDGE', rect: r(0, cursorY + bannerH - 4, W, 4), hex: shade(pal.accent, -40), opacity: 70 });
    headlineG.nodes.push({ kind: 'text', name: 'MAIN_TITLE', content: headline, rect: r(titleX, cursorY + Math.round(S * 0.85), titleBoxW, titleFit.height + 8), font: ty.title, size: titleFit.size, minSize: 28, maxLines: 2, hex: pal.primary, align: 'center', tracking: ty.titleTracking, surfaceHex: pal.accent, effects: { shadow: { hex: 'FFFFFF', opacity: 28, distance: 1, size: 3, angle: 90 } } });
    cursorY += bannerH + Math.round(S * 0.8);
  } else {
    headlineG.nodes.push({ kind: 'text', name: 'MAIN_TITLE', content: headline, rect: r(titleX, cursorY, titleBoxW, titleFit.height + 6), font: ty.title, size: titleFit.size, minSize: 28, maxLines: 2, hex: lightBase ? pal.primary : pal.textOnDark, align: titleAlign, tracking: ty.titleTracking, surfaceHex: pal.bgA, effects: lightBase ? undefined : { shadow: { hex: '000000', opacity: 45, distance: 5, size: 14, angle: 120 }, glow: { hex: pal.accent, opacity: 18, size: 24 } } });
    cursorY += titleFit.height + Math.round(S * 0.5);
    headlineG.nodes.push({ kind: 'rect', name: 'HEADLINE_UNDERLINE', rect: r(titleAlign === 'left' ? safe.left : W / 2 - W * 0.075, cursorY, W * 0.15, 5), hex: pal.accent, effects: { glow: { hex: pal.accent, opacity: 40, size: 10 } } });
    cursorY += Math.round(S * 0.9);
  }

  if (input.subheadline) {
    const subFit = fitText(input.subheadline, { w: titleBoxW, h: 84 }, Math.round(W * 0.026), 16, 2, ty.accent, 1.25);
    headlineG.nodes.push({ kind: 'text', name: 'SUBTITLE', content: input.subheadline, rect: r(titleX, cursorY, titleBoxW, subFit.height + 6), font: ty.accent, size: subFit.size, minSize: 16, maxLines: 2, hex: lightBase ? pal.muted : mix(pal.textOnDark, pal.accent, 0.35), align: titleAlign, surfaceHex: pal.bgA });
    cursorY += subFit.height + Math.round(S * 0.9);
  }

  // ── 04 MANAGEMENT (chairman / principal) ─────────────────────────────────
  // Optional and only when the user enables it (§7). A dignified compact row of
  // portrait medallions with name + designation; never mixed with student cards.
  const mgmt: { person: NonNullable<ComposeInput['management']>['chairman']; role: string }[] = [];
  if (input.management?.chairman?.show && input.management.chairman.asset) mgmt.push({ person: input.management.chairman, role: 'CHAIRMAN' });
  if (input.management?.principal?.show && input.management.principal.asset) mgmt.push({ person: input.management.principal, role: 'PRINCIPAL' });
  if (mgmt.length) {
    const cardH = Math.round(H * 0.10);
    const portraitD = cardH;
    const cellW = Math.round((safe.width - S) / mgmt.length);
    mgmt.forEach((m, i) => {
      const person = m.person!; const asset = person.asset!;
      const cx = safe.left + i * (cellW + (mgmt.length > 1 ? S : 0));
      const frameMode = person.frame ?? 'circle';
      const mask = frameMode === 'circle' ? 'circle' : frameMode === 'rounded' ? 'rounded' : 'rect';
      managementG.nodes.push({ kind: mask === 'circle' ? 'ellipse' : 'rect', name: `${m.role}_RING_OUTER`, rect: r(cx - 6, cursorY - 6, portraitD + 12, portraitD + 12), hex: mix(pal.accent, 'FFFFFF', 0.3), radius: 14, opacity: 60 } as PlanNode);
      managementG.nodes.push({ kind: mask === 'circle' ? 'ellipse' : 'rect', name: `${m.role}_RING`, rect: r(cx - 3, cursorY - 3, portraitD + 6, portraitD + 6), hex: pal.accent, radius: 12, effects: { shadow: { hex: '000000', opacity: 40, distance: 6, size: 14, angle: 120 } } } as PlanNode);
      managementG.nodes.push({ kind: 'photo', name: `${m.role}_PHOTO`, rect: r(cx, cursorY, portraitD, portraitD), path: asset.path, mask, radius: 14, focusY: 0.32, zoom: asset.crop?.zoom, offsetX: asset.crop?.offsetX, offsetY: asset.crop?.offsetY });
      const tx = cx + portraitD + Math.round(S * 0.6);
      const tw = cellW - portraitD - Math.round(S * 0.6);
      managementG.nodes.push({ kind: 'text', name: `${m.role}_NAME`, content: person.name || '', rect: r(tx, cursorY + Math.round(portraitD * 0.24), tw, Math.round(W * 0.026)), font: ty.title, size: Math.round(W * 0.021), minSize: 13, maxLines: 1, hex: lightBase ? pal.primary : pal.textOnDark, align: 'left', surfaceHex: pal.bgA });
      managementG.nodes.push({ kind: 'text', name: `${m.role}_DESIGNATION`, content: person.designation || '', rect: r(tx, cursorY + Math.round(portraitD * 0.52), tw, Math.round(W * 0.022)), font: ty.body, size: Math.round(W * 0.0165), minSize: 11, maxLines: 1, hex: lightBase ? pal.muted : mix(pal.textOnDark, pal.accent, 0.3), align: 'left', surfaceHex: pal.bgA });
    });
    cursorY += cardH + S;
  }

  // ── FOOTER (computed first so content knows its ceiling) ────────────────
  const footerH = Math.round(H * 0.09);
  const footerY = H - footerH;
  if (preset.footer === 'minimal-line') {
    footerG.nodes.push({ kind: 'rect', name: 'FOOTER_LINE', rect: r(safe.left, footerY, safe.width, 4), hex: pal.accent, effects: { glow: { hex: pal.accent, opacity: 30, size: 6 } } });
    footerG.nodes.push({ kind: 'text', name: 'FOOTER_PHONE', content: `Phone: ${input.school.phone}`, rect: r(safe.left, footerY + S * 0.7, safe.width / 2, 30), font: ty.body, size: Math.round(W * 0.019), minSize: 13, maxLines: 1, hex: lightBase ? pal.primary : pal.textOnDark, align: 'left', surfaceHex: pal.bgA });
    footerG.nodes.push({ kind: 'text', name: 'FOOTER_YEAR', content: input.school.academicYear, rect: r(W / 2, footerY + S * 0.7, safe.width / 2, 30), font: ty.body, size: Math.round(W * 0.019), minSize: 13, maxLines: 1, hex: lightBase ? pal.primary : pal.textOnDark, align: 'right', surfaceHex: pal.bgA });
  } else {
    if (preset.footer === 'gradient-bar') footerG.nodes.push({ kind: 'gradient', name: 'FOOTER_BAR', rect: r(0, footerY, W, footerH), stops: [{ hex: pal.accent, position: 0 }, { hex: shade(pal.accent, 18), position: 40 }, { hex: shade(pal.accent, -30), position: 100 }], angle: 0 });
    else footerG.nodes.push({ kind: 'rect', name: 'FOOTER_BAR', rect: r(0, footerY, W, footerH), hex: pal.accent });
    footerG.nodes.push({ kind: 'rect', name: 'FOOTER_EDGE', rect: r(0, footerY - 5, W, 5), hex: shade(pal.accent, 30), opacity: 85 });
    const fy = footerY + Math.round(footerH / 2) - 22;
    // Reserve space on the right when the LEAD logo sits in the footer, so the
    // academic year never runs under it.
    const leadInFooter = Boolean(leadLogo) && showLead && (leadPlacement === 'footer-right' || leadPlacement === 'beside-powered-by');
    const yearReserve = leadInFooter ? Math.round(logoSize * 0.7) + S : 0;
    footerG.nodes.push({ kind: 'text', name: 'FOOTER_PHONE', content: `Phone: ${input.school.phone}`, rect: r(safe.left, fy, safe.width * 0.5, 30), font: ty.title, size: Math.round(W * 0.021), minSize: 14, maxLines: 1, hex: pal.primary, align: 'left', surfaceHex: pal.accent });
    footerG.nodes.push({ kind: 'text', name: 'FOOTER_YEAR', content: input.school.academicYear, rect: r(safe.left + safe.width * 0.5, fy, safe.width * 0.5 - yearReserve, 30), font: ty.body, size: Math.round(W * 0.019), minSize: 13, maxLines: 1, hex: pal.primary, align: 'right', surfaceHex: pal.accent });
    footerG.nodes.push({ kind: 'text', name: 'FOOTER_ADDRESS', content: input.school.address, rect: r(safe.left, fy + 34, safe.width, 24), font: ty.body, size: Math.round(W * 0.0145), minSize: 11, maxLines: 1, hex: shade(pal.primary, 12), align: 'left', surfaceHex: pal.accent });
  }
  // LEAD logo in the footer-right partner slot (§6) when configured there.
  if (leadLogo && showLead && (leadPlacement === 'footer-right' || leadPlacement === 'beside-powered-by')) {
    const lw = Math.round(logoSize * 0.7);
    footerG.nodes.push({ kind: 'photo', name: 'LEAD_LOGO', rect: r(safe.right - lw, footerY + Math.round((footerH - lw * 0.6) / 2), lw, Math.round(lw * 0.6)), path: leadLogo.path, mask: 'none', fit: 'contain' });
  }

  // ── PHOTO ANALYSIS + HERO SELECTION ──────────────────────────────────────
  // Before layout, analyze all photos to determine which should be the hero.
  // Reorder the array so the best image is first (the layout engine treats
  // index 0 as the hero). This makes the poster look like a human chose
  // the strongest photo to lead the collage.
  let photos = input.photos.slice(0, 12);
  let photoOrientations: ('portrait' | 'landscape' | 'square')[] = [];
  if (photos.length > 1) {
    try {
      const analysis = await analyzeBatch(photos.map(p => p.path));
      photoOrientations = analysis.orientations;
      // Move hero to front if not already there
      if (analysis.heroIndex > 0) {
        const heroPhoto = photos.splice(analysis.heroIndex, 1)[0];
        photos = [heroPhoto, ...photos];
        const heroOrientation = photoOrientations.splice(analysis.heroIndex, 1)[0];
        photoOrientations = [heroOrientation, ...photoOrientations];
      }
    } catch {
      // If analysis fails (e.g. sharp unavailable), just use default
      photoOrientations = photos.map(() => 'portrait' as const);
    }
  } else if (photos.length === 1) {
    photoOrientations = ['portrait'];
  }
  // Attach analysis results to photos for downstream use
  const photoMeta = photos.map(p => ({
    path: p.path,
    name: p.name,
    className: p.className,
    zoom: p.zoom,
    offsetX: p.offsetX,
    offsetY: p.offsetY,
  }));

  // ── 04/05/06 CONTENT + PHOTOS + DETAILS ──────────────────────────────────
  const detailLine = [input.details, input.venue].filter(Boolean).join('  ·  ');
  // Reserve the date/venue ribbon band so content and photos never sit under it.
  const detailBandH = detailLine ? Math.round(W * 0.042) + Math.round(S * 0.55) + S : 0;
  const contentBottom = footerY - S - detailBandH;

  // Collect content blocks in emphasis-driven order. Each block is routed to a
  // §8 layer group: special-event highlights → 06, programme list → 08, the
  // rest of the prayer content → 07.
  type BlockGroup = 'special' | 'programme' | 'prayer';
  interface Block { title?: string; body: string; highlight?: boolean; group: BlockGroup }
  const blocks: Block[] = [];
  const p = input.prayer;
  if (input.message) blocks.push({ body: input.message, group: 'prayer' });
  if (p) {
    const push = (title: string, body: string | undefined, group: BlockGroup, highlight = false) => { if (body?.trim()) blocks.push({ title, body: body.trim(), highlight, group }); };
    if (emphasis === 'birthday') push('Birthday Celebrations', p.birthdays?.map((b) => b.className ? `${b.name} (${b.className})` : b.name).join('  ·  '), 'special', true);
    if (emphasis === 'exam') push('Examination Information', p.examInfo, 'special', true);
    if (emphasis === 'festival') push('Festival', p.festivalInfo, 'special', true);
    push('Prayer', p.prayerTitle, 'prayer');
    push('Thought of the Day', p.thought, 'prayer', emphasis === 'programme');
    if (p.programme?.length) blocks.push({ title: 'Programme Order', body: p.programme.map((line, i) => `${i + 1}.  ${line}`).join('\r'), highlight: emphasis === 'programme', group: 'programme' });
    push('News', p.news, 'prayer');
    push('Pledge', p.pledge, 'prayer');
    push('Speech', p.speech, 'prayer');
    push('Dance', p.dance, 'special', emphasis === 'lively');
    push('Karate', p.karate, 'special', emphasis === 'lively');
    if (emphasis !== 'exam') push('Examination Information', p.examInfo, 'special');
    if (emphasis !== 'festival') push('Festival', p.festivalInfo, 'special');
    if (emphasis !== 'birthday') push('Birthday Wishes', p.birthdays?.map((b) => b.className ? `${b.name} (${b.className})` : b.name).join('  ·  '), 'special');
  }
  const groupFor = (bg: BlockGroup): PlanGroup => bg === 'special' ? specialG : bg === 'programme' ? programmeG : prayerG;

  // Photo zone share of remaining vertical space, weighted by importance —
  // then rebalanced against the estimated height the text blocks actually
  // need, so long programmes are never silently dropped.
  const remaining = contentBottom - cursorY;
  let photoShare = photos.length === 0 ? 0 : photos.length === 1 ? 0.38 : photos.length <= 4 ? 0.42 : photos.length <= 8 ? 0.46 : 0.52;
  if (emphasis === 'birthday' && photos.length) photoShare = Math.min(0.56, photoShare + 0.08);
  if (blocks.length === 0 && photos.length) photoShare = 0.8;
  if (blocks.length && photos.length) {
    const padEst = Math.round(S * 1.1);
    const innerEst = safe.width - padEst * 2;
    let needed = padEst * 2;
    for (const block of blocks) {
      if (block.title) needed += Math.round(W * 0.0335) + Math.round(S * 0.5);
      const bodySize = block.highlight ? Math.round(W * 0.0215) : Math.round(W * 0.0195);
      needed += block.body.includes('\r')
        ? block.body.split('\r').length * bodySize * 1.5
        : fitText(block.body, { w: innerEst, h: bodySize * 1.35 * 4 }, bodySize, 13, 4, ty.body, 1.35).height;
      needed += Math.round(S * 0.9);
    }
    const maxPhotoShare = Math.max(0.2, (remaining - needed - S) / remaining);
    photoShare = Math.min(photoShare, maxPhotoShare);
  }
  const photoZoneH = Math.round(remaining * photoShare);
  const textZoneH = remaining - photoZoneH - (photos.length ? S : 0);

  // Photos placed first (above content when celebratory, below otherwise).
  const photosOnTop = (emphasis === 'birthday' || emphasis === 'lively' || emphasis === 'festival') && photos.length > 0 && seed !== 1;
  const photoZoneY = photosOnTop ? cursorY : cursorY + textZoneH + (blocks.length ? S : 0);
  const textZoneY = photosOnTop ? cursorY + photoZoneH + S : cursorY;

  if (photos.length) {
    const zone = r(safe.left, photoZoneY, safe.width, photoZoneH);
    const gap = Math.round(S * 0.6);
    const treatment = preset.photoTreatment;
    let frames = photoLayout(photos.length, zone, gap, seed, photoOrientations);
    if (treatment === 'circle' && photos.length <= 6) {
      // circles pack best as one centered row of equal medallions with labels
      const anyNames = photos.some((p) => p.name);
      const labelH = anyNames ? Math.round(W * 0.032) : 0;
      const side = Math.min(zone.h - labelH, Math.floor((zone.w - (photos.length - 1) * gap) / photos.length));
      const rowW = photos.length * side + (photos.length - 1) * gap;
      const x0 = zone.x + (zone.w - rowW) / 2;
      const y0 = zone.y + (zone.h - side - labelH) / 2;
      frames = photos.map((_, i) => ({ x: Math.round(x0 + i * (side + gap)), y: Math.round(y0), w: side, h: side + labelH, importanceScale: 1, labelBelow: anyNames }));
    }
    frames.forEach((frame, i) => {
      const photo = photos[i];
      const labelH = frame.labelBelow && photo.name ? Math.round(W * 0.032) : 0;
      let imgRect = r(frame.x, frame.y, frame.w, frame.h - labelH);
      if (treatment === 'circle') {
        // circle masks need square frames or they render as squashed ellipses
        const side = Math.min(imgRect.w, imgRect.h);
        imgRect = r(imgRect.x + (imgRect.w - side) / 2, imgRect.y + (imgRect.h - side) / 2, side, side);
      }
      const mask = treatment === 'circle' ? 'circle' : 'rounded';
      if (treatment === 'polaroid') {
        photosG.nodes.push({ kind: 'rect', name: `PHOTO_${i + 1}_FRAME`, rect: r(imgRect.x - 10, imgRect.y - 10, imgRect.w + 20, imgRect.h + 20 + (labelH ? 0 : 18)), hex: 'FFFFFF', radius: 6, effects: { shadow: { hex: '000000', opacity: 50, distance: 10, size: 22, angle: 120 }, stroke: { hex: 'E8E8E8', size: 1, opacity: 60 } } });
      } else {
        photosG.nodes.push({ kind: treatment === 'circle' ? 'ellipse' : 'rect', name: `PHOTO_${i + 1}_RING`, rect: r(imgRect.x - 5, imgRect.y - 5, imgRect.w + 10, imgRect.h + 10), hex: pal.accent, radius: Math.round(S * 0.5) + 5, effects: { shadow: { hex: '000000', opacity: 45, distance: 8, size: 20, angle: 120 }, stroke: { hex: lightBase ? mix(pal.accent, pal.primary, 0.3) : 'FFFFFF', size: 2, opacity: 70 } } } as PlanNode);
      }
      photosG.nodes.push({ kind: 'photo', name: `PHOTO_${i + 1}`, rect: imgRect, path: photo.path, mask: mask as 'circle' | 'rounded' | 'rect', radius: Math.round(S * 0.5), focusY: 0.38 });
      if (labelH && photo.name) {
        photosG.nodes.push({ kind: 'text', name: `PHOTO_${i + 1}_NAME`, content: photo.className ? `${photo.name} · ${photo.className}` : photo.name, rect: r(frame.x - S * 0.3, frame.y + frame.h - labelH + 4, frame.w + S * 0.6, labelH), font: ty.body, size: Math.max(12, Math.round(frame.w * 0.11)), minSize: 10, maxLines: 1, hex: lightBase ? pal.primary : pal.textOnDark, align: 'center', surfaceHex: pal.bgA });
      }
    });
  }

  // Content panel + text blocks. The panel must sit BEHIND every content block,
  // and content groups render in order 06 → 07 → 08, so the panel goes into the
  // first of them (06_SPECIAL_EVENT) — otherwise a later group's panel would
  // paint over the special-event block drawn earlier.
  if (blocks.length) {
    const panelRect = r(safe.left, textZoneY, safe.width, textZoneH);
    specialG.nodes.push({ kind: 'rect', name: 'CONTENT_PANEL', rect: panelRect, hex: pal.panel, opacity: preset.panelOpacity, radius: Math.round(S * 0.7), effects: { shadow: { hex: '000000', opacity: 35, distance: 10, size: 28, angle: 120 }, stroke: { hex: mix(pal.panel, pal.primary, 0.08), size: 1, opacity: 50 } } });
    const pad = Math.round(S * 1.1);
    let by = panelRect.y + pad;
    const innerW = panelRect.w - pad * 2;
    const bottomLimit = panelRect.y + panelRect.h - pad;
    for (const [bi, block] of blocks.entries()) {
      if (by >= bottomLimit - 30) break; // quality validator flags dropped blocks
      const boxLeft = panelRect.x + pad;
      const target = groupFor(block.group);
      const tag = block.group === 'special' ? 'EVENT' : block.group === 'programme' ? 'PROGRAMME' : `BLOCK_${bi + 1}`;
      if (block.title) {
        const badgeW = Math.min(innerW, block.title.length * Math.round(W * 0.0128) + S * 1.4);
        target.nodes.push({ kind: 'rect', name: `${tag}_BADGE`, rect: r(boxLeft, by, badgeW, Math.round(W * 0.0335)), hex: block.highlight ? pal.accent : shade(pal.panel, -8), radius: Math.round(W * 0.0167) });
        target.nodes.push({ kind: 'text', name: `${tag}_TITLE`, content: block.title.toUpperCase(), rect: r(boxLeft + S * 0.7, by + Math.round(W * 0.0056), badgeW, Math.round(W * 0.024)), font: ty.title, size: Math.round(W * 0.0165), minSize: 12, maxLines: 1, hex: block.highlight ? pal.primary : pal.muted, align: 'left', tracking: 50, surfaceHex: block.highlight ? pal.accent : pal.panel });
        by += Math.round(W * 0.0335) + Math.round(S * 0.5);
      }
      const isList = block.body.includes('\r');
      const bodySize = block.highlight ? Math.round(W * 0.0215) : Math.round(W * 0.0195);
      const maxLines = isList ? block.body.split('\r').length : 4;
      const bodyFit = fitText(block.body.replace(/\r/g, ' '), { w: innerW, h: Math.min(bottomLimit - by, bodySize * 1.35 * maxLines) }, bodySize, 13, maxLines, ty.body, 1.35);
      const bodyH = isList ? block.body.split('\r').length * bodySize * 1.5 : bodyFit.height;
      target.nodes.push({ kind: 'text', name: `${tag}_BODY`, content: block.body, rect: r(boxLeft, by, innerW, Math.min(bodyH + 8, Math.max(30, bottomLimit - by))), font: ty.body, size: isList ? bodySize : bodyFit.size, minSize: 13, maxLines, hex: pal.textOnLight, align: 'left', lineHeight: 1.4, surfaceHex: pal.panel });
      by += Math.min(bodyH, bottomLimit - by) + Math.round(S * 0.9);
    }
  }

  // Date/venue ribbon pinned above footer — lives in the 03_TITLE group as DATE.
  if (detailLine) {
    const dh = Math.round(W * 0.045);
    const dw = Math.min(safe.width, detailLine.length * Math.round(W * 0.013) + S * 3.5);
    const dx = Math.round((W - dw) / 2);
    const dy = footerY - dh - Math.round(S * 0.6);
    headlineG.nodes.push({ kind: 'rect', name: 'DATE_RIBBON', rect: r(dx, dy, dw, dh), hex: pal.accent, radius: Math.round(dh / 2), effects: { shadow: { hex: '000000', opacity: 40, distance: 6, size: 14, angle: 120 }, stroke: { hex: shade(pal.accent, -25), size: 1, opacity: 60 } } });
    headlineG.nodes.push({ kind: 'text', name: 'DATE', content: detailLine, rect: r(dx + S * 1.2, dy + Math.round(dh * 0.22), dw - S * 2.4, Math.round(dh * 0.6)), font: ty.title, size: Math.round(W * 0.02), minSize: 12, maxLines: 1, hex: pal.primary, align: 'center', tracking: 25, surfaceHex: pal.accent });
  }

  // Top accent edge — bold colour stripe across the full width.
  effectsG.nodes.push({ kind: 'gradient', name: 'TOP_ACCENT_EDGE', rect: r(0, 0, W, 12), stops: [{ hex: pal.accent, position: 0 }, { hex: shade(pal.accent, 20), position: 35 }, { hex: shade(pal.accent, -30), position: 100 }], angle: 0 });
  effectsG.nodes.push({ kind: 'rect', name: 'TOP_ACCENT_GLOW', rect: r(0, 8, W, 8), hex: shade(pal.accent, 15), opacity: 30 });

  // §8 layer structure, bottom → top.
  const ordered: PlanGroup[] = [background, decoration, branding, headlineG, managementG, photosG, specialG, prayerG, programmeG, footerG, effectsG];
  const plan: Plan = { width: W, height: H, baseHex: pal.bgA, groups: ordered };

  // Run visual critique on the composed plan. The critique checks for
  // human-like design qualities and returns scores + fix suggestions.
  // The caller (posterGenerator) can use the report to decide whether
  // to revise and regenerate.
  try {
    plan.metadata = plan.metadata || {};
    const critique = critiquePoster(plan);
    plan.metadata.critiqueScore = critique.score;
    plan.metadata.critiqueReport = critique;
    plan.metadata.photoCount = photos.length;
    plan.metadata.heroFirst = photos.length > 0;
  } catch {
    // Critique is advisory — never fail composition because of it
    plan.metadata = plan.metadata || {};
    plan.metadata.critiqueScore = -1;
  }

  return plan;
}

// ── colour helpers ───────────────────────────────────────────────────────────
function clamp255(v: number): number { return Math.max(0, Math.min(255, Math.round(v))); }
export function shade(hex: string, percent: number): string {
  const f = 1 + percent / 100;
  return [0, 2, 4].map((i) => clamp255(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function mix(hexA: string, hexB: string, t: number): string {
  return [0, 2, 4].map((i) => {
    const a = parseInt(hexA.slice(i, i + 2), 16); const b = parseInt(hexB.slice(i, i + 2), 16);
    return clamp255(a + (b - a) * t).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}
function mulberry(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
