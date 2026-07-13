import type {
  ClassifiedLayer, LayoutIssue, LayoutValidationResult, AutoFix,
  LayoutSection, PosterData, TemplateManifest, SemanticRole
} from '../types';
import { detectLayoutCollisions, HEADER_ROLES, CONTENT_ROLES, FOOTER_ROLES } from './collisionDetector';
import { calculateSafeArea, getSectionForRole } from './layoutHelpers';
import { log } from '../utils/logger';

const REQUIRED_ROLES = new Set([
  'school_logo', 'school_name', 'poster_title', 'footer'
]);

const NON_REPEATABLE_ROLES = new Set([
  'school_logo', 'school_name', 'school_address', 'school_phone',
  'poster_title', 'event_name', 'event_date', 'event_description',
  'academic_year', 'footer', 'powered_by_lead', 'contact_information'
]);

const TEXT_ROLES_MIN_FONT: Record<string, number> = {
  poster_title: 18,
  event_name: 18,
  poster_subtitle: 12,
  subheadline: 12,
  event_description: 10,
  features: 10,
  school_address: 8,
  footer: 8,
  event_date: 10,
  academic_year: 10,
  school_phone: 8,
  school_name: 12,
  contact_information: 8,
  powered_by_lead: 7,
};

function allImportantRoles(): Set<string> {
  return new Set([...HEADER_ROLES, ...CONTENT_ROLES, ...FOOTER_ROLES]);
}

function qualityLabel(score: number): 'Excellent' | 'Good' | 'Needs Review' | 'Invalid' {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Review';
  return 'Invalid';
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

export async function validatePosterLayout(
  docW: number,
  docH: number,
  layers: ClassifiedLayer[],
  manifest: TemplateManifest,
  data: PosterData
): Promise<LayoutValidationResult> {
  const issues: LayoutIssue[] = [];
  const fixesApplied: AutoFix[] = [];
  const safe = calculateSafeArea(docW, docH);
  const importantRoles = allImportantRoles();

  const roleMap = new Map<string, ClassifiedLayer[]>();
  for (const layer of layers) {
    if (layer.confidence < 50) continue;
    const arr = roleMap.get(layer.semanticRole) || [];
    arr.push(layer);
    roleMap.set(layer.semanticRole, arr);
  }

  // 1. Required layers visible
  for (const rawRole of REQUIRED_ROLES) {
    const role = rawRole as SemanticRole;
    const matches = roleMap.get(role);
    if (!matches || matches.length === 0) {
      issues.push({
        code: 'MISSING_REQUIRED_LAYER',
        severity: 'critical',
        message: 'Required layer with role "' + role + '" not found',
        section: getSectionForRole(role)
      });
    } else {
      const primary = matches[0];
      if (primary && !primary.visible && role !== 'footer') {
        issues.push({
          code: 'HIDDEN_REQUIRED',
          severity: 'error',
          message: 'Required layer ' + primary.path + ' (' + role + ') is hidden',
          layerId: primary.layerId,
          section: getSectionForRole(role)
        });
      }
    }
  }

  // 2. Missing required content
  const requiredData: SemanticRole[] = ['poster_title', 'event_name', 'school_name'];
  for (const r of requiredData) {
    const val = data.values[r];
    if (!val && roleMap.has(r)) {
      issues.push({
        code: 'MISSING_INPUT',
        severity: 'error',
        message: 'Missing required content for "' + r + '"',
        section: getSectionForRole(r)
      });
    }
  }

  // 3. Outside canvas
  for (const layer of layers) {
    if (layer.semanticRole === 'background' || layer.semanticRole === 'decorative_element') continue;
    if (layer.type === 'group') continue;

    const b = layer.bounds;
    if (b.right > docW + 5 || b.bottom > docH + 5 || b.left < -5 || b.top < -5) {
      issues.push({
        code: 'OUTSIDE_CANVAS',
        severity: 'critical',
        message: layer.path + ' extends outside canvas (' +
          Math.round(b.left) + ',' + Math.round(b.top) + '-' +
          Math.round(b.right) + ',' + Math.round(b.bottom) + ')',
        layerId: layer.layerId,
        section: getSectionForRole(layer.semanticRole)
      });
    }
  }

  // 4. Inside safe area check
  for (const layer of layers) {
    if (!importantRoles.has(layer.semanticRole)) continue;
    if (layer.semanticRole === 'background') continue;
    const b = layer.bounds;
    if (b.left < safe.left - 5 || b.top < safe.top - 5 ||
        b.right > safe.right + 5 || b.bottom > safe.bottom + 5) {
      issues.push({
        code: 'OUTSIDE_SAFE_AREA',
        severity: 'warning',
        message: layer.path + ' (' + layer.semanticRole + ') extends outside safe area',
        layerId: layer.layerId,
        section: getSectionForRole(layer.semanticRole)
      });
    }
  }

  // 5. Font size check
  for (const layer of layers) {
    if (layer.type !== 'text' || !layer.text) continue;
    const minFont = TEXT_ROLES_MIN_FONT[layer.semanticRole];
    if (minFont && (layer.text.size ?? 99) < minFont) {
      issues.push({
        code: 'SMALL_TEXT',
        severity: 'warning',
        message: layer.path + ' font size ' + (layer.text.size ?? '?') + 'px is below minimum ' + minFont + 'px for ' + layer.semanticRole,
        layerId: layer.layerId,
        section: getSectionForRole(layer.semanticRole)
      });
    }
  }

  // 6. Collision detection
  const collisionIssues = detectLayoutCollisions(layers, docW, docH);
  issues.push(...collisionIssues);

  // 7. Duplicate role check
  const duplicateMessages = findDuplicateRoles(layers);
  for (const msg of duplicateMessages) {
    const alreadyExists = issues.some(i => i.code === 'DUPLICATE_ROLE' && i.message === msg);
    if (!alreadyExists) {
      issues.push({
        code: 'DUPLICATE_ROLE',
        severity: 'error',
        message: msg
      });
    }
  }

  // 8. Image distortion check
  for (const layer of layers) {
    if (layer.type !== 'smartObject' && layer.type !== 'pixel') continue;
    if (layer.semanticRole === 'background') continue;
    if (layer.bounds.width > 0 && layer.bounds.height > 0) {
      const aspect = layer.bounds.width / layer.bounds.height;
      const originalAspect = layer.boundsNoEffects.width / Math.max(1, layer.boundsNoEffects.height);
      if (originalAspect > 0 && (aspect / originalAspect > 1.1 || aspect / originalAspect < 0.9)) {
        issues.push({
          code: 'IMAGE_DISTORTED',
          severity: 'warning',
          message: layer.path + ' aspect ratio changed from ' +
            originalAspect.toFixed(2) + ' to ' + aspect.toFixed(2),
          layerId: layer.layerId,
          section: getSectionForRole(layer.semanticRole)
        });
      }
    }
  }

  // Score calculation
  let score = 100;
  let criticalCount = 0;
  for (const issue of issues) {
    if (issue.severity === 'critical') { score -= 25; criticalCount++; }
    else if (issue.severity === 'error') score -= 15;
    else score -= 5;
  }
  score = Math.max(0, Math.min(100, score));
  const valid = score >= 50 && criticalCount === 0;

  log('info', 'validatePosterLayout',
    'Score: ' + score + ', critical: ' + criticalCount + ', issues: ' + issues.length + ', valid: ' + valid);

  return {
    valid,
    score,
    issues,
    fixesApplied,
    criticalIssueCount: criticalCount
  };
}
