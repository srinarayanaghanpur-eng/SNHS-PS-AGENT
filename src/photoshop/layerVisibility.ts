import type { ClassifiedLayer, PosterData } from '../types';
import { psRunJsx } from '../bridge/apiClient';
import { generateJsx } from '../utils/jsxBuilder';

export async function setVisibility(layerId: number, visible: boolean): Promise<void> {
  await psRunJsx(generateJsx.setLayerVisibility(layerId, visible));
}

export async function setOpacity(layerId: number, opacity: number): Promise<void> {
  await psRunJsx(generateJsx.setLayerOpacity(layerId, opacity));
}

export async function smartHidePlaceholders(
  layers: ClassifiedLayer[],
  data: PosterData,
  onHide?: (layerId: number) => void
): Promise<void> {
  const usedRoles = new Set(Object.keys(data.values));
  for (const role of Object.keys(data.files)) usedRoles.add(role);

  for (const layer of layers) {
    if (layer.semanticRole === 'decorative_element' || layer.semanticRole === 'background') continue;
    if (layer.semanticRole === 'unknown') {
      await setVisibility(layer.layerId, false);
      onHide?.(layer.layerId);
      continue;
    }
    if (usedRoles.has(layer.semanticRole)) continue;
    if (layer.type === 'text' && !data.values[layer.semanticRole]) {
      await setVisibility(layer.layerId, false);
      onHide?.(layer.layerId);
    }
  }
}
