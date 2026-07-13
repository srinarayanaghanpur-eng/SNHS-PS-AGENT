// Layout Solver
// Constraint-based layout engine for professional poster composition.

import { log } from '../../logger';
import type { SceneNode, GroupNode, Rect, Constraints, SceneGraph, DesignFamily } from './sceneGraph';

export interface LayoutConstraint {
  id: string;
  type: 'position' | 'size' | 'alignment' | 'spacing' | 'containment' | 'aspectRatio' | 'priority';
  nodes: string[]; // node IDs this constraint applies to
  params: Record<string, number | string>;
  strength: 'required' | 'strong' | 'medium' | 'weak';
  active: boolean;
}

export interface LayoutContext {
  canvasWidth: number;
  canvasHeight: number;
  safeMargin: number;
  designFamily: DesignFamily;
  seed: number;
  contentNodes: Map<string, SceneNode>;
  groups: Map<string, GroupNode>;
  constraints: LayoutConstraint[];
}

export interface SolvedLayout {
  nodes: Map<string, { rect: Rect; constraints: LayoutConstraint[] }>;
  violations: ConstraintViolation[];
  iterations: number;
  converged: boolean;
}

export interface ConstraintViolation {
  constraintId: string;
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  nodeIds: string[];
  suggestedFix?: { nodeId: string; property: string; value: number };
}

const DEFAULT_SAFE_MARGIN_RATIO = 0.055;
const MIN_READABLE_SIZE_RATIO = 0.011;
const MIN_SPACING_RATIO = 0.015;

export function createLayoutContext(
  canvasWidth: number,
  canvasHeight: number,
  designFamily: DesignFamily,
  seed: number
): LayoutContext {
  const safeMargin = Math.round(Math.min(canvasWidth, canvasHeight) * DEFAULT_SAFE_MARGIN_RATIO);
  
  return {
    canvasWidth,
    canvasHeight,
    safeMargin,
    designFamily,
    seed,
    contentNodes: new Map(),
    groups: new Map(),
    constraints: [],
  };
}

export function addNodeToContext(ctx: LayoutContext, node: SceneNode): void {
  if (node.kind === 'group') {
    ctx.groups.set(node.id, node);
    for (const child of node.children) {
      addNodeToContext(ctx, child);
    }
  } else {
    ctx.contentNodes.set(node.id, node);
  }
}

export function buildConstraintsForFamily(ctx: LayoutContext, family: DesignFamily): LayoutConstraint[] {
  const constraints: LayoutConstraint[] = [];
  const { canvasWidth, canvasHeight, safeMargin, seed } = ctx;
  const contentWidth = canvasWidth - safeMargin * 2;
  const contentHeight = canvasHeight - safeMargin * 2;
  
  // Canvas boundary constraints (required)
  constraints.push({
    id: 'canvas-bounds',
    type: 'containment',
    nodes: Array.from(ctx.contentNodes.keys()),
    params: { left: 0, top: 0, right: canvasWidth, bottom: canvasHeight },
    strength: 'required',
    active: true,
  });
  
  // Safe margin constraints (strong)
  constraints.push({
    id: 'safe-margins',
    type: 'containment',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const node = ctx.contentNodes.get(id);
      return node && !['background', 'structuralGraphic'].includes(node.semanticRole || '');
    }),
    params: { left: safeMargin, top: safeMargin, right: canvasWidth - safeMargin, bottom: canvasHeight - safeMargin },
    strength: 'strong',
    active: true,
  });
  
  // Minimum readable text size
  constraints.push({
    id: 'min-text-size',
    type: 'size',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const node = ctx.contentNodes.get(id);
      return node?.kind === 'text';
    }),
    params: { minHeight: Math.round(canvasWidth * MIN_READABLE_SIZE_RATIO) },
    strength: 'strong',
    active: true,
  });
  
  // Minimum spacing between unrelated elements
  constraints.push({
    id: 'min-spacing',
    type: 'spacing',
    nodes: Array.from(ctx.contentNodes.keys()),
    params: { minGap: Math.round(Math.min(canvasWidth, canvasHeight) * MIN_SPACING_RATIO) },
    strength: 'medium',
    active: true,
  });
  
  // Family-specific constraints
  switch (family) {
    case 'editorial-minimal':
      constraints.push(...editorialMinimalConstraints(ctx));
      break;
    case 'bold-graphic':
      constraints.push(...boldGraphicConstraints(ctx));
      break;
    case 'photo-story':
      constraints.push(...photoStoryConstraints(ctx));
      break;
  }
  
  // Hierarchy constraints (title > subtitle > body)
  addHierarchyConstraints(constraints, ctx);
  
  // Alignment constraints
  addAlignmentConstraints(constraints, ctx);
  
  // Footer always visible
  constraints.push({
    id: 'footer-visibility',
    type: 'containment',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const node = ctx.contentNodes.get(id);
      return node?.semanticRole?.startsWith('footer');
    }),
    params: { bottom: canvasHeight - safeMargin, top: canvasHeight - contentHeight * 0.15 },
    strength: 'required',
    active: true,
  });
  
  return constraints;
}

