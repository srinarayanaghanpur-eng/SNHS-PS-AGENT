// Visual verifier.
//
// After each applied command the document is re-analysed and checked for
// regressions (§ Visual verification). This never claims success merely because
// Photoshop exported a file — it inspects the resulting scene graph.

import { flatten } from './document-analyzer';
import { mapScene } from './semantic-layer-mapper';
import type { MapperContext } from './semantic-layer-mapper';
import type { SceneGraph, SceneLayer, VerificationIssue } from './types';

const EDGE_MARGIN = 8; // px: text closer than this to the canvas edge is flagged

function overlaps(a: SceneLayer, b: SceneLayer): boolean {
  if (!a.bounds || !b.bounds) return false;
  return !(a.bounds.right <= b.bounds.left || b.bounds.right <= a.bounds.left ||
           a.bounds.bottom <= b.bounds.top || b.bounds.bottom <= a.bounds.top);
}

function relLuminance(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relLuminance(fgHex); const l2 = relLuminance(bgHex);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export interface VerifyContext extends MapperContext {
  // Hex of the dominant background sampled behind text, keyed by text layerId.
  backgroundHexByLayer?: Record<number, string>;
  expectSchoolBranding?: boolean;
  expectLeadBranding?: boolean;
}

export function verifyScene(scene: SceneGraph, ctx: VerifyContext = {}): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const { width, height } = scene.document;
  const all = flatten(scene.layers);
  const matches = mapScene(scene, ctx);
  const roleById = new Map(matches.map((m) => [m.layerId, m.role]));

  for (const l of all) {
    if (l.type === 'group' || !l.bounds) continue;
    const role = roleById.get(l.id);

    // Out of canvas
    if (l.bounds.left < -2 || l.bounds.top < -2 || l.bounds.right > width + 2 || l.bounds.bottom > height + 2) {
      const isLogo = role === 'school_logo' || role === 'lead_logo';
      issues.push({
        code: isLogo ? 'LOGO_CUT_OFF' : 'OUT_OF_CANVAS',
        message: `${l.name} extends outside the canvas`,
        layerId: l.id, severity: isLogo ? 'error' : 'warning',
      });
    }

    // Logo distortion: extreme aspect drift on a logo can't be verified without
    // the original aspect; flag near-zero or degenerate dimensions.
    if ((role === 'school_logo' || role === 'lead_logo') && (l.width < 4 || l.height < 4)) {
      issues.push({ code: 'LOGO_DISTORTED', message: `${l.name} has degenerate dimensions`, layerId: l.id, severity: 'error' });
    }

    // Text near edge
    if (l.type === 'text' && (l.bounds.left < EDGE_MARGIN || l.bounds.top < EDGE_MARGIN ||
        l.bounds.right > width - EDGE_MARGIN || l.bounds.bottom > height - EDGE_MARGIN)) {
      issues.push({ code: 'TEXT_TOO_CLOSE_TO_EDGE', message: `${l.name} is very close to the canvas edge`, layerId: l.id, severity: 'warning' });
    }

    // Text clipped: rendered bounds wider/taller than the visible canvas region
    if (l.type === 'text' && (l.bounds.right > width || l.bounds.bottom > height)) {
      issues.push({ code: 'TEXT_CLIPPED', message: `${l.name} appears clipped by the canvas`, layerId: l.id, severity: 'warning' });
    }

    // Contrast
    if (l.type === 'text' && l.textColorHex && ctx.backgroundHexByLayer?.[l.id]) {
      const ratio = contrastRatio(l.textColorHex, ctx.backgroundHexByLayer[l.id]);
      if (ratio < 3.0) issues.push({ code: 'LOW_TEXT_CONTRAST', message: `${l.name} has low contrast (${ratio.toFixed(1)}:1)`, layerId: l.id, severity: 'warning' });
    }

    // Unexpected hidden branding
    if (!l.visible && (role === 'school_logo' || role === 'lead_logo' || role === 'school_name')) {
      issues.push({ code: 'UNEXPECTED_HIDDEN_LAYER', message: `${l.name} (${role}) is hidden`, layerId: l.id, severity: 'warning' });
    }
  }

  // Text overlap (text vs text)
  const texts = all.filter((l) => l.type === 'text' && l.visible && l.bounds);
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (overlaps(texts[i], texts[j])) {
        issues.push({ code: 'TEXT_OVERLAP', message: `${texts[i].name} overlaps ${texts[j].name}`, layerId: texts[i].id, severity: 'warning' });
      }
    }
  }

  // Background covering content: a full-canvas visible layer sitting above text
  const roles = matches;
  const bg = all.find((l) => roles.find((r) => r.layerId === l.id && r.role === 'background'));
  if (bg && bg.visible) {
    const bgZ = bg.zOrder;
    const covered = texts.some((t) => t.zOrder < bgZ); // lower zOrder = earlier = behind in our counter
    if (covered) issues.push({ code: 'BACKGROUND_COVERS_CONTENT', message: 'Background appears in front of some text', layerId: bg.id, severity: 'error' });
  }

  // Missing branding
  if (ctx.expectSchoolBranding && !matches.some((m) => m.role === 'school_logo' && m.confidence > 0.4)) {
    issues.push({ code: 'MISSING_SCHOOL_BRANDING', message: 'No school logo detected', severity: 'warning' });
  }
  if (ctx.expectLeadBranding && !matches.some((m) => m.role === 'lead_logo' && m.confidence > 0.4)) {
    issues.push({ code: 'MISSING_LEAD_BRANDING', message: 'No LEAD logo detected', severity: 'warning' });
  }

  // Empty photo frame: a visible frame/shape with no pixel/smart-object child overlapping
  const frames = all.filter((l) => roles.find((r) => r.layerId === l.id && r.role === 'frame') && l.visible && l.bounds);
  for (const f of frames) {
    const filled = all.some((l) => (l.type === 'smartObject' || l.type === 'pixel') && l.visible && overlaps(f, l));
    if (!filled) issues.push({ code: 'EMPTY_PHOTO_FRAME', message: `${f.name} looks like an empty frame`, layerId: f.id, severity: 'warning' });
  }

  return issues;
}
