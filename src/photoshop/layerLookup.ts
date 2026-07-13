import { psReadLayers } from '../bridge/apiClient';

export async function findLayer(docId: number, layerId: number): Promise<any> {
  const data = await psReadLayers(docId);
  return data.layers?.find((l: any) => l.id === layerId) || null;
}

export async function descendants(parentLayerId: number): Promise<any[]> {
  const data = await psReadLayers();
  return data.layers?.filter((l: any) => l.path?.includes(String(parentLayerId))) || [];
}

export async function getLayerBounds(docId: number, layerId: number): Promise<{ left: number; top: number; right: number; bottom: number; width: number; height: number } | null> {
  const data = await psReadLayers(docId);
  const b = data.bounds?.find((b: any) => b.id === layerId);
  if (b) return { ...b, width: b.right - b.left, height: b.bottom - b.top };
  return null;
}