function editorialMinimalConstraints(ctx: LayoutContext): LayoutConstraint[] {
  const { canvasWidth, canvasHeight, safeMargin, seed } = ctx;
  const constraints: LayoutConstraint[] = [];
  
  // Asymmetric grid - title left, content right, or vice versa
  const titleLeft = seed % 2 === 0;
  const gridCols = 12;
  const colWidth = (canvasWidth - safeMargin * 2) / gridCols;
  
  // Title area: 7-8 columns on one side
  constraints.push({
    id: 'editorial-title-zone',
    type: 'position',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.semanticRole === 'displayTitle' || n?.semanticRole === 'subtitle';
    }),
    params: {
      x: titleLeft ? safeMargin : safeMargin + colWidth * 5,
      width: colWidth * 7,
    },
    strength: 'strong',
    active: true,
  });
  
  // Content area opposite title
  constraints.push({
    id: 'editorial-content-zone',
    type: 'position',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return ['programmeItem', 'programmeHeading', 'quoteMessage'].includes(n?.semanticRole || '');
    }),
    params: {
      x: titleLeft ? safeMargin + colWidth * 5 : safeMargin,
      width: colWidth * 7,
    },
    strength: 'strong',
    active: true,
  });
  
  // Thin rules instead of heavy panels
  constraints.push({
    id: 'editorial-thin-rules',
    type: 'size',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.kind === 'shape' && n.semanticRole === 'structuralGraphic';
    }),
    params: { maxHeight: 2 },
    strength: 'medium',
    active: true,
  });
  
  // No large rounded panels
  constraints.push({
    id: 'editorial-no-heavy-panels',
    type: 'size',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.kind === 'shape' && (n as any).style?.fill && (n as any).metadata?.panel === true;
    }),
    params: { maxHeight: canvasHeight * 0.3 },
    strength: 'medium',
    active: true,
  });
  
  // Generous whitespace
  constraints.push({
    id: 'editorial-whitespace',
    type: 'spacing',
    nodes: Array.from(ctx.contentNodes.keys()),
    params: { minGap: Math.round(Math.min(canvasWidth, canvasHeight) * 0.03) },
    strength: 'strong',
    active: true,
  });
  
  return constraints;
}

