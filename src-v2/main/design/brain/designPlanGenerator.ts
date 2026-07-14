// Layer 2: Design Plan Generator
//
// Produces a validated, versioned DesignPlan JSON from ComposeInput + AssetAnalysis.
// Does NOT render — it produces a specification that drives all output formats.
//
// Retrieval-first approach:
//   1. Analyse current event + assets
//   2. Search approved-poster library for similar examples
//   3. Retrieve top 3 most useful examples
//   4. Adapt their composition knowledge to create a new DesignPlan
//   5. Do NOT copy their photographs, faces, names or text

import type { ComposeInput, Plan, PlanNode, PlanGroup, Rect } from '../types';
import type { SafeArea } from '../layout';
import type {
  DesignPlan, PhotoPlacement, DesignPalette, DesignTypography,
  DecorationSpec, QuoteSpec, ManagementSpec, FooterSpec,
  PhotoshopLayerGroup, DesignDecision, CropAnchors,
} from './brainTypes';
import { BRAIN_VERSION } from './brainTypes';
import { type AssetAnalysis } from './visualAssetAnalyzer';
import { retrieveSimilar } from './brainRetrieval';
import { safeArea } from '../layout';
import { randomUUID } from 'node:crypto';

export interface GeneratePlanOptions {
  input: ComposeInput;
  analysis: AssetAnalysis;
  posterWidth: number;
  posterHeight: number;
  variationSeed: number;
  compositionFamily?: string;
  planId?: string;
  retrievedExamples?: DesignPlan[];
}

function genId(): string {
  return randomUUID().slice(0, 8);
}

function toRect(sa: SafeArea): Rect {
  return { x: sa.left, y: sa.top, w: sa.width, h: sa.height };
}

export async function generateDesignPlan(opts: GeneratePlanOptions): Promise<DesignPlan> {
  const { input, analysis, posterWidth, posterHeight, variationSeed, compositionFamily } = opts;

  const retrieved = opts.retrievedExamples || await retrieveSimilar({
    eventCategory: input.category || 'prayer',
    emphasis: analysis.eventEmphasis,
    photoCount: analysis.photoCount,
    hasBirthdays: analysis.hasBirthdays,
    hasManagement: analysis.hasManagement,
    assetCount: analysis.totalAssets,
    keywords: [input.headline || '', input.subheadline || ''].filter(Boolean),
  }, 3);

  const family = compositionFamily || adaptFamily(analysis, retrieved);
  const seed = variationSeed;
  const safe = safeArea(posterWidth, posterHeight);
  const safeRect = toRect(safe);
  const sections = buildSections(posterWidth, posterHeight, safe, safeRect);
  const heroPhoto = selectHero(analysis, input.photos || []);
  const supporting = placeSupporting(analysis, input.photos || [], heroPhoto.assetPath, sections, seed);
  const palette = buildPalette(input, retrieved);
  const typography = buildTypography(input, posterWidth);
  const branding = placeBranding(sections, input);
  const decorations = genDecorations(family, sections, palette, seed);
  const footer = buildFooter(sections, input);
  const management = buildMgmt(sections, input);
  const quote = buildQuote(sections, input);
  const layerStructure = buildLayerStructure(analysis);
  const decisions = recordDecisions(analysis, retrieved, family);

  const now = new Date().toISOString();
  const planId = opts.planId || `plan_${genId()}`;

  return {
    planVersion: BRAIN_VERSION, planId, createdAt: now,
    compositionFamily: family, variationSeed: seed,
    heroPhoto, supportingPhotos: supporting,
    galleryOrder: supporting.map(p => p.assetPath),
    sections, sectionBoxes: {},
    palette, typography, brandingPlacement: branding,
    decorations, quoteTreatment: quote, managementSection: management,
    footer, photoshopLayerStructure: layerStructure, decisionLog: decisions,
    metadata: {
      modelVersion: BRAIN_VERSION, rendererVersion: BRAIN_VERSION,
      brainVersion: BRAIN_VERSION, assetCount: analysis.totalAssets,
      photoCount: analysis.photoCount,
      hasBirthdays: analysis.hasBirthdays,
      hasManagement: analysis.hasManagement,
      emphasis: analysis.eventEmphasis,
      derivedFromPlanId: retrieved[0]?.planId || null,
      retrievalSource: retrieved.length > 0 ? 'generated-approved' : 'none',
      similarExampleIds: retrieved.map(r => r.planId),
    },
  };
}

