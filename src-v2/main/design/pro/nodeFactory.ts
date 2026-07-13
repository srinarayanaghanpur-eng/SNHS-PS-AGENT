// Scene Node Factory
// Helper functions to create scene graph nodes consistently.

import type { SceneGraph, GroupNode, SceneNode, TextNode, ImageNode, ShapeNode, GradientNode, LineNode, Rect, TextStyle, ImageStyle, ShapeStyle, GradientDef, LineStyle, Effects, SemanticRole, DesignFamily } from './sceneGraph';
import type { DerivedPalette } from './colour';
import type { FontPairing, FontInfo } from './typography';

export interface ContentInput {
  school: { name: string; address: string; phone: string; academicYear: string; logoPath?: string; leadLogoPath?: string };
  headline: string;
  subheadline?: string;
  message?: string;
  details?: string;
  venue?: string;
  programme?: string[];
  management?: { chairman?: { show: boolean; asset?: { path: string }; name?: string; designation?: string }; principal?: { show: boolean; asset?: { path: string }; name?: string; designation?: string } };
  leadBranding?: string;
}

let _nodeIdCounter = 0;

export function nextNodeId(): string {
  return `n_${++_nodeIdCounter}`;
}

export function resetNodeIdCounter(): void {
  _nodeIdCounter = 0;
}

export function makeSceneGraph(
  width: number,
  height: number,
  palette: DerivedPalette,
  designFamily: DesignFamily,
  seed: number
): SceneGraph {
  return {
    width,
    height,
    dpi: 72,
    colorMode: 'RGB',
    backgroundColor: palette.background,
    root: {
      id: 'root',
      kind: 'group',
      name: 'Poster Root',
      parentId: undefined,
      zIndex: 0,
      visible: true,
      opacity: 100,
      rotation: 0,
      transformOrigin: { x: 0.5, y: 0.5 },
      rect: { x: 0, y: 0, w: width, h: height },
      children: [],
      layout: 'absolute',
    },
    version: 2,
    seed,
    designFamily,
    colorDirection: palette.direction,
  };
}

export function makeGroup(
  name: string,
  semanticRole: SemanticRole,
  x: number,
  y: number,
  w: number,
  h: number,
  zIndex: number
): GroupNode {
  return {
    id: nextNodeId(),
    kind: 'group',
    semanticRole,
    name,
    parentId: undefined,
    zIndex,
    visible: true,
    opacity: 100,
    rotation: 0,
    transformOrigin: { x: 0.5, y: 0.5 },
    rect: { x, y, w, h },
    children: [],
    layout: 'absolute',
  };
}

export function makeText(
  name: string,
  semanticRole: SemanticRole,
  content: string,
  rect: Rect,
  typography: FontPairing,
  roleKey: keyof FontPairing['roles'],
  palette: DerivedPalette,
  zIndex: number,
  overrides?: Partial<TextStyle>
): TextNode {
  const role = typography?.roles?.[roleKey];
  const defaultFont = { family: 'Arial', postScriptName: 'ArialMT', weight: 400 } as FontInfo;
  const colorRoleMap: Record<string, string | undefined> = palette ? {
    primary: palette.textPrimary,
    secondary: palette.textSecondary,
    accent: palette.accent,
    muted: palette.textMuted,
    'on-dark': palette.textOnDark,
    'on-light': palette.textOnLight,
  } : {};

  return {
    id: nextNodeId(),
    kind: 'text',
    semanticRole,
    name,
    parentId: undefined,
    zIndex,
    visible: true,
    opacity: 100,
    rotation: 0,
    transformOrigin: { x: 0.5, y: 0.5 },
    rect,
    content,
    style: {
      fontFamily: role?.font?.family || defaultFont.family,
      fontPostScriptName: role?.font?.postScriptName || defaultFont.postScriptName,
      fontWeight: role?.weight || 400,
      fontSize: overrides?.fontSize || role?.size || 48,
      minFontSize: overrides?.minFontSize || role?.minSize || 12,
      maxFontSize: overrides?.maxFontSize || role?.maxSize || undefined,
      lineHeight: overrides?.lineHeight || role?.lineHeight || 1.2,
      tracking: overrides?.tracking ?? role?.tracking ?? 0,
      textCase: overrides?.textCase || role?.textCase || 'none',
      align: overrides?.align || 'left',
      verticalAlign: overrides?.verticalAlign || 'top',
      color: overrides?.color || (role ? colorRoleMap[role.colorRole] : undefined) || palette?.textPrimary || '#000000',
      maxLines: overrides?.maxLines || 99,
      wrap: overrides?.wrap !== false,
    },
    metadata: {},
  } as TextNode;
}

