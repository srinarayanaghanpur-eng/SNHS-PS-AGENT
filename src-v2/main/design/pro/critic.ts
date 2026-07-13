// Rule-Based Design Critic
// Evaluates poster compositions against professional design principles.
// Scores each candidate and returns specific correction actions.

import type { SceneGraph, SceneNode, GroupNode, QualityScore, QualityDetail, Criticism, Correction, DesignFamily } from './sceneGraph';
import { contrastRatio as calcContrast } from './colour';

interface CritiqueConfig {
  minTitleSizeRatio: number;
  maxTitleSizeRatio: number;
  minSafeMarginRatio: number;
  maxDominantRatio: number;
  maxEqualTextElements: number;
  minFocalStrength: number;
  maxDecorationCount: number;
  minPhotoQuality: number;
  maxLogoSizeRatio: number;
  minContrastRatio: number;
  maxCenterAlignedRatio: number;
  minWhitespaceRatio: number;
  maxFooterDominance: number;
  minProgrammeVariety: number;
  maxRepeatedShapes: number;
}

const DEFAULT_CONFIG: CritiqueConfig = {
  minTitleSizeRatio: 0.04,
  maxTitleSizeRatio: 0.12,
  minSafeMarginRatio: 0.04,
  maxDominantRatio: 0.6,
  maxEqualTextElements: 3,
  minFocalStrength: 0.3,
  maxDecorationCount: 5,
  minPhotoQuality: 40,
  maxLogoSizeRatio: 0.12,
  minContrastRatio: 3.0,
  maxCenterAlignedRatio: 0.5,
  minWhitespaceRatio: 0.25,
  maxFooterDominance: 0.12,
  minProgrammeVariety: 0.3,
  maxRepeatedShapes: 3,
};

export interface CritiqueResult {
  score: QualityScore;
  criticisms: Criticism[];
  corrections: Correction[];
  passed: boolean;
}

function scoreMetric(value: number, min: number, max: number, idealMin: number, idealMax: number): number {
  if (value >= idealMin && value <= idealMax) return 100;
  if (value < min || value > max) return 0;
  if (value < idealMin) return ((value - min) / (idealMin - min)) * 100;
  return ((max - value) / (max - idealMax)) * 100;
}