function adaptFamily(analysis: AssetAnalysis, retrieved: DesignPlan[]): string {
  if (retrieved.length > 0) {
    const families = retrieved.map(r => r.compositionFamily);
    const counts = new Map<string, number>();
    for (const f of families) counts.set(f, (counts.get(f) || 0) + 1);
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (best[0][1] >= 2) return best[0][0];
    return families[0];
  }
  if (analysis.photoCount === 0) return 'emblematic';
  if (analysis.photoCount === 1) return 'photoSplit';
  if (analysis.photoCount <= 3) return 'asymmetric';
  if (analysis.birthdayCount > 0) return 'collage';
  return 'magazine';
}

function buildSections(w: number, h: number, safe: SafeArea, safeRect: Rect) {
  const headerH = Math.round(h * 0.10);
  const footerH = Math.round(h * 0.08);
  const titleH = Math.round(h * 0.08);
  const photoH = Math.round(h * 0.40);
  const contentH = h - headerH - footerH - titleH - photoH;

  return {
    headerZone: { x: safe.left, y: safe.top, w: safe.width, h: headerH },
    titleZone: { x: safe.left, y: safe.top + headerH, w: safe.width, h: titleH },
    photoZone: { x: safe.left, y: safe.top + headerH + titleH, w: safe.width, h: photoH },
    contentZone: { x: safe.left, y: safe.top + headerH + titleH + photoH, w: safe.width, h: Math.max(contentH, safe.height - headerH - titleH - photoH - footerH) },
    footerZone: { x: safe.left, y: h - footerH - safe.top, w: safe.width, h: footerH },
    safeArea: safeRect,
  };
}

function selectHero(analysis: AssetAnalysis, photos: ComposeInput['photos']): PhotoPlacement {
  if (photos.length === 0) {
    return { assetPath: '', role: 'hero', importanceScore: 0, frameShape: 'rect', frameRect: { x: 0, y: 0, w: 0, h: 0 }, focusY: 0.5, zoom: 1, offsetX: 0, offsetY: 0, cropAnchors: { top: 0, right: 1, bottom: 1, left: 0 } };
  }
  const best = analysis.heroCandidates[0];
  const photo = photos.find(p => p.path === best?.path) || photos[0];
  return { assetPath: photo.path, role: 'hero', importanceScore: best?.score || 50, frameShape: 'rounded', frameRect: { x: 0, y: 0, w: 0, h: 0 }, focusY: 0.5, zoom: photo.zoom || 1, offsetX: photo.offsetX || 0, offsetY: photo.offsetY || 0, cropAnchors: { top: 0.08, right: 0.95, bottom: 0.92, left: 0.05 } };
}

function placeSupporting(analysis: AssetAnalysis, photos: ComposeInput['photos'], heroPath: string, sections: ReturnType<typeof buildSections>, seed: number): PhotoPlacement[] {
  return photos.filter(p => p.path !== heroPath).map((p, i) => ({
    assetPath: p.path,
    role: (i === 0 && analysis.photoCount <= 4) ? 'supporting' as const : 'gallery' as const,
    importanceScore: Math.max(0, 50 - i * 10),
    frameShape: (i % 3 === 0) ? 'circle' as const : (i % 3 === 1) ? 'rounded' as const : 'rect' as const,
    frameRect: { x: 0, y: 0, w: 0, h: 0 },
    focusY: 0.5, zoom: p.zoom || 1, offsetX: p.offsetX || 0, offsetY: p.offsetY || 0,
    cropAnchors: { top: 0.08, right: 0.95, bottom: 0.92, left: 0.05 },
  }));
}

function buildPalette(input: ComposeInput, retrieved: DesignPlan[]): DesignPalette {
  const c = input.brand?.colors;
  if (c) {
    return {
      primary: c.primary, secondary: c.secondary || '#C8A951',
      accent: c.accent || '#E8D5A3', background: c.background || '#F5F0E8',
      surface: '#FFFFFF', textPrimary: '#1A1A2E', textSecondary: '#4A4A5A',
      headerBg: c.primary, footerBg: c.primary || '#1A1A2E',
      cardBg: '#FFFFFF', divider: '#D0C8B8',
    };
  }
  if (retrieved.length > 0) return retrieved[0].palette;
  return { primary: '#1A237E', secondary: '#C8A951', accent: '#E8D5A3', background: '#F5F0E8', surface: '#FFFFFF', textPrimary: '#1A1A2E', textSecondary: '#4A4A5A', headerBg: '#1A237E', footerBg: '#1A1A2E', cardBg: '#FFFFFF', divider: '#D0C8B8' };
}