function boldGraphicConstraints(ctx: LayoutContext): LayoutConstraint[] {
  const { canvasWidth, canvasHeight, safeMargin, seed } = ctx;
  const constraints: LayoutConstraint[] = [];
  
  // Split composition - diagonal, vertical, or horizontal
  const splitType = seed % 3; // 0=diagonal, 1=vertical, 2=horizontal
  
  if (splitType === 0) {
    // Diagonal split
    constraints.push({
      id: 'bold-diagonal-split',
      type: 'position',
      nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
        const n = ctx.contentNodes.get(id);
        return n?.semanticRole === 'displayTitle' || n?.semanticRole === 'background';
      }),
      params: { angle: seed % 2 === 0 ? 45 : -45 },
      strength: 'strong',
      active: true,
    });
  } else if (splitType === 1) {
    // Vertical split - left/right color blocks
    constraints.push({
      id: 'bold-vertical-split',
      type: 'position',
      nodes: Array.from(ctx.contentNodes.keys()),
      params: { splitX: canvasWidth * 0.4 },
      strength: 'strong',
      active: true,
    });
  } else {
    // Horizontal split - top/bottom
    constraints.push({
      id: 'bold-horizontal-split',
      type: 'position',
      nodes: Array.from(ctx.contentNodes.keys()),
      params: { splitY: canvasHeight * 0.55 },
      strength: 'strong',
      active: true,
    });
  }
  
  // Oversized title
  constraints.push({
    id: 'bold-oversized-title',
    type: 'size',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.semanticRole === 'displayTitle';
    }),
    params: { minHeight: canvasHeight * 0.12, maxHeight: canvasHeight * 0.25 },
    strength: 'strong',
    active: true,
  });
  
  // Knockout text on colored shapes
  constraints.push({
    id: 'bold-knockout-text',
    type: 'alignment',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.semanticRole === 'displayTitle' || n?.semanticRole === 'subtitle';
    }),
    params: { alignTo: 'shape', mode: 'knockout' },
    strength: 'medium',
    active: true,
  });
  
  // Cropped photos interacting with shapes
  constraints.push({
    id: 'bold-photo-shape-interaction',
    type: 'alignment',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.kind === 'image' || n?.kind === 'photoFrame';
    }),
    params: { alignTo: 'shape-edge', overlap: true },
    strength: 'medium',
    active: true,
  });
  
  // Controlled decoration only
  constraints.push({
    id: 'bold-minimal-decoration',
    type: 'size',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.semanticRole === 'decorative';
    }),
    params: { maxCount: 3, maxArea: canvasWidth * canvasHeight * 0.05 },
    strength: 'strong',
    active: true,
  });
  
  return constraints;
}

function photoStoryConstraints(ctx: LayoutContext): LayoutConstraint[] {
  const { canvasWidth, canvasHeight, safeMargin, seed } = ctx;
  const constraints: LayoutConstraint[] = [];
  
  // Hero photo full bleed or edge bleed
  constraints.push({
    id: 'photo-hero-bleed',
    type: 'containment',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.kind === 'image' && n.semanticRole === 'background';
    }),
    params: { 
      left: 0, top: 0, right: canvasWidth, bottom: canvasHeight,
      allowBleed: true 
    },
    strength: 'strong',
    active: true,
  });
  
  // Gradient overlay for readability
  constraints.push({
    id: 'photo-gradient-overlay',
    type: 'size',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.kind === 'gradient' && n.semanticRole === 'photoOverlay';
    }),
    params: { 
      cover: 'hero-photo',
      opacity: { start: 0.6, end: 0 }
    },
    strength: 'medium',
    active: true,
  });
  
  // Content integrated into photo composition
  constraints.push({
    id: 'photo-content-integration',
    type: 'alignment',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return ['displayTitle', 'subtitle', 'dateLabel', 'programmeItem', 'quoteMessage'].includes(n?.semanticRole || '');
    }),
    params: { 
      relativeTo: 'hero-photo',
      zones: ['lower-third', 'left-third', 'right-third'],
      avoidFaces: true
    },
    strength: 'strong',
    active: true,
  });
  
  // Overlapping secondary photos
  constraints.push({
    id: 'photo-secondary-overlap',
    type: 'alignment',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.kind === 'image' && n.semanticRole === 'studentPhoto';
    }),
    params: { 
      allowOverlap: true,
      overlapMargin: Math.round(Math.min(canvasWidth, canvasHeight) * 0.02),
      stackOrder: 'chronological'
    },
    strength: 'medium',
    active: true,
  });
  
  // Caption-style management names
  constraints.push({
    id: 'photo-caption-style',
    type: 'position',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.semanticRole === 'managementName' || n?.semanticRole === 'managementDesignation';
    }),
    params: { 
      position: 'below-photo',
      offset: Math.round(Math.min(canvasWidth, canvasHeight) * 0.015),
      align: 'center'
    },
    strength: 'medium',
    active: true,
  });
  
  // Narrative flow - programme items in sequence
  constraints.push({
    id: 'photo-narrative-flow',
    type: 'alignment',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.semanticRole === 'programmeItem';
    }),
    params: { 
      direction: seed % 2 === 0 ? 'vertical' : 'horizontal',
      spacing: Math.round(Math.min(canvasWidth, canvasHeight) * 0.025)
    },
    strength: 'medium',
    active: true,
  });
  
  return constraints;
}