export function critiqueDesign(sceneGraph: SceneGraph): CritiqueResult {
  const allNodes = flattenNodes(sceneGraph.root);
  const textNodes = allNodes.filter(n => n.kind === 'text');
  const imageNodes = allNodes.filter(n => n.kind === 'image' || n.kind === 'photoFrame');
  const shapeNodes = allNodes.filter(n => n.kind === 'shape');
  const decorativeNodes = allNodes.filter(n => n.kind === 'decorative');

  const criticisms: Criticism[] = [];
  const corrections: Correction[] = [];

  // Evaluate hierarchy
  const hierarchyScore = evaluateHierarchy(textNodes, sceneGraph, criticisms, corrections);

  // Evaluate balance
  const balanceScore = evaluateBalance(allNodes, sceneGraph, criticisms, corrections);

  // Evaluate alignment
  const alignmentScore = evaluateAlignment(textNodes, sceneGraph, criticisms, corrections);

  // Evaluate whitespace
  const whitespaceScore = evaluateWhitespace(allNodes, sceneGraph, criticisms, corrections);

  // Evaluate rhythm
  const rhythmScore = evaluateRhythm(textNodes, sceneGraph, criticisms, corrections);

  // Evaluate contrast
  const contrastScore = evaluateContrast(textNodes, sceneGraph, criticisms, corrections);

  // Evaluate readability
  const readabilityScore = evaluateReadability(textNodes, sceneGraph, criticisms, corrections);

  // Evaluate visual weight
  const visualWeightScore = evaluateVisualWeight(allNodes, sceneGraph, criticisms, corrections);

  // Evaluate photo quality
  const photoQualityScore = evaluatePhotoQuality(imageNodes, sceneGraph, criticisms, corrections);

  // Evaluate brand consistency
  const brandConsistencyScore = evaluateBrandConsistency(allNodes, sceneGraph, criticisms, corrections);

  // Evaluate decoration restraint
  const decorationRestraintScore = evaluateDecorationRestraint(decorativeNodes, sceneGraph, criticisms, corrections);

  // Evaluate content completeness
  const contentScore = evaluateContentCompleteness(textNodes, sceneGraph, criticisms, corrections);

  const details: QualityDetail[] = [
    { category: 'hierarchy', score: hierarchyScore, issues: criticisms.filter(c => c.category === 'hierarchy').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'hierarchy').map(c => c.suggestedAction) },
    { category: 'balance', score: balanceScore, issues: criticisms.filter(c => c.category === 'balance').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'balance').map(c => c.suggestedAction) },
    { category: 'alignment', score: alignmentScore, issues: criticisms.filter(c => c.category === 'alignment').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'alignment').map(c => c.suggestedAction) },
    { category: 'whitespace', score: whitespaceScore, issues: criticisms.filter(c => c.category === 'whitespace').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'whitespace').map(c => c.suggestedAction) },
    { category: 'rhythm', score: rhythmScore, issues: criticisms.filter(c => c.category === 'rhythm').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'rhythm').map(c => c.suggestedAction) },
    { category: 'contrast', score: contrastScore, issues: criticisms.filter(c => c.category === 'contrast').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'contrast').map(c => c.suggestedAction) },
    { category: 'readability', score: readabilityScore, issues: criticisms.filter(c => c.category === 'readability').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'readability').map(c => c.suggestedAction) },
    { category: 'visualWeight', score: visualWeightScore, issues: criticisms.filter(c => c.category === 'visualWeight').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'visualWeight').map(c => c.suggestedAction) },
    { category: 'photoQuality', score: photoQualityScore, issues: criticisms.filter(c => c.category === 'photoQuality').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'photoQuality').map(c => c.suggestedAction) },
    { category: 'brandConsistency', score: brandConsistencyScore, issues: criticisms.filter(c => c.category === 'brandConsistency').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'brandConsistency').map(c => c.suggestedAction) },
    { category: 'decorationRestraint', score: decorationRestraintScore, issues: criticisms.filter(c => c.category === 'decorationRestraint').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'decorationRestraint').map(c => c.suggestedAction) },
    { category: 'contentCompleteness', score: contentScore, issues: criticisms.filter(c => c.category === 'contentCompleteness').map(c => c.message), suggestions: criticisms.filter(c => c.category === 'contentCompleteness').map(c => c.suggestedAction) },
  ];

  const overall = Math.round(details.reduce((sum, d) => sum + d.score, 0) / details.length);

  return {
    score: { overall, ...Object.fromEntries(details.map(d => [d.category, d.score])), details } as QualityScore,
    criticisms,
    corrections,
    passed: overall >= 60,
  };
}

function flattenNodes(node: GroupNode): SceneNode[] {
  const result: SceneNode[] = [];
  for (const child of node.children) {
    if (child.kind === 'group') {
      result.push(child);
      result.push(...flattenNodes(child as GroupNode));
    } else {
      result.push(child);
    }
  }
  return result;
}

