import type { ClassifiedLayer, LayoutIssue, LayoutSection, Rect, SemanticRole } from '../types';

interface Bounds {
  left: number; top: number; right: number; bottom: number;
  width: number; height: number;
}

function localSafeArea(docW: number, docH: number): Bounds {
  return {
    left: Math.round(docW * 0.05),
    top: Math.round(docH * 0.04),
    right: Math.round(docW * 0.95),
    bottom: Math.round(docH * 0.96),
    width: Math.max(1, Math.round(docW * 0.9)),
    height: Math.max(1, Math.round(docH * 0.92))
  };
}

function localSectionForRole(role: string): LayoutSection {
  if (['school_logo','school_name','poster_title','event_name','powered_by_lead','branding'].includes(role)) return 'header';
  if (['chairman_photo','principal_photo','contact_information','school_address','school_phone','footer','social_media'].includes(role)) return 'footer';
  return 'content';
}

function getBounds(layer: ClassifiedLayer): Bounds {
  return {
    left: layer.bounds.left,
    top: layer.bounds.top,
    right: layer.bounds.right,
    bottom: layer.bounds.bottom,
    width: layer.bounds.width,
    height: layer.bounds.height
  };
}

function rectOverlap(a: Bounds, b: Bounds, pad = 0): boolean {
  return a.left < b.right + pad && a.right > b.left - pad &&
    a.top < b.bottom + pad && a.bottom > b.top - pad;
}

function inside(inner: Bounds, outer: Bounds): boolean {
  return inner.left >= outer.left && inner.top >= outer.top &&
    inner.right <= outer.right && inner.bottom <= outer.bottom;
}

const NON_REPEATABLE_ROLES = new Set([
  'school_logo', 'school_name', 'school_address', 'school_phone',
  'poster_title', 'event_name', 'event_date', 'event_description',
  'academic_year', 'footer', 'powered_by_lead', 'contact_information',
  'background'
]);

export const CONTENT_ROLES = new Set([
  'event_image', 'poster_subtitle', 'subheadline', 'features',
  'student_name', 'student_class', 'student_photo'
]);

export const HEADER_ROLES = new Set([
  'school_logo', 'school_name', 'poster_title', 'event_name',
  'powered_by_lead'
]);

export const FOOTER_ROLES = new Set([
  'chairman_photo', 'principal_photo', 'contact_information',
  'school_address', 'school_phone', 'footer'
]);

interface CollisionRule {
  code: string;
  severity: 'error' | 'warning' | 'critical';
  description: string;
  check: (a: ClassifiedLayer, b: ClassifiedLayer) => boolean;
}

const RULES: CollisionRule[] = [
  {
    code: 'HEADLINE_OVER_SCHOOL_NAME',
    severity: 'error',
    description: 'Headline overlaps school name',
    check: (a, b) =>
      (a.semanticRole === 'poster_title' && b.semanticRole === 'school_name') &&
      rectOverlap(getBounds(a), getBounds(b), 5)
  },
  {
    code: 'HEADLINE_OVER_POWERED_BY_LEAD',
    severity: 'error',
    description: 'Headline overlaps Powered by LEAD',
    check: (a, b) =>
      (a.semanticRole === 'poster_title' && b.semanticRole === 'powered_by_lead') &&
      rectOverlap(getBounds(a), getBounds(b), 5)
  },
  {
    code: 'TEXT_OVER_TEXT',
    severity: 'warning',
    description: 'Text layers overlap in same section',
    check: (a, b) =>
      a.type === 'text' && b.type === 'text' &&
      a.semanticRole !== 'repeated_student_card' &&
      b.semanticRole !== 'repeated_student_card' &&
      localSectionForRole(a.semanticRole) === localSectionForRole(b.semanticRole) &&
      rectOverlap(getBounds(a), getBounds(b), 3)
  },
  {
    code: 'FOOTER_TEXT_OVER_PORTRAIT',
    severity: 'error',
    description: 'Footer text overlaps profile portrait',
    check: (a, b) =>
      FOOTER_ROLES.has(a.semanticRole) && FOOTER_ROLES.has(b.semanticRole) &&
      ((a.semanticRole === 'chairman_photo' || a.semanticRole === 'principal_photo') && b.type === 'text') &&
      rectOverlap(getBounds(a), getBounds(b), 5)
  },
  {
    code: 'PHOTO_OVER_TEXT',
    severity: 'warning',
    description: 'Photo overlaps nearby text',
    check: (a, b) =>
      (a.type === 'smartObject' || a.type === 'pixel') && b.type === 'text' &&
      !b.clipping && localSectionForRole(a.semanticRole) === localSectionForRole(b.semanticRole) &&
      rectOverlap(getBounds(a), getBounds(b), 8)
  },
  {
    code: 'CONTENT_OUTSIDE_SAFE_AREA',
    severity: 'error',
    description: 'Content extends outside safe area',
    check: (a, _b) =>
      a.semanticRole !== 'background' &&
      a.semanticRole !== 'decorative_element' &&
      !a.bounds.left && !a.bounds.top && !a.bounds.right && !a.bounds.bottom
  },
  {
    code: 'ADDRESS_OUTSIDE_FOOTER',
    severity: 'error',
    description: 'Address extends outside footer region',
    check: (a, _b) =>
      a.semanticRole === 'school_address' && localSectionForRole(a.semanticRole) !== 'footer'
  }
];