function addHierarchyConstraints(constraints: LayoutConstraint[], ctx: LayoutContext): void {
  const { canvasWidth, canvasHeight, safeMargin } = ctx;
  
  // Title hierarchy: displayTitle > subtitle > dateLabel > others
  const hierarchyRoles = [
    { role: 'displayTitle', level: 1, sizeRatio: 0.062 },
    { role: 'subtitle', level: 2, sizeRatio: 0.026 },
    { role: 'dateLabel', level: 3, sizeRatio: 0.019 },
    { role: 'programmeHeading', level: 3, sizeRatio: 0.022 },
    { role: 'schoolIdentity', level: 2, sizeRatio: 0.035 },
    { role: 'managementName', level: 3, sizeRatio: 0.021 },
    { role: 'programmeItem', level: 4, sizeRatio: 0.019 },
    { role: 'quoteMessage', level: 3, sizeRatio: 0.022 },
    { role: 'footer', level: 5, sizeRatio: 0.017 },
  ];
  
  hierarchyRoles.forEach(({ role, level, sizeRatio }) => {
    const nodes = Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.semanticRole === role && n.kind === 'text';
    });
    
    if (nodes.length) {
      constraints.push({
        id: `hierarchy-${role}`,
        type: 'size',
        nodes,
        params: { 
          targetSize: Math.round(canvasWidth * sizeRatio),
          minSize: Math.round(canvasWidth * MIN_READABLE_SIZE_RATIO),
          level 
        },
        strength: level <= 2 ? 'strong' : 'medium',
        active: true,
      });
    }
  });
  
  // Visual weight: higher level elements should be more prominent
  constraints.push({
    id: 'visual-weight-hierarchy',
    type: 'priority',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.kind === 'text';
    }),
    params: { hierarchy: hierarchyRoles.map(h => h.role) },
    strength: 'medium',
    active: true,
  });
}

function addAlignmentConstraints(constraints: LayoutConstraint[], ctx: LayoutContext): void {
  const { canvasWidth, canvasHeight, safeMargin } = ctx;
  const contentWidth = canvasWidth - safeMargin * 2;
  
  // Left-aligned group (school identity, title, content)
  const leftAlignedRoles = ['schoolIdentity', 'displayTitle', 'subtitle', 'programmeHeading', 'programmeItem', 'quoteMessage'];
  const leftNodes = Array.from(ctx.contentNodes.keys()).filter(id => {
    const n = ctx.contentNodes.get(id);
    return leftAlignedRoles.includes(n?.semanticRole || '') && n.kind === 'text';
  });
  
  if (leftNodes.length) {
    constraints.push({
      id: 'left-alignment-group',
      type: 'alignment',
      nodes: leftNodes,
      params: { align: 'left', x: safeMargin },
      strength: 'medium',
      active: true,
    });
  }
  
  // Center-aligned group (date, footer, centered titles)
  const centerRoles = ['dateLabel', 'footerPhone', 'footerAddress', 'footerBranding'];
  const centerNodes = Array.from(ctx.contentNodes.keys()).filter(id => {
    const n = ctx.contentNodes.get(id);
    return centerRoles.includes(n?.semanticRole || '') && n.kind === 'text';
  });
  
  if (centerNodes.length) {
    constraints.push({
      id: 'center-alignment-group',
      type: 'alignment',
      nodes: centerNodes,
      params: { align: 'center', x: canvasWidth / 2 },
      strength: 'medium',
      active: true,
    });
  }
  
  // Right-aligned group (management, some footer elements)
  const rightRoles = ['managementName', 'managementDesignation'];
  const rightNodes = Array.from(ctx.contentNodes.keys()).filter(id => {
    const n = ctx.contentNodes.get(id);
    return rightRoles.includes(n?.semanticRole || '') && n.kind === 'text';
  });
  
  if (rightNodes.length) {
    constraints.push({
      id: 'right-alignment-group',
      type: 'alignment',
      nodes: rightNodes,
      params: { align: 'right', x: canvasWidth - safeMargin },
      strength: 'medium',
      active: true,
    });
  }
  
  // Baseline alignment for related text
  constraints.push({
    id: 'baseline-alignment',
    type: 'alignment',
    nodes: Array.from(ctx.contentNodes.keys()).filter(id => {
      const n = ctx.contentNodes.get(id);
      return n?.kind === 'text' && ['programmeNumber', 'programmeItem'].includes(n?.semanticRole || '');
    }),
    params: { align: 'baseline', groupBy: 'programmeItem' },
    strength: 'weak',
    active: true,
  });
}