function evaluateHierarchy(textNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  if (textNodes.length === 0) return 0;

  let score = 100;
  const sizes = textNodes.map(n => n.kind === 'text' ? n.style.fontSize : 0).filter(s => s > 0).sort((a, b) => b - a);

  // Check for title dominance
  if (sizes.length >= 2) {
    const ratio = sizes[0] / sizes[1];
    if (ratio < 1.3) {
      score -= 25;
      criticisms.push({ category: 'hierarchy', severity: 'major', message: 'Title not sufficiently dominant over body text', nodeIds: [textNodes[0].id, textNodes[1].id], suggestedAction: 'Increase title size or decrease body size to create clearer hierarchy.' });
      corrections.push({ type: 'resize', nodeId: textNodes[0].id, property: 'fontSize', beforeValue: sizes[0], afterValue: Math.round(sizes[0] * 1.3), reason: 'Increase title dominance' });
    }
  }

  // Check for too many equal-sized elements
  const sizeGroups = new Map<number, number>();
  for (const s of sizes) {
    const key = Math.round(s / 2) * 2; // Group by 2px bands
    sizeGroups.set(key, (sizeGroups.get(key) || 0) + 1);
  }
  const maxEqual = Math.max(...sizeGroups.values());
  if (maxEqual > DEFAULT_CONFIG.maxEqualTextElements) {
    score -= 15;
    criticisms.push({ category: 'hierarchy', severity: 'major', message: `${maxEqual} text elements have approximately the same size, creating visual monotony`, nodeIds: [], suggestedAction: 'Vary text sizes more dramatically to create clear reading order.' });
  }

  return Math.max(0, score);
}

function evaluateBalance(allNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  const { width, height } = sg;
  const centerX = width / 2;
  const centerY = height / 2;

  // Calculate visual weight distribution (approximate)
  let leftWeight = 0, rightWeight = 0, topWeight = 0, bottomWeight = 0;

  for (const node of allNodes) {
    if (!node.rect || !node.visible) continue;
    const weight = (node.rect.w * node.rect.h) * (node.opacity / 100);
    const cx = node.rect.x + node.rect.w / 2;
    const cy = node.rect.y + node.rect.h / 2;

    if (cx < centerX) leftWeight += weight;
    else rightWeight += weight;
    if (cy < centerY) topWeight += weight;
    else bottomWeight += weight;
  }

  const horizontalRatio = leftWeight > 0 ? Math.min(leftWeight, rightWeight) / Math.max(leftWeight, rightWeight) : 0;
  const verticalRatio = topWeight > 0 ? Math.min(topWeight, bottomWeight) / Math.max(topWeight, bottomWeight) : 0;

  let score = 100;
  if (horizontalRatio < 0.4) {
    score -= 20;
    criticisms.push({ category: 'balance', severity: 'major', message: 'Poster is heavily weighted to one side horizontally', nodeIds: [], suggestedAction: 'Move content to balance visual weight across the horizontal axis.' });
  }
  if (verticalRatio < 0.4) {
    score -= 15;
    criticisms.push({ category: 'balance', severity: 'major', message: 'Poster is heavily weighted to one side vertically', nodeIds: [], suggestedAction: 'Distribute content more evenly vertically.' });
  }

  return Math.max(0, score);
}

function evaluateAlignment(textNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  let score = 100;
  const { width, height } = sg;

  // Check for excessive centered alignment
  const centerAligned = textNodes.filter(n => n.kind === 'text' && n.style.align === 'center').length;
  const totalText = textNodes.length;

  if (totalText > 0 && centerAligned / totalText > DEFAULT_CONFIG.maxCenterAlignedRatio) {
    score -= 20;
    criticisms.push({ category: 'alignment', severity: 'major', message: `${Math.round(centerAligned / totalText * 100)}% of text is center-aligned, reducing visual sophistication`, nodeIds: [], suggestedAction: 'Use left alignment for most text and reserve center alignment for titles and dates only.' });
    corrections.push({ type: 'retype', nodeId: '', property: 'align', beforeValue: 'center', afterValue: 'left', reason: 'Reduce centered alignment' });
  }

  // Check that title is not too close to any edge
  const title = textNodes.find(n => n.semanticRole === 'displayTitle');
  if (title && title.rect) {
    const margin = Math.min(width, height) * DEFAULT_CONFIG.minSafeMarginRatio;
    if (title.rect.x < margin || title.rect.y < margin || title.rect.x + title.rect.w > width - margin || title.rect.y + title.rect.h > height - margin) {
      score -= 15;
      criticisms.push({ category: 'alignment', severity: 'major', message: 'Title too close to an edge', nodeIds: [title.id], suggestedAction: `Move title at least ${Math.round(margin)}px from all edges.` });
      corrections.push({ type: 'reposition', nodeId: title.id, property: 'rect', beforeValue: title.rect, afterValue: { ...title.rect, x: Math.max(margin, title.rect.x), y: Math.max(margin, title.rect.y) }, reason: 'Move title away from edge' });
    }
  }

  return Math.max(0, score);
}