function buildTypography(input: ComposeInput, width: number): DesignTypography {
  return { headingFont: input.brand?.headingFont || 'Georgia', bodyFont: input.brand?.bodyFont || 'Arial', titleSize: Math.round(width * 0.045), subtitleSize: Math.round(width * 0.028), headingSize: Math.round(width * 0.022), bodySize: Math.round(width * 0.016), captionSize: Math.round(width * 0.012), lineHeight: 1.4, tracking: 0.5 };
}

function placeBranding(sections: ReturnType<typeof buildSections>, input: ComposeInput) {
  const hz = sections.headerZone;
  return {
    logoRect: { x: hz.x + 10, y: hz.y + 4, w: Math.round(hz.w * 0.12), h: hz.h - 8 },
    schoolNameRect: { x: hz.x + Math.round(hz.w * 0.14), y: hz.y + 4, w: Math.round(hz.w * 0.5), h: hz.h - 8 },
    addressRect: null,
    leadLogoRect: input.brand?.showLead ? { x: hz.x + hz.w - Math.round(hz.w * 0.12) - 10, y: hz.y + 4, w: Math.round(hz.w * 0.12), h: hz.h - 8 } : null,
    footerRect: sections.footerZone,
    headerRuleRect: { x: hz.x, y: hz.y + hz.h - 2, w: hz.w, h: 2 },
  };
}

function genDecorations(family: string, sections: ReturnType<typeof buildSections>, palette: DesignPalette, seed: number): DecorationSpec[] {
  const decos: DecorationSpec[] = [];
  const sz = sections.safeArea;
  const r = (seed % 100) / 100;

  if (family === 'emblematic' || family === 'magazine') {
    decos.push({ type: 'sideBand', rect: { x: sz.x, y: sz.y, w: 8, h: sz.h }, color: palette.primary, opacity: 1, zIndex: 1 });
  }
  if (r < 0.3) {
    decos.push({ type: 'cornerFrame', rect: { x: sz.x, y: sz.y, w: Math.round(sz.w * 0.2), h: Math.round(sz.h * 0.15) }, color: palette.accent, opacity: 0.3, zIndex: 1 });
  }
  if (r < 0.5) {
    decos.push({ type: 'dotGrid', rect: { x: sz.x, y: sz.y + sz.h - 60, w: sz.w, h: 40 }, color: palette.divider, opacity: 0.2, zIndex: 1 });
  }
  decos.push({ type: 'accentEdge', rect: { x: sz.x, y: sz.y + sz.h - 4, w: sz.w, h: 4 }, color: palette.primary, opacity: 1, zIndex: 10 });
  return decos;
}

function buildFooter(sections: ReturnType<typeof buildSections>, input: ComposeInput): FooterSpec {
  return { barStyle: 'solid', showAddress: true, showPhone: true, showYear: true, showLeadLogo: input.brand?.showLead ?? false, elements: [{ type: 'text', content: '', rect: { x: sections.footerZone.x + 10, y: sections.footerZone.y + 4, w: sections.footerZone.w - 20, h: sections.footerZone.h - 8 } }] };
}

function buildMgmt(sections: ReturnType<typeof buildSections>, input: ComposeInput): ManagementSpec | null {
  const cm = input.management?.chairman;
  const pm = input.management?.principal;
  if (!cm?.show && !pm?.show) return null;
  const mz = sections.contentZone;
  const size = Math.round(mz.h * 0.35);
  return {
    chairman: cm?.show ? { photoRect: { x: mz.x + 10, y: mz.y + 8, w: size, h: size }, frame: 'circle', nameRect: { x: mz.x + size + 16, y: mz.y + 10, w: 200, h: 20 }, designationRect: { x: mz.x + size + 16, y: mz.y + 32, w: 200, h: 16 }, ringColor: '#C8A951' } : null,
    principal: pm?.show ? { photoRect: { x: mz.x + 10, y: mz.y + size + 16, w: size, h: size }, frame: 'circle', nameRect: { x: mz.x + size + 16, y: mz.y + size + 18, w: 200, h: 20 }, designationRect: { x: mz.x + size + 16, y: mz.y + size + 40, w: 200, h: 16 }, ringColor: '#C8A951' } : null,
  };
}

