import { nativeImage } from 'electron';
import type { Plan, PlanNode, Rect } from './types';

export interface QualityGateExpectation {
  schoolLogoPath?: string; leadLogoPath?: string; heroImagePath?: string;
  previewPlanHash: string; photoshopPlanHash: string; finalExportPlanHash: string;
  legacyRendererUsed: boolean;
}

export interface ProfessionalQualityGateReport {
  accepted: boolean;
  failures: string[];
  warnings: string[];
  metrics: Record<string, number | string | boolean>;
  inspectedPngPath: string;
}

const area = (rect: Rect): number => Math.max(0, rect.w) * Math.max(0, rect.h);
const neutral = (hex: string): boolean => {
  const value = hex.replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(value)) return false;
  const parts = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return Math.max(...parts) - Math.min(...parts) < 12 && parts.reduce((a, b) => a + b, 0) / 3 > 190;
};

function bounds(node: PlanNode): Rect {
  if (node.kind !== 'polygon') return node.rect;
  const xs = node.points.map((point) => point.x); const ys = node.points.map((point) => point.y);
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function foregroundRects(nodes: PlanNode[]): Rect[] {
  return nodes.filter((node) => {
    if (node.kind === 'text' || node.kind === 'photo' || node.kind === 'ellipse' || node.kind === 'polygon') return true;
    return node.kind === 'rect' && /BADGE|TAB|ACCENT|SPINE|RULE/.test(node.name);
  }).map(bounds);
}

function contains(rect: Rect, x: number, y: number): boolean { return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h; }

function inspectPixels(pngPath: string, plan: Plan): { lightNeutralRatio: number; visuallyEmptyRatio: number; sampledPixels: number } {
  const image = nativeImage.createFromPath(pngPath);
  if (image.isEmpty()) throw new Error(`FINAL_PNG_UNREADABLE: ${pngPath}`);
  const size = image.getSize(); const bitmap = image.toBitmap(); const stride = size.width * 4;
  const step = Math.max(2, Math.floor(Math.min(size.width, size.height) / 260));
  const foreground = foregroundRects(plan.groups.flatMap((group) => group.nodes));
  let sampled = 0; let lightNeutral = 0; let empty = 0;
  for (let y = 0; y < size.height - step; y += step) {
    for (let x = 0; x < size.width - step; x += step) {
      const index = y * stride + x * 4; const right = y * stride + Math.min(size.width - 1, x + step) * 4;
      const b = bitmap[index]; const g = bitmap[index + 1]; const r = bitmap[index + 2];
      const rb = bitmap[right]; const rg = bitmap[right + 1]; const rr = bitmap[right + 2];
      const isNeutral = Math.max(r, g, b) - Math.min(r, g, b) < 13 && (r + g + b) / 3 > 205;
      if (isNeutral) lightNeutral++;
      const flat = Math.abs(r - rr) + Math.abs(g - rg) + Math.abs(b - rb) < 12;
      const px = x * plan.width / size.width; const py = y * plan.height / size.height;
      if (isNeutral && flat && !foreground.some((rect) => contains(rect, px, py))) empty++;
      sampled++;
    }
  }
  return { lightNeutralRatio: lightNeutral / Math.max(1, sampled), visuallyEmptyRatio: empty / Math.max(1, sampled), sampledPixels: sampled };
}

export function inspectProfessionalPoster(plan: Plan, pngPath: string, expected: QualityGateExpectation): ProfessionalQualityGateReport {
  const failures: string[] = []; const warnings: string[] = [];
  const nodes = plan.groups.flatMap((group) => group.nodes); const canvasArea = plan.width * plan.height;
  const photos = nodes.filter((node): node is Extract<PlanNode, { kind: 'photo' }> => node.kind === 'photo');
  const texts = nodes.filter((node): node is Extract<PlanNode, { kind: 'text' }> => node.kind === 'text');
  const meaningfulPhoto = photos.some((node) => area(node.rect) / canvasArea >= 0.22 && !/LOGO/.test(node.name));
  const meaningfulIllustration = nodes.some((node) => /FOCAL_/.test(node.name) && (node.kind === 'polygon' || node.kind === 'ellipse'));
  if (!meaningfulPhoto && !meaningfulIllustration) failures.push('NO_MEANINGFUL_FOCAL_VISUAL');

  const repeatedFullWidthRows = nodes.filter((node) => node.kind === 'rect' && /PROGRAMME_ROW/.test(node.name) && node.rect.w / plan.width > 0.8).length;
  if (repeatedFullWidthRows > 6) failures.push('MORE_THAN_SIX_REPEATED_FULL_WIDTH_ROWS');

  const neutralPanelRatio = nodes.filter((node): node is Extract<PlanNode, { kind: 'rect' }> => node.kind === 'rect').filter((node) => neutral(node.hex) && area(node.rect) / canvasArea > 0.03).reduce((sum, node) => sum + area(node.rect), 0) / canvasArea;
  if (neutralPanelRatio > 0.4) failures.push('PLAIN_WHITE_OR_GREY_PANELS_EXCEED_40_PERCENT');

  const lowOccupancyBoxes = nodes.filter((node) => node.kind === 'rect' && area(node.rect) / canvasArea > 0.08).filter((panel) => {
    const box = panel.kind === 'rect' ? panel.rect : bounds(panel); const textArea = texts.filter((text) => contains(box, text.rect.x + text.rect.w / 2, text.rect.y + text.rect.h / 2)).reduce((sum, text) => sum + area(text.rect), 0);
    return textArea / Math.max(1, area(box)) < 0.35 && neutral(panel.hex);
  }).length;
  if (lowOccupancyBoxes >= 2) failures.push('MULTIPLE_LARGE_LOW_TEXT_OCCUPANCY_BOXES');

  const usedPaths = new Set(photos.map((node) => node.path.toLowerCase()));
  if (expected.schoolLogoPath && !usedPaths.has(expected.schoolLogoPath.toLowerCase())) failures.push('UPLOADED_SCHOOL_LOGO_ABSENT');
  if (expected.leadLogoPath && !usedPaths.has(expected.leadLogoPath.toLowerCase())) failures.push('UPLOADED_LEAD_LOGO_ABSENT');
  if (expected.heroImagePath && !usedPaths.has(expected.heroImagePath.toLowerCase())) failures.push('UPLOADED_HERO_IMAGE_ABSENT');

  const major = nodes.filter((node) => area(bounds(node)) / canvasArea > 0.025);
  const nonRectMajor = major.filter((node) => node.kind === 'photo' || node.kind === 'ellipse' || node.kind === 'polygon').length;
  if (major.length > 5 && nonRectMajor === 0) failures.push('ALL_MAJOR_OBJECTS_ARE_RECTANGULAR');

  const programmeSizes = texts.filter((node) => /PROGRAMME_ITEM/.test(node.name)).map((node) => node.size);
  const title = texts.find((node) => node.name === 'MAIN_TITLE'); const programmeMedian = programmeSizes.sort((a, b) => a - b)[Math.floor(programmeSizes.length / 2)] || 1;
  if (programmeSizes.some((size) => size < 17)) failures.push('PROGRAMME_TEXT_TOO_SMALL_FOR_MOBILE');
  if (title && title.size / programmeMedian > 3.5) failures.push('TITLE_EXCESSIVELY_LARGE');
  if (nodes.some((node) => node.name === 'CONTENT_PANEL') || repeatedFullWidthRows > 3) failures.push('DASHBOARD_TABLE_OR_POWERPOINT_PATTERN_DETECTED');
  if (expected.legacyRendererUsed || plan.metadata?.legacyRendererUsed) failures.push('LEGACY_RENDERER_DETECTED');
  if (expected.previewPlanHash !== expected.photoshopPlanHash || expected.photoshopPlanHash !== expected.finalExportPlanHash) failures.push('DESIGN_PLAN_HASH_MISMATCH');

  const pixels = inspectPixels(pngPath, plan);
  if (pixels.lightNeutralRatio > 0.4) failures.push('FINAL_PNG_PLAIN_WHITE_OR_GREY_EXCEEDS_40_PERCENT');
  if (pixels.visuallyEmptyRatio > 0.18) failures.push('FINAL_PNG_VISUALLY_EMPTY_EXCEEDS_18_PERCENT');
  if (pixels.lightNeutralRatio > 0.28) warnings.push('Final PNG contains a relatively large light-neutral area; visually verify intentional editorial use.');

  return {
    accepted: failures.length === 0, failures, warnings,
    metrics: {
      meaningfulFocalVisual: meaningfulPhoto || meaningfulIllustration,
      repeatedFullWidthRows, neutralPanelRatio: Number(neutralPanelRatio.toFixed(4)), lowOccupancyBoxes,
      nonRectMajorObjects: nonRectMajor, programmeMinimumPx: Math.min(...programmeSizes),
      titleToProgrammeRatio: Number((title ? title.size / programmeMedian : 0).toFixed(3)),
      finalPngLightNeutralRatio: Number(pixels.lightNeutralRatio.toFixed(4)),
      finalPngVisuallyEmptyRatio: Number(pixels.visuallyEmptyRatio.toFixed(4)), sampledPixels: pixels.sampledPixels,
    },
    inspectedPngPath: pngPath,
  };
}