function evaluateWhitespace(allNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  const { width, height } = sg;
  const totalArea = width * height;

  // Calculate occupied area
  let occupiedArea = 0;
  for (const node of allNodes) {
    if (!node.rect || !node.visible) continue;
    if (node.kind === 'decorative' || node.semanticRole === 'background') continue;
    occupiedArea += node.rect.w * node.rect.h;
  }

  const whitespaceRatio = 1 - (occupiedArea / totalArea);

  let score = 100;
  if (whitespaceRatio < 0.15) {
    score -= 25;
    criticisms.push({ category: 'whitespace', severity: 'critical', message: `Insufficient whitespace (${Math.round(whitespaceRatio * 100)}%), poster feels cluttered`, nodeIds: [], suggestedAction: 'Increase margins, reduce element sizes, or remove non-essential decorative elements.' });
  } else if (whitespaceRatio < 0.25) {
    score -= 10;
    criticisms.push({ category: 'whitespace', severity: 'minor', message: `Whitespace is ${Math.round(whitespaceRatio * 100)}%, could benefit from more breathing room`, nodeIds: [], suggestedAction: 'Consider increasing spacing between elements.' });
  }

  return Math.max(0, score);
}

function evaluateRhythm(textNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  let score = 100;

  // Check programme list variety
  const programmeItems = textNodes.filter(n => n.semanticRole === 'programmeItem');
  if (programmeItems.length > 1) {
    const spacing = new Set<number>();
    for (let i = 1; i < programmeItems.length; i++) {
      const prev = programmeItems[i - 1].rect;
      const curr = programmeItems[i].rect;
      spacing.add(Math.round(curr.y - prev.y - prev.h));
    }
    if (spacing.size <= 1 && spacing.size > 0) {
      score -= 10;
      criticisms.push({ category: 'rhythm', severity: 'minor', message: 'Programme items have uniform spacing, creating a plain form-like appearance', nodeIds: programmeItems.slice(0, 3).map(n => n.id), suggestedAction: 'Vary programme structure slightly - use groupings, indentation, or subtle size variations.' });
    }
  }

  // Check for repeated card shapes
  if (textNodes.length > 0) {
    const positions = textNodes.filter(n => n.kind === 'text').map(n => ({ x: n.rect.x, y: n.rect.y, w: n.rect.w, h: n.rect.h }));
    const uniformShapes = positions.filter(p => positions.filter(q => p.w === q.w && p.h === q.h).length >= 3);
    if (uniformShapes.length >= 3) {
      score -= 10;
      criticisms.push({ category: 'rhythm', severity: 'minor', message: 'Multiple elements share identical dimensions, creating a grid-like monotony', nodeIds: [], suggestedAction: 'Vary the sizes of content blocks to create a more dynamic rhythm.' });
    }
  }

  return Math.max(0, score);
}

function evaluateContrast(textNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  let score = 100;

  for (const node of textNodes) {
    if (node.kind !== 'text') continue;
    const textColor = node.style.color;
    // Find background color from parent group or nearest non-text sibling
    const bgColor = findBackgroundColor(node, sg);

    if (textColor && bgColor) {
      const ratio = calcContrast(textColor, bgColor);
      if (ratio < DEFAULT_CONFIG.minContrastRatio) {
        score -= 10;
        criticisms.push({ category: 'contrast', severity: 'critical', message: `Text "${node.name}" has poor contrast (${ratio.toFixed(1)}:1) against background`, nodeIds: [node.id], suggestedAction: `Increase text contrast to at least ${DEFAULT_CONFIG.minContrastRatio}:1 by darkening or lightening text color.` });
        corrections.push({ type: 'recolor', nodeId: node.id, property: 'color', beforeValue: textColor, afterValue: adjustContrastColor(textColor, bgColor, DEFAULT_CONFIG.minContrastRatio), reason: 'Improve text readability' });
      }
    }
  }

  return Math.max(0, score);
}