export function detectLayoutCollisions(
  layers: ClassifiedLayer[],
  _docW: number,
  _docH: number
): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const safe = localSafeArea(_docW, _docH);
  const safeBounds: Bounds = {
    left: safe.left, top: safe.top, right: safe.right, bottom: safe.bottom,
    width: safe.width, height: safe.height
  };

  for (const layer of layers) {
    if (layer.semanticRole === 'background' || layer.semanticRole === 'decorative_element') continue;
    if (layer.semanticRole === 'repeated_student_card') continue;
    if (layer.clipping) continue;

    const b = getBounds(layer);
    if (b.width <= 0 || b.height <= 0) continue;

    if (!inside(b, { left: 0, top: 0, right: _docW, bottom: _docH, width: _docW, height: _docH })) {
      issues.push({
        code: 'OUTSIDE_CANVAS',
        severity: 'critical',
        message: layer.path + ' (' + layer.semanticRole + ') extends outside canvas',
        layerId: layer.layerId,
        section: localSectionForRole(layer.semanticRole)
      });
    }

    if (HEADER_ROLES.has(layer.semanticRole) || CONTENT_ROLES.has(layer.semanticRole) || FOOTER_ROLES.has(layer.semanticRole)) {
      if (!inside(b, safeBounds)) {
        issues.push({
          code: 'OUTSIDE_SAFE_AREA',
          severity: 'error',
          message: layer.path + ' (' + layer.semanticRole + ') extends outside safe area',
          layerId: layer.layerId,
          section: localSectionForRole(layer.semanticRole)
        });
      }
    }
  }

  if (layers.length >= 2) {
    for (let i = 0; i < layers.length; i++) {
      for (let j = i + 1; j < layers.length; j++) {
        const a = layers[i];
        const b = layers[j];
        if (!a || !b) continue;
        if (a.clipping || b.clipping) continue;
        if (a.semanticRole === 'decorative_element' || b.semanticRole === 'decorative_element') continue;
        if (a.semanticRole === 'background' || b.semanticRole === 'background') continue;

        for (const rule of RULES) {
          if (rule.code === 'CONTENT_OUTSIDE_SAFE_AREA') continue;
          if (rule.check(a, b) || rule.check(b, a)) {
            const existing = issues.some(
              ix => ix.code === rule.code && ix.layerId === a.layerId
            );
            if (!existing) {
              issues.push({
                code: rule.code,
                severity: rule.severity,
                message: rule.description + ': ' + a.path + ' vs ' + b.path,
                layerId: a.layerId,
                section: localSectionForRole(a.semanticRole)
              });
            }
          }
        }
      }
    }
  }

  const duplicates = findDuplicateRoles(layers);
  for (const dup of duplicates) {
    issues.push({
      code: 'DUPLICATE_ROLE',
      severity: 'error',
      message: dup,
      section: 'content'
    });
  }

  return issues;
}

function findDuplicateRoles(layers: ClassifiedLayer[]): string[] {
  const warnings: string[] = [];
  const grouped: Record<string, ClassifiedLayer[]> = {};

  for (const layer of layers) {
    if (!NON_REPEATABLE_ROLES.has(layer.semanticRole)) continue;
    if (layer.confidence < 50) continue;
    if (!grouped[layer.semanticRole]) grouped[layer.semanticRole] = [];
    grouped[layer.semanticRole].push(layer);
  }

  for (const [role, matches] of Object.entries(grouped)) {
    if (matches.length > 1) {
      const paths = matches.map(m => m.path).join(', ');
      warnings.push('Multiple layers compete for role "' + role + '": ' + paths);
    }
  }

  return warnings;
}

/** Backward-compatible collision check used by qualityValidator */
export function overlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.left < b.right + pad && a.right > b.left - pad &&
    a.top < b.bottom + pad && a.bottom > b.top - pad;
}

export function collisions(items: { id: number; bounds: Rect }[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (overlap(items[i]!.bounds, items[j]!.bounds))
        out.push([items[i]!.id, items[j]!.id]);
  return out;
}