function buildQuote(sections: ReturnType<typeof buildSections>, input: ComposeInput): QuoteSpec | null {
  if (!input.prayer?.thought) return null;
  return { quoteRect: { x: sections.contentZone.x + 20, y: sections.contentZone.y + 10, w: sections.contentZone.w - 40, h: Math.round(sections.contentZone.h * 0.4) }, authorRect: { x: sections.contentZone.x + 20, y: sections.contentZone.y + Math.round(sections.contentZone.h * 0.4) + 5, w: sections.contentZone.w - 40, h: 20 }, hasQuotationMarks: true, style: 'elegant' };
}

function buildLayerStructure(analysis: AssetAnalysis): PhotoshopLayerGroup[] {
  return [
    { groupName: '00_BACKGROUND', zIndex: 0, layers: [{ name: 'Background', type: 'shape', visible: true }] },
    { groupName: '01_DECORATION', zIndex: 1, layers: [{ name: 'Decorations', type: 'group', visible: true }] },
    { groupName: '02_SCHOOL_BRANDING', zIndex: 2, layers: [{ name: 'Logo', type: 'image', visible: true }, { name: 'School Name', type: 'text', visible: true }] },
    { groupName: '03_TITLE', zIndex: 3, layers: [{ name: 'Title', type: 'text', visible: true }, { name: 'Subtitle', type: 'text', visible: true }] },
    { groupName: '04_MANAGEMENT', zIndex: 4, layers: [{ name: 'Management', type: 'group', visible: analysis.hasManagement }] },
    { groupName: '05_STUDENT_PHOTOS', zIndex: 5, layers: [{ name: 'Hero Photo', type: 'image', visible: true }, { name: 'Supporting Photos', type: 'group', visible: analysis.photoCount > 1 }] },
    { groupName: '06_CONTENT', zIndex: 6, layers: [{ name: 'Content', type: 'group', visible: true }] },
    { groupName: '07_FOOTER', zIndex: 7, layers: [{ name: 'Footer Bar', type: 'shape', visible: true }, { name: 'Footer Text', type: 'text', visible: true }] },
    { groupName: '08_EFFECTS', zIndex: 8, layers: [{ name: 'Accent Edge', type: 'shape', visible: true }] },
  ];
}

function recordDecisions(analysis: AssetAnalysis, retrieved: DesignPlan[], family: string): DesignDecision[] {
  return [
    { category: 'composition-family', choice: family, rationale: retrieved.length > 0 ? `Adapted from ${retrieved.length} similar approved poster(s)` : `Auto-selected based on ${analysis.photoCount} photos, ${analysis.eventEmphasis} emphasis`, source: retrieved.length > 0 ? 'retrieval' : 'heuristic' },
    { category: 'hero-selection', choice: analysis.heroCandidates[0]?.path || 'auto', rationale: `Top candidate scored ${analysis.heroCandidates[0]?.score || 0}`, source: 'heuristic' },
    { category: 'photo-count', choice: `${analysis.photoCount} photos`, rationale: `${Math.max(0, analysis.photoCount - 1)} supporting + 1 hero`, source: 'heuristic' },
    ...(retrieved.length > 0 ? [{ category: 'retrieval' as const, choice: `${retrieved.length} example(s) used`, rationale: `Matched on ${retrieved.map(r => r.compositionFamily).join(', ')}`, source: 'retrieval' as const, alternativesConsidered: retrieved.map(r => `${r.planId} (${r.compositionFamily})`) }] : []),
  ];
}

// ── Convert DesignPlan to legacy Plan for rendering ──────────────────────────