export async function solveLayout(ctx: LayoutContext): Promise<SolvedLayout> {
  log('INFO', 'layout.solve.start', { nodes: ctx.contentNodes.size, constraints: ctx.constraints.length });
  
  const nodes = new Map(ctx.contentNodes);
  const constraints = [...ctx.constraints].filter(c => c.active);
  const violations: ConstraintViolation[] = [];
  let iterations = 0;
  const maxIterations = 50;
  const convergenceThreshold = 1; // pixels
  
  // Initialize positions from node.rect if available
  for (const [id, node] of nodes) {
    if (!node.rect || node.rect.w === 0 || node.rect.h === 0) {
      // Set initial position based on semantic role
      node.rect = estimateInitialRect(node, ctx);
    }
  }
  
  let prevPositions = new Map<string, Rect>();
  
  while (iterations < maxIterations) {
    let maxMovement = 0;
    prevPositions.clear();
    
    // Store current positions
    for (const [id, node] of nodes) {
      prevPositions.set(id, { ...node.rect });
    }
    
    // Apply constraints in strength order
    const strengthOrder = ['required', 'strong', 'medium', 'weak'];
    
    for (const strength of strengthOrder) {
      const strengthConstraints = constraints.filter(c => c.strength === strength);
      
      for (const constraint of strengthConstraints) {
        const result = applyConstraint(constraint, nodes, ctx);
        if (result.moved > maxMovement) maxMovement = result.moved;
        if (result.violations.length) violations.push(...result.violations);
      }
    }
    
    iterations++;
    
    // Check convergence
    if (maxMovement < convergenceThreshold) {
      log('INFO', 'layout.solve.converged', { iterations, violations: violations.length });
      break;
    }
    
    if (iterations === maxIterations) {
      log('WARN', 'layout.solve.max-iterations', { iterations, maxMovement });
    }
  }
  
  // Final validation pass
  const finalViolations = validateLayout(nodes, constraints, ctx);
  violations.push(...finalViolations);
  
  const solved: SolvedLayout = {
    nodes: new Map(),
    violations,
    iterations,
    converged: iterations < maxIterations,
  };
  
  for (const [id, node] of nodes) {
    solved.nodes.set(id, { rect: node.rect, constraints: constraints.filter(c => c.nodes.includes(id)) });
  }
  
  return solved;
}

