import { psRunJsx, psReadLayers } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';

export async function batch(descriptors: any[], _options: any = {}): Promise<any> {
  return psRunJsx(JSON.stringify(descriptors));
}

export async function selectLayer(layerId: number): Promise<void> {
  await psRunJsx(generateJsx.selectLayer(layerId));
}

export async function layerDetails(documentId: number, layerId: number): Promise<any> {
  const data = await psReadLayers(documentId);
  return data.layers?.find((l: any) => l.id === layerId) || {};
}

export async function translateAndScale(layerId: number, dx: number, dy: number, scale = 1): Promise<void> {
  await psRunJsx(generateJsx.translateAndScale(layerId, dx, dy, scale));
}

export async function replaceSmartObject(layerId: number, filePath: string): Promise<void> {
  await psRunJsx(generateJsx.replaceSmartObject(layerId, filePath));
}

export async function placeEmbedded(filePath: string): Promise<any> {
  const result = await psRunJsx(generateJsx.placeEmbedded(filePath));
  const idMatch = result.stdout?.match(/LAYER_ID:(\d+)/);
  return { id: idMatch ? Number(idMatch[1]) : -1 };
}
