import type { LayerSnapshot, LayerType, Rect, TextMetadata } from '../types';
import { psReadLayers } from '../bridge/apiClient';

const n = (v: any) => typeof v === 'number' ? v : Number(v?._value ?? v?.value ?? 0);
const rect = (b: any): Rect => {
  const left = n(b?.left), top = n(b?.top), right = n(b?.right), bottom = n(b?.bottom);
  return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
};

function kind(layer: any, detail?: any): LayerType {
  const k = String(layer.kind ?? '').toLowerCase();
  if (k.includes('group')) return 'group';
  if (k.includes('text')) return 'text';
  if (detail?.smartObject || k.includes('smart')) return 'smartObject';
  if (k.includes('solid') || k.includes('gradient') || k.includes('pattern')) return 'shape';
  if (k.includes('adjust')) return 'adjustment';
  if (layer.isBackground) return 'background';
  if (k.includes('pixel')) return 'pixel';
  return 'other';
}

export function readLayerTree(layers: any[], docId: number): LayerSnapshot[] {
  let done = 0;
  function walk(entries: any[], parentPath: string | null, depth: number): LayerSnapshot[] {
    const out: LayerSnapshot[] = [];
    const ids = entries.map((l: any) => Number(l.id));
    for (let i = 0; i < entries.length; i++) {
      const l = entries[i];
      const path = parentPath ? `${parentPath} > ${l.name}` : String(l.name);
      const children = l.layers ? Array.from(l.layers) : [];
      const snap: LayerSnapshot = {
        layerId: Number(l.id),
        name: String(l.name),
        path,
        parentPath,
        parentGroup: parentPath?.split(' > ').at(-1) ?? null,
        depth,
        type: kind(l),
        bounds: rect(l),
        boundsNoEffects: rect(l),
        visible: Boolean(l.visible ?? false),
        opacity: n(l.opacity ?? 100),
        blendMode: String(l.blendMode ?? 'normal'),
        locked: Boolean(l.locked ?? false),
        locks: { all: false, pixels: false, position: false, transparent: false },
        clipping: false,
        masks: { pixel: false, vector: false, filter: false },
        smartObject: false,
        text: undefined,
        children: [],
        childIds: children.map((c: any) => Number(c.id)),
        siblingIds: ids.filter(id => id !== Number(l.id)),
        zIndex: i,
      };
      snap.children = walk(children, path, depth + 1);
      out.push(snap);
      done++;
    }
    return out;
  }
  return walk(layers, null, 0);
}

export function flattenLayers(tree: LayerSnapshot[]): LayerSnapshot[] {
  return tree.flatMap(l => [l, ...flattenLayers(l.children)]);
}

export async function fetchLayerInfo(docId: number): Promise<{
  hierarchy: LayerSnapshot[];
  layers: LayerSnapshot[];
}> {
  const data = await psReadLayers(docId);
  const rawLayers = data.layers || [];
  const rawBounds = data.bounds || [];
  const rawTexts = data.texts || [];

  const layersWithBounds = rawLayers.map((l: any) => {
    const b = rawBounds.find((bx: any) => bx.id === l.id);
    const t = rawTexts.find((tx: any) => tx.id === l.id);
    return {
      ...l,
      bounds: b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : undefined,
      textItem: t ? { contents: t.contents } : undefined,
    };
  });

  const hierarchy = buildHierarchy(layersWithBounds, null, 0);
  const flat = flattenLayers(hierarchy);
  return { hierarchy, layers: flat };
}

function buildHierarchy(layers: any[], parentPath: string | null, depth: number): LayerSnapshot[] {
  return layers.map((l, i) => {
    const path = parentPath ? `${parentPath} > ${l.name}` : String(l.name);
    return {
      layerId: Number(l.id),
      name: String(l.name),
      path,
      parentPath,
      parentGroup: parentPath?.split(' > ').at(-1) ?? null,
      depth,
      type: kind(l),
      bounds: l.bounds || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
      boundsNoEffects: l.bounds || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
      visible: Boolean(l.visible ?? false),
      opacity: n(l.opacity ?? 100),
      blendMode: 'normal',
      locked: Boolean(l.locked ?? false),
      locks: { all: false, pixels: false, position: false, transparent: false },
      clipping: false,
      masks: { pixel: false, vector: false, filter: false },
      smartObject: l.type === 'smartObject',
      text: l.textItem ? { contents: l.textItem.contents, font: '', size: 0, alignment: '' } : undefined,
      children: [],
      childIds: [],
      siblingIds: [],
      zIndex: i,
    };
  });
}
