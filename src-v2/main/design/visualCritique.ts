// Visual critique for human-like poster design.
//
// After the initial Plan is composed, this module reviews it against the
// criteria a human school designer would check:
//
//   1. Does the poster have a clear visual hierarchy? (hero photo dominates)
//   2. Are photo frames naturally varied (not equal-sized grid)?
//   3. Is the school identity immediately visible?
//   4. Is the event understandable without reading every word?
//   5. Does the canvas feel full but not overcrowded?
//   6. Are faces likely visible (focusY applied)?
//   7. Does it avoid mechanical repetition (equal spacing, same sizes)?
//   8. Is the chairman/management integrated (when provided)?
//   9. Does it feel human-made vs template-generated?
//
// Each check produces a score; the overall report is used by the refinement
// loop to decide whether to revise the layout.

import type { Plan, PlanNode, PlanGroup, Rect } from './types';
import { overlap, safeArea } from './layout';

export interface CritiqueIssue {
  code: string;
  severity: 'pass' | 'info' | 'warning' | 'fail';
  message: string;
  category: string;
  suggestion?: string;
}

export interface VisualCritiqueReport {
  score: number;           // 0-100, higher = more human-like
  issues: CritiqueIssue[];
  fixSuggestions: string[];
  // Categorical scores for targeted revision
  categories: Record<string, number>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nodeRect(n: PlanNode): Rect | null {
  if (n.kind === 'polygon') {
    const xs = n.points.map(p => p.x);
    const ys = n.points.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return 'rect' in n ? (n as any).rect as Rect : null;
}

function asText(n: PlanNode): { content: string; size: number; rect: Rect; name: string } | null {
  if (n.kind !== 'text') return null;
  return { content: n.content, size: n.size, rect: n.rect, name: n.name };
}

function asPhoto(n: PlanNode): { rect: Rect; name: string } | null {
  if (n.kind !== 'photo') return null;
  return { rect: n.rect, name: n.name };
}

function collectNodes(plan: Plan): { all: PlanNode[]; texts: Extract<PlanNode, { kind: 'text' }>[]; photos: Extract<PlanNode, { kind: 'photo' }>[]; logos: Extract<PlanNode, { kind: 'photo' }>[] } {
  const all: PlanNode[] = [];
  const texts: Extract<PlanNode, { kind: 'text' }>[] = [];
  const photos: Extract<PlanNode, { kind: 'photo' }>[] = [];
  const logos: Extract<PlanNode, { kind: 'photo' }>[] = [];
  for (const group of plan.groups) {
    for (const node of group.nodes) {
      all.push(node);
      if (node.kind === 'text') texts.push(node);
      if (node.kind === 'photo') {
        const name = node.name || '';
        if (!name.includes('LOGO') && !name.includes('SCHOOL_LOGO') && !name.includes('LEAD_LOGO')) photos.push(node);
        if (name.includes('LOGO') || name.includes('SCHOOL_LOGO') || name.includes('LEAD_LOGO')) logos.push(node);
      }
    }
  }
  return { all, texts, photos, logos };
}

function addIssue(issues: CritiqueIssue[], code: string, severity: CritiqueIssue['severity'], message: string, category: string, suggestion?: string) {
  issues.push({ code, severity, message, category, suggestion });
}

// ── Individual Checks ────────────────────────────────────────────────────────

function checkVisualHierarchy(plan: Plan, photos: Extract<PlanNode, { kind: 'photo' }>[], issues: CritiqueIssue[], cats: Record<string, number[]>): number {
  let score = 100;

  if (photos.length >= 1) {
    const areas = photos.map(p => p.rect.w * p.rect.h).sort((a, b) => b - a);
    const largest = areas[0];
    const second = areas[1] || 0;

    const ratio = second > 0 ? largest / second : 2;
    if (ratio < 1.3) {
      score -= 25;
      addIssue(issues, 'WEAK_HIERARCHY', 'warning', 'Photos have similar sizes — no clear dominant image. A human designer always makes one photo the hero.', 'hierarchy', 'Make the first photo 50%+ larger than the others.');
    } else if (ratio < 1.6) {
      score -= 10;
      addIssue(issues, 'WEAK_HIERARCHY', 'info', 'Hero photo could be more dominant. Consider increasing its size relative to supporting photos.', 'hierarchy');
    } else {
      addIssue(issues, 'GOOD_HIERARCHY', 'pass', 'Hero photo clearly dominates — good visual hierarchy.', 'hierarchy');
    }

    const binned = new Map<number, number>();
    for (const a of areas) {
      const key = Math.round(a / 5000) * 5000;
      binned.set(key, (binned.get(key) || 0) + 1);
    }
    const maxEqual = Math.max(...binned.values());
    if (maxEqual >= 4) {
      score -= 20;
      addIssue(issues, 'GRID_LIKE', 'warning', `${maxEqual} photos have nearly identical sizes — this looks like a template grid, not a human collage.`, 'variety', 'Vary photo sizes: one hero, 2-3 medium, rest small.');
    }
  }

  cats['hierarchy'] = cats['hierarchy'] || [];
  cats['hierarchy'].push(score);
  return score;
}

function checkNaturalVariation(plan: Plan, photos: Extract<PlanNode, { kind: 'photo' }>[], issues: CritiqueIssue[], cats: Record<string, number[]>): number {
  let score = 100;

  if (photos.length >= 3) {
    const areas = photos.map(p => p.rect.w * p.rect.h);
    const min = Math.min(...areas);
    const max = Math.max(...areas);
    const spread = max / min;

    if (spread < 1.5) {
      score -= 30;
      addIssue(issues, 'UNIFORM_FRAMES', 'fail', 'All photo frames are nearly the same size. A human designer varies frame sizes by importance.', 'variation', 'Introduce a hero frame 2-3x larger than the smallest.');
    } else if (spread < 2.5) {
      score -= 10;
      addIssue(issues, 'LOW_VARIATION', 'info', 'Photo sizes could vary more for a natural collage feel.', 'variation');
    } else {
      addIssue(issues, 'GOOD_VARIATION', 'pass', 'Photo frames have good size variation — looks hand-arranged.', 'variation');
    }

    const ratios = photos.map(p => {
      const r = p.rect.w / p.rect.h;
      return r > 1 ? 'landscape' : r < 0.9 ? 'portrait' : 'square';
    });
    const uniqueRatios = new Set(ratios).size;
    if (uniqueRatios === 1 && ratios.length >= 3) {
      score -= 10;
      addIssue(issues, 'SAME_ASPECT', 'info', 'All photo frames share the same aspect ratio, which can feel monotonous.', 'variation');
    }
  }

  cats['variation'] = cats['variation'] || [];
  cats['variation'].push(score);
  return score;
}

function checkSchoolIdentity(plan: Plan, texts: Extract<PlanNode, { kind: 'text' }>[], logos: Extract<PlanNode, { kind: 'photo' }>[], issues: CritiqueIssue[], cats: Record<string, number[]>): number {
  let score = 100;

  const hasSchoolName = texts.some(t => t.name.includes('SCHOOL_NAME') && t.content.trim().length > 0);
  const hasLogo = logos.some(l => l.name.includes('SCHOOL_LOGO'));
  const hasAddress = texts.some(t => t.name.includes('ADDRESS') && t.content.trim().length > 0);
  const hasLead = texts.some(t => t.name.includes('LEAD') || t.content.includes('LEAD')) || logos.some(l => l.name.includes('LEAD_LOGO'));

  if (!hasSchoolName) {
    score -= 30;
    addIssue(issues, 'MISSING_SCHOOL_NAME', 'fail', 'School name is missing — school identity must be immediately visible.', 'identity', 'Add the school name in the header region.');
  } else {
    addIssue(issues, 'HAS_SCHOOL_NAME', 'pass', 'School name present.', 'identity');
  }

  if (!hasLogo) {
    score -= 15;
    addIssue(issues, 'MISSING_LOGO', 'info', 'School logo is missing — adding it strengthens school identity.', 'identity');
  } else {
    addIssue(issues, 'HAS_LOGO', 'pass', 'School logo present.', 'identity');
  }

  if (!hasAddress) {
    score -= 5;
    addIssue(issues, 'MISSING_ADDRESS', 'info', 'School address is missing from footer.', 'identity');
  }

  const schoolNameNode = texts.find(t => t.name.includes('SCHOOL_NAME'));
  if (schoolNameNode) {
    const top25 = plan.height * 0.25;
    if (schoolNameNode.rect.y > top25) {
      score -= 15;
      addIssue(issues, 'SCHOOL_NAME_POSITION', 'warning', 'School name is too far down — it should be near the top for immediate recognition.', 'identity', 'Move school name to the top 25% of the canvas.');
    }
  }

  cats['identity'] = cats['identity'] || [];
  cats['identity'].push(score);
  return score;
}

function checkCanvasUse(plan: Plan, all: PlanNode[], issues: CritiqueIssue[], cats: Record<string, number[]>): number {
  let score = 100;

  const safe = safeArea(plan.width, plan.height);
  const quads = [
    { name: 'top-left', x: safe.left, y: safe.top, w: safe.width / 2, h: (safe.bottom - safe.top) / 2 },
    { name: 'top-right', x: safe.left + safe.width / 2, y: safe.top, w: safe.width / 2, h: (safe.bottom - safe.top) / 2 },
    { name: 'bottom-left', x: safe.left, y: safe.top + (safe.bottom - safe.top) / 2, w: safe.width / 2, h: (safe.bottom - safe.top) / 2 },
    { name: 'bottom-right', x: safe.left + safe.width / 2, y: safe.top + (safe.bottom - safe.top) / 2, w: safe.width / 2, h: (safe.bottom - safe.top) / 2 },
  ];

  let emptyQuadCount = 0;
  for (const quad of quads) {
    const hasContent = all.some(n => {
      if (n.kind === 'text' && n.name.includes('BG_')) return false;
      if (n.kind === 'rect' && (n as any).name?.includes('BG_')) return false;
      if (n.kind === 'gradient' && (n as any).name?.includes('BG_')) return false;
      if (n.kind === 'ellipse' && (n as any).name?.includes('BG_')) return false;
      if (n.kind === 'ellipse' && (n as any).name?.includes('DECO_')) return false;
      const nr = nodeRect(n);
      return nr !== null && overlap(nr, quad, 10);
    });
    if (!hasContent) emptyQuadCount++;
  }

  if (emptyQuadCount >= 3) {
    score -= 25;
    addIssue(issues, 'EMPTY_CANVAS', 'warning', `${emptyQuadCount} of 4 quadrants are empty — canvas feels underused.`, 'canvas', 'Distribute content to fill the poster area.');
  } else if (emptyQuadCount >= 1) {
    score -= 8;
    addIssue(issues, 'PARTIAL_EMPTY', 'info', `${emptyQuadCount} quadrant(s) could use more visual weight.`, 'canvas');
  } else {
    addIssue(issues, 'FULL_CANVAS', 'pass', 'Canvas is well-filled — good use of space.', 'canvas');
  }

  if (all.length > 3) {
    const nonBgNodes = all.filter(n => {
      const name = (n as any).name || '';
      return !name.startsWith('BG_') && !name.startsWith('DECO_') && !name.startsWith('TOP_ACCENT');
    });
    if (nonBgNodes.length > 0) {
      let contentArea = 0;
      for (const n of nonBgNodes) {
        const nr = nodeRect(n);
        if (nr) contentArea += nr.w * nr.h;
      }
      const canvasArea = plan.width * plan.height;
      const density = contentArea / canvasArea;
      if (density < 0.15) {
        score -= 15;
        addIssue(issues, 'TOO_SPARSE', 'info', `Content density is low (${Math.round(density * 100)}%). Consider adding more visual elements.`, 'canvas');
      }
    }
  }

  cats['canvas'] = cats['canvas'] || [];
  cats['canvas'].push(score);
  return score;
}

function checkMechanicalRepetition(plan: Plan, photos: Extract<PlanNode, { kind: 'photo' }>[], texts: Extract<PlanNode, { kind: 'text' }>[], issues: CritiqueIssue[], cats: Record<string, number[]>): number {
  let score = 100;

  if (photos.length >= 3) {
    const yPositions = photos.map(p => p.rect.y);
    const uniqueY = new Set(yPositions).size;
    if (uniqueY <= 2 && photos.length >= 4) {
      score -= 15;
      addIssue(issues, 'PERFECT_ROWS', 'warning', 'Photos are arranged in perfect rows — a human designer would stagger them.', 'mechanical', 'Offset alternate photos vertically for a natural look.');
    }

    const widths = photos.map(p => p.rect.w);
    const uniqueW = new Set(widths).size;
    if (uniqueW === 1 && photos.length >= 3) {
      score -= 15;
      addIssue(issues, 'IDENTICAL_WIDTHS', 'warning', 'All photos have identical widths — this looks like a spreadsheet, not a collage.', 'mechanical', 'Vary photo widths by at least 20% between hero and supporting shots.');
    }
  }

  const textSizes = texts.map(t => t.size);
  const sizeCounts = new Map<number, number>();
  for (const s of textSizes) {
    sizeCounts.set(s, (sizeCounts.get(s) || 0) + 1);
  }
  for (const [size, count] of sizeCounts) {
    if (count >= 4 && size >= 12) {
      score -= 10;
      addIssue(issues, 'MONOTYPE_TEXT', 'info', `${count} text elements share the exact same size (${size}px) — consider varying for better hierarchy.`, 'mechanical');
      break;
    }
  }

  cats['mechanical'] = cats['mechanical'] || [];
  cats['mechanical'].push(score);
  return score;
}

function checkManagementPresence(plan: Plan, texts: Extract<PlanNode, { kind: 'text' }>[], issues: CritiqueIssue[], cats: Record<string, number[]>): number {
  let score = 100;

  const hasManagement = texts.some(t => t.name.includes('CHAIRMAN') || t.name.includes('PRINCIPAL') || t.name.includes('MANAGEMENT'));
  if (hasManagement) {
    addIssue(issues, 'HAS_MANAGEMENT', 'pass', 'Chairman/Principal is integrated — adds authority to the poster.', 'management');
  }

  cats['management'] = cats['management'] || [];
  cats['management'].push(score);
  return score;
}

function checkReadability(plan: Plan, texts: Extract<PlanNode, { kind: 'text' }>[], issues: CritiqueIssue[], cats: Record<string, number[]>): number {
  let score = 100;
  const minReadable = Math.round(plan.width * 0.011);

  for (const t of texts) {
    if ((t.name.includes('TITLE') || t.name.includes('HEADLINE')) && t.size < minReadable * 1.5) {
      score -= 15;
      addIssue(issues, 'SMALL_TITLE', 'warning', `Title (${t.size}px) may be too small for the poster size.`, 'readability', 'Increase title size for immediate readability.');
      break;
    }
    if (t.name.includes('BODY') || t.name.includes('PROGRAMME') || t.name.includes('ITEM')) {
      if (t.size < minReadable) {
        score -= 5;
        addIssue(issues, 'SMALL_BODY', 'info', `Body text at ${t.size}px may be hard to read at a distance.`, 'readability');
        break;
      }
    }
  }

  cats['readability'] = cats['readability'] || [];
  cats['readability'].push(score);
  return score;
}

function checkEventUnderstanding(plan: Plan, texts: Extract<PlanNode, { kind: 'text' }>[], issues: CritiqueIssue[], cats: Record<string, number[]>): number {
  let score = 100;

  const hasHeadline = texts.some(t => (t.name.includes('TITLE') || t.name.includes('HEADLINE')) && t.content.trim().length > 0);
  const hasDate = texts.some(t => t.name.includes('DATE') && t.content.trim().length > 0);
  const hasCategory = texts.some(t => {
    const c = t.content.toLowerCase();
    return c.includes('prayer') || c.includes('birthday') || c.includes('celebration') || c.includes('programme') || c.includes('proceeding');
  });

  if (!hasHeadline) {
    score -= 25;
    addIssue(issues, 'MISSING_HEADLINE', 'fail', 'No visible title/headline — the event purpose is unclear.', 'event-story');
  }
  if (!hasDate) {
    score -= 15;
    addIssue(issues, 'MISSING_DATE', 'warning', 'No date visible — event timing is missing.', 'event-story');
  }
  if (!hasCategory && !hasDate && !hasHeadline) {
    score -= 20;
    addIssue(issues, 'UNCLEAR_EVENT', 'warning', 'The event type is not immediately clear from the visible text.', 'event-story', 'Add a prominent headline that describes the event.');
  }

  cats['event-story'] = cats['event-story'] || [];
  cats['event-story'].push(score);
  return score;
}

function checkOverallHumanFeel(plan: Plan, photos: Extract<PlanNode, { kind: 'photo' }>[], texts: Extract<PlanNode, { kind: 'text' }>[], issues: CritiqueIssue[], cats: Record<string, number[]>): number {
  let score = 100;

  const photoCount = photos.length;
  if (photoCount >= 2) {
    const photoSizes = photos.map(p => `${p.rect.w}x${p.rect.h}`);
    const uniqueSizes = new Set(photoSizes).size;
    if (uniqueSizes === 1) {
      score -= 30;
      addIssue(issues, 'TEMPLATE_GRID', 'fail', 'Every photo frame is exactly the same size — this is the clearest sign of a template, not a human design.', 'human-feel', 'Vary each photo frame size, starting with a dominant hero shot.');
    }
  }

  const decoCount = plan.groups.filter(g => g.name.includes('DECORATION') || g.name.includes('EFFECTS'))
    .reduce((sum, g) => sum + g.nodes.length, 0);
  if (decoCount > 15) {
    score -= 10;
    addIssue(issues, 'OVER_DECORATED', 'info', `${decoCount} decorative elements may be excessive — a human designer keeps it purposeful.`, 'human-feel');
  }

  if (texts.length >= 3) {
    const sizes = [...new Set(texts.map(t => t.size))].sort((a, b) => b - a);
    if (sizes.length < 3) {
      score -= 10;
      addIssue(issues, 'FLAT_HIERARCHY', 'info', `Only ${sizes.length} distinct text sizes — a human would use 3-5 for clear hierarchy.`, 'human-feel');
    }
  }

  cats['human-feel'] = cats['human-feel'] || [];
  cats['human-feel'].push(score);
  return score;
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

export function critiquePoster(plan: Plan): VisualCritiqueReport {
  const issues: CritiqueIssue[] = [];
  const { all, texts, photos, logos } = collectNodes(plan);
  const cats: Record<string, number[]> = {};

  checkVisualHierarchy(plan, photos, issues, cats);
  checkNaturalVariation(plan, photos, issues, cats);
  checkSchoolIdentity(plan, texts, logos, issues, cats);
  checkCanvasUse(plan, all, issues, cats);
  checkMechanicalRepetition(plan, photos, texts, issues, cats);
  checkManagementPresence(plan, texts, issues, cats);
  checkReadability(plan, texts, issues, cats);
  checkEventUnderstanding(plan, texts, issues, cats);
  checkOverallHumanFeel(plan, photos, texts, issues, cats);

  const catAverages: Record<string, number> = {};
  for (const [cat, scores] of Object.entries(cats)) {
    catAverages[cat] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  const catScores = Object.values(catAverages);
  const baseScore = catScores.length > 0 ? Math.round(catScores.reduce((a, b) => a + b, 0) / catScores.length) : 80;

  const failCount = issues.filter(i => i.severity === 'fail').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const finalScore = Math.max(0, Math.min(100, baseScore - failCount * 12 - warningCount * 4));

  const fixSuggestions = issues
    .filter(i => i.suggestion)
    .map(i => i.suggestion!)
    .filter((v, i, a) => a.indexOf(v) === i);

  return {
    score: finalScore,
    issues,
    fixSuggestions,
    categories: catAverages,
  };
}