export function designPlanToLegacyPlan(dp: DesignPlan, input: ComposeInput): Plan {
  const groups: PlanGroup[] = [];
  const baseHex = dp.palette.background;

  groups.push({ name: '00_BACKGROUND', opacity: 1, visible: true, nodes: [{ kind: 'rect', name: 'BG_MAIN', rect: { x: 0, y: 0, w: 1920, h: 1080 }, hex: baseHex }] });

  if (dp.decorations.length > 0) {
    groups.push({
      name: '01_DECORATION', opacity: 1, visible: true,
      nodes: dp.decorations.map(d => ({ kind: 'rect' as const, name: `DECO_${d.type}`, rect: d.rect, hex: d.color, opacity: d.opacity })),
    });
  }

  const brandNodes: PlanNode[] = [];
  brandNodes.push({ kind: 'text', name: 'SCHOOL_NAME', content: input.school?.name || '', rect: dp.brandingPlacement.schoolNameRect, font: dp.typography.headingFont, size: dp.typography.headingSize, minSize: 12, maxLines: 2, hex: dp.palette.textPrimary, align: 'left' });
  if (dp.brandingPlacement.addressRect) {
    brandNodes.push({ kind: 'text', name: 'ADDRESS', content: input.school?.address || '', rect: dp.brandingPlacement.addressRect, font: dp.typography.bodyFont, size: dp.typography.captionSize, minSize: 8, maxLines: 2, hex: dp.palette.textSecondary, align: 'left' });
  }
  groups.push({ name: '02_SCHOOL_BRANDING', opacity: 1, visible: true, nodes: brandNodes });

  const titleNodes: PlanNode[] = [];
  if (input.headline) {
    titleNodes.push({ kind: 'text', name: 'TITLE', content: input.headline, rect: dp.sections.titleZone, font: dp.typography.headingFont, size: dp.typography.titleSize, minSize: 18, maxLines: 3, hex: dp.palette.textPrimary, align: 'center' });
  }
  if (input.subheadline) {
    titleNodes.push({ kind: 'text', name: 'SUBTITLE', content: input.subheadline, rect: { x: dp.sections.titleZone.x, y: dp.sections.titleZone.y + dp.sections.titleZone.h / 2, w: dp.sections.titleZone.w, h: dp.sections.titleZone.h / 2 }, font: dp.typography.bodyFont, size: dp.typography.subtitleSize, minSize: 12, maxLines: 2, hex: dp.palette.textSecondary, align: 'center' });
  }
  if (titleNodes.length > 0) groups.push({ name: '03_TITLE', opacity: 1, visible: true, nodes: titleNodes });

  const photoNodes: PlanNode[] = [];
  if (dp.heroPhoto.assetPath) {
    photoNodes.push({ kind: 'photo', name: 'HERO_PHOTO', path: dp.heroPhoto.assetPath, rect: dp.heroPhoto.frameRect, mask: dp.heroPhoto.frameShape === 'circle' ? 'circle' : dp.heroPhoto.frameShape === 'rounded' ? 'rounded' : 'rect', focusY: dp.heroPhoto.focusY, fit: 'cover' });
  }
  for (const sp of dp.supportingPhotos) {
    photoNodes.push({ kind: 'photo', name: `PHOTO_${sp.role}`, path: sp.assetPath, rect: sp.frameRect, mask: sp.frameShape === 'circle' ? 'circle' : sp.frameShape === 'rounded' ? 'rounded' : 'rect', focusY: sp.focusY, fit: 'cover' });
  }
  if (photoNodes.length > 0) groups.push({ name: '05_STUDENT_PHOTOS', opacity: 1, visible: true, nodes: photoNodes });

  const fz = dp.sections.footerZone;
  groups.push({
    name: '09_FOOTER', opacity: 1, visible: true,
    nodes: [
      { kind: 'rect', name: 'FOOTER_BG', rect: fz, hex: dp.palette.footerBg },
      { kind: 'text', name: 'FOOTER_TEXT', content: `© ${new Date().getFullYear()} ${input.school?.name || ''}`, rect: fz, font: dp.typography.bodyFont, size: dp.typography.captionSize, minSize: 8, maxLines: 1, hex: '#FFFFFF', align: 'center' },
    ],
  });

  groups.push({ name: '10_EFFECTS', opacity: 1, visible: true, nodes: [{ kind: 'rect', name: 'TOP_ACCENT', rect: { x: 0, y: 0, w: 1920, h: 6 }, hex: dp.palette.primary }] });

  return {
    width: dp.sections.safeArea.w + dp.sections.safeArea.x * 2,
    height: dp.sections.safeArea.h + dp.sections.safeArea.y * 2,
    baseHex,
    groups,
    metadata: { compositionFamily: dp.compositionFamily, photoCount: dp.metadata.photoCount, heroFirst: true, assetUsage: { used: [], missing: [], invalid: [] } },
  };
}