function findBackgroundColor(node: SceneNode, sg: SceneGraph): string | null {
  // Simplified - looks for nearest background/surface
  return sg.backgroundColor || '#FFFFFF';
}

function adjustContrastColor(textColor: string, bgColor: string, minRatio: number): string {
  const ratio = calcContrast(textColor, bgColor);
  if (ratio >= minRatio) return textColor;

  // Darken or lighten until contrast is sufficient
  const isDarkBg = calcContrast('#000000', bgColor) > calcContrast('#FFFFFF', bgColor);
  return isDarkBg ? '#FFFFFF' : '#000000';
}

function evaluateReadability(textNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  let score = 100;
  const { width } = sg;
  const minReadable = Math.round(width * 0.011);

  for (const node of textNodes) {
    if (node.kind !== 'text') continue;
    if (node.style.fontSize < minReadable && ['displayTitle', 'schoolIdentity', 'programmeHeading'].includes(node.semanticRole || '')) {
      score -= 10;
      criticisms.push({ category: 'readability', severity: 'major', message: `"${node.name}" is very small (${node.style.fontSize}px) for its semantic role`, nodeIds: [node.id], suggestedAction: `Increase font size to at least ${minReadable}px.` });
      corrections.push({ type: 'adjustTypography', nodeId: node.id, property: 'fontSize', beforeValue: node.style.fontSize, afterValue: minReadable, reason: 'Improve readability' });
    }
  }

  // Check line lengths
  const bodyText = textNodes.filter(n => n.semanticRole === 'programmeItem' || n.semanticRole === 'quoteMessage');
  for (const node of bodyText) {
    if (node.kind !== 'text') continue;
    const estimatedCharsPerLine = Math.floor(node.rect.w / (node.style.fontSize * 0.55));
    if (estimatedCharsPerLine > 80) {
      score -= 5;
      criticisms.push({ category: 'readability', severity: 'minor', message: `Text "${node.name}" has very long lines (approx ${estimatedCharsPerLine} chars), reducing readability`, nodeIds: [node.id], suggestedAction: 'Narrow the text column width for better readability.' });
    }
  }

  return Math.max(0, score);
}

function evaluateVisualWeight(allNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  let score = 100;
  const { width, height } = sg;

  // Check for weak focal point - no single element dominates
  const visibleNodes = allNodes.filter(n => n.visible && n.rect && n.semanticRole !== 'background' && n.semanticRole !== 'decorative');
  if (visibleNodes.length > 0) {
    const maxArea = Math.max(...visibleNodes.map(n => n.rect.w * n.rect.h));
    const totalArea = visibleNodes.reduce((sum, n) => sum + n.rect.w * n.rect.h, 0);
    const dominantRatio = maxArea / totalArea;

    if (dominantRatio < 0.2) {
      score -= 20;
      criticisms.push({ category: 'visualWeight', severity: 'critical', message: 'No dominant focal point; all elements have similar visual weight', nodeIds: [], suggestedAction: 'Increase the size/weight of the title or hero photo to create a clear focal point.' });
    }
  }

  // Check for visually empty region
  const quadrants = [
    { name: 'upper-left', x: 0, y: 0, w: width / 2, h: height / 2 },
    { name: 'upper-right', x: width / 2, y: 0, w: width / 2, h: height / 2 },
    { name: 'lower-left', x: 0, y: height / 2, w: width / 2, h: height / 2 },
    { name: 'lower-right', x: width / 2, y: height / 2, w: width / 2, h: height / 2 },
  ];

  for (const quad of quadrants) {
    const nodesInQuad = visibleNodes.filter(n => {
      const cx = (n.rect.x + n.rect.w / 2);
      const cy = (n.rect.y + n.rect.h / 2);
      return cx >= quad.x && cx < quad.x + quad.w && cy >= quad.y && cy < quad.y + quad.h;
    });
    if (nodesInQuad.length === 0) {
      score -= 5;
      criticisms.push({ category: 'visualWeight', severity: 'minor', message: `The ${quad.name} quadrant is visually empty`, nodeIds: [], suggestedAction: `Consider how the ${quad.name} region contributes to the composition, or add a design element there.` });
    }
  }

  return Math.max(0, score);
}