function applyConstraint(
  constraint: LayoutConstraint,
  nodes: Map<string, SceneNode>,
  ctx: LayoutContext
): { moved: number; violations: ConstraintViolation[] } {
  const violations: ConstraintViolation[] = [];
  let maxMoved = 0;
  
  const affectedNodes = constraint.nodes.map(id => nodes.get(id)).filter(Boolean) as SceneNode[];
  if (affectedNodes.length === 0) return { moved: 0, violations };
  
  switch (constraint.type) {
    case 'containment': {
      const { left, top, right, bottom } = constraint.params;
      for (const node of affectedNodes) {
        if (!node.rect) continue;
        let moved = 0;
        if (node.rect.x < left) { node.rect.x = left; moved = Math.max(moved, left - node.rect.x); }
        if (node.rect.y < top) { node.rect.y = top; moved = Math.max(moved, top - node.rect.y); }
        if (node.rect.x + node.rect.w > right) { 
          node.rect.x = right - node.rect.w; 
          moved = Math.max(moved, node.rect.x + node.rect.w - right); 
        }
        if (node.rect.y + node.rect.h > bottom) { 
          node.rect.y = bottom - node.rect.h; 
          moved = Math.max(moved, node.rect.y + node.rect.h - bottom); 
        }
        maxMoved = Math.max(maxMoved, moved);
      }
      break;
    }
    
    case 'position': {
      const { x, y, splitX, splitY, angle } = constraint.params;
      for (const node of affectedNodes) {
        if (!node.rect) continue;
        let moved = 0;
        if (typeof x === 'number') { moved = Math.max(moved, Math.abs(node.rect.x - x)); node.rect.x = x; }
        if (typeof y === 'number') { moved = Math.max(moved, Math.abs(node.rect.y - y)); node.rect.y = y; }
        maxMoved = Math.max(maxMoved, moved);
      }
      break;
    }
    
    case 'size': {
      const { minWidth, maxWidth, minHeight, maxHeight, targetSize, minSize, level } = constraint.params;
      for (const node of affectedNodes) {
        if (!node.rect) continue;
        let moved = 0;
        if (node.kind === 'text' && typeof targetSize === 'number') {
          // Text size handled via fontSize, not rect
          if (node.style) {
            const oldSize = node.style.fontSize;
            node.style.fontSize = Math.max(minSize || 0, targetSize);
            moved = Math.abs(node.style.fontSize - oldSize);
          }
        } else {
          if (typeof minWidth === 'number' && node.rect.w < minWidth) { node.rect.w = minWidth; moved = minWidth - node.rect.w; }
          if (typeof maxWidth === 'number' && node.rect.w > maxWidth) { node.rect.w = maxWidth; moved = node.rect.w - maxWidth; }
          if (typeof minHeight === 'number' && node.rect.h < minHeight) { node.rect.h = minHeight; moved = Math.max(moved, minHeight - node.rect.h); }
          if (typeof maxHeight === 'number' && node.rect.h > maxHeight) { node.rect.h = maxHeight; moved = Math.max(moved, node.rect.h - maxHeight); }
        }
        maxMoved = Math.max(maxMoved, moved);
      }
      break;
    }
    
    case 'alignment': {
      const { align, x, alignTo, mode, relativeTo, zones, avoidFaces, direction, spacing, groupBy } = constraint.params;
      const positions = affectedNodes.map(n => n.rect).filter(Boolean) as Rect[];
      if (positions.length === 0) break;
      
      let targetX = x;
      if (align === 'left' && typeof x === 'number') targetX = x;
      else if (align === 'center' && typeof x === 'number') targetX = x;
      else if (align === 'right' && typeof x === 'number') targetX = x;
      else if (align === 'baseline') {
        // Align baselines of grouped elements
        const groups = new Map<string, Rect[]>();
        for (const node of affectedNodes) {
          const key = (node.metadata?.[groupBy as string]) || 'default';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(node.rect!);
        }
        for (const [, group] of groups) {
          const avgY = group.reduce((a, b) => a + b.y, 0) / group.length;
          for (const rect of group) {
            const moved = Math.abs(rect.y - avgY);
            rect.y = avgY;
            maxMoved = Math.max(maxMoved, moved);
          }
        }
      }
      
      if (typeof targetX === 'number') {
        for (const node of affectedNodes) {
          if (!node.rect) continue;
          let moved = 0;
          if (align === 'left') { moved = Math.abs(node.rect.x - targetX); node.rect.x = targetX; }
          else if (align === 'center') { moved = Math.abs((node.rect.x + node.rect.w / 2) - targetX); node.rect.x = targetX - node.rect.w / 2; }
          else if (align === 'right') { moved = Math.abs((node.rect.x + node.rect.w) - targetX); node.rect.x = targetX - node.rect.w; }
          maxMoved = Math.max(maxMoved, moved);
        }
      }
      break;
    }
    
    case 'spacing': {
      const { minGap } = constraint.params;
      // Simple pairwise spacing enforcement
      for (let i = 0; i < affectedNodes.length; i++) {
        for (let j = i + 1; j < affectedNodes.length; j++) {
          const a = affectedNodes[i].rect;
          const b = affectedNodes[j].rect;
          if (!a || !b) continue;
          
          const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
          const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
          
          if (dx < minGap && dy < minGap) {
            // Overlap or too close - push apart
            const overlapX = minGap - dx;
            const overlapY = minGap - dy;
            
            if (overlapX > overlapY) {
              // Push horizontally
              if (a.x < b.x) { a.x -= overlapX / 2; b.x += overlapX / 2; }
              else { a.x += overlapX / 2; b.x -= overlapX / 2; }
              maxMoved = Math.max(maxMoved, overlapX / 2);
            } else {
              // Push vertically
              if (a.y < b.y) { a.y -= overlapY / 2; b.y += overlapY / 2; }
              else { a.y += overlapY / 2; b.y -= overlapY / 2; }
              maxMoved = Math.max(maxMoved, overlapY / 2);
            }
          }
        }
      }
      break;
    }
    
    case 'priority': {
      // Higher priority elements get preferred positioning
      const { hierarchy } = constraint.params;
      // Sort by hierarchy level
      affectedNodes.sort((a, b) => {
        const ai = hierarchy.indexOf(a.semanticRole || '');
        const bi = hierarchy.indexOf(b.semanticRole || '');
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      break;
    }
    
    case 'aspectRatio': {
      const { ratio } = constraint.params;
      for (const node of affectedNodes) {
        if (!node.rect) continue;
        const currentRatio = node.rect.w / node.rect.h;
        if (Math.abs(currentRatio - ratio) > 0.02) {
          // Adjust height to match aspect ratio
          node.rect.h = Math.round(node.rect.w / ratio);
          maxMoved = Math.max(maxMoved, Math.abs(node.rect.h * currentRatio - node.rect.w));
        }
      }
      break;
    }
  }
  
  return { moved: maxMoved, violations };
}

function validateLayout(
  nodes: Map<string, SceneNode>,
  constraints: LayoutConstraint[],
  ctx: LayoutContext
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  
  for (const constraint of constraints) {
    if (!constraint.active) continue;
    
    const affectedNodes = constraint.nodes.map(id => nodes.get(id)).filter(Boolean) as SceneNode[];
    if (affectedNodes.length === 0) continue;
    
    switch (constraint.type) {
      case 'containment': {
        const { left, top, right, bottom } = constraint.params;
        for (const node of affectedNodes) {
          if (!node.rect) continue;
          if (node.rect.x < left - 1 || node.rect.y < top - 1 || 
              node.rect.x + node.rect.w > right + 1 || node.rect.y + node.rect.h > bottom + 1) {
            if (!node.deliberateOverlap) {
              violations.push({
                constraintId: constraint.id,
                type: 'containment',
                severity: constraint.strength === 'required' ? 'error' : 'warning',
                message: `Node ${node.name} exceeds containment bounds`,
                nodeIds: [node.id],
                suggestedFix: {
                  nodeId: node.id,
                  property: 'rect',
                  value: 0 // placeholder
                }
              });
            }
          }
        }
        break;
      }
      
      case 'size': {
        const { minHeight } = constraint.params;
        for (const node of affectedNodes) {
          if (node.kind === 'text' && node.style && typeof minHeight === 'number') {
            if (node.style.fontSize < minHeight) {
              violations.push({
                constraintId: constraint.id,
                type: 'size',
                severity: 'warning',
                message: `Text ${node.name} below minimum readable size (${node.style.fontSize}px < ${minHeight}px)`,
                nodeIds: [node.id],
                suggestedFix: { nodeId: node.id, property: 'fontSize', value: minHeight }
              });
            }
          }
        }
        break;
      }
    }
  }
  
  return violations;
}

function estimateInitialRect(node: SceneNode, ctx: LayoutContext): Rect {
  const { canvasWidth, canvasHeight, safeMargin } = ctx;
  const contentWidth = canvasWidth - safeMargin * 2;
  const contentHeight = canvasHeight - safeMargin * 2;
  
  // Default position based on semantic role
  const defaults: Record<string, { x: number; y: number; w: number; h: number }> = {
    background: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
    structuralGraphic: { x: safeMargin, y: safeMargin, w: contentWidth, h: contentHeight * 0.1 },
    header: { x: safeMargin, y: safeMargin, w: contentWidth, h: contentHeight * 0.15 },
    displayTitle: { x: safeMargin, y: safeMargin + contentHeight * 0.1, w: contentWidth, h: contentHeight * 0.12 },
    subtitle: { x: safeMargin, y: safeMargin + contentHeight * 0.22, w: contentWidth * 0.8, h: contentHeight * 0.05 },
    dateLabel: { x: canvasWidth / 2 - contentWidth * 0.2, y: safeMargin + contentHeight * 0.28, w: contentWidth * 0.4, h: contentHeight * 0.04 },
    managementPhoto: { x: safeMargin, y: contentHeight * 0.35, w: contentWidth * 0.15, h: contentWidth * 0.15 },
    managementName: { x: safeMargin + contentWidth * 0.18, y: contentHeight * 0.35, w: contentWidth * 0.3, h: contentHeight * 0.03 },
    studentPhoto: { x: safeMargin, y: contentHeight * 0.5, w: contentWidth * 0.2, h: contentWidth * 0.2 },
    programmeHeading: { x: safeMargin, y: contentHeight * 0.5, w: contentWidth, h: contentHeight * 0.04 },
    programmeItem: { x: safeMargin, y: contentHeight * 0.55, w: contentWidth, h: contentHeight * 0.03 },
    quoteMessage: { x: safeMargin, y: contentHeight * 0.7, w: contentWidth, h: contentHeight * 0.1 },
    footer: { x: 0, y: canvasHeight - contentHeight * 0.1, w: canvasWidth, h: contentHeight * 0.1 },
    footerPhone: { x: safeMargin, y: canvasHeight - contentHeight * 0.08, w: contentWidth / 2, h: contentHeight * 0.03 },
    footerAddress: { x: canvasWidth / 2, y: canvasHeight - contentHeight * 0.08, w: contentWidth / 2, h: contentHeight * 0.03 },
    decorative: { x: safeMargin, y: safeMargin, w: contentWidth * 0.1, h: contentWidth * 0.1 },
  };
  
  const role = node.semanticRole || 'default';
  const def = defaults[role] || { x: safeMargin, y: safeMargin, w: contentWidth * 0.3, h: contentHeight * 0.1 };
  
  return { ...def };
}

export function applySolvedLayout(solved: SolvedLayout, originalNodes: Map<string, SceneNode>): void {
  for (const [id, { rect }] of solved.nodes) {
    const node = originalNodes.get(id);
    if (node) {
      node.rect = { ...rect };
    }
  }
}

export function generateLayoutReport(solved: SolvedLayout, ctx: LayoutContext): string {
  const lines: string[] = [
    `Layout Solver Report`,
    `====================`,
    `Canvas: ${ctx.canvasWidth}x${ctx.canvasHeight}`,
    `Design Family: ${ctx.designFamily}`,
    `Seed: ${ctx.seed}`,
    `Iterations: ${solved.iterations}`,
    `Converged: ${solved.converged ? 'Yes' : 'No'}`,
    `Constraints: ${ctx.constraints.length}`,
    `Violations: ${solved.violations.length}`,
    ``,
  ];
  
  if (solved.violations.length > 0) {
    lines.push(`VIOLATIONS:`);
    for (const v of solved.violations) {
      lines.push(`  [${v.severity.toUpperCase()}] ${v.message} (${v.nodeIds.join(', ')})`);
    }
    lines.push(``);
  }
  
  lines.push(`NODE POSITIONS:`);
  for (const [id, { rect }] of solved.nodes) {
    lines.push(`  ${id}: (${rect.x}, ${rect.y}) ${rect.w}x${rect.h}`);
  }
  
  return lines.join('\n');
}