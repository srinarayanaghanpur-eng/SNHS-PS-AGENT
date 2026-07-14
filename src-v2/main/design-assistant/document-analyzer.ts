// Document analyzer.
//
// Normalises the raw JSON produced by the assistant's analyzer JSX (which reads
// the active document non-destructively) into a typed SceneGraph. The raw JSX
// output uses a compact shape; this converts it to the richer SceneLayer form
// with derived geometry (x/y/width/height, z-order).

import { z } from 'zod';
import type { LayerType, SceneGraph, SceneLayer } from './types';

const rawBounds = z.object({ left: z.number(), top: z.number(), right: z.number(), bottom: z.number() }).nullable();
const rawLayer: z.ZodType<any> = z.lazy(() => z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  parentPath: z.string().default(''),
  parentId: z.number().nullable().default(null),
  depth: z.number().default(0),
  bounds: rawBounds,
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  opacity: z.number().default(100),
  blendMode: z.string().default('normal'),
  text: z.string().nullable().default(null),
  fontName: z.string().nullable().default(null),
  fontSize: z.number().nullable().default(null),
  textColorHex: z.string().nullable().default(null),
  smartObject: z.boolean().default(false),
  linkedSmartObject: z.boolean().default(false),
  clipping: z.boolean().default(false),
  mask: z.boolean().default(false),
  adjustmentType: z.string().nullable().default(null),
  active: z.boolean().default(false),
  children: z.array(rawLayer).default([]),
}));

export const rawAnalysisSchema = z.object({
  success: z.literal(true),
  stage: z.literal('completed'),
  document: z.object({
    name: z.string(),
    path: z.string().default(''),
    saved: z.boolean().default(false),
    width: z.number(),
    height: z.number(),
    resolution: z.number(),
  }),
  layers: z.array(rawLayer),
  activeLayerId: z.number().nullable().default(null),
});
export type RawAnalysis = z.infer<typeof rawAnalysisSchema>;

const TYPE_MAP: Record<string, LayerType> = {
  group: 'group', text: 'text', smartObject: 'smartObject', shape: 'shape',
  pixel: 'pixel', adjustment: 'adjustment', other: 'other',
};

function convert(raw: any, zCounter: { n: number }): SceneLayer {
  const b = raw.bounds;
  const width = b ? b.right - b.left : 0;
  const height = b ? b.bottom - b.top : 0;
  const layer: SceneLayer = {
    id: raw.id,
    name: raw.name,
    parentPath: raw.parentPath ?? '',
    parentId: raw.parentId ?? null,
    type: TYPE_MAP[raw.type] ?? 'other',
    depth: raw.depth ?? 0,
    zOrder: zCounter.n++,
    bounds: b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : null,
    width, height,
    x: b ? b.left : 0,
    y: b ? b.top : 0,
    visible: raw.visible ?? true,
    opacity: raw.opacity ?? 100,
    blendMode: raw.blendMode ?? 'normal',
    locked: raw.locked ?? false,
    smartObject: raw.smartObject ?? false,
    linkedSmartObject: raw.linkedSmartObject ?? false,
    clippingMask: raw.clipping ?? false,
    hasMask: raw.mask ?? false,
    adjustmentType: raw.adjustmentType ?? null,
    text: raw.text ?? null,
    fontName: raw.fontName ?? null,
    fontSize: raw.fontSize ?? null,
    textColorHex: raw.textColorHex ?? null,
    active: raw.active ?? false,
    children: [],
  };
  layer.children = (raw.children ?? []).map((c: any) => convert(c, zCounter));
  return layer;
}

export function buildSceneGraph(raw: unknown): SceneGraph {
  const parsed = rawAnalysisSchema.parse(raw);
  const zCounter = { n: 0 };
  const layers = parsed.layers.map((l) => convert(l, zCounter));
  let activeLayerId = parsed.activeLayerId;
  if (activeLayerId == null) {
    const found = flatten(layers).find((l) => l.active);
    activeLayerId = found ? found.id : null;
  }
  return { document: parsed.document, layers, activeLayerId };
}

export function flatten(layers: SceneLayer[], acc: SceneLayer[] = []): SceneLayer[] {
  for (const l of layers) { acc.push(l); if (l.children.length) flatten(l.children, acc); }
  return acc;
}

export function findLayer(scene: SceneGraph, id: number): SceneLayer | null {
  return flatten(scene.layers).find((l) => l.id === id) ?? null;
}