function evaluatePhotoQuality(imageNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  let score = 100;
  const { width } = sg;

  for (const node of imageNodes) {
    if (!node.visible || !node.rect) continue;
    // Check for tiny photographs
    const minPhotoSize = width * 0.05;
    if (node.rect.w < minPhotoSize || node.rect.h < minPhotoSize) {
      score -= 10;
      criticisms.push({ category: 'photoQuality', severity: 'major', message: `"${node.name}" frame is very small (${Math.round(node.rect.w)}x${Math.round(node.rect.h)}px)`, nodeIds: [node.id], suggestedAction: `Increase photo size or remove it if it cannot contribute meaningfully.` });
    }

    // Check for stretched images (if we have aspect ratio info)
    if (node.kind === 'image' && node.style?.aspectRatio) {
      const frameRatio = node.rect.w / node.rect.h;
      if (Math.abs(frameRatio - node.style.aspectRatio) > 0.05 && node.style.cropMode !== 'fill') {
        score -= 8;
        criticisms.push({ category: 'photoQuality', severity: 'warning', message: `"${node.name}" may appear stretched due to aspect ratio mismatch`, nodeIds: [node.id], suggestedAction: 'Adjust photo frame to better match the original aspect ratio.' });
      }
    }
  }

  return Math.max(0, score);
}

function evaluateBrandConsistency(allNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  let score = 100;

  // Check logo size
  const logos = allNodes.filter(n => n.semanticRole === 'header' || n.name?.includes('LOGO'));
  for (const logo of logos) {
    if (!logo.rect) continue;
    const logoSizeRatio = Math.max(logo.rect.w, logo.rect.h) / Math.min(sg.width, sg.height);
    if (logoSizeRatio > 0.15) {
      score -= 10;
      criticisms.push({ category: 'brandConsistency', severity: 'major', message: `Logo is oversized (${Math.round(logoSizeRatio * 100)}% of canvas dimension)`, nodeIds: [logo.id], suggestedAction: `Reduce the school logo by ${Math.round((1 - 0.12 / logoSizeRatio) * 100)}%.` });
      corrections.push({ type: 'resize', nodeId: logo.id, property: 'rect', beforeValue: logo.rect, afterValue: { ...logo.rect, w: Math.round(sg.width * 0.12), h: Math.round(logo.rect.h * (0.12 * sg.width / logo.rect.w)) }, reason: 'Reduce logo size' });
    }
  }

  // Check that brand colors are used consistently
  // (Simplified - assumes brand color checking based on available palette)
  const accentColors = allNodes
    .filter(n => n.kind === 'shape' && (n as any).style?.fill && !['#FFFFFF', '#000000'].includes((n as any).style.fill))
    .map(n => (n as any).style.fill as string);

  if (accentColors.length > 3) {
    const uniqueColors = new Set(accentColors);
    if (uniqueColors.size > 3) {
      score -= 5;
      criticisms.push({ category: 'brandConsistency', severity: 'minor', message: `${uniqueColors.size} different accent colors used, reducing brand cohesion`, nodeIds: [], suggestedAction: 'Limit accent/decoration colors to 2-3 brand-aligned hues.' });
    }
  }

  return Math.max(0, score);
}

