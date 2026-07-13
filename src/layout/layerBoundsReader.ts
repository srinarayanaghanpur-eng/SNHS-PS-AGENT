import type { ClassifiedLayer } from '../types';
import { getLayerBounds } from '../photoshop/layerLookup';
import { log } from '../utils/logger';

export async function readLayerBounds(docId: number, layerId: number): Promise<{ left: number; top: number; right: number; bottom: number; width: number; height: number }> {
  const bounds = await getLayerBounds(docId, layerId);
  if (!bounds) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  return bounds;
}

export async function refreshAllBounds(docId: number, manifestLayers: ClassifiedLayer[]): Promise<ClassifiedLayer[]> {
  const updated: ClassifiedLayer[] = [];
  for (const layer of manifestLayers) {
    const bounds = await readLayerBounds(docId, layer.layerId);
    updated.push({
      ...layer,
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height },
      boundsNoEffects: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height },
    });
    log('info', 'refreshAllBounds', `Layer ${layer.path} bounds: ${Math.round(bounds.width)}x${Math.round(bounds.height)} @ ${Math.round(bounds.left)},${Math.round(bounds.top)}`);
  }
  return updated;
}