export function makeImage(
  name: string,
  semanticRole: SemanticRole,
  assetPath: string,
  rect: Rect,
  cropMode: 'cover' | 'contain' | 'fill',
  maskShape: 'rect' | 'rounded' | 'circle' | 'ellipse' | 'none',
  zIndex: number,
  palette: DerivedPalette,
  overrides?: Partial<ImageStyle>
): ImageNode {
  return {
    id: nextNodeId(),
    kind: 'image',
    semanticRole,
    name,
    parentId: undefined,
    zIndex,
    visible: true,
    opacity: overrides?.opacity || 100,
    rotation: overrides?.rotation || 0,
    transformOrigin: { x: 0.5, y: 0.5 },
    rect,
    style: {
      assetPath,
      aspectRatio: overrides?.aspectRatio || (rect.w / rect.h) || 1,
      focalPoint: overrides?.focalPoint || { x: 0.5, y: 0.38 },
      cropMode: overrides?.cropMode || cropMode,
      maskShape: overrides?.maskShape || maskShape,
      maskRadius: overrides?.maskRadius || (maskShape === 'rounded' ? Math.min(rect.w, rect.h) * 0.06 : undefined),
      border: overrides?.border,
      shadow: overrides?.shadow || { color: '#000000', opacity: 25, distance: 6, blur: 14, angle: 120 },
      blendMode: overrides?.blendMode,
      opacity: overrides?.opacity || 100,
      overlay: overrides?.overlay,
      grayscale: overrides?.grayscale,
      duotone: overrides?.duotone,
      blurBackground: overrides?.blurBackground,
    },
    metadata: {},
  } as ImageNode;
}

export function makeShape(
  name: string,
  semanticRole: SemanticRole,
  rect: Rect,
  style: ShapeStyle,
  zIndex: number,
  overrides?: Partial<ShapeNode>
): ShapeNode {
  return {
    id: nextNodeId(),
    kind: 'shape',
    semanticRole,
    name,
    parentId: undefined,
    zIndex,
    visible: overrides?.visible !== false,
    opacity: overrides?.opacity || 100,
    rotation: overrides?.rotation || 0,
    transformOrigin: { x: 0.5, y: 0.5 },
    rect,
    shapeType: overrides?.shapeType || 'rect',
    style: {
      fill: style.fill,
      stroke: style.stroke,
      radius: style.radius,
    },
    metadata: overrides?.metadata || {},
  } as ShapeNode;
}

export function makeGradient(
  name: string,
  semanticRole: SemanticRole,
  rect: Rect,
  gradient: GradientDef,
  zIndex: number,
  opacity = 100
): GradientNode {
  return {
    id: nextNodeId(),
    kind: 'gradient',
    semanticRole,
    name,
    parentId: undefined,
    zIndex,
    visible: true,
    opacity,
    rotation: 0,
    transformOrigin: { x: 0.5, y: 0.5 },
    rect,
    gradient,
    metadata: {},
  } as GradientNode;
}

export function makeLine(
  name: string,
  semanticRole: SemanticRole,
  rect: Rect,
  color: string,
  width: number,
  zIndex: number
): LineNode {
  return {
    id: nextNodeId(),
    kind: 'line',
    semanticRole,
    name,
    parentId: undefined,
    zIndex,
    visible: true,
    opacity: 100,
    rotation: 0,
    transformOrigin: { x: 0.5, y: 0.5 },
    rect,
    start: { x: rect.x, y: rect.y },
    end: { x: rect.x + rect.w, y: rect.y },
    style: { color, width, cap: 'round' },
    metadata: {},
  } as LineNode;
}

export function makeGradientDef(
  type: 'linear' | 'radial' | 'angular',
  stops: { color: string; position: number; opacity?: number }[],
  angle?: number
): GradientDef {
  return { type, stops, angle };
}

export function makeEffects(shadow?: Effects['shadow'], glow?: Effects['glow'], stroke?: Effects['stroke']): Effects {
  return { shadow, glow, stroke };
}