function evaluateDecorationRestraint(decorativeNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  let score = 100;

  if (decorativeNodes.length > DEFAULT_CONFIG.maxDecorationCount) {
    score -= 20;
    criticisms.push({ category: 'decorationRestraint', severity: 'major', message: `Too many decorative elements (${decorativeNodes.length})`, nodeIds: decorativeNodes.slice(DEFAULT_CONFIG.maxDecorationCount).map(n => n.id), suggestedAction: `Remove ${decorativeNodes.length - DEFAULT_CONFIG.maxDecorationCount} non-structural decorations.` });
    corrections.push({ type: 'remove', nodeId: '', property: 'visible', beforeValue: true, afterValue: false, reason: 'Remove excessive decorations' });
  }

  // Check for overlap with content
  const contentNodes = flattenNodes(sg.root).filter(n => n.kind === 'text' || n.kind === 'image');
  for (const dec of decorativeNodes) {
    for (const content of contentNodes) {
      if (!dec.rect || !content.rect) continue;
      const overlap = rectanglesOverlap(dec.rect, content.rect);
      if (overlap && !dec.deliberateOverlap) {
        const overlapArea = intersectionArea(dec.rect, content.rect);
        if (overlapArea / (content.rect.w * content.rect.h) > 0.3) {
          score -= 8;
          criticisms.push({ category: 'decorationRestraint', severity: 'major', message: `Decoration overlaps with "${content.name}" by ${Math.round(overlapArea)}px`, nodeIds: [dec.id], suggestedAction: 'Move decoration away from content area or reduce its size.' });
        }
      }
    }
  }

  return Math.max(0, score);
}

function evaluateContentCompleteness(textNodes: SceneNode[], sg: SceneGraph, criticisms: Criticism[], corrections: Correction[]): number {
  let score = 100;

  // Check for empty text
  for (const node of textNodes) {
    if (node.kind !== 'text') continue;
    if (!node.content || node.content.trim().length === 0) {
      score -= 15;
      criticisms.push({ category: 'contentCompleteness', severity: 'critical', message: `"${node.name}" text is empty`, nodeIds: [node.id], suggestedAction: 'Fill in missing text content.' });
    }
  }

  // Check for unexplained empty panel
  const shapes = textNodes.map(n => n.kind === 'text' ? null : n).filter(Boolean);
  // (Simplified check)

  // Check programme length
  const programmeItems = textNodes.filter(n => n.semanticRole === 'programmeItem');
  if (programmeItems.length === 0) {
    // No programme shown - check if content exists
    const hasContent = textNodes.filter(n => n.content && n.content.trim().length > 0).length > 1;
    if (!hasContent) {
      criticisms.push({ category: 'contentCompleteness', severity: 'info', message: 'Poster contains very little content', nodeIds: [], suggestedAction: 'Consider adding programme or message content.' });
    }
  }

  return Math.max(0, score);
}

function rectanglesOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function intersectionArea(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

export function summarizeCritique(result: CritiqueResult): string {
  const lines: string[] = [
    `Design Critic Report`,
    `====================`,
    `Overall Score: ${result.score.overall}/100 ${result.passed ? '(PASSED)' : '(NEEDS WORK)'}`,
    ``,
    `Detail Scores:`,
  ];

  for (const detail of (result.score as any).details as QualityDetail[]) {
    lines.push(`  ${detail.category.padEnd(20)} ${detail.score}/100`);
    if (detail.issues.length > 0) {
      for (const issue of detail.issues.slice(0, 3)) {
        lines.push(`    - ${issue}`);
      }
    }
  }

  if (result.corrections.length > 0) {
    lines.push(``, `CORRECTIONS APPLIED (${result.corrections.length}):`);
    for (const c of result.corrections.slice(0, 10)) {
      lines.push(`  ${c.type.padEnd(20)} ${c.nodeId}: ${c.property} → ${JSON.stringify(c.afterValue)} (${c.reason})`);
    }
  }

  return lines.join('\n');
}